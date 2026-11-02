const { isAccountActive } = require('../../backend/src/security/session');
const { fail } = require('./quota');

function adminLabService(prisma, { environment }) {
  const authorized = (principal, labId, write, fn) => {
    if (!Number.isSafeInteger(labId) || labId < 1) throw fail('AI_INVALID_REQUEST');
    return prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${principal.id} FOR SHARE`;
        const user = await tx.user.findUnique({ where: { id: principal.id } });
        if (!isAccountActive(user) || user.sessionVersion !== principal.sessionVersion)
          throw fail('UNAUTHORIZED');
        if (user.role !== 'ADMIN') throw fail('AI_NOT_ELIGIBLE');
        const lab = await tx.lab.findFirst({ where: { id: labId, deletedAt: null } });
        if (!lab) throw fail('AI_RESOURCE_NOT_FOUND');
        if (write)
          await tx.$queryRaw`SELECT environment FROM ai_runtime_policies WHERE environment = ${environment} FOR UPDATE`;
        const policy = await tx.aiRuntimePolicy.findUnique({ where: { environment } });
        return fn(tx, { lab, policy, user });
      },
      { timeout: 15000 }
    );
  };
  return {
    read(principal, labId) {
      return authorized(principal, labId, false, async (tx, { lab, policy }) => {
        const scope = {
          attempt: { labId },
          reservations: { some: { bucket: { scopeType: 'GLOBAL_DAY', scopeKey: environment } } },
        };
        const [requests, costs, unresolved, feedback] = await Promise.all([
          tx.aiRequest.count({ where: scope }),
          tx.aiProviderCall.aggregate({ where: { request: scope }, _sum: { costMicros: true } }),
          tx.aiProviderCall.count({
            where: { request: scope, usageStatus: { in: ['PENDING', 'UNRESOLVED'] } },
          }),
          tx.aiFeedback.groupBy({
            by: ['helpful'],
            where: { message: { request: scope } },
            _count: { _all: true },
          }),
        ]);
        return {
          configured: Boolean(policy),
          enabled: Boolean(policy && !policy.eligibilityRules?.disabledLabIds?.includes(labId)),
          editable: Boolean(policy && lab.labType === 'CLI_SIMULATION'),
          available: Boolean(
            policy?.admissionEnabled && policy?.dispatchEnabled && lab.labType === 'CLI_SIMULATION'
          ),
          version: policy ? policy.eligibilityRules?.labSettingsVersion || 1 : null,
          requests,
          costMicros: String(costs._sum.costMicros ?? 0),
          unresolved,
          helpful: feedback.find((item) => item.helpful)?._count._all || 0,
          unhelpful: feedback.find((item) => !item.helpful)?._count._all || 0,
        };
      });
    },
    update(principal, labId, { enabled, version }) {
      return authorized(principal, labId, true, async (tx, { lab, policy, user }) => {
        if (!policy || lab.labType !== 'CLI_SIMULATION') throw fail('AI_DISABLED');
        const rules = policy.eligibilityRules;
        const settingsVersion = rules.labSettingsVersion || 1;
        if (settingsVersion !== version) throw fail('AI_STALE_CONTEXT');
        const disabled = new Set(Array.isArray(rules.disabledLabIds) ? rules.disabledLabIds : []);
        if (enabled) disabled.delete(labId);
        else disabled.add(labId);
        const updated = await tx.aiRuntimePolicy.update({
          where: { environment },
          data: {
            updatedBy: user.id,
            eligibilityRules: {
              ...rules,
              disabledLabIds: [...disabled].sort((a, b) => a - b),
              labSettingsVersion: settingsVersion + 1,
            },
          },
        });
        return { enabled, version: updated.eligibilityRules.labSettingsVersion };
      });
    },
  };
}
module.exports = { adminLabService };
