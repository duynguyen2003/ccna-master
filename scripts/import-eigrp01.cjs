require('dotenv').config();

const { getPrisma, disconnectDatabase } = require('../src/Backend/config/database');
const engine = require('../src/Backend/simulation/networkEngine');
const { gradeAttempt } = require('../src/Backend/simulation/gradingEngine');
const { parseCliLabConfig } = require('../src/Backend/validation/cliLabSchema');
const { sanitizeHtml } = require('../src/shared/sanitizeHtml');
const { labRecord, solutionActions } = require('../src/shared/labs/eigrp01');

const LEGACY_TITLE = 'EIGRP Cơ bản & Tính năng Passive-Interface';

const verifyGoldenSolution = () => {
  const parsed = parseCliLabConfig(labRecord);
  let state = engine.initial(parsed.initialState);
  solutionActions.forEach((action) => {
    const result = engine.execute(state, action);
    if (result.isError) {
      throw new Error(`Golden solution lỗi tại ${action.deviceId}: ${action.command}: ${result.output}`);
    }
    state = result.state;
  });
  const grade = gradeAttempt(state, parsed.gradingSpec);
  if (!grade.passed || grade.score !== 100) {
    const failed = grade.checks.filter((check) => !check.passed).map((check) => check.id);
    throw new Error(`Golden solution chỉ đạt ${grade.score}%; chưa đạt: ${failed.join(', ')}`);
  }
  return { parsed, grade };
};

const main = async () => {
  const { parsed, grade } = verifyGoldenSolution();
  const prisma = getPrisma();
  const course = await prisma.course.findFirst({
    where: { id: labRecord.courseId, deletedAt: null },
    select: { id: true, title: true },
  });
  if (!course) throw new Error(`Không tìm thấy khóa học ${labRecord.courseId}`);

  const existing = await prisma.lab.findFirst({
    where: {
      deletedAt: null,
      OR: [{ title: labRecord.title }, { title: LEGACY_TITLE }],
    },
    orderBy: { id: 'asc' },
  });
  const data = {
    ...labRecord,
    title: labRecord.title,
    guideContent: sanitizeHtml(labRecord.guideContent),
    initialState: parsed.initialState,
    gradingSpec: parsed.gradingSpec,
    commandProfile: parsed.commandProfile,
    simulatorVersion: parsed.simulatorVersion,
    deletedAt: null,
  };
  const saved = existing
    ? await prisma.lab.update({ where: { id: existing.id }, data })
    : await prisma.lab.create({ data });

  console.log(
    JSON.stringify(
      {
        action: existing ? 'updated' : 'created',
        id: saved.id,
        title: saved.title,
        course: course.id,
        labType: saved.labType,
        status: saved.status,
        simulatorVersion: saved.simulatorVersion,
        goldenScore: grade.score,
      },
      null,
      2
    )
  );
};

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);
