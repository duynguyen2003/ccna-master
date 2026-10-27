// Owned local/CI test databases only; --live is one explicit bounded smoke call.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const budget = require('../node/localGeminiBudget');
const root = path.resolve(__dirname, '../../..');
const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--live') || args.length > 1)
  throw new Error('Use no option or --live');
const live = args.includes('--live');
const env = {
  ...process.env,
  PY02_INTEGRATION: '1',
  PY02_LIVE_SMOKE: live ? '1' : '0',
  LAB_AI_MODE: 'deterministic',
};
if (live) {
  if (process.env.CI === 'true' || process.env.NODE_ENV === 'production')
    throw new Error('Live smoke is local only');
  const dotenv = require('dotenv');
  const local = dotenv.parse(fs.readFileSync(path.join(root, '.env')));
  if (!local.GEMINI_API_KEY || (local.GEMINI_MODEL && local.GEMINI_MODEL !== budget.policy.model))
    throw new Error('Local Gemini key/model configuration unavailable');
  budget.available();
  env.GEMINI_API_KEY = local.GEMINI_API_KEY;
  fs.mkdirSync(path.join(root, '.tmp/ai-lab-py02'), { recursive: true });
  env.PY02_EVIDENCE_FILE = path.join(root, '.tmp/ai-lab-py02/live-result.json');
} else {
  env.GEMINI_API_KEY = 'synthetic-py02-key-not-for-vendor';
}
const result = spawnSync(process.execPath, [path.join(__dirname, 'test-ai-lab-storage.cjs')], {
  cwd: root,
  env,
  stdio: 'inherit',
  windowsHide: true,
});
process.exitCode = result.status ?? 1;
