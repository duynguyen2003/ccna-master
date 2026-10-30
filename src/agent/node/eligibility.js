// Reuse the current DB user at admission and delivery. Never trust a JWT role.
function inAiCohort(policy, user, labId) {
  const rules = policy?.eligibilityRules;
  if (Array.isArray(rules?.disabledLabIds) && rules.disabledLabIds.includes(labId)) return false;
  return Boolean(
    (rules?.adminAccess === true && user?.role === 'ADMIN') ||
    (user &&
      Array.isArray(rules?.userIds) &&
      rules.userIds.includes(user.id) &&
      Array.isArray(rules?.labIds) &&
      rules.labIds.includes(labId))
  );
}

// Admins need to enter the real lab workflow to exercise the assistant. This
// development exception is limited to the explicitly enabled test policy.
async function mayTestLockedLab(db, userId, env = process.env) {
  if (env.NODE_ENV === 'production' || env.AI_ENVIRONMENT !== 'admin-test') return false;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true, deletedAt: true },
  });
  if (user?.role !== 'ADMIN' || !user.isActive || user.deletedAt) return false;
  const policy = await db.aiRuntimePolicy.findUnique({ where: { environment: 'admin-test' } });
  return Boolean(policy?.admissionEnabled && policy.eligibilityRules?.adminAccess === true);
}

module.exports = { inAiCohort, mayTestLockedLab };
