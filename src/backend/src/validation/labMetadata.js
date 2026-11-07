const { z } = require('zod');
const schema = z.object({
  schemaVersion: z.coerce.number().int().min(1).max(2),
  durationMinutes: z.coerce.number().int().min(1).max(10080).nullable(),
  topics: z.array(z.string().trim().min(1).max(80)).max(30),
  guideFormat: z.enum(['html', 'markdown']),
});
function labMetadata(body, existing = {}) {
  let topics = body.topics ?? existing.topics ?? [];
  try {
    if (typeof topics === 'string') topics = JSON.parse(topics);
  } catch {
    throw Object.assign(new Error('topics phải là JSON hợp lệ'), { status: 400 });
  }
  const result = schema.safeParse({
    schemaVersion: body.schemaVersion ?? existing.schemaVersion ?? 1,
    durationMinutes:
      body.durationMinutes === ''
        ? null
        : (body.durationMinutes ?? existing.durationMinutes ?? null),
    topics,
    guideFormat: body.guideFormat ?? existing.guideFormat ?? 'html',
  });
  if (!result.success)
    throw Object.assign(new Error(result.error.issues[0].message), { status: 400 });
  return result.data;
}
module.exports = { labMetadata };
