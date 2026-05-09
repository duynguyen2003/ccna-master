# Kiểm Tra Đồng Bộ Frontend ↔ Backend — Bản Đã Sửa & Bổ Sung Chi Tiết

**Ngày**: May 4, 2026  
**Trạng thái**: Bản chỉnh sửa từ review ngày 3/5/2026  
**Người review**: Claude  

---

## ⚠️ Nhận xét tổng quan về tài liệu gốc

### Điểm tốt
- Cấu trúc bảng so sánh mock vs real rõ ràng, dễ đọc
- Đã phát hiện đúng các mismatch quan trọng (id type, difficulty case, pagination wrapper)
- Code snippet tóm tắt cuối tài liệu giúp developer implement nhanh

### Vấn đề phát hiện trong tài liệu gốc
1. **Thiếu module Exams** — Chỉ ghi "cần kiểm tra riêng" nhưng không có nội dung
2. **Thiếu xử lý lỗi** — Code snippet chỉ happy path, không có error handling
3. **Token không được truyền đúng** — Chưa handle trường hợp token null/expired
4. **Thiếu bước test** — Không có checklist test sau khi sửa
5. **Thiếu module UserProgress** — Được nhắc tới nhưng không có API spec
6. **Response format chưa nhất quán** — `json.data` vs `json.data.data` dễ gây nhầm

---

## 1. COURSES — `getCourses` API

### 1.1 So sánh Backend vs Frontend Mock

| Mock field | Real API field | Trạng thái | Hành động |
|---|---|---|---|
| `id` ("c1") | `id` (String) | ✅ OK | Không cần sửa |
| `code` | `code` | ✅ OK | Không cần sửa |
| `title` | `title` | ✅ OK | Không cần sửa |
| `description` | `description` | ✅ OK | Không cần sửa |
| `thumbnailUrl` | `thumbnailUrl` | ✅ OK | Không cần sửa |
| `level` | `level` | ✅ OK | Không cần sửa |
| `status` | `status` | ✅ OK | Không cần sửa |
| `progress` | **KHÔNG CÓ** | ❌ Missing | Gọi API `UserProgress` riêng (ĐÃ LÀM) |
| `fullTitle` | **KHÔNG CÓ** | ❌ Missing | Dùng `title` thay thế, xóa `fullTitle` |
| `longDescription` | **KHÔNG CÓ** | ❌ Missing | Dùng `description` thay thế |
| `instructor` | **KHÔNG CÓ** | ❌ Missing | Xóa hoặc hardcode tạm "CCNA Team" |
| `totalHours` | **KHÔNG CÓ** | ❌ Missing | Xóa hoặc tính từ tổng `duration` của lessons |
| `competencies` | **KHÔNG CÓ** | ❌ Missing | Xóa khỏi UI tạm thời |
| `includes` | **KHÔNG CÓ** | ❌ Missing | Xóa khỏi UI tạm thời |
| `modules` | **KHÔNG CÓ trực tiếp** | ⚠️ Partial | Gọi riêng `/learning/modules?courseId=` |

> **Lưu ý quan trọng**: Backend trả về `{ success, data: { courses[], pagination } }` — KHÔNG phải mảng trực tiếp.  
> **Cấu trúc response thực tế**: `json.data.courses` hoặc `json.data` tuỳ implementation controller.  
> ➡️ Cần kiểm tra response thực tế bằng Postman trước khi code frontend.

### 1.2 Bước làm chi tiết — Courses

#### Bước 1: Kiểm tra response thực tế
```bash
# Chạy backend trước, sau đó test bằng curl
curl -X GET http://localhost:5000/api/learning/courses \
  -H "Authorization: Bearer <your_token>" \
  | json_pp
```
> Xem response trả về dạng gì rồi mới sửa frontend. Đừng đoán.

#### Bước 2: Sửa `Api.js` — getCourses
```javascript
// src/services/Api.js

getCourses: async (token) => {
  try {
    if (!token) throw new Error('No auth token');

    const response = await fetch(`${API_URL}/learning/courses`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 401) {
      // Token hết hạn — trigger logout hoặc refresh
      throw new Error('UNAUTHORIZED');
    }

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const json = await response.json();

    // ⚠️ Kiểm tra cấu trúc response thực tế từ Bước 1
    // Nếu backend trả { data: courses[] }:
    return json.data ?? [];
    // Nếu backend trả { data: { courses[], pagination } }:
    // return json.data.courses ?? [];

  } catch (error) {
    console.error('getCourses error:', error.message);
    if (error.message === 'UNAUTHORIZED') {
      // Gọi logout từ AuthContext
      throw error;
    }
    return [];
  }
}
```

#### Bước 3: Sửa `Home.js` — mapping courses
```javascript
// src/pages/Home.js

// TRƯỚC (mock)
const courses = await api.getCourses();
setCourses(courses);

// SAU (real API)
const { token } = useAuth();

const courses = await api.getCourses(token);

// Normalize data — xử lý các field bị thiếu
const normalizedCourses = courses.map(course => ({
  ...course,
  progress: 0,              // TODO: gọi UserProgress API sau
  fullTitle: course.title,  // Dùng title thay fullTitle
  longDescription: course.description,
  instructor: 'CCNA Team',  // Tạm hardcode
  totalHours: null,         // Ẩn UI nếu null
  modules: [],              // Gọi riêng nếu cần
}));

setCourses(normalizedCourses);
```

#### Bước 4: Sửa component UI — ẩn field không có data
```jsx
// Bất kỳ component nào dùng course.instructor, course.totalHours, v.v.

// TRƯỚC
<p>{course.instructor}</p>
<p>{course.totalHours} giờ</p>

// SAU — render có điều kiện
{course.instructor && <p>{course.instructor}</p>}
{course.totalHours && <p>{course.totalHours} giờ</p>}
```

#### Bước 5: Test
- [x] Gọi API thành công, console không có lỗi
- [x] Danh sách course hiển thị đúng title, thumbnail, level
- [x] Không crash khi thiếu field (progress, instructor, v.v.)
- [x] Token hết hạn → redirect về login

---

## 2. LABS — `getLabs` API

### 2.1 So sánh Backend vs Frontend Mock

| Mock field | Real API field | Trạng thái | Hành động |
|---|---|---|---|
| `id` (String "1") | `id` (Int) | ❌ Type mismatch | Convert `.toString()` ở frontend |
| `title` | `title` | ✅ OK | Không cần sửa |
| `category` | `category` | ✅ OK | Không cần sửa |
| `difficulty` ("Easy") | `difficulty` ("EASY") | ⚠️ Case khác | Normalize khi hiển thị |
| `duration` | `duration` | ✅ OK | Không cần sửa |
| `imageUrl` | `imageUrl` | ✅ OK | Không cần sửa |
| `tools` | `tools` (JSON array) | ⚠️ Cần kiểm tra | Verify JSON structure khớp |
| `fileUrl` | `fileUrl` | ✅ OK | Không cần sửa |
| `topology` | `topologyImgUrl` | ❌ Tên khác | Đổi `lab.topology` → `lab.topologyImgUrl` |
| `objective` | `objective` | ✅ OK | Không cần sửa |
| `steps` | `steps` (JSON array) | ⚠️ Cần kiểm tra | Verify JSON structure khớp |
| *(không có)* | `guideContent` | ℹ️ Mới | Hiển thị thêm nếu có |
| *(không có)* | `status` | ℹ️ Mới | Filter lab theo status nếu cần |
| *(không có)* | `courseId` | ℹ️ Mới | Dùng để filter lab theo course |

> **Lưu ý quan trọng**: Backend trả về `{ success, data: { labs[], pagination } }` — KHÔNG phải mảng trực tiếp.

### 2.2 Bước làm chi tiết — Labs

#### Bước 1: Kiểm tra response thực tế
```bash
curl -X GET http://localhost:5000/api/learning/labs \
  -H "Authorization: Bearer <your_token>" \
  | json_pp
```
> Đặc biệt chú ý cấu trúc của `tools` và `steps` (JSON array trong DB).

#### Bước 2: Sửa `Api.js` — getLabs
```javascript
// src/services/Api.js

getLabs: async (token) => {
  try {
    if (!token) throw new Error('No auth token');

    const response = await fetch(`${API_URL}/learning/labs`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 401) throw new Error('UNAUTHORIZED');
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

    const json = await response.json();
    const labs = json.data ?? [];

    // Normalize ngay tại service layer
    return labs.map(lab => ({
      ...lab,
      id: lab.id.toString(),                          // Int → String
      difficulty: normalizeDifficulty(lab.difficulty), // "EASY" → "Easy"
      topology: lab.topologyImgUrl ?? null,           // Rename field
      tools: Array.isArray(lab.tools) ? lab.tools : [],
      steps: Array.isArray(lab.steps) ? lab.steps : [],
    }));

  } catch (error) {
    console.error('getLabs error:', error.message);
    return [];
  }
}

// Helper function — đặt ngoài object api
function normalizeDifficulty(difficulty) {
  const map = {
    'EASY': 'Easy',
    'MEDIUM': 'Medium',
    'HARD': 'Hard'
  };
  return map[difficulty] ?? difficulty;
}
```

#### Bước 3: Sửa `Labs.js` — không cần sửa nhiều vì đã normalize ở Api.js
```javascript
// src/pages/Labs.js

// TRƯỚC
const { token } = useAuth(); // (nếu chưa có)
const labs = await api.getLabs(); // (không truyền token)

// SAU
const { token } = useAuth();
const labs = await api.getLabs(token);
// Data đã được normalize ở Api.js → dùng trực tiếp
```

#### Bước 4: Kiểm tra render `topology`
```jsx
// Labs.js hoặc LabDetail.js

// TRƯỚC (có thể bị crash nếu undefined)
<img src={lab.topology} />

// SAU
{lab.topology && <img src={lab.topology} alt="Lab topology" />}
```

#### Bước 5: Test
- [x] Danh sách lab load đúng
- [x] Difficulty hiển thị đúng ("Easy", "Medium", "Hard")
- [x] Ảnh topology hiển thị (hoặc ẩn gracefully nếu null)
- [x] tools và steps không bị lỗi JSON parse
- [x] Filter/search lab vẫn hoạt động sau khi đổi id về String

---

## 3. RESOURCES — `getResources` API ✅

> **Trạng thái**: Đã dùng real API, hoạt động tốt. Không cần sửa.

### Lưu ý nhỏ cần verify
```javascript
// Kiểm tra Doc.js đang xử lý response đúng không
const json = await response.json();

// Nếu backend trả { data: resources[] }
const resources = json.data; // ✅

// Nếu backend trả resources[] trực tiếp
const resources = json; // ✅ khác
```
> Chạy Postman verify một lần cho chắc, không cần sửa nếu đang chạy đúng.

---

## 4. EXAMS — `getExams` API *(Bổ sung — thiếu trong tài liệu gốc)*

### 4.1 So sánh Backend vs Frontend Mock

| Mock field | Real API field | Trạng thái | Hành động |
|---|---|---|---|
| `id` | `id` (Int) | ⚠️ Cần kiểm tra | Convert nếu cần |
| `title` | `title` | ✅ OK | Không cần sửa |
| `description` | `description` | ✅ OK | Không cần sửa |
| `duration` | `duration` | ✅ OK | Không cần sửa |
| `difficulty` | `difficulty` (Enum) | ⚠️ Case | Normalize như Labs |
| `questions` | Quan hệ `ExamQuestion[]` | ⚠️ Cần kiểm tra | Backend có include không? |
| `status` | `status` (DRAFT/OPEN/CLOSED) | ⚠️ Mới | Filter chỉ hiện OPEN |
| `totalQuestions` | **KHÔNG CÓ trực tiếp** | ❌ | Tính từ `questions.length` |
| `passingScore` | **Cần kiểm tra schema** | ⚠️ | Thêm field nếu thiếu |

> **Lưu ý quan trọng**: `submitExam` endpoint chưa được implement ở backend (CRITICAL từ Phase 1 Task 1.2). Frontend không thể submit bài thi thật được.

### 4.2 Bước làm chi tiết — Exams

#### Bước 1: Kiểm tra response thực tế
```bash
# Lấy danh sách exam
curl -X GET http://localhost:5000/api/exams \
  -H "Authorization: Bearer <your_token>" \
  | json_pp

# Lấy chi tiết 1 exam (kèm questions)
curl -X GET http://localhost:5000/api/exams/1 \
  -H "Authorization: Bearer <your_token>" \
  | json_pp
```

#### Bước 2: Sửa `Api.js` — thêm getExams (nếu chưa có)
```javascript
// src/services/Api.js

getExams: async (token) => {
  try {
    if (!token) throw new Error('No auth token');

    const response = await fetch(`${API_URL}/exams`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.status === 401) throw new Error('UNAUTHORIZED');
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

    const json = await response.json();
    const exams = json.data ?? [];

    return exams
      .filter(exam => exam.status === 'OPEN') // Chỉ hiện exam đang mở
      .map(exam => ({
        ...exam,
        id: exam.id.toString(),
        difficulty: normalizeDifficulty(exam.difficulty),
        totalQuestions: exam.questions?.length ?? 0,
      }));

  } catch (error) {
    console.error('getExams error:', error.message);
    return [];
  }
},

getExamById: async (token, examId) => {
  try {
    const response = await fetch(`${API_URL}/exams/${examId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
    const json = await response.json();
    return json.data ?? null;

  } catch (error) {
    console.error('getExamById error:', error.message);
    return null;
  }
},

// ⚠️ submitExam — Backend chưa implement, giữ placeholder
submitExam: async (token, examId, answers) => {
  try {
    const response = await fetch(`${API_URL}/exams/${examId}/submit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ answers })
    });

    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
    return await response.json();

  } catch (error) {
    console.error('submitExam error:', error.message);
    throw error; // Re-throw để UI hiển thị lỗi
  }
}
```

#### Bước 3: Test (sau khi backend implement submitExam)
- [x] Danh sách exam hiển thị đúng
- [x] Chỉ hiện exam có status OPEN
- [x] Questions load đúng khi vào exam
- [x] Submit trả về kết quả đúng

---

## 5. USER PROGRESS — API bổ sung *(thiếu hoàn toàn trong tài liệu gốc)*

> Courses cần hiển thị `progress` nhưng không có trong `getCourses` response. Cần API riêng.

### 5.1 Bước làm

#### Bước 1: Thêm vào Api.js
```javascript
getUserProgress: async (token) => {
  try {
    const response = await fetch(`${API_URL}/users/progress`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
    const json = await response.json();

    // Trả về map { courseId: progressPercent } để dễ lookup
    const progressMap = {};
    (json.data ?? []).forEach(p => {
      progressMap[p.courseId] = p.progressPercent ?? 0;
    });
    return progressMap;

  } catch (error) {
    console.error('getUserProgress error:', error.message);
    return {};
  }
}
```

#### Bước 2: Kết hợp với getCourses
```javascript
// Home.js hoặc Roadmap.js

const { token } = useAuth();

const [courses, progressMap] = await Promise.all([
  api.getCourses(token),
  api.getUserProgress(token)
]);

const coursesWithProgress = courses.map(course => ({
  ...course,
  progress: progressMap[course.id] ?? 0
}));
```

> **Lưu ý**: Dùng `Promise.all` để gọi song song, giảm thời gian chờ.

---

## 6. Tóm tắt `Api.js` — Bản đầy đủ sau khi sửa

```javascript
// src/services/Api.js

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Helper functions
function normalizeDifficulty(difficulty) {
  const map = { EASY: 'Easy', MEDIUM: 'Medium', HARD: 'Hard' };
  return map[difficulty] ?? difficulty;
}

async function apiFetch(url, token, options = {}) {
  if (!token) throw new Error('No auth token');

  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (response.status === 401) throw new Error('UNAUTHORIZED');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  return response.json();
}

const api = {

  // AUTH — Đã OK, không sửa
  login: async ({ email, password }) => { /* ... existing code ... */ },
  register: async (data) => { /* ... existing code ... */ },

  // COURSES
  getCourses: async (token) => {
    try {
      const json = await apiFetch('/learning/courses', token);
      return (json.data ?? []).map(course => ({
        ...course,
        fullTitle: course.title,
        longDescription: course.description,
        instructor: null,
        totalHours: null,
        progress: 0,   // Override sau bằng getUserProgress
        modules: [],
      }));
    } catch (e) {
      console.error('getCourses:', e.message);
      return [];
    }
  },

  // LABS
  getLabs: async (token) => {
    try {
      const json = await apiFetch('/learning/labs', token);
      return (json.data ?? []).map(lab => ({
        ...lab,
        id: lab.id.toString(),
        difficulty: normalizeDifficulty(lab.difficulty),
        topology: lab.topologyImgUrl ?? null,
        tools: Array.isArray(lab.tools) ? lab.tools : [],
        steps: Array.isArray(lab.steps) ? lab.steps : [],
      }));
    } catch (e) {
      console.error('getLabs:', e.message);
      return [];
    }
  },

  // EXAMS
  getExams: async (token) => {
    try {
      const json = await apiFetch('/exams', token);
      return (json.data ?? [])
        .filter(exam => exam.status === 'OPEN')
        .map(exam => ({
          ...exam,
          id: exam.id.toString(),
          difficulty: normalizeDifficulty(exam.difficulty),
          totalQuestions: exam.questions?.length ?? 0,
        }));
    } catch (e) {
      console.error('getExams:', e.message);
      return [];
    }
  },

  getExamById: async (token, examId) => {
    try {
      const json = await apiFetch(`/exams/${examId}`, token);
      return json.data ?? null;
    } catch (e) {
      console.error('getExamById:', e.message);
      return null;
    }
  },

  submitExam: async (token, examId, answers) => {
    const json = await apiFetch(`/exams/${examId}/submit`, token, {
      method: 'POST',
      body: JSON.stringify({ answers })
    });
    return json;
  },

  // USER PROGRESS
  getUserProgress: async (token) => {
    try {
      const json = await apiFetch('/users/progress', token);
      const map = {};
      (json.data ?? []).forEach(p => { map[p.courseId] = p.progressPercent ?? 0; });
      return map;
    } catch (e) {
      console.error('getUserProgress:', e.message);
      return {};
    }
  },

  // RESOURCES — Giữ nguyên
  getResources: async (token) => { /* ... existing code ... */ },
};

export default api;
```

---

## 7. Checklist tổng hợp — Trước khi chuyển từ mock sang real

### Pre-flight check
- [ ] Backend đang chạy tại `http://localhost:5000`
- [ ] Database đã có migration và seed data
- [ ] Có ít nhất 1 user token hợp lệ để test

### API test (Postman/curl)
- [x] `GET /learning/courses` → trả về đúng format
- [x] `GET /learning/labs` → trả về đúng format, `tools`/`steps` là valid JSON
- [x] `GET /exams` → trả về đúng format
- [x] `GET /users/progress` → endpoint tồn tại (ĐÃ THÊM)
- [x] `GET /resources` → đang hoạt động ✅

### Frontend check
- [x] `Api.js` — không còn mock data, không còn `await delay()`
- [x] `Home.js` — truyền token vào api calls
- [x] `Labs.js` — difficulty hiển thị đúng case
- [x] `Labs.js` — topology dùng `topologyImgUrl`
- [x] `Exam.js` — chỉ hiện exam status OPEN
- [x] Tất cả component — không crash khi field bị `null/undefined`

### Error handling check
- [x] Token hết hạn → tự động logout qua event listener
- [x] API lỗi 500 → hiển thị thông báo lỗi thân thiện (Đã thêm Toast toàn cục)
- [x] Network offline → không crash app (Đã handle sự kiện offline/online)

---

## 8. Thứ tự thực hiện được khuyến nghị

```
Bước 1: Test backend bằng Postman (30 phút)
   └─ Xác định chính xác response format từng endpoint

Bước 2: Sửa Api.js (45 phút)
   ├─ Thêm helper apiFetch()
   ├─ Sửa getCourses()
   ├─ Sửa getLabs()
   ├─ Thêm getExams(), getExamById()
   └─ Thêm getUserProgress()

Bước 3: Sửa từng page (60 phút)
   ├─ Home.js
   ├─ Roadmap.js
   ├─ Labs.js
   └─ Exam.js

Bước 4: Test end-to-end (30 phút)
   └─ Đi qua toàn bộ checklist ở mục 7

Tổng: ~3 giờ
```

---

**Ghi chú cuối**: Sau khi Phase 1 hoàn thành, tiến hành Phase 2 (React Query) để thay thế toàn bộ `useState` + `useEffect` fetch pattern bằng `useQuery` — giúp cache, retry, và loading state được xử lý tự động.
