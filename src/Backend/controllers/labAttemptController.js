const { getPrisma } = require('../config/database');
const { z } = require('zod');
const { actionSchema } = require('../validation/cliLabSchema');
const engine = require('../simulation/networkEngine');
const { gradeAttempt } = require('../simulation/gradingEngine');
const { buildLabProgress, buildLabTasks } = require('../simulation/labProgress');
const { fail, mayAccess, withAttempt } = require('../simulation/attemptAccess');
const { explainFeedback } = require('../simulation/labFeedback');
const learningPathService = require('../services/learningPathService');
const prisma = getPrisma();
const definitionOf = (a) =>
  a.definition || { initialState: a.lab.initialState, gradingSpec: a.lab.gradingSpec };
const dto = (a, userId, deviceId) => {
  const definition = definitionOf(a);
  const progress = buildLabProgress(a.deviceState, definition.gradingSpec);
  return {
    id: a.id,
    labId: a.labId,
    ownerId: a.userId,
    isOwner: a.userId === userId,
    members: a.userId === userId ? a.members || [] : [],
    status: a.status,
    state: a.deviceState,
    prompt: engine.prompt(a.deviceState, deviceId),
    score: a.score,
    feedback: a.feedback,
    simulatorVersion: a.simulatorVersion,
    commands: a.commands || [],
    updatedAt: a.updatedAt,
    progress,
    lab: {
      id: a.labId,
      title: a.lab.title,
      objective: a.lab.objective,
      tasks: buildLabTasks(definition.gradingSpec),
    },
  };
};
const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ message: e.issues[0].message });
    if (e.status && e.status >= 400 && e.status < 500)
      return res.status(e.status).json({ code: e.code, message: e.message });
    console.error('Lab request failed:', e.code || e.name);
    res.status(500).json({
      code: 'LAB_REQUEST_FAILED',
      message: 'Không thể xử lý phiên Lab. Vui lòng thử lại.',
    });
  }
};
const ownedRead = async (id, userId) => {
  z.string().uuid().parse(id);
  const a = await prisma.labAttempt.findUnique({ where: { id }, include: { lab: true } });
  if (!mayAccess(a, userId)) throw fail(404, 'Không tìm thấy phiên Lab');
  return a;
};
module.exports.startAttempt = handle(async (req, res) => {
  const labId = z.coerce.number().int().positive().parse(req.params.labId);
  const lab = await prisma.lab.findFirst({
    where: { id: labId, deletedAt: null, status: 'PUBLISHED', labType: 'CLI_SIMULATION' },
  });
  if (!lab) throw fail(404, 'Không tìm thấy CLI Lab đã xuất bản');
  const a = await prisma.$transaction(
    async (tx) => {
      await learningPathService.assertLabAccess(tx, req.user.id, lab);
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${req.user.id}::int, ${labId}::int)::text AS locked`;
      const existing = await tx.labAttempt.findFirst({
        where: { userId: req.user.id, labId, status: 'IN_PROGRESS' },
        include: { lab: true, commands: { orderBy: { sequence: 'asc' } } },
      });
      if (existing) return existing;
      return tx.labAttempt.create({
        data: {
          userId: req.user.id,
          labId,
          definition: { initialState: lab.initialState, gradingSpec: lab.gradingSpec },
          members: [],
          deviceState: engine.initial(lab.initialState),
          simulatorVersion: lab.simulatorVersion || '1.0.0',
        },
        include: { lab: true, commands: true },
      });
    },
    { timeout: 15000, maxWait: 10000 }
  );
  res.status(201).json({ data: dto(a, req.user.id) });
});
module.exports.getAttempt = handle(async (req, res) => {
  const a = await ownedRead(req.params.attemptId, req.user.id);
  const after = z.coerce.number().int().min(0).default(0).parse(req.query.after);
  if (req.query.deviceId && !a.deviceState.devices?.[req.query.deviceId])
    throw fail(400, 'Unknown device');
  a.commands = await prisma.labCommand.findMany({
    where: { attemptId: a.id, sequence: { gt: after } },
    orderBy: { sequence: 'asc' },
    take: 500,
  });
  res.json({ data: dto(a, req.user.id, req.query.deviceId) });
});
module.exports.executeAttemptCommand = handle(async (req, res) => {
  const action = actionSchema.parse(req.body.action || { ...req.body, type: 'command' });
  const expected = z.number().int().min(0).parse(req.body.expectedRevision);
  const data = await withAttempt(prisma, req.params.attemptId, req.user.id, async (tx, a) => {
    if (a.status !== 'IN_PROGRESS') throw fail(409, 'Phiên đã kết thúc');
    if (a.deviceState.revision !== expected)
      throw fail(409, 'Cấu hình đã thay đổi; đồng bộ phiên rồi thử lại.');
    if (action.deviceId && !a.deviceState.devices?.[action.deviceId])
      throw fail(400, 'Unknown device');
    const count = await tx.labCommand.count({ where: { attemptId: a.id } });
    if (count >= 500) throw fail(409, 'Giới hạn 500 thao tác mỗi phiên');
    const result = engine.execute(a.deviceState, action);
    if (result.help) {
      return {
        event: { command: action.command, output: result.output, prompt: result.prompt },
        state: result.state,
        prompt: engine.prompt(result.state, action.deviceId),
        progress: buildLabProgress(result.state, definitionOf(a).gradingSpec),
      };
    }
    result.state = { ...result.state, revision: a.deviceState.revision + 1 };
    const event = await tx.labCommand.create({
      data: {
        attemptId: a.id,
        sequence: count + 1,
        command: action.command || '[' + action.type + ']',
        action: { ...action, actorId: req.user.id },
        mode: result.mode,
        prompt: result.prompt,
        output: result.output || '',
        isError: result.isError,
      },
    });
    await tx.labAttempt.update({ where: { id: a.id }, data: { deviceState: result.state } });
    return {
      event,
      state: result.state,
      prompt: engine.prompt(result.state, action.deviceId),
      progress: buildLabProgress(result.state, definitionOf(a).gradingSpec),
    };
  });
  res.json({ data });
});
module.exports.getAttemptCompletions = handle(async (req, res) => {
  const a = await ownedRead(req.params.attemptId, req.user.id);
  const input = z
    .string()
    .max(500)
    .parse(req.query.input || '');
  if (req.query.deviceId && !a.deviceState.devices?.[req.query.deviceId])
    throw fail(400, 'Unknown device');
  res.json({ data: engine.completions(a.deviceState, input, req.query.deviceId) });
});
module.exports.submitAttempt = handle(async (req, res) => {
  const data = await withAttempt(prisma, req.params.attemptId, req.user.id, async (tx, a) => {
    if (a.userId !== req.user.id) throw fail(403, 'Chỉ chủ phiên được nộp bài');
    if (a.status !== 'IN_PROGRESS') throw fail(409, 'Phiên đã kết thúc');
    const result = gradeAttempt(a.deviceState, definitionOf(a).gradingSpec);
    const updated = await tx.labAttempt.update({
      where: { id: a.id },
      data: {
        status: result.passed ? 'PASSED' : 'IN_PROGRESS',
        score: result.score,
        feedback: result,
        submittedAt: result.passed ? new Date() : null,
      },
    });
    const progress = result.passed
      ? await learningPathService.completeGradedLab(tx, a.userId, a.lab)
      : null;
    return {
      attempt: dto({ ...updated, lab: a.lab }, req.user.id),
      result,
      ...(progress ? { learningPath: progress.learningPath, transition: progress.transition } : {}),
    };
  });
  res.json({ data });
});
module.exports.restartAttempt = handle(async (req, res) => {
  const data = await withAttempt(prisma, req.params.attemptId, req.user.id, async (tx, a) => {
    if (a.userId !== req.user.id) throw fail(403, 'Chỉ chủ phiên được bắt đầu lại');
    if (a.status !== 'IN_PROGRESS') throw fail(409, 'Phiên đã kết thúc');
    const updated = await tx.labAttempt.update({
      where: { id: a.id },
      data: { status: 'FAILED', submittedAt: new Date() },
    });
    return dto({ ...updated, lab: a.lab, members: a.members || [], commands: [] }, req.user.id);
  });
  res.json({ data });
});
module.exports.replayAttempt = handle(async (req, res) => {
  const a = await ownedRead(req.params.attemptId, req.user.id);
  if (!a.definition)
    throw fail(409, 'Phiên cũ chưa có snapshot đề bài; hãy bắt đầu một phiên mới để dùng replay.');
  const sequence = z.coerce
    .number()
    .int()
    .min(0)
    .max(500)
    .parse(req.query.sequence || 0);
  const commands = await prisma.labCommand.findMany({
    where: { attemptId: a.id, sequence: { lte: sequence } },
    orderBy: { sequence: 'asc' },
  });
  let state = engine.initial(a.definition.initialState);
  for (const e of commands) {
    state = engine.execute(state, e.action || { type: 'command', command: e.command }).state;
    state.revision = e.sequence;
  }
  res.json({
    data: {
      state,
      sequence: commands.at(-1)?.sequence || 0,
      readOnly: true,
      progress: buildLabProgress(state, a.definition.gradingSpec),
    },
  });
});
module.exports.updateMembers = handle(async (req, res) => {
  const body = z
    .object({ userId: z.number().int().positive(), remove: z.boolean().default(false) })
    .parse(req.body);
  const data = await withAttempt(prisma, req.params.attemptId, req.user.id, async (tx, a) => {
    if (a.userId !== req.user.id) throw fail(403, 'Chỉ chủ phiên được quản lý thành viên');
    if (a.status !== 'IN_PROGRESS') throw fail(409, 'Phiên đã kết thúc');
    if (body.userId === a.userId) throw fail(400, 'Chủ phiên đã có quyền truy cập');
    if (!body.remove && !(await tx.user.findFirst({ where: { id: body.userId, deletedAt: null } })))
      throw fail(404, 'Không tìm thấy tài khoản');
    const members = (a.members || []).filter((id) => id !== body.userId);
    if (!body.remove) members.push(body.userId);
    if (members.length > 7) throw fail(400, 'Tối đa 8 thành viên gồm chủ phiên');
    await tx.labAttempt.update({ where: { id: a.id }, data: { members } });
    return { members };
  });
  res.json({ data });
});
module.exports.explainAttempt = handle(async (req, res) => {
  const a = await ownedRead(req.params.attemptId, req.user.id);
  if (!a.feedback) throw fail(400, 'Nộp bài trước để có kết quả giải thích');
  res.json({ data: await explainFeedback(a.feedback) });
});
module.exports.achievements = handle(async (req, res) => {
  const best = await prisma.labAttempt.groupBy({
    by: ['labId'],
    where: { userId: req.user.id, status: 'PASSED' },
    _max: { score: true },
  });
  const dates =
    await prisma.$queryRaw`SELECT DISTINCT (submitted_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS day FROM lab_attempts WHERE user_id = ${req.user.id} AND status = 'PASSED' ORDER BY day DESC LIMIT 366`;
  const dayMs = 86400000;
  const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  let cursor = Date.parse(today);
  let streak = 0;
  if (!dates.some((d) => d.day === today)) cursor -= dayMs;
  const days = new Set(dates.map((d) => d.day));
  while (days.has(new Date(cursor).toISOString().slice(0, 10))) {
    streak++;
    cursor -= dayMs;
  }
  res.json({
    data: {
      points: best.reduce((n, b) => n + (b._max.score || 0), 0),
      completed: best.length,
      streak,
      badges: [
        best.length >= 1 && 'First configuration',
        best.length >= 5 && 'Network apprentice',
        best.length >= 10 && 'Lab specialist',
        streak >= 3 && 'Three-day streak',
      ].filter(Boolean),
    },
  });
});
