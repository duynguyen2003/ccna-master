# Sơ đồ Luồng nghiệp vụ (Activity Diagram) - CCNA Learning Platform

Dưới đây là tài liệu phân tích luồng nghiệp vụ chi tiết kèm theo mã Mermaid để bạn có thể chèn trực tiếp vào các công cụ vẽ sơ đồ (như Draw.io, Mermaid Live Editor, Notion, v.v.).

## 1. Luồng Tổng quan Hệ thống (System Overview Flow)

Luồng này mô tả cách người dùng truy cập vào hệ thống và sự phân nhánh dựa trên trạng thái đăng nhập và vai trò (Role).

```mermaid
flowchart TD
    start([Truy cập hệ thống]) --> isAuth{Đã đăng nhập?}
    
    isAuth -- Có --> checkRole{Role là gì?}
    checkRole -- ADMIN --> adminDash[Chuyển hướng đến Admin Dashboard]
    adminDash --> adminTasks[Quản lý Khóa học, Bài thi, Lab, Người dùng]
    adminTasks --> stopEnd([Kết thúc])
    
    checkRole -- STUDENT --> studentDash[Chuyển hướng đến Student Dashboard]
    studentDash --> studentTasks[Tiếp tục học tập & Thi thử]
    studentTasks --> stopEnd
    
    isAuth -- Không --> guestView[Xem giao diện Guest]
    guestView --> viewPublic[Xem danh sách Khóa học & Bài thi Public]
    viewPublic --> guestAction{Hành động?}
    
    guestAction -- Đăng nhập --> loginPage[Chuyển đến trang Đăng nhập]
    loginPage --> stopEnd
    
    guestAction -- Bắt đầu học/thi --> reqLogin[Yêu cầu đăng nhập]
    reqLogin --> stopEnd
```

---

## 2. Luồng Học tập (Learning Flow - Học viên)

Mô tả quá trình học viên xem khóa học, xem video bài giảng và hệ thống lưu lại tiến độ.

```mermaid
flowchart TD
    start([Bắt đầu Học tập]) --> selectCourse[Chọn Khóa học]
    selectCourse --> getCourses[Hệ thống lấy danh sách Khóa học PUBLISHED]
    getCourses --> viewCourse[Học viên chọn một Khóa học cụ thể]
    viewCourse --> viewModules[Hiển thị danh sách Chương và Bài học]
    viewModules --> selectLesson[Học viên chọn Bài học]
    
    selectLesson --> hasVideo{Bài học có Video?}
    
    hasVideo -- Có --> playVideo[Phát Video]
    playVideo --> watchAction{Học viên xem xong hoặc chuyển bài?}
    watchAction -- Có --> calcProgress[Tính toán % Video đã xem]
    calcProgress --> sendProgressAPI[Gửi API cập nhật Tiến độ]
    sendProgressAPI --> saveDB[Lưu vào Database]
    saveDB --> updateGlobal[Cập nhật thanh tiến độ tổng của Khóa học]
    watchAction -- Không --> updateGlobal
    
    hasVideo -- Không --> readDoc[Đọc tài liệu / Nội dung HTML]
    readDoc --> markDone[Đánh dấu hoàn thành]
    markDone --> sendProgressAPI2[Gửi API cập nhật Tiến độ]
    sendProgressAPI2 --> updateGlobal
    
    updateGlobal --> stopEnd([Kết thúc])
```

---

## 3. Luồng Thi thử (Exam Flow) - QUAN TRỌNG NHẤT

Đây là luồng nghiệp vụ phức tạp nhất, bao gồm điều kiện phân nhánh về thời gian, chống gian lận và chấm điểm.

```mermaid
flowchart TD
    start([Truy cập Trung tâm ôn thi]) --> clickStart[Chọn Bắt đầu thi]
    
    clickStart --> isGuest{Là Guest?}
    isGuest -- Đúng --> showWarning[Hiển thị cảnh báo Vui lòng đăng nhập]
    showWarning --> stopEnd([Kết thúc])
    
    isGuest -- Sai --> fetchExam[Lấy dữ liệu Bài thi qua API]
    fetchExam --> takeExamPage[Chuyển sang trang Làm bài thi]
    takeExamPage --> startTimer[Bắt đầu tính giờ Countdown]
    
    startTimer --> readQ[Học viên đọc câu hỏi]
    
    readQ --> qType{Loại câu hỏi?}
    qType -- Single Choice --> pickOne[Chọn 1 đáp án]
    qType -- Multi Choice --> pickMulti[Chọn nhiều đáp án]
    
    pickOne --> saveTemp[Lưu đáp án tạm vào LocalStorage]
    pickMulti --> saveTemp
    
    saveTemp --> nextQ[Đánh dấu câu hỏi / Chuyển câu tiếp theo]
    
    nextQ --> isTimeout{Hết giờ?}
    isTimeout -- Không --> isSubmit{Bấm Nộp bài?}
    
    isSubmit -- Không --> readQ
    isSubmit -- Có --> confirmSubmit{Xác nhận nộp?}
    
    confirmSubmit -- Hủy --> readQ
    
    isTimeout -- Có --> doSubmit[Tự động kích hoạt Nộp bài Auto-submit]
    confirmSubmit -- Đồng ý --> doSubmit
    
    doSubmit --> lockUI[Khóa giao diện IsSubmitting = true]
    lockUI --> callAPI[Gửi dữ liệu lên Backend API Submit]
    
    callAPI --> checkSpam{Vừa nộp trong 5 phút?}
    
    checkSpam -- Có --> returnOld[Trả về kết quả đã lưu trước đó]
    checkSpam -- Không --> grade[Backend: Chấm điểm So khớp đáp án]
    
    grade --> calcScore[Tính % số câu đúng]
    calcScore --> isPass{% >= Điểm đạt Passing Score?}
    
    isPass -- Đúng --> setPass[Trạng thái = PASSED]
    isPass -- Sai --> setFail[Trạng thái = FAILED]
    
    setPass --> saveResult[Lưu kết quả ExamResult vào DB]
    setFail --> saveResult
    
    saveResult --> returnNew[Backend trả về ResultID mới]
    returnOld --> clearTemp[Xóa dữ liệu thi tạm LocalStorage]
    returnNew --> clearTemp
    
    clearTemp --> goResult[Chuyển hướng đến trang Kết quả]
    goResult --> showScore[Hiển thị Điểm, Số câu đúng, Lịch sử thi]
    showScore --> stopEnd
```

---

## 4. Luồng Quản lý Bài thi (Admin Management Flow)

Luồng của Admin khi tạo hoặc chỉnh sửa một bài thi mới.

```mermaid
flowchart TD
    start([Truy cập Admin Dashboard]) --> openExams[Mở Quản lý Bài thi]
    openExams --> clickAdd[Chọn Thêm bài thi mới hoặc Chỉnh sửa]
    
    clickAdd --> inputBasic[Nhập thông tin cơ bản Tên, Mã, Thời gian...]
    inputBasic --> addQ[Thêm các Câu hỏi]
    
    addQ --> inputQ[Nhập nội dung câu hỏi và lựa chọn Options]
    inputQ --> setCorrect[Chỉ định Đáp án đúng Single/Multiple]
    
    setCorrect --> hasImg{Có upload ảnh?}
    hasImg -- Có --> uploadImg[Upload ảnh lên Cloudinary]
    uploadImg --> getImgURL[Nhận URL ảnh]
    getImgURL --> moreQ
    
    hasImg -- Không --> moreQ{Còn muốn thêm câu hỏi?}
    
    moreQ -- Có --> inputQ
    moreQ -- Không --> clickSave[Bấm Lưu bài thi]
    
    clickSave --> validate{Validate Input?}
    validate -- Không hợp lệ --> showError[Hiển thị thông báo lỗi]
    showError --> inputBasic
    
    validate -- Hợp lệ --> sendAPI[Gửi dữ liệu lên Backend]
    sendAPI --> sanitize[Sanitize dữ liệu loại đáp án rỗng...]
    sanitize --> dbSave[Lưu vào Database Transaction]
    
    dbSave --> showSuccess[Hiển thị thông báo Thành công]
    showSuccess --> goList[Chuyển về danh sách Bài thi]
    goList --> stopEnd([Kết thúc])
```

## 5. Luồng Đăng nhập & Đăng ký (Authentication Flow)

Hệ thống CCNA Learning Platform sử dụng JWT (JSON Web Token) để xác thực. Dưới đây là luồng xử lý đăng nhập và đăng ký cơ bản.

```mermaid
flowchart TD
    start([Truy cập trang Đăng nhập]) --> hasAcc{Đã có tài khoản?}
    
    hasAcc -- Không --> clickReg[Chọn Đăng ký]
    clickReg --> inputReg[Nhập Full Name, Email, Password]
    inputReg --> submitReg[Gửi API Đăng ký]
    
    submitReg --> checkEmail{Email đã tồn tại?}
    checkEmail -- Có --> errEmail[Hiển thị lỗi Email đã sử dụng]
    errEmail --> inputReg
    
    checkEmail -- Không --> hashPass[Backend: Mã hóa Mật khẩu Bcrypt]
    hashPass --> saveUser[Lưu User vào Database Role mặc định: STUDENT]
    saveUser --> regSuccess[Đăng ký thành công]
    regSuccess --> inputLogin
    
    hasAcc -- Có --> inputLogin[Nhập Email và Password]
    inputLogin --> submitLogin[Gửi API Đăng nhập]
    
    submitLogin --> checkUser{User tồn tại?}
    checkUser -- Không --> errLogin[Hiển thị lỗi Sai tài khoản / mật khẩu]
    
    checkUser -- Có --> comparePass[So sánh mật khẩu Bcrypt]
    comparePass --> isMatch{Khớp mật khẩu?}
    
    isMatch -- Không --> errLogin
    errLogin --> inputLogin
    
    isMatch -- Có --> genJWT[Backend: Tạo JWT Token]
    genJWT --> updateLastLogin[Cập nhật LastLogin trong DB]
    updateLastLogin --> returnToken[Trả về AccessToken và Thông tin User]
    
    returnToken --> saveToken[Frontend: Lưu Token vào LocalStorage]
    saveToken --> redirectDash[Chuyển hướng đến Dashboard tương ứng Role]
    redirectDash --> stopEnd([Kết thúc])
```

---

## Các Điều kiện Phân nhánh (Branching Conditions) Cốt lõi cần đưa vào tài liệu:

1. **Điều kiện Access Control (Phân quyền):**
   - `!req.user`: Guest -> Chỉ cho phép đọc các bản ghi có trạng thái `PUBLISHED` hoặc `OPEN`. Chặn hành động Create/Update/Delete và Nộp bài thi.
   - `req.user.role === 'STUDENT'`: Truy cập bình thường vào luồng học và thi.
   - `req.user.role === 'ADMIN'`: Thấy toàn bộ bản ghi (kể cả `DRAFT`), cho phép vào trang Admin, gọi các API thay đổi dữ liệu.

2. **Điều kiện Chấm điểm Bài thi (Grading Logic):**
   - **Multi-choice check**: Mảng đáp án chọn (`userAns`) phải có cùng độ dài với mảng đáp án đúng (`correctAns`) VÀ mọi phần tử của `userAns` phải nằm trong `correctAns`.
   - `isPassed = (correctCount / totalQuestions) * 100 >= exam.passingScore`.

3. **Điều kiện Chống Spam Nộp bài (Idempotency):**
   - Khi Backend nhận request `submitExam`, kiểm tra xem trong vòng 5 phút vừa qua (`takenAt: { gte: Date.now() - 5 phút }`), người dùng này đã nộp bài thi cho `examId` này chưa.
   - Nếu có: Bỏ qua chấm điểm, trả về luôn `id` của kết quả cũ để chống lặp dữ liệu do mạng lag bấm 2 lần.
