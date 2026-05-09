# Kế Hoạch Triển Khai Trang Admin (Full API)

## Tổng Quan

Hiện tại project có cấu trúc Admin **skeleton** — tất cả components (`Dashboard`, `Users`, `Courses`, `Exams`, `Labs`) đều trống, backend routes (`/api/admin`, `/api/users`, `/api/learning`, `/api/exams`) đều bị comment out, và `Api.js` chính vẫn dùng **Mock Data**. Mục tiêu là kết nối hoàn chỉnh từ **Frontend Admin UI → REST API → Backend Controller → Prisma → PostgreSQL**.

---

## User Review Required

> [!IMPORTANT]
> Admin Dashboard sẽ được đặt tại route **`/admin/*`** — tách biệt hoàn toàn với Layout chính (không có Navbar/Footer của user). Chỉ user có `role: 'ADMIN'` mới được truy cập.

> [!WARNING]
> Cần đảm bảo Backend server (`npm run server` hoặc `node src/Backend/Server.js`) đang chạy ở `http://localhost:5000` trước khi test trang Admin. Database PostgreSQL phải có dữ liệu seed.

> [!CAUTION]
> `services/Api.js` hiện dùng Mock Data cho `getCourses`, `getLabs`, `getUserProfile`. Kế hoạch này sẽ thêm các hàm API mới vào `services/api/adminApi.js` để không phá vỡ code cũ đang hoạt động.

---

## Proposed Changes

### Layer 1: Backend — API Endpoints

---

#### [MODIFY] [adminController.js](file:///d:/ĐỒ%20ÁN%20TỐT%20NGHIỆP/ccna-master/src/Backend/controllers/adminController.js)

Triển khai đầy đủ controller cho Admin Dashboard:
- `getStats()` — tổng hợp: tổng users, total courses, total exams, user mới 7 ngày, exam results hôm nay
- `getAdminLogs(page, limit)` — lấy lịch sử hoạt động admin

#### [MODIFY] [userController.js](file:///d:/ĐỒ%20ÁN%20TỐT%20NGHIỆP/ccna-master/src/Backend/controllers/userController.js)

- `getAll(page, limit, search)` — danh sách users, hỗ trợ phân trang + tìm kiếm
- `getById(id)` — chi tiết user
- `updateRole(id, role)` — đổi role STUDENT ↔ ADMIN
- `toggleActive(id)` — kích hoạt / vô hiệu hóa tài khoản
- `deleteUser(id)` — xóa mềm (set `deletedAt`)

#### [MODIFY] [learningController.js](file:///d:/ĐỒ%20ÁN%20TỐT%20NGHIỆP/ccna-master/src/Backend/controllers/learningController.js)

- `getAllCourses(page, limit)` — danh sách courses + số modules
- `createCourse(data)` — tạo course mới (hỗ trợ middleware `multer` để upload cover image)
- `updateCourse(id, data)` — chỉnh sửa course (hỗ trợ upload cover image)
- `deleteCourse(id)` — xóa mềm
- `getAllLabs(page, limit)` — danh sách labs + difficulty
- `createLab(data)` / `updateLab(id, data)` — tạo/chỉnh sửa lab (hỗ trợ upload file `.pkt` qua middleware `multer`)
- `deleteLab(id)` — xóa mềm
- `getAllLessons(moduleId)` — lấy lessons theo module

#### [MODIFY] [examController.js](file:///d:/ĐỒ%20ÁN%20TỐT%20NGHIỆP/ccna-master/src/Backend/controllers/examController.js)

- `getAllExams(page, limit)` — danh sách exams + số câu hỏi
- `getExamById(id)` — chi tiết exam + câu hỏi
- `createExam(data)` — tạo exam (Sử dụng tính năng **Nested Writes** của Prisma `create: { questions: { create: [...] } }` để insert Exam và Questions cùng tùy chọn Options trong một transaction duy nhất, payload gửi từ Frontend dạng cấu trúc cây)
- `updateExam(id, data)` — chỉnh sửa exam
- `deleteExam(id)` — xóa mềm
- `getExamResults(page, limit)` — lịch sử thi của tất cả users

---

#### [MODIFY] [admin.js (routes)](file:///d:/ĐỒ%20ÁN%20TỐT%20NGHIỆP/ccna-master/src/Backend/routes/admin.js)

```
GET    /api/admin/stats       - Thống kê tổng quan
GET    /api/admin/logs        - Lịch sử hành động admin
GET    /api/admin/users       - Danh sách users (Admin only)
POST   /api/admin/users       - Admin tạo mới tài khoản (set password mặc định)
GET    /api/admin/users/:id   - Chi tiết user cho Admin
PATCH  /api/admin/users/:id/role - Đổi role
PATCH  /api/admin/users/:id/toggle - Toggle active
DELETE /api/admin/users/:id   - Xóa mềm
```
Tất cả routes dùng middleware: `verifyToken` + `checkRole(['ADMIN'])`

#### [MODIFY] [users.js (routes)](file:///d:/ĐỒ%20ÁN%20TỐT%20NGHIỆP/ccna-master/src/Backend/routes/users.js)

```
GET    /api/users/profile/me  - Xem Profile của chính Học viên (verifyToken)
```

#### [MODIFY] [learning.js (routes)](file:///d:/ĐỒ%20ÁN%20TỐT%20NGHIỆP/ccna-master/src/Backend/routes/learning.js)

```
GET    /api/learning/courses              - Danh sách courses
POST   /api/learning/courses              - Tạo course (multipart/form-data qua multer)
PUT    /api/learning/courses/:id          - Cập nhật course (multipart/form-data qua multer)
DELETE /api/learning/courses/:id          - Xóa course
GET    /api/learning/labs                 - Danh sách labs
POST   /api/learning/labs                 - Tạo lab (multipart/form-data qua multer)
PUT    /api/learning/labs/:id             - Cập nhật lab (multipart/form-data qua multer)
DELETE /api/learning/labs/:id             - Xóa lab
```

#### [MODIFY] [exams.js (routes)](file:///d:/ĐỒ%20ÁN%20TỐT%20NGHIỆP/ccna-master/src/Backend/routes/exams.js)

```
GET    /api/exams             - Danh sách exams
POST   /api/exams             - Tạo exam
GET    /api/exams/:id         - Chi tiết exam + câu hỏi
PUT    /api/exams/:id         - Cập nhật exam
DELETE /api/exams/:id         - Xóa exam
GET    /api/exams/results     - Lịch sử thi
```

---

### Layer 2: Frontend — API Service Layer

---

#### [MODIFY] [adminApi.js](file:///d:/ĐỒ%20ÁN%20TỐT%20NGHIỆP/ccna-master/src/services/api/adminApi.js)

Viết đầy đủ các hàm API call (dùng `fetch` + token từ `localStorage`):

```js
export const adminApi = {
  getStats(token),
  getLogs(token, page),

  // Users
  getUsers(token, page, search),
  createUser(token, data),
  updateUserRole(token, userId, role),
  toggleUserActive(token, userId),
  deleteUser(token, userId),

  // Courses & Labs
  getCourses(token, page),
  createCourse(token, formData), // Dùng FormData để upload ảnh qua multipart
  updateCourse(token, id, formData),
  deleteCourse(token, id),
  getLabs(token, page),
  createLab(token, formData),    // Dùng FormData để upload file .pkt
  updateLab(token, id, formData),
  deleteLab(token, id),

  // Exams
  getExams(token, page),
  createExam(token, data),       // Gửi payload JSON cấu trúc cây (Exam -> Questions -> Options)
  updateExam(token, id, data),
  deleteExam(token, id),
  getExamResults(token, page),
}
```

---

### Layer 3: Frontend — Admin UI Components

---

#### [MODIFY] [App.js](file:///d:/ĐỒ%20ÁN%20TỐT%20NGHIỆP/ccna-master/src/App.js)

Thêm Admin routes tách biệt (không dùng Layout):
```jsx
<Route path="/admin/*" element={
  <AdminProtectedRoute>
    <AdminLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/users" element={<Users />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/exams" element={<Exams />} />
        <Route path="/labs" element={<Labs />} />
      </Routes>
    </AdminLayout>
  </AdminProtectedRoute>
} />
```

#### [NEW] [AdminProtectedRoute.js](file:///d:/ĐỒ%20ÁN%20TỐT%20NGHIỆP/ccna-master/src/components/Admin/AdminProtectedRoute.js)

Route guard: kiểm tra `user.role === 'ADMIN'`, nếu không thì redirect về `/`.

---

#### [MODIFY] [AdminLayout.js](file:///d:/ĐỒ%20ÁN%20TỐT%20NGHIỆP/ccna-master/src/components/Admin/Layout/AdminLayout.js)

Hoàn thiện layout: tích hợp `<Sidebar />` và `<TopBar />` thật sự.

#### [MODIFY] [Sidebar.js](file:///d:/ĐỒ%20ÁN%20TỐT NGHIỆP/ccna-master/src/components/Admin/Layout/Sidebar.js)

Sidebar với menu items:
- 📊 Dashboard
- 👥 Users  
- 📚 Courses & Labs
- 📝 Exams
- 📋 Admin Logs

Hiển thị active state dựa theo current URL.

#### [MODIFY] [TopBar.js](file:///d:/ĐỒ%20ÁN%20TỐT%20NGHIỆP/ccna-master/src/components/Admin/Layout/TopBar.js)

Topbar với: breadcrumb, tên admin, nút logout.

---

#### [MODIFY] [Dashboard.js](file:///d:/ĐỒ%20ÁN%20TỐT%20NGHIỆP/ccna-master/src/components/Admin/Views/Dashboard.js)

- **Stats cards**: Tổng Users, Courses, Exams, Kết quả hôm nay (gọi `adminApi.getStats()`)
- **Recent Activity**: Bảng AdminLogs mới nhất (gọi `adminApi.getLogs()`)
- Dùng `<StatsCard />` component

#### [MODIFY] [Users.js](file:///d:/ĐỒ%20ÁN%20TỐT%20NGHIỆP/ccna-master/src/components/Admin/Views/Users.js)

- Bảng danh sách users với phân trang + ô tìm kiếm
- Các action: Đổi Role, Toggle Active, Xóa
- Modal xác nhận với `<AdminModal />`

#### [MODIFY] [Courses.js](file:///d:/ĐỒ%20ÁN%20TỐT%20NGHIỆP/ccna-master/src/components/Admin/Views/Courses.js)

- Bảng danh sách courses
- Form tạo/chỉnh sửa course trong Modal
- Xác nhận xóa

#### [MODIFY] [Exams.js](file:///d:/ĐỒ%20ÁN%20TỐT%20NGHIỆP/ccna-master/src/components/Admin/Views/Exams.js)

- Bảng danh sách exams
- Xem chi tiết exam + câu hỏi (modal)
- Form tạo/chỉnh sửa exam

#### [MODIFY] [Labs.js](file:///d:/ĐỒ%20ÁN%20TỐT%20NGHIỆP/ccna-master/src/components/Admin/Views/Labs.js)

- Bảng danh sách labs
- Form tạo/chỉnh sửa lab trong Modal

---

#### [MODIFY] [StatsCard.js](file:///d:/ĐỒ%20ÁN%20TỐT%20NGHIỆP/ccna-master/src/components/Admin/Components/StatsCard.js)

Reusable card: title, value, icon, trend indicator.

#### [MODIFY] [DataTable.js](file:///d:/ĐỒ%20ÁN%20TỐT%20NGHIỆP/ccna-master/src/components/Admin/Components/DataTable.js)

Reusable table: columns config, data, phân trang, loading skeleton.

#### [MODIFY] [AdminModal.js](file:///d:/ĐỒ%20ÁN%20TỐT%20NGHIỆP/ccna-master/src/components/Admin/Components/AdminModal.js)

Reusable modal: title, children (form), confirm/cancel buttons.

---

### Layer 4: Styling

---

#### [MODIFY] [AdminLayout.css](file:///d:/ĐỒ%20ÁN%20TỐT%20NGHIỆP/ccna-master/src/css/Admin/AdminLayout.css)

CSS cho layout 2 cột: sidebar cố định bên trái + main content cuộn.

#### [MODIFY] [AdminVariables.css](file:///d:/ĐỒ%20ÁN%20TỐT%20NGHIỆP/ccna-master/src/css/Admin/AdminVariables.css)

Màu sắc, typography, spacing cho Admin theme (dark sidebar).

#### [MODIFY] [AdminViews.css](file:///d:/ĐỒ%20ÁN%20TỐT%20NGHIỆP/ccna-master/src/css/Admin/AdminViews.css)

Styles cho Stats Cards, DataTable, Modal, Forms.

#### [NEW] AdminSidebar.css & AdminTopBar.css

CSS riêng cho Sidebar và TopBar.

---

## Thứ Tự Triển Khai (Priority)

| Bước | Phạm vi | Mô tả |
|------|---------|-------|
| 1 | Backend | Viết controllers + routes cho Users và Admin Stats |
| 2 | Frontend Service | Viết `adminApi.js` đầy đủ |
| 3 | Frontend Layout | Hoàn thiện AdminLayout, Sidebar, TopBar, AdminProtectedRoute |
| 4 | Frontend CSS | Viết CSS cho toàn bộ Admin area |
| 5 | Frontend Views | Dashboard (Stats + Logs) |
| 6 | Frontend Views | Users Management (CRUD) |
| 7 | Backend + Views | Courses & Labs |
| 8 | Backend + Views | Exams |

---

## Verification Plan

### Automated (Manual Test)
1. Đăng nhập bằng tài khoản `ADMIN` → kiểm tra redirect về `/admin/`
2. Đăng nhập bằng tài khoản `STUDENT` → truy cập `/admin/` phải bị chặn
3. Dashboard hiển thị đúng số liệu stats từ DB
4. CRUD Users: tạo → sửa role → disable → xóa
5. CRUD Courses, Labs, Exams tương tự

### Manual Verification
- Kiểm tra giao diện Admin không bị ảnh hưởng bởi user Layout CSS
- Kiểm tra responsive trên các màn hình 1280px, 1920px

---

## Các Luồng Bổ Sung Đặc Biệt (Phản Hội Từ Cố Vấn/User)

Dưới đây là các phần thiếu sót đã được bổ sung vào hệ thống API & System Design:

**A. Luồng Xử lý File/Image (Upload)**
- Sử dụng middleware `multer` cho route `POST /api/learning/courses` và `POST /api/learning/labs`.
- Tích hợp lớp đối tượng `FormData` trên Frontend trong `services/api/adminApi.js`.

**B. Luồng Tạo Mới Người Dùng (Create User cho Admin)**
- Cung cấp route `POST /api/admin/users` riêng nhằm giúp Admin chủ động cấp phát tài khoản (có mật khẩu cho trước hoặc cấp tự động).

**C. Xử lý Trùng Lặp Route Users (Routing Conflict)**
- Tách bạch rõ 2 ngữ cảnh:
  - Học viên xem hồ sơ: Gọi qua `GET /api/users/profile/me` (Chỉ verify token).
  - Admin xem người dùng khác: Gọi qua `GET /api/admin/users/:id` (Verify token + verify role).

**D. Luồng Nested Write (Lưu dữ liệu lồng nhau) của Prisma**
- Khởi tạo Bài thi (Exam) tích hợp gửi Payload JSON dạng cây, cho phép hệ thống tạo câu hỏi (Questions) và đáp án (Options) bên trong duy nhất một Transaction (sử dụng Prisma nested `create`).