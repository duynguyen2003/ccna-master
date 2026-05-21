# Hướng Dẫn Chi Tiết Cấu Trúc Thư Mục và Chức Năng Các File - CCNA Master

Dưới đây là tài liệu hướng dẫn chi tiết về cấu trúc thư mục và chức năng của từng file trong đồ án tốt nghiệp **CCNA Master** của bạn. 

---

## 1. Tổng quan Kiến trúc Dự án
Dự án được xây dựng theo mô hình **Client-Server** đầy đủ (Full-stack):
*   **Frontend (Client)**: Sử dụng React.js 18, Tailwind CSS để xây dựng giao diện, thư viện Recharts để vẽ các biểu đồ thống kê và thư viện TanStack Query để quản lý và đồng bộ trạng thái API.
*   **Backend (Server)**: Sử dụng Node.js & Express.js viết theo mô hình kiến trúc MVC (Model-View-Controller) tách biệt.
*   **Database**: Sử dụng PostgreSQL làm hệ quản trị cơ sở dữ liệu và được quản lý, tương tác thông qua **Prisma ORM**.

---

## 2. Các file cấu hình tại thư mục gốc (`ccna-master/`)
*   **[.env](file:///d:/ĐỒ ÁN TỐT NGHIỆP/ccna-master/.env)** & **[.env.example](file:///d:/ĐỒ ÁN TỐT NGHIỆP/ccna-master/.env.example)**: Chứa các biến môi trường cấu hình cho hệ thống (như cổng Server, chuỗi kết nối Database `DATABASE_URL` tới PostgreSQL, mã bí mật `JWT_SECRET`, thông số gửi mail của Nodemailer, Client ID của Google OAuth và các tham số của Cloudinary để tải ảnh).
*   **[package.json](file:///d:/ĐỒ ÁN TỐT NGHIỆP/ccna-master/package.json)**: File quan trọng nhất của Node.js, khai báo tất cả các thư viện dependency đã cài đặt (cho cả React & Express) và các kịch bản chạy (scripts) như `npm start`, `npm run dev`, `build`...
*   **[prisma.config.ts](file:///d:/ĐỒ ÁN TỐT NGHIỆP/ccna-master/prisma.config.ts)**: Cấu hình bổ sung cho Prisma ORM khi thực hiện biên dịch và kết nối.
*   **[db_schema_dump.prisma](file:///d:/ĐỒ ÁN TỐT NGHIỆP/ccna-master/db_schema_dump.prisma)**: File sao lưu cấu trúc database dưới dạng ngôn ngữ schema của Prisma.
*   **[README.md](file:///d:/ĐỒ ÁN TỐT NGHIỆP/ccna-master/README.md)**: Tài liệu hướng dẫn cài đặt, cấu hình môi trường ban đầu và các câu lệnh để vận hành dự án.

---

## 3. Phân hệ Cơ sở dữ liệu (`ccna-master/prisma/`)
*   **[schema.prisma](file:///d:/ĐỒ ÁN TỐT NGHIỆP/ccna-master/prisma/schema.prisma)**: Định nghĩa toàn bộ cấu trúc các bảng (Models) trong Database như `User`, `Course`, `Module`, `Lesson`, `Quiz`, `Exam`, `PracticeLab`, `UserProgress` và các mối quan hệ (Relations) giữa chúng. File này là trung tâm để Prisma tự động sinh ra client truy vấn và đồng bộ trực tiếp xuống cơ sở dữ liệu PostgreSQL.

---

## 4. Phân hệ Backend (`ccna-master/src/Backend/`)
Backend được chia nhỏ thành các thư mục chức năng để dễ bảo trì và mở rộng:
*   **[Server.js](file:///d:/ĐỒ ÁN TỐT NGHIỆP/ccna-master/src/Backend/Server.js)**: File khởi chạy (Entry point) của Server Express. Đảm nhận việc thiết lập các middleware bảo mật (Helmet, CORS), khai báo đường dẫn phục vụ file tĩnh ([uploads](file:///d:/ĐỒ ÁN TỐT NGHIỆP/ccna-master/src/uploads)), kết nối Database thông qua Prisma và lắng nghe các yêu cầu từ Client trên cổng cấu hình (mặc định là `5000`).
*   **`config/`**: Chứa các thiết lập kết nối cơ sở dữ liệu (`database.js`), cấu hình gửi mail khôi phục mật khẩu (`mailer.js`) và lưu trữ đám mây (`cloudinary.js`).
*   **`controllers/`** (Nơi xử lý logic nghiệp vụ chính - Business Logic):
    *   `authController.js`: Xử lý đăng ký, đăng nhập thường, đăng nhập qua tài khoản Google và luồng quên/khôi phục mật khẩu.
    *   `userController.js`: Lấy thông tin cá nhân, cập nhật hồ sơ cá nhân và thay đổi mật khẩu của học viên.
    *   `learningController.js`: Quản lý trạng thái khóa học, xem bài học, danh sách tài liệu và theo dõi tiến độ xem video YouTube trực tiếp của học viên.
    *   `examController.js`: Chấm điểm thi trắc nghiệm tự động, trả về lời giải thích chi tiết và lưu trữ lịch sử thi của học viên.
    *   `adminController.js`: Các nghiệp vụ đặc quyền của quản trị viên như quản lý người dùng, tạo khóa học mới, duyệt tài liệu và xem logs hệ thống.
    *   `toolController.js`: Các hàm hỗ trợ tính toán logic mạng (Subnetting, VLSM).
*   **`routes/`** (Định nghĩa các Endpoint API):
    *   `index.js`: Gom tất cả các Route con lại và export ra ngoài.
    *   `auth.js`, `users.js`, `learning.js`, `exams.js`, `admin.js`, `tools.js`: Định nghĩa các URL cụ thể (như `/api/auth/login`, `/api/exams/submit`) để chuyển tiếp yêu cầu từ client tới controller xử lý.
*   **`middleware/`** (Các bộ lọc trung gian):
    *   `auth.js`: Xác thực JWT Token gửi kèm từ Client để xem học viên có hợp lệ và được quyền truy cập tài nguyên hay không.
    *   `logging.js`: Theo dõi, lưu vết và ghi nhật ký hoạt động hệ thống.
    *   `rateLimiter.js`: Giới hạn số lượng request được gửi lên trong một khoảng thời gian nhất định nhằm chống Spam và tấn công Brute-force.
*   **`validation/`**: Chứa các schema kiểm tra tính hợp lệ của dữ liệu đầu vào (Input validation sử dụng Zod) trước khi xử lý hoặc lưu xuống Database.

---

## 5. Phân hệ Frontend (`ccna-master/src/`)
Được tổ chức để hiển thị giao diện động và giao tiếp với API Backend:
*   **[index.js](file:///d:/ĐỒ ÁN TỐT NGHIỆP/ccna-master/src/index.js)**: Điểm xuất phát của React, thực hiện đưa Component chính vào DOM của trình duyệt.
*   **[App.js](file:///d:/ĐỒ ÁN TỐT NGHIỆP/ccna-master/src/App.js)**: File quản lý định tuyến (Routing) toàn cục của Client bằng `HashRouter`, phân chia rõ ràng các nhóm URL cho học viên và các URL được bảo vệ cho quản trị viên (`/admin`).
*   **[App.css](file:///d:/ĐỒ ÁN TỐT NGHIỆP/ccna-master/src/App.css)**: Định dạng CSS dùng chung cho toàn hệ thống.

### 📁 Thư mục Giao diện (`src/components/`)
*   **`Auth/`** (Trang Xác thực):
    *   [Login.js](file:///d:/ĐỒ ÁN TỐT NGHIỆP/ccna-master/src/components/Auth/Login.js), [Register.js](file:///d:/ĐỒ ÁN TỐT NGHIỆP/ccna-master/src/components/Auth/Register.js): Giao diện đăng nhập và đăng ký dạng Modal đè lên trang chủ.
    *   [ForgotPassword.js](file:///d:/ĐỒ ÁN TỐT NGHIỆP/ccna-master/src/components/Auth/ForgotPassword.js), [ResetPassword.js](file:///d:/ĐỒ ÁN TỐT NGHIỆP/ccna-master/src/components/Auth/ResetPassword.js): Luồng khôi phục lại mật khẩu thông qua mã token gửi qua email.
    *   [ProtectedRoute.js](file:///d:/ĐỒ ÁN TỐT NGHIỆP/ccna-master/src/components/Auth/ProtectedRoute.js): Component bảo vệ, kiểm tra nếu người dùng chưa đăng nhập thì bắt buộc chuyển hướng về trang chủ/đăng nhập.
*   **`Content/`** (Trang của Học viên):
    *   `Home.js`: Trang chủ học viên chứa sơ đồ tổng quan và danh sách khóa học.
    *   `Roadmap.js`: Lộ trình chuẩn hóa theo chuẩn CCNA của Cisco.
    *   `CourseDetail.js`: Chi tiết các module học tập, hiển thị danh sách bài học và trạng thái hoàn thành.
    *   `Lesson.js`: Giao diện học bài học chi tiết bao gồm phát video bài giảng, tài liệu lý thuyết Markdown đính kèm và khu vực tự ghi chú.
    *   `Labs.js`: Nơi hiển thị danh sách bài thực hành và tải file cấu hình `.pka` chạy trên Packet Tracer.
    *   `exam/`: Hệ thống thi trắc nghiệm (gồm trung tâm chọn đề thi `TestingCenter.js`, giao diện làm bài thi trực tuyến `TakeExam.js`, chấm điểm kết quả `ExamResult.js` và trang xem lại bài giải `ReviewExam.js`).
    *   `Profile.js`: Hiển thị thông tin cá nhân và biểu đồ trực quan hóa tiến độ học tập hàng ngày.
*   **`Admin/`** (Trang Quản trị viên):
    *   `Views/Dashboard.js`: Dashboard tổng của Admin hiển thị biểu đồ phân tích thống kê người học và hiệu suất hệ thống.
    *   `Views/Users.js`: Quản lý danh sách thành viên và phân quyền (Học viên/Admin).
    *   `Views/Courses.js` & `CourseDetail.js`: Quản lý danh mục khóa học, bài học và module học tập.
    *   `Views/Exams/`: Quản lý ngân hàng đề thi trắc nghiệm và biên soạn các câu hỏi kèm giải thích.
    *   `Views/Labs.js`: Quản lý cập nhật tài liệu và bài thực hành thực tế.
*   **`Tools/`** (Phân hệ các Công cụ hỗ trợ mạng):
    *   `SubnetCalculator.js`: Công cụ tính toán chia mạng con (IP Subnetting).
    *   `VLSM_Calculator.js`: Công cụ chia mạng con với độ dài mặt nạ biến đổi (VLSM).
    *   `PortLookup.js`: Trang tra cứu thông tin chi tiết của các cổng (Ports) và giao thức truyền thông.
    *   `CiscoCliLookup.js`: Tra cứu từ điển câu lệnh cấu hình thiết bị router/switch của Cisco.

### 📁 Thư mục Giao tiếp API (`src/services/`)
*   **[Api.js](file:///d:/ĐỒ ÁN TỐT NGHIỆP/ccna-master/src/services/Api.js)**: Cấu hình Axios Client chung để tự động chèn JWT token lưu ở client vào tiêu đề header của mỗi request gửi lên Backend.
*   **`api/`** (`adminApi.js`, `authApi.js`, `contentApi.js`): Các module API chuyên biệt gọi trực tiếp các endpoint tương ứng ở Backend.

### 📁 Thư mục Quản lý State (`src/context/`)
*   **[AuthContext.js](file:///d:/ĐỒ ÁN TỐT NGHIỆP/ccna-master/src/context/AuthContext.js)**: Cung cấp trạng thái đăng nhập, thông tin tài khoản và hàm Logout toàn cục cho tất cả các Component trong ứng dụng.
*   **[ToastContext.js](file:///d:/ĐỒ ÁN TỐT NGHIỆP/ccna-master/src/context/ToastContext.js)**: Quản lý việc hiển thị thông báo popup (Toast) trên màn hình khi thao tác thành công hoặc lỗi.

### 📁 Thư mục Dữ liệu tĩnh (`src/json/`)
*   **[ports.json](file:///d:/ĐỒ ÁN TỐT NGHIỆP/ccna-master/src/json/ports.json)**: Tập tin chứa danh sách hơn hàng ngàn cổng mạng và mô tả giao thức đi kèm để phục vụ cho tính năng Port Lookup.
*   **[cisco-commands.json](file:///d:/ĐỒ ÁN TỐT NGHIỆP/ccna-master/src/json/cisco-commands.json)**: Tập hợp danh sách các câu lệnh cấu hình CLI của Cisco để phục vụ tính năng tra cứu câu lệnh.

---

## 6. Thư mục Tài liệu & Sơ đồ Thiết kế (`ccna-master/Markdown/`)
Thư mục này đóng vai trò rất quan trọng trong việc **viết báo cáo tốt nghiệp** của bạn. Nó chứa các bản tài liệu hóa chi tiết kiến trúc và thiết kế:
*   `Admin_Logic_Flows.md` & `thiết kế admin.md`: Đặc tả luồng xử lý và giao diện của trang quản trị viên.
*   `sequence_diagrams.md`: Chi tiết các biểu đồ tuần tự (Sequence Diagrams) cho các tính năng quan trọng như Đăng nhập, Làm bài thi, Cập nhật tiến độ.
*   `activity_diagram_flows.md` & `activity_diagrams.md`: Sơ đồ hoạt động (Activity Diagrams) cho các luồng nghiệp vụ.
*   `database_data_dictionary.md` & `Prisma_Schema_Docs.md`: Tài liệu từ điển dữ liệu (Data Dictionary), mô tả chi tiết kiểu dữ liệu và ý nghĩa của từng trường trong các bảng database.
*   `youtube-progress-tracking.md`: Mô tả giải thuật/logic dùng để bắt sự kiện xem video YouTube của người dùng để lưu lại phần trăm tiến độ học tập.
