const { policySchema } = require('../domain/labAccess');
const fail = (message) =>
  Object.assign(new Error(message), { status: 400, code: 'INVALID_LAB_ACCESS_POLICY' });
async function validateLabAccessPolicy(db, input, { courseId, moduleId, status }) {
  let raw = input;
  try {
    if (typeof raw === 'string') raw = JSON.parse(raw);
  } catch {
    throw fail('Điều kiện mở lab không hợp lệ.');
  }
  if (raw == null) return null;
  const parsed = policySchema.safeParse(raw);
  if (!parsed.success) throw fail('Kiểm tra chế độ mở lab, danh sách bài và tùy chọn hoàn thành.');
  const policy = parsed.data;
  if (
    !courseId &&
    (status === 'PUBLISHED' || policy.mode !== 'OPEN' || policy.requiredForCompletion)
  )
    throw fail('Chọn khóa học để xếp lab và lưu kết quả. Điều kiện mở lab được cấu hình riêng.');
  if (policy.mode === 'LESSONS') {
    if (status === 'PUBLISHED' && !policy.lessonIds.length)
      throw fail('Chọn ít nhất một bài tiên quyết trước khi xuất bản.');
    const lessons = await db.lesson.findMany({
      where: {
        id: { in: policy.lessonIds },
        deletedAt: null,
        module: {
          deletedAt: null,
          courseId,
          ...(moduleId ? { id: moduleId } : {}),
          ...(status === 'PUBLISHED'
            ? { course: { deletedAt: null, status: { in: ['PUBLISHED', 'OPEN'] } } }
            : {}),
        },
      },
      select: { id: true },
    });
    if (lessons.length !== policy.lessonIds.length)
      throw fail('Bài tiên quyết phải còn tồn tại và thuộc khóa học/chương đã chọn.');
  }
  if (policy.mode === 'CAPSTONE' && status === 'PUBLISHED') {
    const count = await db.lesson.count({
      where: {
        deletedAt: null,
        module: { deletedAt: null, courseId, ...(moduleId ? { id: moduleId } : {}) },
      },
    });
    if (!count) throw fail('Lab tổng hợp cần ít nhất một bài lý thuyết trong phạm vi đã chọn.');
  }
  return policy;
}
module.exports = { validateLabAccessPolicy };
