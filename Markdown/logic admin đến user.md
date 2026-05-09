# 🔄 Luồng Dữ Liệu: Từ Bàn Tay Admin Đến Màn Hình Học Viên

Tài liệu này giải thích chi tiết luồng luân chuyển dữ liệu (Data Flow) từ lúc một **Quản trị viên (Admin)** nhấn nút "Tạo mới" một Khóa Học (hoặc Đề Thi), cho đến khi nó xuất hiện ngay lập tức trên giao diện của **Học viên (User/Student)**.

Dưới góc độ kỹ thuật, chúng ta áp dụng mô hình **Client-Server-Database** kết hợp **RESTful API** và **React Hook (`useEffect`)**.

---

## 🗺 Sơ Đồ Kiến Trúc Hoạt Động (Data Flow Graph)

```mermaid
sequenceDiagram
    participant AU as Admin UI (React)
    participant API_A as Backend Admin API
    participant DB as PostgreSQL (Prisma)
    participant API_U as Backend Client API
    participant UU as User UI (React)

    Note over AU, UU: QUÁ TRÌNH KHỞI TẠO NỘI DUNG (ADMIN)
    AU->>API_A: 1. Submit Form (POST /api/learning/courses)
    API_A->>API_A: 2. Auth JWT + Check Phân Quyền (is ADMIN?)
    API_A->>DB: 3. Prisma INSERT (prisma.course.create)
    DB-->>API_A: Trả về trạng thái Lưu Thành Công
    API_A-->>AU: 4. HTTP 201 Created

    Note over AU, UU: QUÁ TRÌNH HIỂN THỊ (HỌC VIÊN)
    UU->>API_U: 5. Student ấn "F5" dạo /roadmap (GET /api/learning/courses)
    API_U->>DB: 6. Prisma SELECT (prisma.course.findMany)
    DB-->>API_U: Trả về Danh sách Khóa học (Có khóa mới)
    API_U-->>UU: 7. JSON Arrays -> React Render HTML
```

---

## 📝 Diễn Giải Chi Tiết Từng Bước (Step-by-Step)

### Giai Đoạn 1: Bấm Nút Tạo Từ Admin (Tầng Controller)
1. **Form Gửi Đi:** Admin trên React (`src/components/Admin/Views/Courses.js`) điền xong tiêu đề, mức độ, ảnh Upload và bấm Submit. Một hàm `adminApi.createCourse()` kích hoạt và gửi gói payload qua `FormData` lên Backend.
2. **Middleware Trạm Gác:** Gói tin tới cánh cổng API `router.post('/courses')`. Nó phải đi qua 3 trạm gác bảo mật: 
   - `verifyToken`: Xác minh thư ủy quyền (Có JWT hợp lệ không?).
   - `checkRole('ADMIN')`: Giấy tờ (Role) có phải QUẢN TRỊ VIÊN hay không?
   - `multer`: Giải nén thư mục lấy ảnh Thumbnail cất vào kho `uploads/thumbnails/`.
3. **Ghi Xuống Database:** Controller gọi đến `prisma.course.create()`. ORM Prisma sẽ thực hiện chuyển ngữ logic JS sang vòng đời SQL `INSERT INTO courses..`. Chớp mắt 0.1s, trong ổ cứng CSDL PostgreSQL đã mọc thêm dữ liệu!

### Giai Đoạn 2: Hiệu Ứng "Ngay Lập Tức" Tại Màn Trình Diễn Học Viên
**Tại sao vừa tạo xong, học viên nhìn thấy ngay mà không cần khởi động lại Server hay chờ đồng bộ hóa đồng hồ?**
Vì ứng dụng React của chúng ta là ứng dụng **SPA** (Single Page Application) tương tác Trực tiếp Theo Yêu Cầu (On-Demand Fetching).

1. **Hiệu ứng Cửa Sổ (Component Mount):** Một học viên mở link trang chủ hoặc truy cập vào `/roadmap`. Ngay tức khắc, React phát hiện ra một vòng đời component `useEffect()` đang chờ mở khóa.
2. **The Fetcher (Gửi lệnh Fetch):** React âm thầm gửi một HTTP Request `GET /api/learning/courses` về phía Backend của chúng ta.
3. **Database Quét Quá Khứ:** Backend tiếp nhận yêu cầu, bảo `prisma.course.findMany({ where: { status: 'PUBLISHED', deletedAt: null } })` xuống CSDL lục lọi quét tất cả Khóa học CÓ THẬT hiện hành. Do Admin *vừa mới gắn khóa mới 1 giây trước*, Lưới quét của Prisma tóm được dính ngay khóa học mới này trong kết quả trả về.
4. **Virtual DOM Cập Nhật:** Backend trả về 1 mảng JSON. React phía Học Viên tóm mảng State này, kích hoạt vòng lặp `Array.map()`, biến hóa cái JSON vô hình kia thành từng Card khóa học màu sắc lóa mắt hiển thị trên giao diện! Mọi thứ diễn ra dưới **300ms** (quá nhanh đến mức mắt thường tự ảo giác là "tự động hiển thị song song").

---

### 🔥 Tóm Lược
Tính năng "tạo bên Admin tự động hiện bên User" không dùng ma thuật WebSocket hay Streaming Real-time. Nó bắt nguồn từ bản chất **Cơ sở dữ liệu tập trung phi trạng thái** kết hợp hiệu năng **Bắt Sự Kiện Load Page** nhạy bén của Reac.js (chỉ khi nào User truy cập, ứng dụng mới bốc Data trực tiếp từ kho chung). Do đó, sự đồng bộ trải dài luôn là `100% Khớp Data` mọi khoảnh khắc.
