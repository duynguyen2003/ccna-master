# 📋 HƯỚNG DẪN NHANH CHO ADMIN

**Cập nhật:** 13/04/2026  
**Dành cho:** Admin Dashboard - CCNA Learning Platform

---

## 🔑 Thông Tin Đăng Nhập Admin

### Tài Khoản Test
```
Email:    admin@example.com
Password: Admin@12345
Role:     ADMIN
```

---

## 📊 Dashboard Admin - Các Tính Năng Chính

### 1. Quản Lý Người Dùng
**Chức năng:**
- Xem danh sách tất cả học viên
- Kích hoạt/Vô hiệu hóa tài khoản
- Xem tiến độ học tập của từng user
- Reset mật khẩu user

**Quy trình:**
```
Admin Dashboard → Quản Lý Người Dùng → Chọn User
→ Xem chi tiết / Sửa thông tin / Kích hoạt-Vô hiệu
```

### 2. Quản Lý Khóa Học
**Các thành phần:**
```
Khóa Học
├─ Module 1
│  ├─ Lesson 1
│  ├─ Lesson 2
│  └─ ...
├─ Module 2
│  ├─ Lesson 1
│  └─ ...
```

**Thao tác:**
- **Tạo Khóa Học:** Điền tên, mô tả, hình ảnh
- **Thêm Module:** Tạo module theo từng chủ đề
- **Tạo Lesson:** Thêm bài học với nội dung
- **Công Bố:** Khóa học mới tạo ở trạng thái `DRAFT` → nhấn `Publish` để cho học viên học

**Các trường dữ liệu quan trọng:**
```
- Tên Khóa Học (Course Title)
- Mô Tả (Description)
- Hình Ảnh Đại Diện (Thumbnail)
- Mã Khóa (Course Code) - VD: CCNA-100
- Số Module dự định
- Ngày Công Bố (Published Date)
```

### 3. Quản Lý Module & Bài Học

**Tạo Module:**
```
1. Chọn Khóa Học
2. Nhấn "+ Thêm Module"
3. Điền Tiêu Đề: VD "Cơ Bản Mạng"
4. Điền Mô Tả: VD "Học về TCP/IP, OSI Models..."
5. Nhấn Tạo
```

**Tạo Bài Học (Lesson):**
```
1. Vào Module vừa tạo
2. Nhấn "+ Tạo Bài Học"
3. Điền thông tin:
   - Tiêu Đề bài học
   - Video URL (YouTube/Vimeo)
   - Nội dung bài học (Markdown)
   - Tài liệu đính kèm (PDF/Document)
4. Nhấn Lưu
```

### 4. Quản Lý Bài Thí Nghiệm (Lab)

**Tạo Lab:**
```
1. Admin Dashboard → Labs
2. Nhấn "+ Tạo Lab Mới"
3. Điền:
   - Lab Title: VD "Config Router Cisco"
   - Mô Tả chi tiết
   - Mục tiêu học tập
   - Cấp độ khó (Easy/Medium/Hard)
   - Hướng dẫn từng bước
   - File topology (nếu có)
4. Lưu & Công Bố
```

**Kiểm Tra Kết Quả Lab:**
- Xem danh sách học viên đã hoàn thành
- Kiểm tra file gửi lên (screenshot/config)
- Chấm điểm (Pass/Fail)
- Ghi chú phản hồi

### 5. Quản Lý Kỳ Thi (Exam)

**Tạo Kỳ Thi:**
```
1. Admin → Quản Lý Kỳ Thi
2. "+ Tạo Kỳ Thi Mới"
3. Nhập thông tin:
   - Tên Kỳ Thi: VD "CCNA 1 - Midterm"
   - Mô Tả
   - Số câu hỏi yêu cầu
   - Thời gian làm bài (phút)
   - Điểm qua (Pass Score) - VD 70%
   - Hạn chế thời gian thi
```

**Tạo Câu Hỏi (Question):**
```
Các loại câu hỏi hỗ trợ:

1. Multiple Choice (Trắc nghiệm 1 đáp án)
   - Câu hỏi
   - 4 lựa chọn A, B, C, D
   - Đáp án đúng
   - Score

2. Multiple Select (Chọn nhiều đáp án đúng)
   - Câu hỏi
   - Danh sách các lựa chọn có checkbox
   - Đánh dấu đúng

3. Matching (Ghép cặp)
   - Danh sách bên trái
   - Danh sách bên phải
   - Ghép cặp đúng

4. Fill in the Blank (Điền vào chỗ trống)
   - Câu hỏi có chỗ trống [____]
   - Đáp án đúng
```

---

## 🛠️ Công Cụ (Tools) Cho Học Viên

**Các công cụ sẵn có:**
1. **Subnet Calculator** - Tính subnet mask, network, broadcast
2. **VLSM Calculator** - Chia subnet theo yêu cầu
3. **Port Lookup** - Tìm thông tin cổng mạng
4. **CLI Lookup** - Tra cứu lệnh Cisco

---

## 📊 Xem Báo Cáo & Thống Kê

### Dashboard - 4 Widget Chính

```
┌──────────────────────────────────┐
│ Tổng Số Học Viên                │
│ Ví dụ: 237 students             │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ Tổng Khóa Học                    │
│ Ví dụ: 15 courses               │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ Phiên Học Đang Hoạt Động         │
│ Ví dụ: 42 active sessions       │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ Tỉ Lệ Hoàn Thành Khóa (%)        │
│ Ví dụ: 68% completion rate      │
└──────────────────────────────────┘
```

### Xem Nhật Ký Hành Động (Activity Log)

**Các hành động được ghi lại:**
- Đăng nhập/Đăng xuất
- Tạo/Cập nhật/Xóa khóa học
- Thêm bài học mới
- Thay đổi cài đặt hệ thống

**Thông tin từng Log Entry:**
```
Timestamp (Thời gian): 2026-04-13 10:45:30
Action (Hành động):    CREATE_COURSE
Admin Email:           admin@example.com
Details (Chi tiết):    Tạo khóa học "CCNA Advanced"
Status (Trạng thái):   SUCCESS
```

---

## ⚙️ Cài Đặt Hệ Thống

### Các Tùy Chọn Cầu Hình

**1. Cử Chỉ Học (Learning Gestures)**
- Bật/Tắt các loại bài học khác nhau
- Thay đổi thứ tự hiển thị

**2. Cài Đặt Bài Thi**
- Thời gian mặc định cho bài thi
- Điểm qua mặc định
- Cho phép xem lại đáp án sau thi (Yes/No)

**3. Cài Đặt Lab**
- Deadline cho submission
- Yêu cầu upload file
- File type được phép upload

**4. Thông Báo & Email**
- Gửi thông báo khi có user mới
- Email xác nhận hoàn thành khóa học
- Cảnh báo khi phát hiện hành vi bất thường

---

## 🚨 Các Vấn Đề Thường Gặp & Cách Xử Lý

### 1. User Quên Mật Khẩu
```
✓ Admin thực hiện: 
  - Vào "Quản Lý Người Dùng"
  - Tìm user
  - Nhấn "Reset Password"
  - Hệ thống tạo mật khẩu tạm thời
  - Gửi email cho user
  - User đổi mật khẩu lần đăng nhập tiếp theo
```

### 2. Học Viên Không Thể Truy Cập Khóa Học
```
✓ Kiểm tra:
  - Khóa học đã "Publish" chưa?
  - Người dùng có quyền truy cập (enrolled)?
  - Khóa học bị khóa (archived)?
  - Trình duyệt cache - clear cookies
```

### 3. Thi Bị Treo Khi Nộp Bài
```
✓ Xử lý:
  - Yêu cầu user F5 (refresh)
  - Nếu vẫn lỗi: Admin kiểm tra backend logs
  - Resetexam attempt nếu cần
```

### 4. File Upload Lab Không Lên Được
```
✓ Nguyên nhân & Giải Pháp:
  - File quá lớn? → Kiểm tra max file size (25MB)
  - Format không đúng? → Kiểm tra allowed extensions
  - Server lỗi? → Check server status
```

---

## 🔐 Từ Khóa & Quyền Truy Cập

### Role Hiện Tại

```
┌─────────────────────────────┐
│ ADMIN                       │
├─────────────────────────────┤
│ ✓ Tạo/Sửa/Xóa Khóa Học     │
│ ✓ Quản Lý Người Dùng        │
│ ✓ Tạo/Chấm Điểm Bài Thi     │
│ ✓ Xem Báo Cáo & Thống Kê    │
│ ✓ Quản Lý Labs/Activities   │
│ ✓ Cài Đặt Hệ Thống          │
│ ✓ Xem Nhật Ký Hành Động      │
└─────────────────────────────┘

┌─────────────────────────────┐
│ STUDENT                     │
├─────────────────────────────┤
│ ✓ Học Bài Giảng             │
│ ✓ Làm Bài Lab               │
│ ✓ Tham Gia Kỳ Thi           │
│ ✗ Không được Quản Lý        │
│ ✗ Không được Cài Đặt        │
└─────────────────────────────┘
```

---

## 📞 Hỗ Trợ Kỹ Thuật

**Khi gặp lỗi:**

1. **Kiểm tra Server Status**
   ```
   Backend: http://localhost:5000/api/health
   ```

2. **Xem Logs chi tiết**
   ```
   - Backend logs: Terminal chạy server
   - Browser logs: F12 → Console tab
   - Network logs: F12 → Network tab
   ```

3. **Liên Hệ Nhà Phát Triển**
   - Gửi screenshot + error message
   - Mô tả chi tiết các bước tái hiện lỗi

---

## ✅ Checklist Hàng Ngày

```
[ ] Kiểm tra Dashboard - có bất thường không?
[ ] Xem log hoạt động cho errors
[ ] Kiểm tra emails gửi đi (nếu user report)
[ ] Backup dữ liệu (hàng tuần)
[ ] Cập nhật thông báo quan trọng
[ ] Kiểm tra phiên bản phần mềm
```

---

**Cập nhật lần cuối:** 13/04/2026  
**Phiên bản:** 1.0
