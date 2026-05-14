import { API_URL } from '../Api';
const DEFAULT_TIMEOUT_MS = 10000;

const getHeaders = (token, isFormData = false) => ({
  'Authorization': `Bearer ${token}`,
  ...(!isFormData && { 'Content-Type': 'application/json;charset=utf-8' }),
});

const getErrorMessage = (data, fallback) =>
  data?.message || data?.error?.message || fallback;

// ✅ Hàm dùng chung — loại bỏ toàn bộ boilerplate lặp lại
const request = async (url, options = {}, errorMsg = 'Lỗi không xác định') => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const data = await response.json();
    if (!response.ok) throw new Error(getErrorMessage(data, errorMsg));
    return data;
  } finally {
    clearTimeout(timeout);
  }
};

export const adminApi = {
  // --- STATS & LOGS ---
  getStats: (token) =>
    request(`${API_URL}/admin/stats`, { headers: getHeaders(token) }, 'Lỗi lấy thống kê'),

  getLogs: (token, page = 1, limit = 10) =>
    request(
      `${API_URL}/admin/logs?page=${page}&limit=${limit}`,
      { headers: getHeaders(token) },
      'Lỗi lấy nhật ký'
    ),

  // --- MODULAR DASHBOARD ---
  getDashboardSummary: (token) =>
    request(`${API_URL}/admin/dashboard/summary`, { headers: getHeaders(token) }, 'Lỗi lấy tổng quan dashboard'),
    
  getDashboardActivity: (token) =>
    request(`${API_URL}/admin/dashboard/activity`, { headers: getHeaders(token) }, 'Lỗi lấy hoạt động dashboard'),
    
  getDashboardDistribution: (token) =>
    request(`${API_URL}/admin/dashboard/distribution`, { headers: getHeaders(token) }, 'Lỗi lấy phân bổ dashboard'),
    
  getDashboardTrends: (token) =>
    request(`${API_URL}/admin/dashboard/trends`, { headers: getHeaders(token) }, 'Lỗi lấy xu hướng dashboard'),
    
  getRecentStudents: (token) =>
    request(`${API_URL}/admin/dashboard/students`, { headers: getHeaders(token) }, 'Lỗi lấy danh sách học viên mới'),

  // --- USERS ---
  getUsers: (token, page = 1, search = '', options = {}) => {
    const params = new URLSearchParams({ page: String(page), search: search || '' });
    if (options.limit) params.set('limit', String(options.limit));
    if (options.role && options.role !== 'ALL') params.set('role', options.role);
    if (options.status && options.status !== 'ALL') params.set('status', options.status);
    return request(`${API_URL}/admin/users?${params}`, { headers: getHeaders(token) }, 'Lỗi lấy danh sách người dùng');
  },

  getUser: (token, id) =>
    request(`${API_URL}/admin/users/${id}`, { headers: getHeaders(token) }, 'Lỗi lấy thông tin người dùng'),

  createUser: (token, payload) =>
    request(`${API_URL}/admin/users`, {
      method: 'POST', headers: getHeaders(token), body: JSON.stringify(payload)
    }, 'Lỗi tạo người dùng'),

  updateUserRole: (token, userId, role) =>
    request(`${API_URL}/admin/users/${userId}/role`, {
      method: 'PATCH', headers: getHeaders(token), body: JSON.stringify({ role })
    }, 'Lỗi cập nhật quyền'),

  toggleUserActive: (token, userId) =>
    request(`${API_URL}/admin/users/${userId}/toggle`, {
      method: 'PATCH', headers: getHeaders(token)
    }, 'Lỗi cập nhật trạng thái'),

  deleteUser: (token, userId) =>
    request(`${API_URL}/admin/users/${userId}`, {
      method: 'DELETE', headers: getHeaders(token)
    }, 'Lỗi xóa người dùng'),

  // --- COURSES ---
  getCourses: (token, page = 1) =>
    request(`${API_URL}/learning/courses?page=${page}`, { headers: getHeaders(token) }, 'Lỗi lấy danh sách khóa học'),

  createCourse: (token, formData) =>
    request(`${API_URL}/learning/courses`, {
      method: 'POST', headers: getHeaders(token, true), body: formData
    }, 'Lỗi tạo khóa học'),

  updateCourse: (token, id, formData) =>
    request(`${API_URL}/learning/courses/${id}`, {
      method: 'PUT', headers: getHeaders(token, true), body: formData
    }, 'Lỗi cập nhật khóa học'),

  deleteCourse: (token, id) =>
    request(`${API_URL}/learning/courses/${id}`, {
      method: 'DELETE', headers: getHeaders(token)
    }, 'Lỗi xóa khóa học'),

  // --- LABS ---
  getLabs: (token, page = 1) =>
    request(`${API_URL}/learning/labs?page=${page}`, { headers: getHeaders(token) }, 'Lỗi lấy danh sách bài thực hành'),

  createLab: (token, formData) =>
    request(`${API_URL}/learning/labs`, {
      method: 'POST', headers: getHeaders(token, true), body: formData
    }, 'Lỗi tạo bài thực hành'),

  updateLab: (token, id, formData) =>
    request(`${API_URL}/learning/labs/${id}`, {
      method: 'PUT', headers: getHeaders(token, true), body: formData
    }, 'Lỗi cập nhật bài thực hành'),

  deleteLab: (token, id) =>
    request(`${API_URL}/learning/labs/${id}`, {
      method: 'DELETE', headers: getHeaders(token)
    }, 'Lỗi xóa bài thực hành'),

  // --- MODULES (CHƯƠNG) ---
  getModules: (token, courseId) =>
    request(`${API_URL}/learning/courses/${courseId}/modules`, { headers: getHeaders(token) }, 'Lỗi lấy danh sách chương'),

  createModule: (token, courseId, payload) =>
    request(`${API_URL}/learning/courses/${courseId}/modules`, {
      method: 'POST', headers: getHeaders(token), body: JSON.stringify(payload)
    }, 'Lỗi tạo chương'),

  updateModule: (token, moduleId, payload) =>
    request(`${API_URL}/learning/modules/${moduleId}`, {
      method: 'PUT', headers: getHeaders(token), body: JSON.stringify(payload)
    }, 'Lỗi cập nhật chương'),

  deleteModule: (token, moduleId) =>
    request(`${API_URL}/learning/modules/${moduleId}`, {
      method: 'DELETE', headers: getHeaders(token)
    }, 'Lỗi xóa chương'),

  // --- LESSONS (BÀI HỌC) ---
  getLessons: (token, moduleId) =>
    request(`${API_URL}/learning/modules/${moduleId}/lessons`,
      { headers: getHeaders(token) }, 'Lỗi lấy danh sách bài học'),

  createLesson: (token, moduleId, payload) =>
    request(`${API_URL}/learning/modules/${moduleId}/lessons`, {
      method: 'POST', headers: getHeaders(token), body: JSON.stringify(payload)
    }, 'Lỗi tạo bài học'),

  updateLesson: (token, lessonId, payload) =>
    request(`${API_URL}/learning/lessons/${lessonId}`, {
      method: 'PUT', headers: getHeaders(token), body: JSON.stringify(payload)
    }, 'Lỗi cập nhật bài học'),

  deleteLesson: (token, lessonId) =>
    request(`${API_URL}/learning/lessons/${lessonId}`, {
      method: 'DELETE', headers: getHeaders(token)
    }, 'Lỗi xóa bài học'),

  // --- EXAMS ---
  getExams: (token, page = 1) =>
    request(`${API_URL}/exams?page=${page}`,
      { headers: getHeaders(token) }, 'Lỗi lấy danh sách bài kiểm tra'),

  getExamById: (token, id) =>
    request(`${API_URL}/exams/detail/${id}`,
      { headers: getHeaders(token) }, 'Lỗi lấy chi tiết bài kiểm tra'),

  createExam: (token, payload) =>
    request(`${API_URL}/exams`, {
      method: 'POST', headers: getHeaders(token), body: JSON.stringify(payload)
    }, 'Lỗi tạo bài kiểm tra'),

  uploadExamQuestionImage: (token, file) => {
    const formData = new FormData();
    formData.append('image', file);
    return request(`${API_URL}/exams/question-image`, {
      method: 'POST', headers: getHeaders(token, true), body: formData
    }, 'Lỗi tải ảnh câu hỏi');
  },

  updateExam: (token, id, payload) =>
    request(`${API_URL}/exams/${id}`, {
      method: 'PUT', headers: getHeaders(token), body: JSON.stringify(payload)
    }, 'Lỗi cập nhật bài kiểm tra'),

  deleteExam: (token, id) =>
    request(`${API_URL}/exams/${id}`, {
      method: 'DELETE', headers: getHeaders(token)
    }, 'Lỗi xóa bài kiểm tra'),

  getExamResults: (token, page = 1) =>
    request(`${API_URL}/exams/results?page=${page}`,
      { headers: getHeaders(token) }, 'Lỗi lấy kết quả thi'),

  // --- COURSE TOPICS ---
  getTopics: (token, courseId) =>
    request(`${API_URL}/learning/courses/${courseId}/topics`,
      { headers: getHeaders(token) }, 'Lỗi lấy chủ đề'),

  createTopic: (token, courseId, payload) =>
    request(`${API_URL}/learning/courses/${courseId}/topics`, {
      method: 'POST', headers: getHeaders(token), body: JSON.stringify(payload)
    }, 'Lỗi tạo chủ đề'),

  deleteTopic: (token, topicId) =>
    request(`${API_URL}/learning/topics/${topicId}`, {
      method: 'DELETE', headers: getHeaders(token)
    }, 'Lỗi xóa chủ đề'),

  // --- RESOURCES ---
  getResources: (token, courseId = '', page = 1) => {
    const params = new URLSearchParams();
    if (courseId) params.append('courseId', courseId);
    if (page) params.append('page', String(page));
    
    return request(`${API_URL}/learning/resources?${params.toString()}`,
      { headers: getHeaders(token) }, 'Lỗi lấy tài liệu');
  },

  createResource: (token, formData) =>
    request(`${API_URL}/learning/resources`, {
      method: 'POST', headers: getHeaders(token, true), body: formData
    }, 'Lỗi tải tài liệu'),

  deleteResource: (token, id) =>
    request(`${API_URL}/learning/resources/${id}`, {
      method: 'DELETE', headers: getHeaders(token)
    }, 'Lỗi xóa tài liệu'),

  // --- TOOLS ---
  getTools: (token) =>
    request(`${API_URL}/tools`,
      { headers: getHeaders(token) }, 'Lỗi lấy công cụ'),

  createTool: (token, payload) =>
    request(`${API_URL}/tools`, {
      method: 'POST', headers: getHeaders(token), body: JSON.stringify(payload)
    }, 'Lỗi tạo công cụ'),

  toggleTool: (token, id) =>
    request(`${API_URL}/tools/${id}/toggle`, {
      method: 'PATCH', headers: getHeaders(token)
    }, 'Lỗi cập nhật công cụ'),

  deleteTool: (token, id) =>
    request(`${API_URL}/tools/${id}`, {
      method: 'DELETE', headers: getHeaders(token)
    }, 'Lỗi xóa công cụ')
};
