const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const budget = require('../node/localGeminiBudget');
const { explainFeedback } = require('../node/feedback');
const root = path.resolve(__dirname, '../../..');

async function main() {
  if (process.argv[2] === '--init') {
    budget.initializeBudget();
    console.log(
      'Initialized local live budget: at most 20 calls, $0.05/day, $0.10/month and lifetime.'
    );
    return;
  }
  if (process.argv[2] === '--status') {
    const ledger = budget.readBudget();
    console.log(
      JSON.stringify(
        {
          calls: ledger.calls.length,
          maxCalls: budget.policy.maxCalls,
          committedMicroUsd: ledger.calls.length * budget.reserveMicroUsd,
          circuitOpen: ledger.circuitOpen,
          latest: ledger.calls.at(-1) || null,
        },
        null,
        2
      )
    );
    return;
  }
  if (process.argv.length > 2) throw new Error('Use no argument, --init or --status');
  // Parse server files only; never initialize the app/database or print env values.
  const config = {};
  for (const file of ['.env', 'src/backend/.env']) {
    const absolute = path.join(root, file);
    if (fs.existsSync(absolute)) Object.assign(config, dotenv.parse(fs.readFileSync(absolute)));
  }
  Object.assign(config, process.env);
  const result = await explainFeedback(
    {
      checks: [
        {
          passed: false,
          message: 'PC1 cannot reach PC2 on a different IPv4 subnet.',
          hint: 'Check the default gateway and the return route.',
        },
        { passed: true, message: 'Both Ethernet interfaces are administratively enabled.' },
      ],
    },
    config
  );
  console.log(JSON.stringify(result, null, 2));
  if (result.provider !== 'gemini') process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.code || 'LOCAL_LIVE_CHECK_FAILED');
  process.exitCode = 1;
});
