// Run from any directory. No database, environment secrets, network, or model calls.
const fs = require('node:fs');
const path = require('node:path');
const { labs } = require('../fixtures/labs/disc03');
const { buildPublicDataset } = require('../fixtures/labs/publicFixture');

const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--check')) throw new Error('Supported option: --check');
const checkOnly = args.includes('--check');
const directory = path.resolve(__dirname, '../python/evals/fixtures/disc-03');
let mismatches = 0;
for (const lab of labs) {
  const file = path.join(directory, `${lab.id}.json`);
  const contents = `${JSON.stringify(buildPublicDataset(lab), null, 2)}\n`;
  if (checkOnly) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== contents) {
      console.error(`Fixture needs regeneration: ${lab.id}`);
      mismatches += 1;
    }
  } else {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(file, contents);
  }
}
if (mismatches) process.exitCode = 1;
else
  console.log(
    `${checkOnly ? 'Verified' : 'Generated'} ${labs.length} public datasets (${labs.reduce((sum, lab) => sum + lab.cases.length, 0)} cases).`
  );
