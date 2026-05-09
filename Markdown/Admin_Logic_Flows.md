# 🏗️ Admin Panel — Tài Liệu Luồng Logic Hoàn Chỉnh

Tài liệu này mô tả **toàn bộ luồng logic, API, state và hành vi** của từng trang Admin.
Mục đích: Giúp bạn tái tạo lại UI/UX mà không cần đọc source code.

---

## 📁 Cấu Trúc File Hệ Thống

```
src/
├── components/Admin/
│   ├── Layout/
│   │   ├── AdminLayout.js      — Khung chính (Sidebar + TopBar + Content)
│   │   ├── Sidebar.js          — Menu điều hướng trái (7 mục)
│   │   └── TopBar.js           — Thanh trên (Tên Admin, nút Logout)
│   ├── Components/
│   │   ├── AdminModal.js       — Modal dùng chung (title, children, onConfirm)
│   │   └── StatsCard.js        — Card thống kê trên Dashboard
│   ├── Views/
│   │   ├── Dashboard.js        — Trang tổng quan
│   │   ├── Users.js            — Quản lý người dùng
│   │   ├── Courses.js          — Quản lý khóa học (danh sách)
│   │   ├── CourseDetail.js     — Quản lý nội dung khóa học (Module + Lesson + Topic)
│   │   ├── Exams.js            — Quản lý bài thi
│   │   ├── Labs.js             — Quản lý bài lab
│   │   ├── Resources.js        — Quản lý tài liệu
│   │   └── Tools.js            — Quản lý công cụ
│   └── AdminProtectedRoute.js  — Guard: Chỉ role ADMIN mới vào được
├── services/api/
│   └── adminApi.js             — Tất cả hàm gọi API cho admin
└── Backend/
    ├── controllers/
    │   ├── adminController.js   — getStats, getAdminLogs
    │   ├── userController.js    — CRUD User
    │   ├── learningController.js— CRUD Course, Module, Lesson, Lab, CourseTopic, Resource
    │   ├── examController.js    — CRUD Exam + ExamQuestion
    │   └── toolController.js    — CRUD Tool
    ├── routes/
    │   ├── admin.js, learning.js, exams.js, tools.js, users.js
    └── middleware/
        ├── auth.js              — verifyToken, checkRole
        └── upload.js            — Multer (thumbnail, filePka, file)
```

---

## 🔐 Luồng Phân Quyền (Authentication Flow)

```
User mở /admin → AdminProtectedRoute kiểm tra:
  ├── Có token trong AuthContext? → KHÔNG → Redirect /login
  └── CÓ → Decode JWT, kiểm tra role
        ├── role !== 'ADMIN' → Redirect /
        └── role === 'ADMIN' → Render AdminLayout + children
```

**Mọi API call đều gửi kèm header:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Backend middleware chain:** `verifyToken → checkRole(['ADMIN']) → Controller`

---

## 📊 Trang 1: DASHBOARD (`/admin/dashboard`)

### Dữ liệu hiển thị
| Thẻ thống kê | API | Trường dữ liệu |
|---|---|---|
| Tổng học viên | `GET /api/admin/stats` | `totalUsers` |
| Tổng khóa học | | `totalCourses` |
| Tổng bài thi | | `totalExams` |
| Học viên mới (7 ngày) | | `recentUsers` |

### Luồng
```
Component mount → useEffect
  → adminApi.getStats(token)
  → setState({ totalUsers, totalCourses, totalExams, recentUsers })
  → Render 4 StatsCard
```

### Nhật ký Admin (AdminLog) — ĐÃ CÓ API, chưa hiển thị
```
adminApi.getLogs(token, page) → GET /api/admin/logs
Trả về: { data: [{ id, action, targetTable, targetId, description, ipAddress, admin: {fullName} }], pagination }
```

---

## 👥 Trang 2: USERS (`/admin/users`)

### State
```js
users = []           // Danh sách user
search = ''          // Từ khóa tìm kiếm
isModalOpen = false  // Modal tạo user
formData = { fullName, email, password, role }
```

### Bảng hiển thị
| Cột | Trường DB | Ghi chú |
|---|---|---|
| ID | `id` | Int, auto-increment |
| Họ tên | `fullName` | |
| Email | `email` | Unique |
| Vai trò | `role` | Badge: ADMIN (đỏ) / STUDENT (xanh) |
| Trạng thái | `isActive` | Badge: Hoạt động / Đã khóa |
| Hành động | — | 3 nút: Đổi quyền, Khóa/Mở, Xóa |

### Luồng hành động

| Hành động | API call | Method | Endpoint |
|---|---|---|---|
| Lấy danh sách | `getUsers(token, page, search)` | GET | `/api/admin/users?page=1&search=` |
| Tạo mới | `createUser(token, {fullName, email, password, role})` | POST | `/api/admin/users` |
| Đổi quyền | `updateUserRole(token, userId, newRole)` | PATCH | `/api/admin/users/:id/role` |
| Khóa/Mở | `toggleUserActive(token, userId)` | PATCH | `/api/admin/users/:id/toggle` |
| Xóa | `deleteUser(token, userId)` | DELETE | `/api/admin/users/:id` |

### Form tạo User
```
Trường: fullName (text), email (email), password (password), role (select: STUDENT/ADMIN)
Submit → POST /api/admin/users → Backend hash password → prisma.user.create
```

---

## 📚 Trang 3: COURSES (`/admin/courses`)

### State
```js
courses = []
formData = { code, title, description, level, status, orderIndex, thumbnail (File) }
```

### Bảng hiển thị
| Cột | Trường DB | Ghi chú |
|---|---|---|
| Mã | `code` | Badge xanh (VD: ITN, SRWE) |
| Khóa học | `title` + `thumbnailUrl` | Ảnh 40x40 + tên |
| Mô tả | `description` | Cắt 40 ký tự |
| Độ khó | `level` | BEGINNER / INTERMEDIATE / ADVANCED |
| Trạng thái | `status` | Badge: PUBLISHED (xanh) / DRAFT (xám) |
| Thứ tự | `orderIndex` | Số nguyên |
| Hành động | — | 2 nút: 📖 Quản lý nội dung, 🗑️ Xóa |

### Luồng hành động

| Hành động | API | Method | Endpoint | Body |
|---|---|---|---|---|
| Lấy DS | `getCourses` | GET | `/api/learning/courses?page=1` | — |
| Tạo mới | `createCourse` | POST | `/api/learning/courses` | **FormData** (thumbnail là file) |
| Xóa | `deleteCourse` | DELETE | `/api/learning/courses/:id` | — (soft-delete) |
| Quản lý nội dung | — | — | Navigate → `/admin/courses/:courseId` | — |

### Form tạo Course (FormData, multipart)
```
code*        — Mã khóa học (max 10 ký tự)
title*       — Tên khóa học
description  — Mô tả
level        — Select: BEGINNER / INTERMEDIATE / ADVANCED
status       — Select: DRAFT / PUBLISHED
orderIndex   — Số nguyên (thứ tự hiển thị trên Roadmap)
thumbnail    — File ảnh (upload → /uploads/thumbnails/)
```

**Backend logic tạo Course:**
```
id = code.toLowerCase()  (auto-generate, max 10 chars)
code = từ form
orderIndex = từ form (default 0)
thumbnailUrl = /uploads/thumbnails/<uuid>.<ext>
```

---

## 📖 Trang 4: COURSE DETAIL (`/admin/courses/:courseId`)

### Đây là trang PHỨC TẠP NHẤT — quản lý 3 entity lồng nhau

### State
```js
course = {}              // Thông tin khóa học cha
modules = []             // Danh sách Chương (include lessons bên trong)
topics = []              // Danh sách Chủ đề (tags)
expandedModules = {}     // { moduleId: true/false } — accordion state
topicInput = ''          // Input gõ topic mới
moduleForm = { title, description }
lessonForm = { title, sectionNumber, contentHtml, videoUrl }
```

### Layout trang
```
┌──────────────────────────────────────────────────┐
│ [← Quay lại]   Tên khóa: CCNA ITN               │
│                 Mã: ITN • 3 chương • 12 bài học  │
├──────────────────────────────────────────────────┤
│ 🏷️ Chủ đề (Topics)                               │
│ [IPv4] [x]  [OSI Model] [x]  [TCP/IP] [x]       │
│ [ Nhập chủ đề mới...          ] [+ Thêm]        │
├──────────────────────────────────────────────────┤
│ [+ Thêm Chương]                                  │
│                                                  │
│ ▼ Chương 1: Giới thiệu Mạng           [🗑️]     │
│ ┌──────────────────────────────────────┐         │
│ │ 📄 1.1.1 Mạng là gì?          [🗑️] │         │
│ │ 🎬 1.1.2 Các loại mạng        [🗑️] │         │
│ │ [+ Thêm Bài Học - - - - - -]       │         │
│ └──────────────────────────────────────┘         │
│ ▶ Chương 2: Mô hình OSI               [🗑️]     │
└──────────────────────────────────────────────────┘
```

### Luồng API

| Hành động | API | Method | Endpoint |
|---|---|---|---|
| Lấy Modules + Lessons | `getModules(token, courseId)` | GET | `/api/learning/courses/:courseId/modules` |
| Tạo Module | `createModule(token, courseId, {title, description})` | POST | `/api/learning/courses/:courseId/modules` |
| Xóa Module | `deleteModule(token, moduleId)` | DELETE | `/api/learning/modules/:id` |
| Lấy Topics | `getTopics(token, courseId)` | GET | `/api/learning/courses/:courseId/topics` |
| Tạo Topic | `createTopic(token, courseId, {title})` | POST | `/api/learning/courses/:courseId/topics` |
| Xóa Topic | `deleteTopic(token, topicId)` | DELETE | `/api/learning/topics/:id` |
| Tạo Lesson | `createLesson(token, moduleId, {...})` | POST | `/api/learning/modules/:moduleId/lessons` |
| Xóa Lesson | `deleteLesson(token, lessonId)` | DELETE | `/api/learning/lessons/:id` |

### Module schema → DB
```
id          — String, auto-gen: m + timestamp (max 10 chars)
courseId     — FK → Course
title*      — VarChar(200)
description — Text (tùy chọn)
orderIndex  — Int (auto = count + 1)
```

### Lesson schema → DB
```
id            — Int, auto-increment
moduleId      — FK → Module
title*        — VarChar(200)
sectionNumber — VD: "1.1.1" (tùy chọn)
contentHtml   — Text (nội dung bài giảng HTML)
videoUrl      — VarChar(500) (link YouTube...)
videoDuration — VarChar(20)
orderIndex    — Int (auto = count + 1)
```

### CourseTopic schema → DB
```
id         — Int, auto-increment
courseId    — FK → Course
title*     — VarChar(100) — VD: "IPv4 & IPv6"
orderIndex — Int (auto = count + 1)
```

---

## 📝 Trang 5: EXAMS (`/admin/exams`)

### State
```js
exams = []
courses = []   // Để dropdown chọn khóa học
formData = {
  title, examCode, totalQuestions, durationMinutes,
  passingScore, difficulty, courseId, questionsJson
}
```

### Bảng hiển thị
| Cột | Trường DB | Ghi chú |
|---|---|---|
| ID | `id` | Int |
| Bài thi | `title` + `difficulty` | Tên + sublabel độ khó |
| Mã đề | `examCode` | VD: EX-001 |
| Số câu | `totalQuestions` | + " câu" |
| Thời gian | `durationMinutes` | + " phút" |
| Điểm sàn | `passingScore` | + "%" |
| Khóa học | `course.code` | FK relation |

### Form tạo Exam (JSON)
```
title*           — Tên bài thi
examCode         — Mã đề (tùy chọn)
totalQuestions*  — Số câu hỏi (Int)
durationMinutes* — Thời gian làm bài (Int, phút)
passingScore     — Điểm sàn % (default 70)
difficulty       — Select: EASY / MEDIUM / HARD / trống
courseId         — Dropdown khóa học (tùy chọn)
questionsJson    — Textarea JSON:
```

### JSON format câu hỏi (ExamQuestion)
```json
[
  {
    "question": "Giao thức nào hoạt động ở tầng Transport?",
    "options": ["HTTP", "TCP", "IP", "ARP"],
    "correctAnswer": 1,
    "explanation": "TCP hoạt động ở tầng Transport."
  }
]
```
**Chú ý quan trọng:**
- `options` = Mảng JSON chuỗi (KHÔNG phải nested relation)
- `correctAnswer` = Index vị trí đáp án đúng (bắt đầu từ 0)
- `orderIndex` = Backend tự gán = idx + 1

---

## 🧪 Trang 6: LABS (`/admin/labs`)

### State
```js
labs = []
courses = []
formData = { title, category, difficulty, duration, guideContent, courseId, moduleId, filePka (File) }
```

### Bảng hiển thị
| Cột | Trường DB | Badge |
|---|---|---|
| ID | `id` | Int |
| Bài Lab | `title` + `fileUrl` | Icon + tên + tên file |
| Danh mục | `category` | VD: Routing, Switching |
| Độ khó | `difficulty` | EASY (xanh), MEDIUM (vàng), HARD (đỏ) |
| Thời lượng | `duration` | VD: "30 phút" |
| Khóa học | `course.title` | FK relation |

### Form tạo Lab (FormData, multipart)
```
title*       — Tên bài Lab
category     — Danh mục (text)
difficulty   — Select: EASY / MEDIUM / HARD
duration     — Thời lượng (text)
courseId      — Dropdown khóa học
moduleId     — Text input (VD: m1)
guideContent — Textarea hướng dẫn thực hành
filePka      — File .pkt/.pka (upload → /uploads/labs/)
```

---

## 📂 Trang 7: RESOURCES (`/admin/resources`)

### State
```js
resources = []
courses = []
formData = { title, type, courseId, file (File) }
```

### Bảng hiển thị
| Cột | Trường DB | Ghi chú |
|---|---|---|
| ID | `id` | |
| Tài liệu | `title` + `fileUrl` | Icon màu theo type + tên file |
| Loại | `type` | Badge: pdf, doc, pptx, xlsx, png |
| Kích thước | `size` | VD: "150 KB" |
| Khóa học | `course.code` | FK |
| Hành động | — | Nút: 📥 Tải xuống, 🗑️ Xóa |

### Màu sắc theo loại file
```
pdf  → #EA4335 (đỏ)
doc  → #4285F4 (xanh dương)
pptx → #FBBC04 (vàng)
xlsx → #34A853 (xanh lá)
png  → #9C27B0 (tím)
```

### Form tạo Resource (FormData, multipart)
```
title*   — Tên tài liệu
type     — Select: Tự nhận diện / PDF / Word / PowerPoint / Excel / Hình ảnh
courseId  — Dropdown khóa học
file*    — File upload → /uploads/resources/
```

**Backend auto-fill:** `size` = fileSize / 1024 + " KB", `type` = mimetype nếu không chọn

---

## 🔧 Trang 8: TOOLS (`/admin/tools`)

### State
```js
tools = []
formData = { title, description, iconName, linkUrl, orderIndex }
```

### Bảng hiển thị
| Cột | Trường DB | Ghi chú |
|---|---|---|
| ID | `id` | |
| Công cụ | `title` + `description` | Icon Wrench + tên + mô tả ngắn |
| Đường dẫn | `linkUrl` | VD: /tools/subnet |
| Icon | `iconName` | Tên Lucide icon |
| Thứ tự | `orderIndex` | |
| Trạng thái | `isActive` | Badge: Bật (xanh) / Tắt (xám) |
| Hành động | — | Nút: Toggle Bật/Tắt, 🗑️ Xóa |

### Luồng API
| Hành động | API | Method | Endpoint |
|---|---|---|---|
| Lấy DS | `getTools` | GET | `/api/tools` |
| Tạo | `createTool` | POST | `/api/tools` |
| Toggle | `toggleTool` | PATCH | `/api/tools/:id/toggle` |
| Xóa | `deleteTool` | DELETE | `/api/tools/:id` |

---

## 🧩 Component Dùng Chung

### AdminModal
```jsx
<AdminModal
  title="Tiêu đề Modal"
  isOpen={boolean}
  onClose={function}
  onConfirm={function}
  confirmText="Xác nhận"  // (mặc định)
>
  {children}  // Form content
</AdminModal>
```
- Overlay đen mờ, modal giữa màn hình
- Nút Hủy + Nút Xác Nhận (admin-btn-primary)

### AdminProtectedRoute
```
Kiểm tra: AuthContext.user.role === 'ADMIN'
  → Đúng: Render children
  → Sai: Navigate('/') hoặc Navigate('/login')
```

### Upload Middleware (Multer)
```
fieldname === 'thumbnail'  → uploads/thumbnails/
fieldname === 'filePka'    → uploads/labs/
fieldname === 'file'       → uploads/resources/
else                       → uploads/

Filename: UUID v4 + extension gốc
Max size: 50MB
```

---

## 🗺️ Sơ Đồ Điều Hướng (Route Map)

```
/admin
  ├── /dashboard        → Dashboard.js
  ├── /users            → Users.js
  ├── /courses          → Courses.js
  │   └── /courses/:id  → CourseDetail.js (Module, Lesson, Topic)
  ├── /exams            → Exams.js
  ├── /labs             → Labs.js
  ├── /resources        → Resources.js
  └── /tools            → Tools.js
```

### Sidebar Menu (7 mục)
1. 📊 Dashboard
2. 👥 Users
3. 📚 Courses
4. 📝 Exams
5. 🧪 Labs
6. 📂 Resources
7. 🔧 Tools
