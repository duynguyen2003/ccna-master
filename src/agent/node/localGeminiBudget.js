const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const policy = require('../../../docs/ai-lab-assistant/ops/OPS-00-live.json');

const ledgerFile = path.resolve(__dirname, '../../../.tmp/ai-lab-live/budget.json');
const reserveMicroUsd = Math.ceil(
  (policy.maxInputTokens * policy.inputMicroUsdPerMillionTokens +
    policy.maxTotalOutputTokens * policy.outputIncludingThinkingMicroUsdPerMillionTokens) /
    1e6
);
const fail = (code) => Object.assign(new Error(code), { code });

function readBudget(file = ledgerFile) {
  const ledger = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (
    ledger.version !== policy.version ||
    !Array.isArray(ledger.calls) ||
    ledger.calls.length > policy.maxCalls ||
    typeof ledger.circuitOpen !== 'boolean' ||
    ledger.calls.some(
      (c) =>
        typeof c.id !== 'string' ||
        !Number.isSafeInteger(c.at) ||
        c.reservedMicroUsd !== reserveMicroUsd ||
        !['PENDING', 'COMPLETE', 'REJECTED', 'UNKNOWN', 'ERROR'].includes(c.status)
    ) ||
    new Set(ledger.calls.map((c) => c.id)).size !== ledger.calls.length
  )
    throw fail('LOCAL_BUDGET_INVALID');
  return ledger;
}

function initializeBudget(file = ledgerFile) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    `${JSON.stringify({ version: policy.version, circuitOpen: false, calls: [] }, null, 2)}\n`,
    { flag: 'wx', mode: 0o600 }
  );
}

function update(file, mutate) {
  // No automatic lock expiry/recreation: a crash is reviewed before enabling again.
  const lock = `${file}.lock`;
  const fd = fs.openSync(lock, 'wx', 0o600);
  let temporary;
  try {
    const ledger = readBudget(file);
    const result = mutate(ledger);
    temporary = `${file}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(ledger, null, 2)}\n`, {
      flag: 'wx',
      mode: 0o600,
    });
    fs.renameSync(temporary, file);
    return result;
  } finally {
    if (temporary && fs.existsSync(temporary)) fs.unlinkSync(temporary);
    fs.closeSync(fd);
    fs.unlinkSync(lock);
  }
}

function reserve(file = ledgerFile, now = Date.now()) {
  return update(file, (ledger) => {
    if (ledger.circuitOpen) throw fail('LOCAL_CIRCUIT_OPEN');
    const stamp = new Date(now).toISOString();
    const spent = (prefix) =>
      ledger.calls
        .filter((c) => new Date(c.at).toISOString().startsWith(prefix))
        .reduce((sum, c) => sum + c.reservedMicroUsd, 0);
    if (
      ledger.calls.some(
        (c) => ['PENDING', 'UNKNOWN'].includes(c.status) && now - c.at < policy.busyWindowMs
      )
    )
      throw fail('LOCAL_BUSY');
    if (ledger.calls.length && now - ledger.calls.at(-1).at < policy.minimumIntervalMs)
      throw fail('LOCAL_RATE_LIMIT');
    if (
      ledger.calls.length >= policy.maxCalls ||
      (ledger.calls.length + 1) * reserveMicroUsd > policy.lifetimeMicroUsd ||
      spent(stamp.slice(0, 10)) + reserveMicroUsd > policy.dailyMicroUsd ||
      spent(stamp.slice(0, 7)) + reserveMicroUsd > policy.monthlyMicroUsd
    )
      throw fail('LOCAL_BUDGET_EXHAUSTED');
    const id = crypto.randomUUID();
    ledger.calls.push({ id, at: now, reservedMicroUsd: reserveMicroUsd, status: 'PENDING' });
    return id;
  });
}

function finish(id, result, file = ledgerFile) {
  update(file, (ledger) => {
    const call = ledger.calls.find((c) => c.id === id);
    if (!call || call.status !== 'PENDING') throw fail('LOCAL_CALL_INVALID');
    Object.assign(call, result);
    if (result.code === 'USAGE_EXCEEDS_RESERVATION') ledger.circuitOpen = true;
    // Keep full worst-case commitment, including failures/unknown usage. No refund.
  });
}

module.exports = {
  policy,
  ledgerFile,
  reserveMicroUsd,
  readBudget,
  initializeBudget,
  reserve,
  finish,
};
