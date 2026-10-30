const { labs } = require('../backend/src/simulation/fixtures/foundationLabs');
require('../backend/src/config/env');
const { getPrisma, disconnectDatabase } = require('../backend/src/config/database');
const { validateLabAccessPolicy } = require('../backend/src/validation/labAccessPolicy');
async function main() {
  if (process.argv.slice(2).some((arg) => arg !== '--apply'))
    throw new Error('Only --apply is supported');
  const apply = process.argv.includes('--apply');
  const db = getPrisma();
  const courses = await db.course.findMany({
    where: { code: 'ITN', deletedAt: null, status: { in: ['PUBLISHED', 'OPEN'] } },
    select: { id: true },
  });
  if (courses.length !== 1) throw new Error('Expected one published ITN course');
  const courseId = courses[0].id;
  const module = await db.module.findFirst({
    where: { courseId, deletedAt: null, lessons: { some: { deletedAt: null } } },
    orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
    include: {
      lessons: {
        where: { deletedAt: null },
        orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
        take: 1,
      },
    },
  });
  if (!module) throw new Error('ITN needs an introductory lesson');
  const results = await db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('netmaster-foundation-labs-v1', 0))::text`;
      const results = [];
      for (const fixture of labs) {
        const accessPolicy = await validateLabAccessPolicy(
          tx,
          fixture.policy(module.lessons[0].id),
          { courseId, moduleId: module.id, status: 'PUBLISHED' }
        );
        const existing = await tx.lab.findFirst({
          where: { title: fixture.data.title },
          select: { id: true },
        });
        if (existing) {
          results.push({ key: fixture.key, id: existing.id, action: 'kept' });
          continue;
        }
        if (!apply) {
          results.push({
            key: fixture.key,
            action: 'would-create',
            courseId,
            moduleId: module.id,
            accessPolicy,
          });
          continue;
        }
        const created = await tx.lab.create({
          data: { ...fixture.data, courseId, moduleId: module.id, accessPolicy },
        });
        results.push({
          key: fixture.key,
          id: created.id,
          action: 'created',
          mode: accessPolicy.mode,
        });
      }
      return results;
    },
    { timeout: 15000 }
  );
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', results }, null, 2));
}
main()
  .catch((error) => {
    console.error('Foundation lab setup failed:', error.code || error.name);
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);
