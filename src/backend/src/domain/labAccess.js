const { z } = require('zod');
const policySchema = z
  .object({
    mode: z.enum(['OPEN', 'LESSONS', 'CAPSTONE']),
    lessonIds: z.array(z.number().int().positive()).max(100),
    requiredForCompletion: z.boolean(),
  })
  .strict()
  .refine(
    (p) =>
      new Set(p.lessonIds).size === p.lessonIds.length &&
      (p.mode === 'LESSONS' || p.lessonIds.length === 0)
  );

const countsForCompletion = (lab) => {
  if (lab.accessPolicy == null) return true;
  const parsed = policySchema.safeParse(lab.accessPolicy);
  return !parsed.success || parsed.data.requiredForCompletion;
};

// courseId/moduleId classify a configured lab; only its explicit prerequisites
// govern entry. CAPSTONE excludes labs, including itself, from its conditions.
function labAccess(lab, state) {
  const result = {
    canAccess: false,
    lockedReason: null,
    unmetLessons: [],
    mode: lab.accessPolicy?.mode || 'LEGACY',
    requiredForCompletion: countsForCompletion(lab),
  };
  const deny = (reason) => ({ ...result, lockedReason: reason });
  if (!state.user?.id) return deny('Đăng nhập để thực hành bài lab này.');
  const course = state.path.courses.find(
    (c) => c.id === lab.courseId || (!lab.courseId && c.modules.some((m) => m.id === lab.moduleId))
  );
  const module = course?.modules.find((m) => m.id === lab.moduleId);
  if ((lab.courseId || lab.moduleId) && (!course || (lab.moduleId && !module)))
    return deny('Nội dung liên quan chưa được xuất bản hoặc đã thay đổi.');
  if (lab.accessPolicy == null) {
    if (course?.canAccess === false) return deny(course.lockedReason);
    if (module?.canAccess === false) return deny(module.lockedReason);
    return { ...result, canAccess: true };
  }
  const parsed = policySchema.safeParse(lab.accessPolicy);
  if (!parsed.success) return deny('Điều kiện mở lab cần được cập nhật.');
  const policy = parsed.data;
  if (policy.mode === 'OPEN') return { ...result, canAccess: true };
  if (!course) return deny('Bài lab chưa có phạm vi kiến thức hợp lệ.');
  const lessons = module ? module.lessons : course.modules.flatMap((m) => m.lessons);
  const required =
    policy.mode === 'CAPSTONE'
      ? lessons
      : policy.lessonIds.map((id) => lessons.find((l) => l.id === id));
  if (!required.length || required.some((l) => !l))
    return deny('Bài học tiên quyết đã thay đổi. Vui lòng liên hệ quản trị.');
  const unmet = required.filter(
    (l) => !l.completed && !(policy.mode === 'LESSONS' && l.hasVideo && l.progressPercent >= 70)
  );
  return {
    ...result,
    canAccess: unmet.length === 0,
    lockedReason: unmet.length
      ? policy.mode === 'CAPSTONE'
        ? 'Hoàn thành phần lý thuyết liên quan để mở lab tổng hợp.'
        : 'Học các bài tiên quyết để mở lab này.'
      : null,
    unmetLessons: unmet.map((l) => ({
      id: l.id,
      title: l.title,
      courseId: course.id,
      requiredPercent: policy.mode === 'LESSONS' && l.hasVideo ? 70 : 100,
      progressPercent: l.progressPercent,
    })),
  };
}
module.exports = { policySchema, countsForCompletion, labAccess };
