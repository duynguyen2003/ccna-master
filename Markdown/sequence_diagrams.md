# Biểu Đồ Tuần Tự — Dự Án CCNA-Master

---

## 1. Đăng nhập bằng Google OAuth

```mermaid
sequenceDiagram
    autonumber
    actor User as Người dùng
    participant FE as Giao diện
    participant Google as Google
    participant BE as Máy chủ
    participant DB as CSDL

    User->>FE: Nhấn "Đăng nhập bằng Google"
    FE->>Google: Yêu cầu xác thực
    Google-->>User: Hiển thị chọn tài khoản
    User->>Google: Chọn tài khoản
    Google-->>FE: Trả về mã xác thực

    FE->>BE: Gửi mã xác thực
    BE->>Google: Xác minh mã
    Google-->>BE: Trả về thông tin người dùng

    BE->>DB: Tìm tài khoản theo email

    alt Chưa có tài khoản
        BE->>DB: Tạo tài khoản mới
    else Đã có tài khoản
        BE->>DB: Cập nhật lần đăng nhập
    end

    alt Tài khoản bị khóa
        BE-->>FE: Thông báo tài khoản bị khóa
        FE-->>User: Hiển thị lỗi
    else Tài khoản hoạt động
        BE->>BE: Tạo phiên đăng nhập
        BE-->>FE: Trả về thông tin + phiên
        FE-->>User: Chuyển đến trang chủ
    end
```

---

## 2.1. Tải danh sách bài học và tiến độ

```mermaid
sequenceDiagram
    autonumber
    actor User as Học viên
    participant FE as Giao diện
    participant BE as Máy chủ
    participant DB as CSDL

    User->>FE: Mở trang bài học
    FE->>BE: Lấy danh sách chương và bài học
    BE->>DB: Truy vấn nội dung khóa học
    DB-->>BE: Danh sách chương + bài học
    BE-->>FE: Trả về dữ liệu

    FE->>BE: Lấy tiến độ học tập
    BE->>DB: Truy vấn tiến độ của học viên
    DB-->>BE: Dữ liệu tiến độ
    BE-->>FE: Trả về tiến độ
    FE-->>User: Hiển thị bài học + tiến độ
```

---

## 2.2. Theo dõi tiến độ video và hoàn thành bài học

```mermaid
sequenceDiagram
    autonumber
    actor User as Học viên
    participant FE as Giao diện
    participant YT as YouTube
    participant BE as Máy chủ
    participant DB as CSDL

    User->>FE: Chọn bài học có video
    FE->>BE: Lấy vị trí xem trước đó
    BE->>DB: Truy vấn tiến độ video
    DB-->>BE: Vị trí đã xem
    BE-->>FE: Trả về vị trí

    FE->>YT: Phát video từ vị trí cũ
    YT-->>User: Hiển thị video

    loop Mỗi 30 giây
        FE->>BE: Gửi thời gian đã xem
        BE->>DB: Cập nhật tiến độ video
        BE->>DB: Cập nhật nhật ký học tập
        BE-->>FE: Xác nhận
    end

    User->>FE: Hoàn thành bài học
    FE->>BE: Đánh dấu hoàn thành
    BE->>DB: Cập nhật tiến độ bài học
    BE->>DB: Tính lại tiến độ khóa học
    BE-->>FE: Trả về tiến độ mới
    FE-->>User: Cập nhật thanh tiến độ
```

---

## 3.1. Tải đề thi và làm bài

```mermaid
sequenceDiagram
    autonumber
    actor User as Học viên
    participant FE as Giao diện
    participant BE as Máy chủ
    participant DB as CSDL

    User->>FE: Chọn bài thi
    FE->>BE: Lấy đề thi
    BE->>DB: Truy vấn đề thi + câu hỏi
    DB-->>BE: Dữ liệu đề thi

    alt Không tìm thấy
        BE-->>FE: Thông báo lỗi
        FE-->>User: Hiển thị lỗi
    else Tìm thấy
        BE->>BE: Ẩn đáp án đúng
        BE-->>FE: Trả về đề thi
    end

    FE-->>User: Hiển thị giao diện làm bài
    FE->>FE: Bắt đầu đếm ngược

    loop Mỗi câu hỏi
        User->>FE: Chọn đáp án
        FE->>FE: Lưu câu trả lời
    end
```

---

## 3.2. Nộp bài và xem kết quả

```mermaid
sequenceDiagram
    autonumber
    actor User as Học viên
    participant FE as Giao diện
    participant BE as Máy chủ
    participant DB as CSDL

    User->>FE: Nộp bài (hoặc hết giờ)
    FE->>BE: Gửi bài làm

    BE->>DB: Kiểm tra nộp trùng

    alt Đã nộp trước đó
        BE-->>FE: Trả về kết quả cũ
    else Lần nộp mới
        BE->>DB: Lấy đáp án đúng
        BE->>BE: Chấm điểm từng câu
        BE->>BE: Tính điểm + đạt/không đạt
        BE->>DB: Lưu kết quả thi
        BE-->>FE: Trả về mã kết quả
    end

    FE->>BE: Lấy chi tiết kết quả
    BE->>DB: Truy vấn kết quả + giải thích
    DB-->>BE: Dữ liệu kết quả
    BE-->>FE: Trả về kết quả
    FE-->>User: Hiển thị điểm và giải thích
```

---

## 4. Quên mật khẩu & Đặt lại mật khẩu

```mermaid
sequenceDiagram
    autonumber
    actor User as Người dùng
    participant FE as Giao diện
    participant BE as Máy chủ
    participant DB as CSDL
    participant Email as Dịch vụ Email

    Note over User,Email: Bước 1 — Yêu cầu đặt lại mật khẩu

    User->>FE: Nhấn "Quên mật khẩu"
    FE-->>User: Hiển thị form nhập email
    User->>FE: Nhập email và gửi

    FE->>BE: Gửi yêu cầu khôi phục
    BE->>DB: Tìm tài khoản theo email

    alt Không tìm thấy
        BE-->>FE: Thông báo chung
    else Tìm thấy
        BE->>BE: Tạo mã khôi phục
        BE->>DB: Lưu mã khôi phục (hạn 30 phút)
        BE->>Email: Gửi email chứa liên kết
        Email-->>User: Email với liên kết đặt lại
        BE-->>FE: Thông báo chung
    end

    FE-->>User: Hiển thị "Kiểm tra email"

    Note over User,Email: Bước 2 — Xác thực liên kết

    User->>FE: Nhấn liên kết trong email
    FE->>BE: Kiểm tra mã khôi phục
    BE->>DB: Tìm mã khôi phục

    alt Mã không hợp lệ hoặc hết hạn
        BE-->>FE: Thông báo hết hạn
        FE-->>User: Hiển thị lỗi
    else Mã hợp lệ
        BE-->>FE: Xác nhận hợp lệ
        FE-->>User: Hiển thị form mật khẩu mới
    end

    Note over User,Email: Bước 3 — Đặt mật khẩu mới

    User->>FE: Nhập mật khẩu mới
    FE->>BE: Gửi mật khẩu mới + mã khôi phục
    BE->>BE: Mã hóa mật khẩu
    BE->>DB: Cập nhật mật khẩu
    BE->>DB: Xóa mã khôi phục + phiên cũ
    BE-->>FE: Đặt lại thành công
    FE-->>User: Chuyển đến trang đăng nhập
```

---

## 5.1. Xem danh sách khóa học (Chưa đăng nhập)

```mermaid
sequenceDiagram
    autonumber
    actor User as Khách (Guest)
    participant FE as Giao diện (Home.js)
    participant BE as Máy chủ
    participant DB as CSDL

    User->>FE: Truy cập trang chủ
    FE->>FE: Kiểm tra trạng thái đăng nhập (Guest)
    FE->>BE: GET /api/learning/courses
    BE->>BE: Xác định quyền (Guest)
    BE->>DB: Truy vấn khóa học (status = PUBLISHED)
    DB-->>BE: Danh sách khóa học công khai
    BE->>BE: Tính thống kê (tổng giờ, tổng bài)
    Note over BE: Không có tiến độ cá nhân
    BE-->>FE: Trả về danh sách (progress = 0)
    FE->>FE: Hiển thị thẻ khóa học (không thanh tiến độ)
    FE-->>User: Xem danh sách khóa học
```

---

## 5.2. Xem danh sách khóa học (Đã đăng nhập)

```mermaid
sequenceDiagram
    autonumber
    actor User as Học viên
    participant FE as Giao diện (Home.js)
    participant BE as Máy chủ
    participant DB as CSDL

    User->>FE: Truy cập trang chủ
    FE->>FE: Kiểm tra trạng thái đăng nhập (AuthContext)
    FE->>BE: GET /api/learning/courses
    Note over FE,BE: Gửi kèm Token (Bearer)

    BE->>BE: Xác thực Token

    alt Token không hợp lệ / hết hạn
        BE-->>FE: 401 Unauthorized
        FE-->>User: Chuyển hướng đến trang đăng nhập
    else Token hợp lệ
        BE->>DB: Truy vấn khóa học (status = PUBLISHED)
        DB-->>BE: Danh sách khóa học
        BE->>DB: Truy vấn tiến độ học viên (UserProgress)
        DB-->>BE: Dữ liệu tiến độ cá nhân
        BE->>BE: Tính % tiến độ từng khóa học
        Note over BE: Tính dựa trên bài học và lab đã xong
        BE->>BE: Tính trạng thái module (locked/active)
        BE-->>FE: Trả về danh sách + tiến độ thực tế
        FE->>FE: Ánh xạ giao diện (thanh tiến độ, màu sắc)
        FE-->>User: Hiển thị danh sách khóa học + tiến độ

        opt Có khóa học đang học dở
            FE->>FE: Hiển thị banner "Tiếp tục bài học"
            FE-->>User: Gợi ý bài học tiếp theo
        end
    end
```

---

## 5.3. Điều hướng xem chi tiết khóa học

```mermaid
sequenceDiagram
    autonumber
    actor User as Người dùng
    participant FE as Giao diện (Home.js)
    participant BE as Máy chủ
    participant DB as CSDL

    User->>FE: Nhấn "Xem chi tiết" trên thẻ khóa học
    FE->>BE: GET /api/learning/courses/:courseId
    BE->>DB: Truy vấn chi tiết khóa học + danh sách module
    DB-->>BE: Dữ liệu chi tiết
    BE-->>FE: Trả về thông tin khóa học
    FE-->>User: Điều hướng và hiển thị trang /course/:courseId
```
