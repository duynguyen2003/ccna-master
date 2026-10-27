/* global BigInt */
const { fail } = require('./quota');
// unitUsed is separate from money settlement: fallback refunds the unit while
// unknown provider cost continues to occupy its ORIGINAL UTC money buckets.
async function settle(tx, row, cost, consumeUnit, now) {
  const reservations = await tx.aiReservation.findMany({
    where: { requestId: row.id },
    orderBy: { bucketId: 'asc' },
  });
  for (const r of reservations) {
    await tx.$queryRaw`SELECT id FROM ai_quota_buckets WHERE id = ${r.bucketId}::uuid FOR UPDATE`;
    if (['SETTLED', 'RELEASED'].includes(r.status)) continue;
    const used = r.unitUsed ?? (consumeUnit ? r.units : 0);
    const data = {};
    if (r.unitUsed === null) {
      data.reservedUnits = { decrement: r.units };
      data.usedUnits = { increment: used };
    }
    if (cost !== null) {
      if (cost > r.costMicros) throw fail('AI_BUDGET_PAUSED');
      data.reservedMicros = { decrement: r.costMicros };
      data.spentMicros = { increment: cost };
    }
    await tx.aiQuotaBucket.update({ where: { id: r.bucketId }, data });
    await tx.aiReservation.update({
      where: { id: r.id },
      data: {
        unitUsed: used,
        ...(cost === null
          ? { status: 'UNRESOLVED' }
          : {
              status: used || cost ? 'SETTLED' : 'RELEASED',
              settlementKey: `${row.id}:${r.id}:initial`,
              settledUnits: used,
              settledCostMicros: cost,
              settledAt: now,
            }),
      },
    });
  }
}
function costOf(provider, usage) {
  if (usage.status !== 'FINAL') return null;
  const rates = provider.prices;
  const numerator = ['input', 'output', 'reasoning'].reduce((sum, name) => {
    if (!Number.isSafeInteger(rates?.[name]) || rates[name] < 0) throw fail('AI_DISABLED');
    return sum + BigInt(usage[`${name}Tokens`]) * BigInt(rates[name]);
  }, 0n);
  return (numerator + 999999n) / 1000000n;
}
module.exports = { settle, costOf };
