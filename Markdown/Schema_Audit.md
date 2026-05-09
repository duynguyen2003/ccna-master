# 🔍 Bảng Kiểm Kê: Prisma Schema vs Admin UI

Đối chiếu toàn bộ **18 bảng nghiệp vụ** trong `schema.prisma` với hệ thống Admin hiện tại.

---

## ✅ ĐÃ CÓ CRUD ĐẦY ĐỦ (7 bảng)

| Bảng | Trạng thái | Ghi chú |
|---|---|---|
| `User` | ✅ Đầy đủ | CRUD + đổi Role + Toggle Active + Soft Delete |
| `Course` | ✅ Đầy đủ | Tất cả fields: id, code, title, description, level, status, thumbnailUrl, orderIndex |
| `Module` | ✅ Đầy đủ | CRUD qua trang CourseDetail (Accordion) |
| `Lesson` | ✅ Đầy đủ | CRUD qua trang CourseDetail, có title, sectionNumber, contentHtml, videoUrl, videoDuration, orderIndex |
| `Lab` | ✅ Đầy đủ | category, difficulty (EASY/MEDIUM/HARD), duration, guideContent, fileUrl, courseId, moduleId |
| `Exam` | ✅ Đầy đủ | examCode, totalQuestions, durationMinutes, passingScore, difficulty, courseId |
| `ExamQuestion` | ✅ Đầy đủ | Nested Write khi tạo Exam: question, options (Json), correctAnswer (Int), explanation, orderIndex |

## ⚠️ CÓ ĐỌC (READ) NHƯNG CHƯA CÓ TẠO/SỬA TỪ ADMIN (3 bảng)

| Bảng | Trạng thái | Vấn đề | Cần làm gì? |
|---|---|---|---|
| `ExamResult` | ⚠️ Read-only | Admin Dashboard Stats đếm kết quả, nhưng chưa có trang xem chi tiết | Tạo trang "Kết quả thi" để Admin xem lịch sử thi của từng user |
| `AdminLog` | ⚠️ Read-only | API `getAdminLogs` đã có, nhưng Dashboard chưa hiển thị | Hiển thị bảng Logs trên Dashboard |
| `RefreshToken` | ⚠️ Tự động | Được quản lý bởi authController (login/logout), **KHÔNG** cần CRUD từ Admin | Không cần thay đổi |

## ❌ CHƯA CÓ QUẢN LÝ NÀO TỪ ADMIN (8 bảng)

| # | Bảng | Mô tả | Ưu tiên | Khuyến nghị |
|---|---|---|---|---|
| 1 | `CourseTopic` | Chủ đề phụ của khóa học (VD: "IPv4 & IPv6") | 🟡 Trung bình | Thêm vào trang CourseDetail |
| 2 | `Resource` | Tài liệu đính kèm (PDF, Slide) | 🟡 Trung bình | Thêm tab "Tài liệu" vào CourseDetail |
| 3 | `UserProgress` | Tiến độ học tập từng user | 🟢 Thấp | Chỉ đọc, không cần Admin CRUD — hệ thống tự tính |
| 4 | `UserBadge` | Huy hiệu thành tích | 🟢 Thấp | Admin có thể tặng badge thủ công (Tùy chọn) |
| 5 | `UserActivity` | Lịch sử hoạt động (Newsfeed) | 🟢 Thấp | Chỉ đọc — hệ thống tự ghi log |
| 6 | `UserNote` | Ghi chú cá nhân của user | 🟢 Thấp | Thuộc phía User, KHÔNG nên để Admin CRUD |
| 7 | `Tool` | Cấu hình công cụ (Subnet Calculator...) | 🟡 Trung bình | Thêm trang "Quản lý Tool" mới |
| 8 | `QuestionBank` | Ngân hàng câu hỏi AI | 🔴 Cao (nếu cần AI) | Thêm trang CRUD riêng cho Question Bank |

---

## 📊 Tổng kết

| Danh mục | Số bảng | Tỉ lệ |
|---|---|---|
| ✅ CRUD đầy đủ | **7/18** | 39% |
| ⚠️ Read-only / Tự động | **3/18** | 17% |
| ❌ Chưa có quản lý | **8/18** | 44% |

## 🎯 Đề xuất ưu tiên triển khai tiếp

1. **`CourseTopic`** — Thêm vào CourseDetail (cùng chỗ với Module/Lesson)
2. **`Resource`** — Thêm tab upload tài liệu vào CourseDetail
3. **`Tool`** — Trang quản lý công cụ mới trên Sidebar
4. **`ExamResult`** — Trang xem kết quả thi (Read-only cho Admin)
5. **`AdminLog`** — Hiển thị nhật ký hoạt động trên Dashboard
6. **`QuestionBank`** — Trang CRUD ngân hàng câu hỏi (nếu xây AI)

> Các bảng `UserProgress`, `UserBadge`, `UserActivity`, `UserNote` thuộc tầng tương tác **phía Student** — hệ thống tự ghi dữ liệu khi user học/thi. Admin chỉ cần **xem** (Read-only) chứ không nên tạo/sửa/xóa trực tiếp vì sẽ phá vỡ tính toàn vẹn dữ liệu.
