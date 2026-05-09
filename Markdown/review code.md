Admin Dashboard
├─ 📊 Overview (users count, courses, active sessions)
├─ 👥 User Management (CRUD + role assignment)
├─ 📚 Course Management (Course → Module → Lesson)
├─ 🔬 Lab Management
├─ 📋 Exam Management (with question editor)
├─ 📈 Analytics & Reports
└─ 📋 System Logs (admin activity tracking)# 📊 REVIEW CODE & THIẾT KẾ ADMIN PANEL

**Ngày tạo:** 13/04/2026  
**Dự án:** CCNA Learning Platform  
**Công nghệ:** React 18 + Express + Prisma + PostgreSQL

---

## 📋 MỤC LỤC

1. [Tổng quan kiến trúc hiện tại](#tổng-quan-kiến-trúc-hiện-tại)
2. [Phân tích cấu trúc Frontend](#phân-tích-cấu-trúc-frontend)
3. [Phân tích cấu trúc Backend](#phân-tích-cấu-trúc-backend)
4. [Database Schema Review](#database-schema-review)
5. [Định hướng thiết kế Admin Panel](#định-hướng-thiết-kế-admin-panel)
6. [Kiến trúc File Structure cho Admin](#kiến-trúc-file-structure-cho-admin)
7. [Component Design Pattern](#component-design-pattern)
8. [API Endpoints cần thiết](#api-endpoints-cần-thiết)
9. [Authentication & Authorization](#authentication--authorization)
10. [UI/UX Design Recommendations](#uiux-design-recommendations)

---

## 🏗️ TỔNG QUAN KIẾN TRÚC HIỆN TẠI

### Stack Công nghệ
```
Frontend:
  ├─ React 18.3.1 (UI Library)
  ├─ React Router DOM 7.10.1 (SPA Navigation)
  ├─ Axios 1.14.0 (HTTP Client)
  ├─ Lucide React 0.556.0 (Icon Library)
  └─ CSS (Custom Styling)

Backend:
  ├─ Express 5.2.1 (REST API Server)
  ├─ Prisma 7.6.0 (ORM)
  ├─ PostgreSQL (Database)
  ├─ JWT (Token Authentication)
  └─ bcrypt (Password Hashing)

Deployment:
  ├─ React Scripts (Development & Build)
  └─ Node.js (Backend Server)
```

### Mô hình dữ liệu hiện tại
```
PostgreSQL Database
├─ User (với roles: STUDENT, SUPER_ADMIN, CONTENT_MANAGER, EXAM_MANAGER)
├─ Course → Module → Lesson
├─ Lab (thí nghiệm)
├─ Exam → ExamQuestion → ExamResult
├─ CourseTopic (chủ đề khóa học) ⭐ MỚI
├─ Resource (tài nguyên bổ sung)
├─ UserProgress (theo dõi tiến độ)
├─ UserBadge, UserActivity, UserNote
└─ AdminLog (nhật ký hành động admin)
```

---

## 📱 PHÂN TÍCH CẤU TRÚC FRONTEND

### Hiện tại có các trang:
```
src/components/
├─ Auth/
│  ├─ Login.js
│  ├─ Register.js
│  ├─ ProtectedRoute.js (Bảo vệ route theo role)
│  └─ (Chưa có Admin role check)
│
├─ Content/
│  ├─ Home.js (Trang chủ)
│  ├─ Roadmap.js (Khóa học - Publiccc)
│  ├─ Lesson.js (Bài học)
│  ├─ Labs.js (Bài thí nghiệm)
│  ├─ Exam.js (Thi trắc nghiệm)
│  ├─ Doc.js (Resources)
│  ├─ Profile.js (Thông tin cá nhân)
│  └─ Layout.js (Header + Footer wrapper)
│
├─ Header/ (Navigation)
├─ Footer/
├─ Tools/ (Subnet Calc, VLSM, Port Lookup, CLI Lookup)
└─ Toast.js (Thông báo)

css/
├─ App.css
├─ Navbar.css
├─ Home.css
├─ Roadmap.css
├─ Lesson.css
├─ Labs.css
├─ Profile.css
└─ (Chưa có Admin CSS)
```

### Context & State Management
```
src/context/
└─ AuthContext.js
   ├─ user (id, fullName, email, role, level, streak...)
   ├─ token (JWT Access Token)
   ├─ isAuthenticated (boolean)
   ├─ loading (boolean)
   ├─ login(userData, token) → lưu localStorage
   ├─ logout() → xóa localStorage
   └─ updateUser(data) → cập nhật user state

⚠️ THIẾU: 
  - GlobalAlert/Toast Context
  - Pagination Context
  - Filter/Search Context
  - Permission Provider (cho role-based access)
```

### Services (API Calls)
```
src/services/
└─ Api.js
   ├─ api.register(data)
   ├─ api.login(data)
   └─ (Chưa có các API khác)

⚠️ CẦN BỔ SUNG:
  - CRUD API cho Course, Module, Lesson
  - CRUD API cho Lab, Exam
  - User management API
  - Admin log API
  - Search/Filter API
```

---

## 🔌 PHÂN TÍCH CẤU TRÚC BACKEND

### Server.js hiện tại
```
Express Server (Port 5000)
├─ Middleware:
│  ├─ CORS (cho React ở port 3000)
│  ├─ express.json() (parse JSON body)
│  └─ (Chưa có rate limiting, logging middleware)
│
├─ API Endpoints:
│  ├─ POST /api/auth/register
│  ├─ POST /api/auth/login
│  └─ (Chưa có admin endpoints)
│
├─ Database:
│  ├─ Pool (PostgreSQL)
│  ├─ PrismaClient (ORM)
│  └─ Connection: postgresql://postgres:123456@localhost:5432/netmastery_db
│
├─ Authentication:
│  ├─ JWT_SECRET: 'netmastery_bi_mat_2026'
│  ├─ bcrypt (password hashing)
│  └─ (Chưa có role-based middleware)
│
└─ Error Handling:
   └─ Basic try-catch (cần cải thiện)

⚠️ CẦN CẢI THIỆN:
  1. Tách API routes theo module (auth, users, courses, etc.)
  2. Thêm authentication middleware cho protected routes
  3. Thêm authorization middleware cho role-based access
  4. Implement error handling middleware
  5. Thêm logging/monitoring
  6. Thêm input validation (Joi hoặc Yup)
  7. Rate limiting
  8. Database transaction support
```

### Cấu trúc hiện tại (Tất cả trong 1 file)
```
src/Backend/
├─ Server.js (ALL IN ONE - không tốt)
│  ├─ Route: /api/auth/register
│  ├─ Route: /api/auth/login
│  └─ (Logic, middleware, database query tất cả ở đây)
│
└─ db.js (Chưa dùng đến)
```

---

## 💾 DATABASE SCHEMA REVIEW

### ✅ Ưu điểm hiện tại
1. **Quan hệ rõ ràng:** Course → Module → Lesson (GOOD ✓)
2. **Role-based system:** STUDENT, SUPER_ADMIN, CONTENT_MANAGER, EXAM_MANAGER (GOOD ✓)
3. **Soft delete:** deletedAt field để giữ dữ liệu (GOOD ✓)
4. **Audit trail:** AdminLog bảng để theo dõi (GOOD ✓)
5. **Progress tracking:** UserProgress bảng chi tiết (GOOD ✓)
6. **Cascade delete:** onDelete: Cascade (GOOD ✓)
7. **New CourseTopic:** Tổ chức chủ đề theo course (GOOD ✓)

### ⚠️ Cần cải thiện
1. **Thiếu bảng Permission:** Không có granular permissions (chỉ có role)
   ```prisma
   model Permission {
     id        Int      @id @default(autoincrement())
     name      String   @unique // "CREATE_COURSE", "EDIT_EXAM", etc.
     roleId    Int
     role      Role     @relation(fields: [roleId], references: [id])
   }
   ```

2. **Thiếu audit fields cho entities chính**
   ```prisma
   Lesson {
     createdBy   Int?     // Admin nào tạo
     updatedBy   Int?     // Admin nào update
     createdByUser User?
     updatedByUser User?
   }
   ```

3. **ExamQuestion nên có status (draft/published)**
   ```prisma
   status    ExamQuestionStatus @default(DRAFT) // DRAFT, PUBLISHED
   ```

4. **Thiếu bảng Announcement/Notification cho admin**
   ```prisma
   model Announcement {
     id        Int      @id @default(autoincrement())
     title     String
     content   String   @db.Text
     type      String   // SYSTEM, MAINTENANCE, etc.
     createdBy Int
     createdAt DateTime @default(now())
   }
   ```

---

## 🎯 ĐỊNH HƯỚNG THIẾT KẾ ADMIN PANEL

### Mục tiêu Admin Panel
1. **Quản lý nội dung**: Course, Module, Lesson, Lab, Exam
2. **Quản lý người dùng**: Xem, disable/enable, phân quyền
3. **Quản lý thi**: Tạo đề thi, thêm câu hỏi, xem kết quả
### Phân quyền chi tiết
```
STUDENT (Role hiện tại)
├─ Xem course, lesson, lab
├─ Làm exam, ghi chú
└─ Xem profile, badge


SUPER_ADMIN (Admin toàn quyền) ⭐ CẦN THÊM
├─ Toàn bộ quyền của CONTENT_MANAGER + EXAM_MANAGER
├─ Quản lý User (tạo, disable, phân quyền)
├─ Quản lý System (announcement, maintenance)
─ Tạo/Sửa/Xóa Exam
├─ Tạo/Sửa/Xóa ExamQuestion
├─ Xem ExamResult,
─ Tạo/Sửa/Xóa Course
├─ Tạo/Sửa/Xóa Module
├─ Tạo/Sửa/Xóa Lesson
├─ Tạo/Sửa/Xóa Lab
└─ Report & Analytics
```

---

## 📁 KIẾN TRÚC FILE STRUCTURE CHO ADMIN

### Recommended File Structure
```
src/
├─ components/
│  ├─ Admin/ ⭐ MỚI
│  │  ├─ AdminLayout.js (Layout cho admin trang)
│  │  ├─ Sidebar.js (Menu admin)
│  │  ├─ TopBar.js (Header admin với user info)
│  │  │
│  │  ├─ Dashboard/ (Trang chính admin)
│  │  │  ├─ Dashboard.js (Overview, stats)
│  │  │  ├─ StatsCard.js (Card hiển thị chỉ số)
│  │  │  └─ Dashboard.css
│  │  │
│  │  ├─ Users/ (Quản lý người dùng)
│  │  │  ├─ UserManagement.js
│  │  │  ├─ UserList.js
│  │  │  ├─ UserForm.js (Tạo/Sửa user)
│  │  │  ├─ UserDetail.js (Xem chi tiết)
│  │  │  └─ Users.css
│  │  │
│  │  ├─ Courses/ (Quản lý khóa học)
│  │  │  ├─ CourseManagement.js
│  │  │  ├─ CourseList.js
│  │  │  ├─ CourseForm.js
│  │  │  ├─ CourseDetail.js
│  │  │  ├─ TopicManager.js (Quản lý topic)
│  │  │  └─ Courses.css
│  │  │
│  │  ├─ Modules/ (Quản lý module)
│  │  │  ├─ ModuleManagement.js
│  │  │  ├─ ModuleList.js
│  │  │  ├─ ModuleForm.js
│  │  │  ├─ ModuleDetail.js
│  │  │  └─ Modules.css
│  │  │
│  │  ├─ Lessons/ (Quản lý bài học)
│  │  │  ├─ LessonManagement.js
│  │  │  ├─ LessonList.js
│  │  │  ├─ LessonForm.js (Editor HTML/Video)
│  │  │  ├─ LessonDetail.js
│  │  │  └─ Lessons.css
│  │  │
│  │  ├─ Labs/ (Quản lý thí nghiệm)
│  │  │  ├─ LabManagement.js
│  │  │  ├─ LabList.js
│  │  │  ├─ LabForm.js
│  │  │  ├─ LabDetail.js
│  │  │  └─ Labs.css
│  │  │
│  │  ├─ Exams/ (Quản lý thi)
│  │  │  ├─ ExamManagement.js
│  │  │  ├─ ExamList.js
│  │  │  ├─ ExamForm.js
│  │  │  ├─ ExamDetail.js
│  │  │  ├─ QuestionManager.js (Quản lý câu hỏi)
│  │  │  ├─ QuestionForm.js (Tạo/Sửa câu hỏi)
│  │  │  ├─ ExamResults.js (Xem kết quả)
│  │  │  └─ Exams.css
│  │  │
│  │  │
│  │  │
│  │  └─ Common/ (Components dùng chung)
│  │     ├─ Table.js (Data table component)
│  │     ├─ Pagination.js
│  │     ├─ Modal.js (Dialog/Modal)
│  │     ├─ Loading.js
│  │     ├─ EmptyState.js
│  │     └─ Common.css
│  │
│  ├─ Auth/
│  │  ├─ AdminProtectedRoute.js ⭐ MỚI (Check role admin)
│  │  └─ (Cũ...)
│  │
│  └─ (Cũ...)
│
├─ context/
│  ├─ AuthContext.js (cũ)
│  ├─ AdminContext.js ⭐ MỚI (Admin state, filters, etc.)
│  └─ ToastContext.js ⭐ MỚI (Thông báo toàn cục)
│
├─ services/
│  ├─ api/ ⭐ NÊN TÁCH
│  │  ├─ authApi.js
│  │  ├─ courseApi.js
│  │  ├─ moduleApi.js
│  │  ├─ lessonApi.js
│  │  ├─ labApi.js
│  │  ├─ examApi.js
│  │  ├─ userApi.js
│  │  ├─ analyticsApi.js
│  │  ├─ adminLogApi.js
│  │  └─ index.js (export tất cả)
│  │
│  ├─ Api.js (cũ, sẽ deprecated)
│  └─ utils.js (Helper functions)
│
├─ css/
│  ├─ Admin/ ⭐ MỚI
│  │  ├─ AdminLayout.css
│  │  ├─ Sidebar.css
│  │  ├─ CommonComponents.css
│  │  └─ AdminVariables.css (Màu sắc, font chung)
│  │
│  └─ (cũ...)
│
├─ App.js (Update routes)
└─ index.js
```

### Backend Structure (Refactoring)
```
src/Backend/
├─ Server.js (Main entry, Middleware setup)
│
├─ config/
│  ├─ database.js (Prisma setup)
│  └─ jwt.js (JWT config)
│
├─ middleware/
│  ├─ auth.js (Verify JWT)
│  ├─ authorization.js (Check role)
│  ├─ errorHandler.js
│  ├─ logging.js
│  ├─ validation.js
│  └─ rateLimiter.js
│
├─ routes/
│  ├─ auth.js (Register, Login, Logout)
│  ├─ users.js (User CRUD, phân quyền)
│  ├─ courses.js (Course CRUD)
│  ├─ modules.js (Module CRUD)
│  ├─ lessons.js (Lesson CRUD)
│  ├─ labs.js (Lab CRUD)
│  ├─ exams.js (Exam CRUD)
│  ├─ questions.js (ExamQuestion CRUD)
│  ├─ results.js (ExamResult, Analytics)
│  ├─ analytics.js (Statistics, Reports)
│  ├─ adminLogs.js (View logs)
│  └─ index.js (Combine all routes)
│
├─ controllers/
│  ├─ authController.js
│  ├─ userController.js
│  ├─ courseController.js
│  ├─ moduleController.js
│  ├─ lessonController.js
│  ├─ labController.js
│  ├─ examController.js
│  ├─ questionController.js
│  ├─ resultController.js
│  ├─ analyticsController.js
│  └─ adminLogController.js
│
├─ services/
│  ├─ authService.js
│  ├─ userService.js
│  ├─ courseService.js
│  ├─ moduleService.js
│  ├─ lessonService.js
│  ├─ labService.js
│  ├─ examService.js
│  ├─ analyticsService.js
│  └─ adminLogService.js
│
├─ validators/
│  ├─ authValidator.js
│  ├─ courseValidator.js
│  ├─ userValidator.js
│  └─ examValidator.js
│
```

---

## 🎨 COMPONENT DESIGN PATTERN