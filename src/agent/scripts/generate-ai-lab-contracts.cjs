const fs = require('node:fs');
const path = require('node:path');
const {
  VERSION,
  createSchemaDocuments,
  RequestTransitions,
  ProviderTransitions,
  ErrorStatuses,
} = require('@ccna/shared/aiLabContract');
const { buildCases, examples } = require('../contracts/ai-lab/v1/fixtures/build-cases.cjs');
const directory = path.resolve(__dirname, '../contracts/ai-lab/v1');
const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--check')) throw new Error('Supported option: --check');
const checking = args.includes('--check');
let failures = 0;
const write = (relative, value) => {
  const file = path.join(directory, relative);
  const contents = `${JSON.stringify(value, null, 2)}\n`;
  if (checking) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== contents) {
      console.error(`Contract drift: ${relative}`);
      failures += 1;
    }
  } else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents);
  }
};
const documents = createSchemaDocuments();
for (const [name, document] of Object.entries(documents))
  write(`schemas/${name}.schema.json`, document);
write('schema-index.json', {
  contractVersion: VERSION,
  jsonSchemaDraft: 'draft-07',
  schemas: Object.fromEntries(
    Object.keys(documents).map((name) => [name, `schemas/${name}.schema.json`])
  ),
});
write('state-machine.json', {
  contractVersion: VERSION,
  request: RequestTransitions,
  providerCall: ProviderTransitions,
  guardedTransitions: [
    {
      from: 'RUNNING',
      to: 'QUEUED',
      requires: ['leaseExpired', 'deadlineRemaining', 'callState=null|PLANNED'],
    },
  ],
  retryProviderAfterDispatch: false,
});
write('error-statuses.json', ErrorStatuses);
write('fixtures/cases.json', buildCases());
write('examples/create-request.json', examples.create);
write('examples/completed-response.json', { contractVersion: VERSION, data: examples.resource });
write('examples/internal-analyze.json', examples.analyze);
write('examples/provider-receipt.json', examples.receipt);
process.exitCode = failures ? 1 : 0;
if (!failures)
  console.log(
    `${checking ? 'Verified' : 'Generated'} ${Object.keys(documents).length} JSON Schemas, state machine and shared fixtures.`
  );
