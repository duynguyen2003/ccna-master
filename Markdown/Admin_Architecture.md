# Cẩm Nang Cấu Trúc Thành Phần Trang Admin (Admin Architecture Guide)

Tài liệu này giải thích chi tiết cấu trúc thư mục, các file đảm nhận chức năng gì và cấu hình ra sao trong hệ thống phân hệ Quản trị (Admin) của dự án CCNA Master.

---

## 1. Hệ Thống Backend (API & Business Logic)

Khu vực này chịu trách nhiệm cấp phát dữ liệu, kiểm tra quyền hạn thực tế và thao tác an toàn với Database qua Prisma.

### 1.1 Controllers (`src/Backend/controllers/`)
*Controllers là nơi chứa logic chức năng nghiệp vụ (Business logic).*
- **`adminController.js`**: Xuất các số liệu quan trọng cho bảng điều khiển (Dashboard). VD: Tổng số users, tổng số khóa học/baì kiểm tra. Nó cũng lưu log ghi lại hành động của Admin.

- **`userController.js`**: Trung tâm xử lý CRUD với User. Cung cấp API để Admin xem toàn bộ User, đổi phân quyền (Role: `STUDENT` ↔ `ADMIN`), hoặc `toggleActive` (Kích hoạt/Khóa mỏm tài khoản).

- **`learningController.js`**: Thao tác CRUD (Tạo/Sửa/Xóa) cho các Khóa học và Bài Lab. Chứa các cấu hình tương tác với Middleware `multer` để hứng file `.pkt` (Packet Tracer) hoặc hình ảnh Thumbnail.

- **`examController.js`**: Chịu trách nhiệm khởi tạo đề thi phức tạp. Được cấu hình để sử dụng *Nested Writes* của Prisma — cho phép Admin đẩy 1 form gồm cấu trúc cây (Exam chứa mảng Questions chứa Options) lưu vào thẳng CSDL trong duy nhất 1 Transaction bảo mật.

### 1.2 Routes & Middleware (`src/Backend/routes/`)
*Routes định tuyến đầu cuối cho REST API.*
- **`admin.js`**: Tuyến đường dành riêng cho việc thao tác API của Admin (`/api/admin`). Nó được bọc kỹ bằng middleware để ngăn chặn các truy cập ngoài luồng.
- **`auth.js` (Middleware)**:
  - Hàm `verifyToken()`: Trích xuất `Bearer Token` từ Header để đối chiếu danh tính.
  - Hàm `checkRole(['ADMIN'])`: Sau khi xác thực danh tính, hàm này kiểm chứng User đó có mang role `ADMIN` trong CSDL/JWT Payload không, nếu không sẽ hất văng (Return Status 403 Forbidden).

---

## 2. Hệ Thống Frontend - Javascript (React Admin)

Khu vực hiển thị và tương tác người dùng, độc lập hoàn toàn với trang dành cho Học viên (Student).

### 2.1 Cấu rào bảo vệ (Route & Access Control)

- **`src/components/Admin/AdminProtectedRoute.js`**: Thiết bị "cổng từ" của máy khách (Client). Component chịu trách nhiệm vây bắt các hành vi URL tay không gõ `/#/admin` mà không đăng nhập vào hệ thống hoặc không mang Role `ADMIN` (Đẩy họ về trang Chủ `/`).

### 2.2 Giao diện khung (Layout Components)
- **`src/components/Admin/Layout/AdminLayout.js`**: Khung sườn tổng (Wrapper). Nó sẽ bọc các Component hệ thống. Cấu trúc chia màn hình ra làm 2: Phần bên trái đặt `Sidebar` và bên phải đặt `Content`.

- **`src/components/Admin/Layout/Sidebar.js`**: Chứa menu ghim ở phía bên trái. Quản lý trạng thái đang hoạt động (Active Item) dựa theo biến đổi route. 

- **`src/components/Admin/Layout/TopBar.js`**: Header mỏng bên trên khu vực hiển thị Content. Là nơi hiện ảnh đại diện Admin, Nút Đăng xuất và điều hướng "Đường dẫn chỉ mục" (Breadcrumbs).

### 2.3 Các trang chức năng (Admin Views)
- **`Dashboard.js`**: Nơi biểu diễn Chart, đồ thị, thẻ Số liệu Tổng quan (`StatsCards`) và nhật ký hệ 
thống.  
- **`Users.js`**: Hiển thị bảng toàn bộ hệ thống users, cung cấp Nút bật/tắt quyền quản trị hoặc vô hiệu hóa khóa tài khoản ngay lập tức. Cần cấu hình gọi hàm xử lý Modal để tránh người vô tình ấn nhầm chốt khóa.

- **`Courses.js` & `Labs.js`**: Quản lý kho nội dung, gọi đối tượng `FormData` trong hàm tạo nhằm đóng gói dữ liệu dạng bảng/chữ quyện cùng File Upload (Hình ảnh, packet tracer).

- **`Exams.js`**: Nơi các giáo cụ cung cấp bộ ngân hàng câu hỏi khó lấy dữ liệu đi cùng. Chứa form động cho phép "Thêm câu trả lời", "Chỉnh sửa câu hỏi".

### 2.4 Dịch vụ API Frontend
- **`src/services/api/adminApi.js`**: Chuyên chứa các cấu hình hàm `fetch()`. Nơi này sẽ tự động gắn `Authorization: Bearer <token>` vào request Header cho mọi lượt gọi tới Backend (Ví dụ: `adminApi.createExam(token, data)`).

---

## 3. Hệ Thống CSS Quản Trị (Admin CSS)

Việc viết thẳng cho Admin CSS hoàn toàn được cách ly nhằm bảo vệ Theme của Student bằng File cấu hình chuyên nghiệp:

### `src/css/Admin/`
- **`AdminVariables.css`**: Nơi khai báo tập biến bộ màu (`--primary-color`, `--bg-dark-admin`, `--sidebar-width: 260px`). Khi bạn đổi thay chủ đề (Theme Mode), chỉ cần điều chỉnh ở đây là tất cả view sẽ đổi màu.  

- **`AdminLayout.css`**: CSS tinh chỉnh xương sống hiển thị UI bằng Flexbox/CSS Grid. Nó phụ trách cố định khung hình cho `Sidebar` và tạo thanh Cuộn Scrollable độc lập riêng cho khu vực Nội dung (Body content), giúp Header thanh Nav sẽ không bị cuộn trôi đi.

- **`AdminViews.css`**: Chứa CSS của các cấu kiện tiểu mục (Nút, Bảng - Table, Modal). Bao gồm trạng thái `Hover`, thẻ Tag trạng thái `Status: Active / Inactive` bằng Gradient xanh/đỏ biểuị cho User quản lý.

---
### Tóm gọn Mỏ Lết Setup (Workflow Hooking)
1. Để thêm 1 trang Admin mới (Vd: *Quản lý Bình luận*), ban lập UI ở `Views/Comments.js`.
2. Tạo thêm API Hooking tại `adminApi.js` -> `api.getAllComments(token)`
3. Set CSS Table ở `AdminViews.css`
4. Cắm lộ trình vào `App.js` bên dưới Admin Layout -> `<Route path="comments" />`
5. Xuống Backend viết Controller phân trang, sau đó mở thêm Route `router.get('/comments')` tại `routes/admin.js`. Mọi API ở đây đã được chặn cổng tự động bằng Router Use CheckRole.
