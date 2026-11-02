const crypto = require('node:crypto');
const engine = require('@ccna/shared/simulation/networkEngine');
const { gradeAttempt } = require('@ccna/shared/simulation/gradingEngine');
const { parseCliLabConfig } = require('@ccna/shared/cliLabSchema');
const lab = require('@ccna/shared/labs/eigrp01');
const { transmit } = require('@ccna/shared/simulation/networkPackets');
function verifyGoldenSolution() {
  const parsed = parseCliLabConfig(lab.labRecord);
  for (const scenario of lab.scenarios) {
    let state = engine.initial(parsed.initialState, parsed.simulatorVersion);
    for (const action of scenario.actions) {
      const result = engine.execute(state, action);
      if (result.isError)
        throw new Error(scenario.id + ': ' + action.command + ': ' + result.output);
      state = result.state;
    }
    const grade = gradeAttempt(state, parsed.gradingSpec);
    if (
      grade.passed !== scenario.expected.passed ||
      (scenario.expected.score !== undefined && grade.score !== scenario.expected.score)
    )
      throw new Error('Scenario failed: ' + scenario.id);
    for (const id of scenario.expected.failedChecks || []) {
      const check = grade.checks.find((c) => c.id === id);
      if (check?.passed !== false || check.status === 'blocked')
        throw new Error('Negative check did not fail independently: ' + id);
    }
    for (const id of scenario.expected.blockedChecks || [])
      if (grade.checks.find((c) => c.id === id)?.status !== 'blocked')
        throw new Error('Dependency was not blocked: ' + id);
    for (const probe of scenario.expected.reachable || [])
      if (!transmit(structuredClone(state), probe.deviceId, probe.destination).success)
        throw new Error('Expected raw connectivity: ' + scenario.id);
  }
  return parsed;
}
async function publishLab(prisma) {
  const parsed = verifyGoldenSolution();
  const data = { ...lab.labRecord, ...parsed };
  const contentHash = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  return prisma.$transaction(async (tx) => {
    const existing = await tx.lab.findUnique({
      where: { labKey_labVersion: { labKey: data.labKey, labVersion: data.labVersion } },
    });
    if (existing) {
      if (existing.contentHash !== contentHash)
        throw new Error('Published revision differs. Increment labVersion before importing.');
      return { action: 'unchanged', id: existing.id, labVersion: existing.labVersion };
    }
    const course = await tx.course.findFirst({ where: { id: data.courseId, deletedAt: null } });
    if (!course) throw new Error('Course missing: ' + data.courseId);
    const saved = await tx.lab.create({ data: { ...data, contentHash } });
    return { action: 'created', id: saved.id, labVersion: saved.labVersion };
  });
}
if (require.main === module) {
  require('../backend/src/config/env');
  const { getPrisma, disconnectDatabase } = require('../backend/src/config/database');
  if (process.argv.includes('--verify-only')) {
    verifyGoldenSolution();
    console.log('All EIGRP01 scenarios passed; no database writes.');
  } else
    publishLab(getPrisma())
      .then((result) => console.log(JSON.stringify(result)))
      .catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
      })
      .finally(disconnectDatabase);
}
module.exports = { verifyGoldenSolution, publishLab };
