#!/usr/bin/env node
/* eslint-env node, es2020 */
// Offline planning check, not the runtime admission/ledger implementation.
const assert = require('node:assert/strict');
const budget = require('../../../docs/ai-lab-assistant/ops/OPS-00-budget.json');
const live = require('../../../docs/ai-lab-assistant/ops/OPS-00-live.json');

assert.equal(budget.planningOnly, true);
assert.equal(budget.currency, 'USD');
assert.equal(budget.decision.mode, 'LOCAL_FAKE');
assert.equal(budget.decision.allowExternalCalls, false);
assert.equal(budget.decision.providerCallLimit, 0);
for (const field of [
  'pilotBudgetMicroUsd',
  'dailyBudgetMicroUsd',
  'monthlyBudgetMicroUsd',
  'evalBudgetMicroUsd',
]) {
  assert.equal(budget.decision[field], 0, `${field}: local/fake approval is 0 USD`);
}
for (const cost of Object.values(budget.incrementalMonthlyMicroUsd)) assert.equal(cost, 0);
for (const field of ['rpm', 'inputTpm', 'rpd'])
  assert.equal(budget.decision.accountLimits[field], null);

const sample = budget.illustration;
assert.equal(sample.isForecast, false);
const calls = sample.pilotUsers * sample.pilotDays * sample.requestsPerUserDay;
function costFor(candidate, thinkingTokens) {
  const numerator =
    BigInt(sample.inputTokens) * BigInt(candidate.inputMicroUsdPerMillionTokens) +
    BigInt(sample.visibleOutputTokens + thinkingTokens) *
      BigInt(candidate.outputIncludingThinkingMicroUsdPerMillionTokens);
  return Number((numerator + 999999n) / 1000000n);
}
for (const candidate of budget.candidateReferences) {
  assert.equal(candidate.eligibleForLive, false);
  assert.equal(candidate.maxReasoningTokens, null);
  const expected = sample.expectedMicroUsd[candidate.id];
  const perCall = costFor(candidate, sample.thinkingTokensAssumedForArithmeticOnly);
  assert.equal(perCall, expected.perCall);
  assert.equal(calls * perCall, expected.pilot);
  assert.equal(sample.evalCalls * perCall, expected.evaluation);
  // A zero-thinking illustration must not be mistaken for a worst-case reservation.
  assert.ok(costFor(candidate, 1000) > perCall);
  console.log(
    `${candidate.id}: illustration $${(perCall / 1e6).toFixed(6)}/call, ${calls} calls $${(expected.pilot / 1e6).toFixed(2)}; live ineligible.`
  );
}
console.log(
  'Historical OPS-00 fake-only worksheet verified; superseded for local feedback by OPS-00-live.json.'
);
assert.equal(live.model, 'gemini-3.5-flash-lite');
assert.equal(live.productionEnabled, false);
assert.equal(live.maxInputTokens, 6000);
assert.equal(live.maxTotalOutputTokens, 800);
const reserved = Math.ceil(
  (live.maxInputTokens * live.inputMicroUsdPerMillionTokens +
    live.maxTotalOutputTokens * live.outputIncludingThinkingMicroUsdPerMillionTokens) /
    1e6
);
assert.equal(reserved, 3800);
assert.ok(live.maxCalls * reserved <= live.lifetimeMicroUsd);
assert.equal(live.dailyMicroUsd, 50000);
assert.equal(live.monthlyMicroUsd, 100000);
assert.equal(live.lifetimeMicroUsd, 100000);
assert.equal(live.maxCalls, 20);
console.log(
  'Active local feedback policy: 20 calls maximum, $0.05/day, $0.10/month/lifetime; production disabled.'
);
