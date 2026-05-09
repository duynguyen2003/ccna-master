# 📚 Tài Liệu Đặc Tả Schema Database (Prisma)

Một sự quan sát rất tinh tế! Nếu bạn nhìn vào Database SQL (như DBeaver hay pgAdmin), bạn sẽ thấy Database có chính xác **19 bảng**. 
Trong đó bao gồm **18 bảng nghiệp vụ** do chúng ta định nghĩa trong `schema.prisma` và **1 bảng hệ thống** do Prisma sinh ra.

Dưới đây là sơ đồ chi tiết về từng bảng dữ liệu một:

---

## KHỐI 1: NGƯỜI DÙNG & BẢO MẬT (2 Bảng)

### 1. Bảng `users` (Model: `User`)
Lưu trữ thông tin định danh của người học và người quản trị.
- `id`, `fullName`, `email`, `passwordHash`, `avatarUrl`.
- `role`: Phân quyền (STUDENT / ADMIN).
- `isActive`, `deletedAt`: Quản lý hiển thị và xóa mềm.
- `level`, `streak`, `totalStudyTime`: Các cơ chế tích lũy học tập (Gamification).

### 2. Bảng `refresh_tokens` (Model: `RefreshToken`)
- Dùng cho cơ chế xác thực JWT. Giữ Token thứ cấp giúp user không bị văng phiên đăng nhập.

---

## KHỐI 2: HỆ THỐNG KHÓA HỌC (ROADMAP) (5 Bảng)

### 3. Bảng `courses` (Model: `Course`)
Đại diện cho 1 chứng chỉ Lớn.
- `id` (c1, c2...), `code` (mã quốc tế như ITN, SRWE), `title`, `description`.
- `level`, `status`, `thumbnail_url`.

### 4. Bảng `course_topics` (Model: `CourseTopic`)
Chủ đề nhánh của một khóa học.

### 5. Bảng `modules` (Model: `Module`)
Từng Chương nhỏ bên trong một khóa học.

### 6. Bảng `lessons` (Model: `Lesson`)
Quyển sách học chi tiết của từng Chương.
- `content_html`: Dữ liệu HTML của bài giảng chữ.
- `video_url`, `video_duration`: URL video giảng viên (nếu có).

### 7. Bảng `resources` (Model: `Resource`)
Tài liệu phụ trợ đính kèm (File PDF, Hình ảnh, Slide) để người dùng tải về.

---

## KHỐI 3: THỰC HÀNH & MÔ PHỎNG (1 Bảng)

### 8. Bảng `labs` (Model: `Lab`)
Kho bài thực hành Packet tracer.
- `difficulty` (EASY, MEDIUM, HARD).
- `file_url`: Nơi lưu file bài Lab đuôi `.pka` / `.pkt` mô phỏng mạng Cisco tải về.
- `guide_content`: Nội dung gợi ý hướng dẫn hoặc nhắc nhở cấu hình.

---

## KHỐI 4: KHẢO THÍ CHỨNG CHỈ (3 Bảng)

### 9. Bảng `exams` (Model: `Exam`)
Thông tin cấu hình một bài Test/Thi cuối kì.
- `total_questions`, `duration_minutes` (Thời gian đếm ngược), `passing_score` (Điểm sàn để qua môn).

### 10. Bảng `exam_questions` (Model: `ExamQuestion`)
Các câu hỏi trắc nghiệm của đề thi.
- `options`: Mảng JSON chứa các đáp án [A, B, C, D...].
- `correct_answer`: Đánh dấu vị trí đáp án đúng.
- `explanation`: Lời giải thích khi người dùng làm sai.

### 11. Bảng `exam_results` (Model: `ExamResult`)
Lưu lại lịch sử chấm điểm sau khi nộp bài.
- `score`, `percentage`, `is_passed` (Qua/Trượt).
- `answers`: JSON lưu lại vết (track) câu nào click đáp án gì.

---

## KHỐI 5: TƯƠNG TÁC NGƯỜI DÙNG (4 Bảng)

### 12. Bảng `user_progress` (Model: `UserProgress`)
Điểm chốt then chốt của Hệ thống. Lưu lại tiến độ (Đã hoàn thành % bao nhiêu của Bài học / Lab / Module nào).

### 13. Bảng `user_badges` (Model: `UserBadge`)
Tủ trưng bày Huy hiệu cá nhân khi vượt qua cột mốc (e.g. Thành tích Thi 100/100).

### 14. Bảng `user_activity` (Model: `UserActivity`)
Hành động thao tác cho Newsfeed/Thông báo cá nhân.

### 15. Bảng `user_notes` (Model: `UserNote`)
Notebook cá nhân để ghi chú kiến thức lưu trong lúc đang ngồi xem 1 Lesson.

---

## KHỐI 6: ADMIN, ĐIỀU HÀNH VÀ AI (3 Bảng)

### 16. Bảng `admin_logs` (Model: `AdminLog`)
Bảo vệ tính minh bạch của Admin. Mọi thao tác Xóa user / Sửa đề thi đều bị Log và dán IP lại để kiểm toán.

### 17. Bảng `tools` (Model: `Tool`)
Cấu hình giao diện các Mini-Tool trong website (ví dụ như tool Subnetting Calculator).

### 18. Bảng `question_bank` (Model: `QuestionBank`)
Ngân hàng kịch bản phức tạp phục vụ hệ thống AI Chatbot và phân tích file CLI tương lai.
- `ai_prompt_context`: Context nhắc AI.
- `topology_img_url`: Hình ảnh sơ đồ mạng đi kèm.

---

## BẢNG HỆ THỐNG DO PRISMA TẠO (1 Bảng)

### 19. Bảng `_prisma_migrations`
- Đây là bảng **Quản lý lịch sử cơ sở dữ liệu** do ORM Prisma tự sinh ra lúc ta gõ dòng lệnh `npx prisma db push` hoặc `npx prisma migrate`.
- Prisma dựa vào bảng này để truy dấu và biết các bảng lúc trước có hình thù như thế nào để nếu ta đánh lệnh roll-back, nó sẽ cho mọi thứ quay ngược thời gian. Tuyệt đối không xóa hay sửa tay bảng này trên SQL!
