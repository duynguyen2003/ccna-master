# Thiết kế Logic Flow cho Khóa Học (Course Flow)

## 1. PHÂN TÍCH VẤN ĐỀ HIỆN TẠI

### Tình trạng hiện tại:
```
User Click Roadmap → Show Lesson (Kiến trúc không rõ ràng)
```

- Người dùng click vào khóa học nhưng chưa có:
  - Trang xem chi tiết khóa học
  - Lựa chọn chính thức để "bắt đầu khóa học"
  - Các tùy chọn: xem nội dung, xem tiến độ, xem bài tập

---

## 2. LUỒNG LOGIC ĐƯỢC THIẾT KẾ (PROPOSED FLOW)

### Cấu trúc 3 tầng:

```
┌─────────────────────────────────┐
│   TẦNG 1: ROADMAP (DANH SÁCH)  │
├─────────────────────────────────┤
│  - ITN 100-105                 │
│  - SRWE 200-105                │
│  - CCNA 200-301                │
└──────────┬──────────────────────┘
           │ Click vào Course
           ▼
┌─────────────────────────────────┐
│ TẦNG 2: COURSE DETAIL (CHI TIẾT)│
├─────────────────────────────────┤
│ • Tiêu đề & Mô tả              │
│ • Thống kê: Xiên độ, Bài học   │
│ • Yêu cầu tiên quyết           │
│ • Nút: "Bắt Đầu" / "Tiếp Tục"  │
│ • Danh sách Modules            │
└──────────┬──────────────────────┘
           │ Click "Bắt Đầu/Tiếp Tục"
           ▼
┌─────────────────────────────────┐
│  TẦNG 3: LESSON (BÀI GIẢNG)    │
├─────────────────────────────────┤
│ • Video                         │
│ • Nội dung bài học              │
│ • Bài tập liên quan             │
│ • Navigation giữa các bài       │
└─────────────────────────────────┘
```

---

## 3. CONTEXT STATE CẦN THÊM

### Thêm vào `CourseContext.js` (cần tạo mới):

```javascript
{
  selectedCourseId: null,           // Course đang được xem chi tiết
  currentModuleId: null,            // Module hiện tại
  currentLessonId: null,            // Bài học hiện tại
  courseProgress: {},               // { courseId: { progress, startDate } }
  isCourseLocked: (courseId) => {}  // Kiểm tra khóa học có bị khóa không
}
```

### Cập nhật `AuthContext.js`:
- Thêm trường `courseEnrollments` để lưu danh sách khóa học đã đăng ký

---

## 4. COMPONENT STRUCTURE

### A. Roadmap.js (DANH SÁCH)
**Nhiệm vụ:** Hiển thị tất cả khóa học
**Thay đổi:**
- Thêm button "Xem Chi Tiết" hoặc "Bắt Đầu"
- Click → Navigate đến CourseDetail

```javascript
{courses.map((course) => (
  <div key={course.id} className="course-card">
    <h3>{course.title}</h3>
    <p>{course.description}</p>
    <ProgressBar value={course.progress} />
    <button 
      onClick={() => navigate(`/course/${course.id}`)}
    >
      {course.progress > 0 ? "Tiếp Tục" : "Bắt Đầu"}
    </button>
  </div>
))}
```

### B. CourseDetail.js (CHI TIẾT - CẦN TẠO MỚI)
**Nhiệm vụ:** Hiển thị thông tin chi tiết về khóa học
**Nội dung:**
- Header: Tên, mô tả, badge (tiến độ, difficulty)
- Thống kê: Số bài học, số modules, thời gian ước tính
- Danh sách modules (có thể expand để xem lessons)
- 2 nút chính:
  - **"Bắt Đầu Khóa Học"** → Điều hướng tới bài học đầu tiên
  - **"Tiếp Tục"** → Điều hướng tới bài học cuối cùng đã học

```javascript
const CourseDetail = ({ courseId }) => {
  const [course, setCourse] = useState(null);
  const [expandedModules, setExpandedModules] = useState({});
  
  // Xác định button text
  const getButtonLabel = () => {
    if (course.progress === 0) return "Bắt Đầu Khóa Học";
    return "Tiếp Tục Học Tập";
  };
  
  const handleStartCourse = () => {
    // Ghi nhận user đã vào khóa học
    enrollCourse(courseId);
    // Điều hướng tới bài học đầu tiên hoặc bài học tiếp theo
    navigate(`/lesson/${firstLesson.id}?course=${courseId}`);
  };

  return (
    <div className="course-detail">
      <CourseHeader course={course} />
      <CourseStats course={course} />
      <ModuleList course={course} />
      <button onClick={handleStartCourse}>
        {getButtonLabel()}
      </button>
    </div>
  );
};
```

### C. Lesson.js (BÀI GIẢNG - CẬP NHẬT)
**Thay đổi:**
- Nhận `courseId` từ URL query params
- Thêm breadcrumb: Course > Module > Lesson
- Navigation sidebar hiển thị lessons của khóa học hiện tại
- Thêm nút "Quay lại khóa học"

```javascript
const Lesson = () => {
  const queryParams = new URLSearchParams(window.location.search);
  const courseId = queryParams.get('course');
  const [courseModules, setCourseModules] = useState([]);
  
  // Load bài học theo course
  const loadLessonsByModule = async (moduleId) => {
    const lessons = await api.getLessonsByModule(moduleId, courseId);
    return lessons;
  };

  return (
    <div className="lesson-container">
      <Breadcrumb course={currentCourse} module={currentModule} />
      
      <video src={currentLesson.videoUrl} />
      <LessonContent lesson={currentLesson} />
      
      {/* Navigation */}
      <button onClick={() => navigate(`/course/${courseId}`)}>
        ← Quay lại Khóa Học
      </button>
      <NavigationButtons courseId={courseId} />
    </div>
  );
};
```

---

## 5. ROUTING CẦN CẬP NHẬT

### Hiện tại:
```javascript
<Route path="/roadmap" element={<Roadmap />} />
<Route path="/lesson" element={<Lesson />} />
```

### Sau khi cập nhật:
```javascript
<Route path="/roadmap" element={<Roadmap />} />
<Route path="/course/:id" element={<CourseDetail />} />
<Route path="/lesson/:id" element={<Lesson />} />
```

---

## 6. DATA FLOW & STATE MANAGEMENT

### Khi user click vào khóa học:
```
1. Roadmap.js → onClick handler
2. Navigate to /course/:courseId
3. CourseDetail loads course data (API call)
4. CourseDetail.jsx render with:
   - Course info
   - Modules list
   - Start/Continue button
5. User clicks "Bắt Đầu"
6. enrollCourse() → save to context
7. Navigate to /lesson/:firstLessonId?course=:courseId
8. Lesson.jsx loads lesson with course context
```

### State flow:
```
┌─────────────┐
│ AuthContext │ (User data, token)
└──────┬──────┘
       │
       ▼
┌──────────────────┐
│ CourseContext    │ (Active course, modules, lessons)
└──────┬───────────┘
       │
   ┌──────┴────────┐
   ▼               ▼
Roadmap      CourseDetail
   │               │
   └───────┬───────┘
           ▼
        Lesson
```

---

## 7. API ENDPOINTS CẦN THIẾT

```javascript
// Existing
GET /api/courses
GET /api/courses/:id
GET /api/modules/:id

// New / Modifications needed
POST /api/courses/:id/enroll        // Ghi nhận user vào khóa học
GET /api/courses/:id/progress       // Lấy tiến độ khóa học
GET /api/modules/:id/lessons        // Lấy danh sách bài học trong module
GET /api/lessons/:id                // Lấy chi tiết bài học
POST /api/lessons/:id/complete      // Đánh dấu bài học hoàn thành
```

---

## 8. USER EXPERIENCE IMPROVEMENT

### Trước:
- ❌ Click course → Quá nhanh vào bài học
- ❌ Không rõ người dùng đã "vào" khóa học chưa
- ❌ Không có cơ hội xem tổng quan khóa học

### Sau:
- ✅ Click course → Xem chi tiết
- ✅ Click "Bắt Đầu" → Vào khóa học chính thức
- ✅ Người dùng biết mình đã "đăng ký" khóa học
- ✅ Có thể quay lại tổng quan bất cứ lúc nào
- ✅ Clear navigation: Roadmap → Course Details → Lessons

---

## 9. THỰC TRANG TOÀN BỘ TRONG APP.JS

```javascript
<Route path="/roadmap" element={<Roadmap />} />
<Route path="/course/:courseId" element={<CourseDetail />} />
<Route path="/lesson/:lessonId" element={<Lesson />} />
```

---

## 10. TIMELINE IMPLEMENTATION

1. **Phase 1**: Tạo CourseContext & CourseDetail component
2. **Phase 2**: Cập nhật Roadmap navigation
3. **Phase 3**: Cập nhật Lesson với course context
4. **Phase 4**: Cập nhật routing trong App.js
5. **Phase 5**: Testing & refinement

---

## TÓMLƯỢC LUỒNG CUỐI CÙNG

### **Flow 1: Từ Roadmap** (Luồng chính)
```
User Flow:
1. Vào /roadmap
   → Thấy danh sách 3 khóa học
   
2. Click "ITN 100-105"
   → Điều hướng đến /course/itn-100-105?from=roadmap
   → Xem chi tiết khóa học
   
3. Click "Bắt Đầu Khóa Học"
   → Ghi nhận enrollment
   → Điều hướng đến /lesson/1?course=itn-100-105
   → Xem bài giảng
   
4. Xem nội dung bài học
   → Click "← Quay lại Khóa Học" → /course/itn-100-105?from=roadmap
   → Click "Quay lại" → /roadmap
```

### **Flow 2: Trực tiếp từ Home hoặc trang khác**
```
User Flow:
1. Trên Home (hoặc trang khác) → Click vào course card
   → Điều hướng đến /course/itn-100-105?from=home (hoặc ?from=profile)
   → Xem chi tiết khóa học
   
2. Click "Bắt Đầu Khóa Học"
   → Ghi nhận enrollment
   → Điều hướng đến /lesson/1?course=itn-100-105
   → Xem bài giảng
   
3. Xem nội dung bài học
   → Click "← Quay lại Khóa Học" → /course/itn-100-105?from=home
   → Click "Quay lại" → /home (quay lại trang trước đó)
```

### **Flow 3: Trực tiếp link bookmark hoặc URL**
```
User Flow:
1. Người dùng bookmark /course/itn-100-105 (không có ?from)
   → Điều hướng đến /course/itn-100-105
   → Xem chi tiết khóa học
   
2. Click "Quay lại" (không có from parameter)
   → Mặc định quay về /roadmap
```

---

## IMPLEMENTATION: URL Parameters Tracking

### CourseDetail Navigation:
```javascript
// Roadmap link
<button onClick={() => navigate(`/course/${courseId}?from=roadmap`)}>
  Xem chi tiết
</button>

// Home card link
<button onClick={() => navigate(`/course/${courseId}?from=home`)}>
  Học ngay
</button>

// CourseDetail back button
const [searchParams] = useSearchParams();
const fromPage = searchParams.get('from') || 'roadmap'; // Mặc định roadmap

<button onClick={() => navigate(`/${fromPage}`)}>
  ← Quay lại
</button>
```

### Lesson to CourseDetail:
```javascript
// courseId + from parameter truyền sang
navigate(`/course/${courseId}?from=lesson`)
```

---

## BENEFIT CỦA APPROACH NÀY

✅ **Linh hoạt**: Người dùng có thể vào course từ bất cứ trang nào  
✅ **Quay lại chính xác**: Biết quay lại trang nào (Home/Roadmap/Profile/v.v)  
✅ **SEO-friendly**: Có thể share link direct `/course/:id`  
✅ **Bookmark safe**: Ngay cả bookmark `?from=` parameter cũng ok  
✅ **Không phụ thuộc History API**: Browser back button cũng hoạt động  

---

## URL Structure Summary

```
/roadmap
  ↓ click course
/course/:courseId?from=roadmap
  ↓ click "Bắt Đầu"
/lesson/:lessonId?course=:courseId
  ↓ click "← Quay lại"
/course/:courseId?from=roadmap
  ↓ click "Quay lại"
/roadmap

---

/home
  ↓ click course card
/course/:courseId?from=home
  ↓ click "Bắt Đầu"
/lesson/:lessonId?course=:courseId
  ↓ click "← Quay lại"
/course/:courseId?from=home
  ↓ click "Quay lại"
/home

---

/course/:courseId (trực tiếp - bookmark)
  ↓ click "Quay lại" (mặc định)
/roadmap
```

Đây là thiết kế hoàn chỉnh cho logic flow của khóa học! 🎯
