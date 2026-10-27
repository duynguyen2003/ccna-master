/* global BigInt */
const fail = (code) => Object.assign(new Error(code), { code });
function limitsOf(policy) {
  const l = policy.limits;
  for (const key of [
    'userMinute',
    'userDay',
    'globalDayMicros',
    'globalMonthMicros',
    'maxCostMicros',
  ])
    if (!Number.isSafeInteger(l?.[key]) || l[key] < 0) throw fail('AI_DISABLED');
  if (l.userMinute > 2147483647 || l.userDay > 2147483647) throw fail('AI_DISABLED');
  return l;
}
function windows(now) {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return {
    minute: [
      new Date(Math.floor(+now / 60000) * 60000),
      new Date(Math.floor(+now / 60000) * 60000 + 60000),
    ],
    day: [day, new Date(+day + 86400000)],
    month: [month, new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))],
  };
}
async function userQuota(tx, environment, owner, policy, now) {
  const l = limitsOf(policy);
  const [start, end] = windows(now).day;
  const b = await tx.aiQuotaBucket.findUnique({
    where: {
      scopeType_scopeKey_windowStart: {
        scopeType: 'USER_DAY',
        scopeKey: `${environment}:${owner}`,
        windowStart: start,
      },
    },
  });
  return {
    remaining: Math.max(0, l.userDay - (b?.usedUnits || 0) - (b?.reservedUnits || 0)),
    reserved: b?.reservedUnits || 0,
    resetAt: end.toISOString(),
  };
}
// Caller holds the environment admission advisory lock; every write shares one transaction.
async function reserve(tx, requestId, environment, owner, policy, now) {
  const l = limitsOf(policy);
  const w = windows(now);
  const cost = BigInt(l.maxCostMicros);
  const definitions = [
    ['GLOBAL_DAY', environment, w.day, 0, l.globalDayMicros, 0, cost, 'AI_BUDGET_PAUSED'],
    ['GLOBAL_MONTH', environment, w.month, 0, l.globalMonthMicros, 0, cost, 'AI_BUDGET_PAUSED'],
    [
      'USER_DAY',
      `${environment}:${owner}`,
      w.day,
      l.userDay,
      Number.MAX_SAFE_INTEGER,
      1,
      cost,
      'AI_QUOTA_EXHAUSTED',
    ],
    [
      'USER_MINUTE',
      `${environment}:${owner}`,
      w.minute,
      l.userMinute,
      0,
      1,
      0n,
      'AI_USER_RATE_LIMITED',
    ],
  ];
  for (const [
    scopeType,
    scopeKey,
    [windowStart, windowEnd],
    unitLimit,
    moneyLimit,
    units,
    money,
    error,
  ] of definitions) {
    const b = await tx.aiQuotaBucket.upsert({
      where: { scopeType_scopeKey_windowStart: { scopeType, scopeKey, windowStart } },
      create: {
        scopeType,
        scopeKey,
        windowStart,
        windowEnd,
        limitUnits: unitLimit,
        limitMicros: BigInt(moneyLimit),
      },
      update: {},
    });
    if (
      b.usedUnits + b.reservedUnits + units > Math.min(unitLimit, b.limitUnits) ||
      b.spentMicros + b.reservedMicros + money >
        (BigInt(moneyLimit) < b.limitMicros ? BigInt(moneyLimit) : b.limitMicros)
    )
      throw fail(error);
    await tx.aiQuotaBucket.update({
      where: { id: b.id },
      data:
        scopeType === 'USER_MINUTE'
          ? { usedUnits: { increment: 1 } }
          : { reservedUnits: { increment: units }, reservedMicros: { increment: money } },
    });
    if (scopeType !== 'USER_MINUTE')
      await tx.aiReservation.create({
        data: { requestId, bucketId: b.id, units, costMicros: money },
      });
  }
}
module.exports = { fail, limitsOf, userQuota, reserve };
