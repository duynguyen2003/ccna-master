# Giải Thích Chi Tiết Thay Đổi Code (Technical Deep Dive)

Tài liệu này đi sâu vào phần logic code đã được thực hiện để tái cấu trúc hệ thống.

---

## 1. Đồng bộ hóa Token (Backend - authController.js)

**Vấn đề:** Frontend (trong `Api.js` và `Login.js`) mặc định tìm kiếm key `accessToken` trong JSON trả về, trong khi Backend trả về key `token`. Điều này làm `localStorage.setItem('token', ...)` bị gán giá trị `undefined`.

### Code Logic:
- **Trước:** `res.json({ success: true, token, user });`
- **Sau:** 
```javascript
res.json({ 
  success: true, 
  accessToken: token, // Rename để khớp với code Frontend hiện tại
  user 
});
```

---

## 2. Dynamic Data Mapping (Frontend - Home.js)

**Vấn đề:** Trang Home trước đây dùng mảng dữ liệu tĩnh, dẫn đến việc không thể cập nhật tiến độ học tập thực tế của người dùng.

### Code Logic:
Chúng ta đã chuyển từ `courses` (array) tĩnh sang `useState` và `useEffect` để fetch data từ API chung:

```javascript
// Map dữ liệu từ API sang định dạng hiển thị của trang Home
const data = await api.getCourses();
const mapped = data.map((c, idx) => ({
  id: idx + 1,
  courseId: c.id,          // Giữ ID gốc để điều hướng
  icon: COURSE_ICONS[c.code] || FALLBACK_ICON, // Map icon theo code
  title: c.title,
  progress: c.progress,
  statusText: getStatusText(c.progress),
}));
setCourses(mapped);
```

---

## 3. Điều hướng linh hoạt (Breadcrumbs - Lesson.js)

**Vấn đề:** Người dùng khi vào trang bài học (`/lesson`) sẽ bị "mất dấu" không biết mình đang ở khóa học nào nếu không có thanh điều hướng quay lại.

### Code Logic:
Sử dụng `useSearchParams` của `react-router-dom` để lấy context khóa học từ URL:

```javascript
// URL: /lesson?course=c1
const [searchParams] = useSearchParams();
const courseId = searchParams.get('course');

// Trong giao diện Breadcrumb:
<button onClick={() => navigate(`/course/${courseId}?from=lesson`)}>
   <ArrowLeft size={14} /> Khóa học
</button>
```

---

## 4. Tối ưu Sidebar State (Navbar.js)

**Vấn đề:** Khi người dùng ở trang Chi tiết khóa học (`/course/c1`), thanh Sidebar mất trạng thái "Active" vì URL không khớp hoàn toàn với `/roadmap`.

### Code Logic:
Cập nhật logic `isActive` để giữ trạng thái sáng đèn cho mục "Khóa học" khi người dùng ở bất kỳ trang nào thuộc luồng học tập:

```javascript
// Trước: isActive('/roadmap')
// Sau: 
<Link 
  className={`sidebar-link ${isActive('/roadmap') || location.pathname.startsWith('/course') ? 'active' : ''}`} 
  to="/roadmap"
>
```

---

## 5. Cấu trúc dữ liệu mới (Services - Api.js)

**Vấn đề:** Để tạo giao diện kiểu Udemy, chúng ta cần nhiều thông tin hơn là chỉ tiêu đề và mô tả (Ví dụ: Giảng viên, Năng lực đạt được, Thời lượng).

### Code Logic:
Mở rộng Schema của Object `Course` trong `MOCK_COURSES`:
- `fullTitle`: Tiêu đề đầy đủ chuyên nghiệp.
- `competencies`: Mảng các kỹ năng (checkpoints).
- `instructor`: Object chứa tên và chức danh giảng viên.
- `thumbnailUrl`: Ảnh nền khóa học thực tế từ Unsplash.
- `lessonCount`: Số lượng bài học trong mỗi module.

---

## 6. Layout 2 cột (CSS - CourseDetail.css)

Sử dụng `display: flex` với thuộc tính `sticky`:
- `.cdp-layout`: Flexbox container chính.
- `.cdp-main`: `flex: 1` để chiếm phần lớn diện tích bên trái.
- `.cdp-sidebar`: `position: sticky; top: 80px; width: 340px;` để thẻ đăng ký luôn trượt theo người dùng khi họ cuộn trang xem giáo trình bên trái.

> [!NOTE]
> Toàn bộ các thay đổi trên được thiết kế để đảm bảo tính **Scalability (Mở rộng)**. Khi bạn thay thế Mock Data bằng API thật từ Database, bạn chỉ cần thay đổi phần fetch, giao diện không cần sửa lại bất kỳ CSS nào.
