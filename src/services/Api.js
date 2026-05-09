// fe/src/services/Api.js

export const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

// ─── Static Metadata ────────────────────────────────────────────────────────
const COURSE_METADATA = {
  ITN: {
    language: "Tiếng Việt",
    totalHours: 28,
    competencies: [
      "Hiểu mô hình OSI và TCP/IP từ lớp vật lý đến ứng dụng",
      "Cấu hình địa chỉ IPv4 và IPv6 cho thiết bị đầu cuối",
      "Phân tích và kiểm tra kết nối mạng bằng các lệnh CLI cơ bản",
      "Thiết lập và cấu hình Switch Cisco cơ bản",
      "Hiểu nguyên lý hoạt động của Ethernet và cáp mạng",
      "Nắm vững các khái niệm về Bandwidth, Latency và QoS",
    ],
    includes: [
      { icon: "play_circle", text: "28 giờ nội dung video" },
      { icon: "phone_android", text: "Truy cập trên điện thoại và TV" },
      { icon: "workspace_premium", text: "Chứng chỉ hoàn thành" },
    ],
  },
  SRWE: {
    language: "Tiếng Anh",
    totalHours: 42,
    competencies: [
      "Cấu hình và xác thực địa chỉ IPv4 và IPv6 cũng như chia mạng con trên các mạng doanh nghiệp.",
      "Triển khai VLAN và các giao thức Trunking để tối ưu hóa việc phân đoạn và bảo mật mạng.",
      "Hiểu về các giao thức định tuyến bao gồm OSPFv2 cho mạng điểm-điểm và mạng đa truy cập.",
      "Làm chủ các dịch vụ IP như NAT, NTP và DHCP để duy trì thúc mạng mạnh mẽ.",
      "Bảo mật truy cập mạng với port security, DHCP snooping và kiểm tra ARP động (DAI).",
      "Cơ bản về tự động hóa và khả năng lập trình trong các mạng điều khiển bằng phần mềm hiện đại.",
    ],
    includes: [
      { icon: "play_circle", text: "42 giờ nội dung video" },
      { icon: "phone_android", text: "Truy cập trên điện thoại và TV" },
      { icon: "workspace_premium", text: "Chứng chỉ hoàn thành" },
    ],
  },
  ENSA: {
    language: "Tiếng Anh",
    totalHours: 35,
    competencies: [
      "Triển khai và tối ưu hóa giao thức OSPF trên mạng doanh nghiệp",
      "Cấu hình VPN Site-to-Site và Remote Access với IPsec",
      "Hiểu và áp dụng các khái niệm SD-WAN trong thực tế",
      "Lập trình tự động hóa mạng với Python và Ansible",
      "Sử dụng REST API để quản lý thiết bị Cisco DNA Center",
      "Phân tích và xử lý sự cố mạng doanh nghiệp phức tạp",
    ],
    includes: [
      { icon: "play_circle", text: "35 giờ nội dung video" },
      { icon: "phone_android", text: "Truy cập trên điện thoại và TV" },
      { icon: "workspace_premium", text: "Chứng chỉ hoàn thành" },
    ],
  },
};

// [OPT-03] Alias rõ ràng, không dùng mutation
const CODE_ALIASES = { SRW: "SRWE", ENA: "ENSA" };
const getCourseMetadata = (code) =>
  COURSE_METADATA[code] ?? COURSE_METADATA[CODE_ALIASES[code]] ?? {};

// ─── Core Fetch ─────────────────────────────────────────────────────────────
const apiFetch = async (endpoint, token, options = {}) => {
  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  
  if (response.status === 401) {
    // Nếu là login, cho phép hiển thị lỗi sai mật khẩu thay vì quăng UNAUTHORIZED chung chung
    if (endpoint !== "/auth/login" && endpoint !== "/auth/register") {
       window.dispatchEvent(new Event("unauthorized"));
       throw new Error("UNAUTHORIZED");
    }
  }

  if (!response.ok) {
    if (response.status >= 500) {
      window.dispatchEvent(
        new CustomEvent("api_error", { detail: "Lỗi máy chủ (500). Vui lòng thử lại sau." })
      );
    }
    throw new Error(data.message || data.error?.message || `Lỗi API: ${response.status}`);
  }

  return data;
};

// [OPT-01] Helper tránh lặp try/catch — dùng cho các hàm có fallback an toàn
// Các hàm bắt buộc phải có kết quả (login, submit...) vẫn dùng apiFetch trực tiếp
const safeApiFetch = async (endpoint, token, fallback, options = {}) => {
  try {
    return await apiFetch(endpoint, token, options);
  } catch (error) {
    console.error(`[API] ${endpoint}:`, error.message);
    return fallback;
  }
};

// ─── Normalizers ─────────────────────────────────────────────────────────────
// [OPT-04] Tách mapper ra khỏi api object để dễ đọc và dễ test

const DIFFICULTY_MAP = { EASY: "Easy", MEDIUM: "Medium", HARD: "Hard" };
const normalizeDifficulty = (d) => DIFFICULTY_MAP[d] ?? d;

const mapLesson = (lesson) => ({
  id: lesson.id,
  title: lesson.title,
  sectionNumber: lesson.sectionNumber || null,
  videoDuration: lesson.videoDuration || null,
  orderIndex: lesson.orderIndex,
});

const mapModule = (module, idx) => ({
  ...module,
  // Mở khóa chương đầu tiên mặc định, các chương sau tạm khóa
  status: idx === 0 ? "active" : "locked",
  lessonCount: module._count?.lessons || module.lessons?.length || 0,
  lessons: (module.lessons || []).map(mapLesson),
});

const mapCourse = (course) => {
  const metadata = getCourseMetadata(course.code);
  return {
    ...course,
    ...metadata,
    // Ưu tiên dữ liệu thật từ DB, fallback sang metadata tĩnh
    totalHours: course.totalHours || metadata.totalHours || 0,
    fullTitle: course.title,
    longDescription: course.description,
    progress: course.progress ?? 0,
    modules: (course.modules || []).map(mapModule),
  };
};

const mapLab = (lab) => ({
  ...lab,
  id: lab.id.toString(),
  difficulty: normalizeDifficulty(lab.difficulty),
  topology: lab.topologyImgUrl,
  tools: Array.isArray(lab.tools) ? lab.tools : [],
  steps: Array.isArray(lab.steps) ? lab.steps : [],
});

const mapExam = (exam) => ({
  ...exam,
  id: exam.id.toString(),
  difficulty: normalizeDifficulty(exam.difficulty),
  totalQuestions: exam._count?.questions || exam.questions?.length || 0,
});

// ─── API Object ──────────────────────────────────────────────────────────────
export const api = {

  // ── Auth ──────────────────────────────────────────────────────────────────
  // [OPT-02] Các hàm auth không có fallback — throw để caller xử lý lỗi đúng cách

  register: (fullName, email, password) =>
    apiFetch("/auth/register", null, {
      method: "POST",
      body: JSON.stringify({ fullName, email, password }),
    }),

  login: (email, password) =>
    apiFetch("/auth/login", null, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  googleLogin: (token) =>
    apiFetch("/auth/google", null, {
      method: "POST",
      body: JSON.stringify({ token }),
    }),

  forgotPassword: (email) =>
    apiFetch("/auth/forgot-password", null, {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  validateResetPasswordToken: (token) =>
    apiFetch(`/auth/reset-password/${token}/validate`),

  resetPassword: (token, password) =>
    apiFetch("/auth/reset-password", null, {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),

  logout: async (token) => {
    // Logout thất bại không nên crash app — nuốt lỗi có log
    const result = await safeApiFetch("/auth/logout", token, null, { method: "POST" });
    return result;
  },

  // ── Courses ───────────────────────────────────────────────────────────────

  getCourses: async (token) => {
    const json = await safeApiFetch("/learning/courses", token, { data: [] });
    const courses = json.data?.courses || json.data || [];
    return courses.map(mapCourse);
  },

  getModulesByCourse: async (token, courseId) => {
    const json = await safeApiFetch(`/learning/courses/${courseId}/modules`, token, { data: [] });
    return json.data || [];
  },

  getLessonsByModule: async (token, moduleId) => {
    const json = await safeApiFetch(`/learning/modules/${moduleId}/lessons`, token, { data: [] });
    return json.data || [];
  },

  // ── Labs ──────────────────────────────────────────────────────────────────

  getLabs: async (token) => {
    const json = await safeApiFetch("/learning/labs", token, { data: [] });
    const labs = json.data?.labs || json.data || [];
    return labs.map(mapLab);
  },

  // ── Resources ─────────────────────────────────────────────────────────────

  // [OPT-02] Trả về { data: [] } thống nhất với các hàm list khác
  getResources: async (token) => {
    const json = await safeApiFetch("/learning/resources", token, { data: [] });
    return json;
  },

  // ── User ──────────────────────────────────────────────────────────────────

  // Profile bắt buộc phải có → throw nếu lỗi
  getUserProfile: async (token) => {
    const json = await apiFetch("/users/profile/me", token);
    return json.data;
  },

  getUserProgress: async (token) => {
    const json = await safeApiFetch("/users/progress", token, { data: [] });
    const raw = json.data || [];

    // Build lookup map: courseId → percent, lessonId → { percent, status, completedAt }
    const progressMap = { _raw: raw };
    raw.forEach((p) => {
      if (!p.moduleId && !p.lessonId && !p.labId) {
        progressMap[p.courseId] = p.progressPercent || 0;
      }
      if (p.lessonId) {
        progressMap[`lesson_${p.lessonId}`] = {
          percent: p.progressPercent || 0,
          status: p.status,
          completedAt: p.completedAt,
        };
      }
    });

    return progressMap;
  },

  updateUserProgress: (token, progressData) =>
    apiFetch("/users/progress", token, {
      method: "POST",
      body: JSON.stringify(progressData),
    }),

  // ── User Notes ────────────────────────────────────────────────────────────

  getUserNote: async (token, lessonId) => {
    const json = await safeApiFetch(`/users/notes/${lessonId}`, token, { content: "" });
    return json.content || "";
  },

  updateUserNote: (token, noteData) =>
    apiFetch("/users/notes", token, {
      method: "POST",
      body: JSON.stringify(noteData),
    }),

  // ── Exams ─────────────────────────────────────────────────────────────────

  getExams: async (token) => {
    const json = await safeApiFetch("/exams", token, { data: [] });
    return (json.data || [])
      .filter((exam) => exam.status === "OPEN")
      .map(mapExam);
  },

  // Bắt buộc có kết quả → throw nếu lỗi
  getExamById: async (token, examId) => {
    const json = await apiFetch(`/exams/detail/${examId}`, token);
    return json.exam || json.data;
  },

  // Bắt buộc có kết quả → throw nếu lỗi
  submitExam: (token, examId, answers, timeSpent) =>
    apiFetch(`/exams/${examId}/submit`, token, {
      method: "POST",
      body: JSON.stringify({ answers, timeSpent }),
    }),

  // Bắt buộc có kết quả → throw nếu lỗi
  getExamResult: async (token, resultId) => {
    const json = await apiFetch(`/exams/result/${resultId}`, token);
    return json.data;
  },

  getMyExamHistory: async (token) => {
    const json = await safeApiFetch("/exams/history/me", token, { data: [] });
    return json.data || [];
  },
};

export default api;