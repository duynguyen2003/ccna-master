const VALID_LAB_STATUSES = new Set(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
const VALID_DIFFICULTIES = new Set(['EASY', 'MEDIUM', 'HARD']);

const validationError = (message) => {
  const error = new Error(message);
  error.status = 400;
  error.code = 'LAB_VALIDATION_ERROR';
  return error;
};

const parseJsonArray = (value, fieldName) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return [];
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw validationError(`${fieldName} phải là JSON hợp lệ`);
    }
  }
  if (!Array.isArray(parsed)) throw validationError(`${fieldName} phải là một mảng`);
  return parsed;
};

const validateTools = (tools) => {
  if (tools === undefined) return;
  if (tools.length > 30 || tools.some((tool) => typeof tool !== 'string' || !tool.trim())) {
    throw validationError('tools chỉ được chứa tối đa 30 tên công cụ không rỗng');
  }
};

const validateSteps = (steps) => {
  if (steps === undefined) return;
  if (steps.length > 100) throw validationError('steps chỉ được chứa tối đa 100 bước thực hành');
  steps.forEach((step, index) => {
    if (!step || typeof step !== 'object' || Array.isArray(step))
      throw validationError(`steps[${index}] phải là object`);
    if (typeof step.title !== 'string' || !step.title.trim())
      throw validationError(`steps[${index}].title không được để trống`);
    if (
      !Array.isArray(step.commands) ||
      step.commands.some((command) => typeof command !== 'string')
    )
      throw validationError(`steps[${index}].commands phải là mảng chuỗi`);
    if (step.note !== undefined && typeof step.note !== 'string')
      throw validationError(`steps[${index}].note phải là chuỗi`);
  });
};

const hasRichText = (value) =>
  String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .trim().length > 0;

const validateLabFields = ({ title, status, difficulty, tools, steps }) => {
  if (typeof title !== 'string' || !title.trim())
    throw validationError('Vui lòng nhập tên bài Lab');
  if (title.trim().length > 1000) throw validationError('Tên bài Lab không được quá 1000 ký tự');
  if (!VALID_LAB_STATUSES.has(status)) throw validationError('Trạng thái Lab không hợp lệ');
  if (!VALID_DIFFICULTIES.has(difficulty)) throw validationError('Độ khó Lab không hợp lệ');
  validateTools(tools);
  validateSteps(steps);
};

const assertCourseModule = async (prisma, courseId, moduleId) => {
  if (!courseId && moduleId)
    throw validationError('Không thể chọn chương khi bài Lab chưa thuộc khóa học');
  if (!courseId) return;
  const course = await prisma.course.findFirst({ where: { id: courseId, deletedAt: null } });
  if (!course) throw validationError('Khóa học không tồn tại hoặc đã bị xóa');
  if (!moduleId) return;
  const module = await prisma.module.findFirst({
    where: { id: moduleId, courseId, deletedAt: null },
  });
  if (!module) throw validationError('Chương không thuộc khóa học đã chọn');
};

const assertPublishReady = ({
  status,
  labType,
  objective,
  guideContent,
  steps,
  fileUrl,
  hasPacketTracerUpload,
  gradingSpec,
}) => {
  if (status !== 'PUBLISHED') return;
  if (!String(objective || '').trim())
    throw validationError('Lab đã xuất bản phải có mục tiêu thực hành');
  if (!hasRichText(guideContent) && !(steps || []).length)
    throw validationError('Lab đã xuất bản phải có hướng dẫn hoặc các bước thực hành');
  if (labType === 'PACKET_TRACER' && !fileUrl && !hasPacketTracerUpload) {
    throw validationError('Packet Tracer Lab đã xuất bản phải có file .pkt hoặc .pka');
  }
  if (labType === 'CLI_SIMULATION' && !(gradingSpec?.checks || []).length) {
    throw validationError('CLI Lab đã xuất bản phải có ít nhất một tiêu chí chấm điểm');
  }
};

module.exports = {
  assertCourseModule,
  assertPublishReady,
  parseJsonArray,
  validateLabFields,
  validationError,
};
