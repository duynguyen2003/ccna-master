# Learning Game Path — Kế hoạch frontend và hợp đồng FE–BE–Database

Ngày bàn giao: 10/09/2026. Nguồn yêu cầu: `coure.md`. Phạm vi lượt triển khai hiện tại: backend, kiểm thử và tài liệu này. Agent tiếp theo triển khai frontend theo hợp đồng dưới đây.

## 1. Nhiệm vụ dành cho Agent frontend

Nâng cấp trang `/roadmap` thành bản đồ hành trình CCNA, kết nối dữ liệu thật của backend đã có trong repository. Người học phải nhận biết chặng hiện tại, tiến độ, nội dung còn thiếu và lý do khóa; chuyển liền mạch từ bản đồ sang course, lesson, Lab và quay lại sau khi lưu tiến độ.

Đọc tài liệu này, `coure.md`, `Agent.md` và source được dẫn bên dưới trước khi sửa. Ghi kế hoạch vào `todo.md`, triển khai từng giai đoạn, kiểm tra và ghi kết quả. Ưu tiên hợp đồng backend thực tế khi ví dụ trong `coure.md` khác source. Các JSON minh họa bên dưới là tài liệu contract, không phải dữ liệu để hardcode trong UI.

Backend đã xử lý nghiệp vụ. Frontend chỉ gửi thao tác hợp lệ và trình bày kết quả đã được server xác nhận. Không thêm thao tác “hoàn thành cả khóa học” bằng state local hoặc gửi tùy ý XP/status khóa học.

## 2. Kiến trúc thực tế cần giữ

| Phần | Hiện trạng và điểm tích hợp |
| --- | --- |
| Frontend | React 18, JavaScript/JSX, CRA/react-scripts; không có yêu cầu chuyển TypeScript hay Vite |
| Router | `src/App.js`, HashRouter, `/roadmap`, `/course/:courseId`, `/lesson?course=...&lesson=...`, `/labs?labId=...` |
| Layout | `src/components/Content/Layout.js`; giữ Navbar, header, footer và bố cục trang hiện tại |
| Authentication | `src/context/AuthContext.js`: `user`, `token`, `loading`, `isAuthenticated`, `login`, `logout`, `updateUser` |
| API client đang được dùng | `src/services/Api.js`: `API_URL`, `apiFetch`, object `api`, Bearer token và sự kiện `unauthorized` |
| Điểm khác đặc tả ban đầu | Client học viên thực tế dùng **fetch wrapper**; Axios có trong dependency nhưng không có Axios instance chung cho flow này. Mở rộng `apiFetch`, không tạo transport thứ hai chỉ để khớp ví dụ Axios |
| Module API cũ chưa dùng | `src/services/api/contentApi.js` là placeholder; `src/services/api/index.js` còn export `examApi` không tồn tại. Không nối tính năng mới qua barrel này |
| Server state | `src/index.js` đã tạo một `QueryClient` trong `QueryClientProvider`; Roadmap cũ vẫn dùng useEffect, cần chuyển riêng flow này sang React Query v5 |
| UI tokens | `src/App.css`: `--blue-primary`, `--blue-hover`, `--slate-*`, `--border-color`, `--text-muted`, `--system-ui` |
| Styling | CSS theo trang trong `src/css/`; không giả định utility Tailwind đã được cấu hình đầy đủ chỉ vì dependency tồn tại |
| Animation | GSAP + `@gsap/react`; `src/utils/labMotion.js` có `gsap`, `useGSAP`, `prefersReducedMotion`; Motion hiện nằm trong các UI khác |
| Toast | `src/components/Toast.js` có component và hook; `GlobalToastRenderer` trong App dùng AuthContext. Không thêm một toast provider toàn ứng dụng trùng chức năng |
| Modal | `AdminModal` có style/animation dành riêng admin, Escape và dialog semantics, chưa có focus trap hoàn chỉnh. Không import toàn bộ admin CSS vào trang học viên; dùng `<dialog>` hoặc trích primitive chung nếu thật sự cần |
| Backend | Express 5/CommonJS trong `src/Backend/`; router được mount dưới `/api` |
| Database | Prisma 7 + adapter-pg singleton ở `src/Backend/config/database.js`, PostgreSQL/Supabase; trình duyệt không kết nối DB |
| Environment | `process.env.REACT_APP_API_URL`, mặc định `http://localhost:5000/api`; production dùng URL Render trong cấu hình triển khai, không hardcode localhost |

Không sửa các component Admin/Navbar/Lab mà người dùng đang thiết kế nếu không cần cho điểm nối progress. Không thay HashRouter, AuthContext, hệ thống đăng nhập hay stack build.

## 3. Backend đã triển khai

### 3.1. File nguồn sự thật

| File | Trách nhiệm |
| --- | --- |
| `src/Backend/domain/learningPath.js` | Pure functions: sắp thứ tự, prerequisite, trạng thái, progress từ task, DTO, XP |
| `src/Backend/services/learningPathService.js` | Đọc Prisma, xác thực tài khoản, kiểm tra liên kết/nội dung/khóa, transaction, summary, badge, activity, telemetry video |
| `src/Backend/validation/learningPathSchema.js` | Zod cho ID, progress, module completion và video heartbeat |
| `src/Backend/controllers/learningPathController.js` | Response contract và lỗi an toàn cho frontend |
| `src/Backend/routes/learning.js` | GET Learning Path, PATCH module progress; đăng ký trước middleware admin |
| `src/Backend/routes/users.js` | Giữ các URL progress/video cũ, thêm limiter cho thao tác ghi |
| `src/Backend/controllers/userController.js` | Delegate việc ghi progress/video sang controller chung |
| `src/Backend/controllers/learningController.js` | GET courses dùng cùng phép tính với Learning Path, giữ envelope và field cũ |
| `src/Backend/controllers/adminController.js` | Các số liệu course chỉ lọc course summary, tránh tính nhầm module summary mới thành enrollment/course progress |
| `src/Backend/controllers/labAttemptController.js` | CLI Lab kiểm tra mở khóa lúc bắt đầu; khi chấm đạt, cập nhật tiến độ/badge trong cùng transaction với kết quả Lab |
| `src/Backend/middleware/rateLimiter.js` | Limiter progress 120 request/phút/user, dùng chung cho module/lesson/video |

### 3.2. Quy tắc nghiệp vụ chính thức

1. Course hiển thị trên bản đồ phải có `deletedAt = null` và `status` thuộc `PUBLISHED`, `OPEN`.
2. Thứ tự tăng dần theo `orderIndex`, sau đó `id`. Không hardcode đúng ba course hoặc gán prerequisite bằng code ITN/SRWE/ENSA.
3. `prerequisiteId` là **ID** của course hiển thị ngay trước đó. Đây là lộ trình tuần tự, chưa có mô hình nhiều prerequisite/nhánh tùy chỉnh.
4. Course đã đủ điều kiện hoàn thành có `status = completed`; course chưa hoàn thành đầu tiên đủ prerequisite là `current`; các course chưa hoàn thành còn lại là `locked`.
5. Module cũng học tuần tự trong course. Module đã hoàn thành được ôn tập; module chưa xong phía sau một module chưa hoàn thành bị khóa. Quyền cuối cùng nằm ở `canAccess` của course và module.
6. Bài học chưa xóa và Lab đang `PUBLISHED`/`OPEN`, chưa xóa, thuộc course/module đang hiển thị là các task bắt buộc. Lab có `moduleId` và `courseId` được tính đúng một lần. Lab chỉ liên kết module vẫn được quy về course của module.
7. Lab gắn vào module đã xóa, Lab DRAFT hoặc liên kết course/module mâu thuẫn không được tính. Bài học trong module đã xóa cũng không được tính.
8. Module hoàn thành khi có ít nhất một task và **mọi lesson/Lab của module đều hoàn thành**. Course hoàn thành khi tất cả module và mọi task của course đã hoàn thành; Lab chỉ gắn course cũng là yêu cầu của course.
9. Module rỗng không tự hoàn thành. Nếu course có module rỗng, modal hiển thị empty state theo dữ liệu thật; node khóa học không gắn nhãn “Cập nhật” và không có nút đánh dấu xong để vượt qua.
10. Exam hiện là điểm điều hướng/ôn tập, chưa là điều kiện hoàn thành Learning Path. Không thêm khóa dựa trên điểm thi ở FE.
11. Completion lesson/Packet Tracer vẫn theo flow tự báo tiến độ hiện hữu: server chấp nhận `status: COMPLETED` hoặc `progressPercent >= 95`, chuẩn hóa thành 100 sau khi kiểm tra quyền. Đây không phải bằng chứng chống tua video hay cơ chế chống gian lận thi.
12. CLI Lab chỉ hoàn thành bằng kết quả chấm phía server. `POST /users/progress` không cho tự đánh dấu CLI Lab xong.
13. Tiến độ task tăng một chiều; request chậm hoặc retry với phần trăm thấp không làm mất completion. PATCH module chỉ nhận `completed: true`; chưa có reset/uncomplete.
14. Backend không dùng course/module summary cũ làm bằng chứng hoàn thành. Nó tính lại từ các task, gom các dòng progress cũ bị trùng theo ID task.

### 3.3. Công thức và gamification

```text
taskPercent = 100 nếu UserProgress.status = COMPLETED
              hoặc progressPercent đã đạt 100;
              còn lại clamp(progressPercent, 0, 100)

modulePercent = floor(trung bình taskPercent của module)
coursePercent = floor(trung bình taskPercent của course)

Chỉ trả 100 khi điều kiện hoàn thành thực sự đạt.
Chưa đạt thì tối đa 99; không làm tròn 99.9 thành 100.
Không có task thì 0.

overallProgress = floor(sum(coursePercent × course.totalItems) / sum(totalItems))
Chưa hoàn thành tất cả course thì tối đa 99.

XP = completedLessons × 10
   + completedLabs × 50
   + completedModules × 25
   + completedCourses × 100
```

- `stats.xp` là giá trị server tính từ nội dung đang xuất bản, **chưa phải ví XP tích lũy vĩnh viễn**. Khi admin thêm/xóa/ẩn nội dung hoặc thay đổi quy tắc thưởng, giá trị có thể được tính lại. FE chỉ animate số server trả, không cộng vào localStorage hay cập nhật `User.level`.
- Badge được lưu vào `UserBadge` khi transaction ghi tiến độ xác nhận course đã hoàn thành. Tên ổn định là `CCNA: <course.id>`; FE có thể hiển thị nhãn thân thiện `Hoàn thành <course.code>`. Một người dùng không được nhận lại cùng badge qua retry/ôn tập.
- `stats.badges` là số badge thực đang có trong `UserBadge`, bao gồm badge cũ khác Learning Path. Không dùng số completedCourses để thay nó.
- `stats.streakDays` đọc `User.streak` hiện có. Repository chưa có cơ chế cập nhật streak học tập chung; theo mục 55 của `coure.md`, lượt này giữ điểm tích hợp, chưa phát minh thuật toán mới. Không hiển thị hứa hẹn “học hôm nay chắc chắn +1 streak”.
- Video `StudyLog.date` mới được ghi theo ngày `Asia/Ho_Chi_Minh`, lưu dạng DATE lúc 00:00 UTC. Phần thống kê ngày lịch không phụ thuộc timezone máy người dùng. Không tự suy ra streak từ clock trình duyệt.

## 4. Mapping database — không cần migration cho phiên bản này

| Data/UI | Model/field nguồn | Cách sử dụng |
| --- | --- | --- |
| Node identity | `Course.id` (`String`, tối đa 10) | Dùng trong route, key và mutation; không thay bằng `code` |
| Nhãn course | `Course.code`, `title`, `description`, `thumbnailUrl` | Hiển thị dữ liệu thật; description null được chuẩn hóa `""` |
| Thứ tự/prerequisite | `Course.orderIndex`, `id` | Backend tạo chuỗi course từ danh sách đã lọc |
| Chương | `Module.id`, `courseId`, `orderIndex`, `deletedAt` | ID module là **chuỗi**, không `parseInt` |
| Bài học | `Lesson.id` (số nguyên), `moduleId`, `videoDuration` | Thời lượng video chỉ là metadata ước tính, không phải thời lượng học toàn bộ course |
| Kỹ năng | `CourseTopic.title`, `orderIndex` | Admin quản trị như “Kỹ năng trọng tâm”, backend trả thành `skills[]`; không suy đoán từ tên video và không bịa danh sách để lấp chỗ trống |
| Mã exam | `Exam.examCode` của exam OPEN chưa xóa gắn course | Nullable; không hardcode 200-301 vào mọi course |
| Lesson progress | `UserProgress`: `userId`, `courseId`, `lessonId`, `moduleId` | Bằng chứng task, không đếm số dòng nếu có dữ liệu legacy trùng |
| Lab progress | `UserProgress.labId` và `LabAttempt` chấm đạt | CLI chỉ ghi từ grader; Packet Tracer dùng flow hiện tại |
| Module summary | `UserProgress` với `moduleId != null`, `lessonId = labId = null` | Projection lưu để tương thích; backend vẫn tính từ task |
| Course summary/enrollment | `UserProgress` với `moduleId = lessonId = labId = null` | Cho API/profile cũ; enrollment không đồng nghĩa hoàn thành |
| XP | Completion được domain tổng hợp từ các model trên | Không thêm cột `xp`, không có API FE ghi XP |
| Badge | `UserBadge` | Cấp trong transaction, dùng user lock chống trùng |
| Lịch sử | `UserActivity` | LESSON_COMPLETED, LAB_COMPLETED, MODULE_COMPLETED, COURSE_COMPLETED |
| Chuỗi ngày | `User.streak` | Điểm tích hợp đã có, xem giới hạn ở trên |
| Resume video/thời gian học | `VideoProgress`, `StudyLog`, `User.totalStudyTime` | Cùng transaction, không phải nguồn thay thế UserProgress |

Không thay `schema.prisma`, không seed course mẫu vào DB thật, không reset hoặc sửa dữ liệu production. Kiểm thử đã dùng schema hiện có trên database tạm riêng.

Course/module summary, badge, activity và kết quả task được cập nhật cùng transaction; CLI kết quả chấm cũng nằm trong transaction đó. Khóa PostgreSQL theo `(userId, 0)` được dùng chung giữa các đường ghi nên hoạt động qua nhiều backend process. GET không cấp badge hay ghi dữ liệu ngầm.

## 5. API contract chính xác

Tất cả đường dẫn trong phần này đã gồm `/api`. Khi gọi từ `apiFetch`, bỏ tiền tố `/api` vì `API_URL` đã chứa nó. JWT lấy từ AuthContext và được client hiện tại gắn vào `Authorization: Bearer ...`. Không truyền userId, role, XP hay trạng thái course từ frontend.

### 5.1. GET `/api/learning/learning-path`

Bắt buộc đăng nhập. Không phân trang để không cắt mất prerequisite. HTTP 200:

```ts
type PathStatus = 'completed' | 'current' | 'locked';

interface TaskSummary {
  totalItems: number;
  completedItems: number;
  completed: boolean;
  progressPercent: number; // 0..100, số nguyên trong DTO backend
}

interface LearningLesson {
  id: number;
  title: string;
  orderIndex: number;
  videoDuration: string | null;
  progressPercent: number;
  completed: boolean;
}

interface LearningLab {
  id: number;
  title: string;
  moduleId: string | null;
  labType: 'PACKET_TRACER' | 'CLI_SIMULATION';
  progressPercent: number;
  completed: boolean;
}

interface LearningModule extends TaskSummary {
  id: string;
  title: string;
  description: string;
  orderIndex: number;
  lessons: LearningLesson[];
  labs: LearningLab[];
  totalLessons: number;
  completedLessons: number;
  totalLabs: number;
  completedLabs: number;
  estimatedMinutes: number | null;
  duration: string | null;
  nextLessonId: number | null;
  status: PathStatus;
  canAccess: boolean;
  lockedReason: string | null;
}

interface LearningCourse extends TaskSummary {
  id: string;
  code: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  orderIndex: number;
  publicationStatus: string; // Không phải trạng thái học tập
  prerequisiteId: string | null;
  prerequisiteTitle: string | null;
  status: PathStatus;
  canAccess: boolean;
  lockedReason: string | null;
  iconType: 'network' | 'switching' | 'enterprise' | 'security' | 'automation';
  modules: LearningModule[];
  labs: LearningLab[]; // Gồm cả lab trong module; không cộng đếm lại
  totalModules: number;
  completedModules: number;
  totalLessons: number;
  completedLessons: number;
  totalLabs: number;
  completedLabs: number;
  estimatedHours: number | null;
  skills: string[];
  badgeName: string;
  examCode: string | null;
  contentReady: boolean;
  isStarted: boolean;
  nextModuleId: string | null;
  nextLessonId: number | null;
}

interface LearningPath {
  courses: LearningCourse[];
  stats: { streakDays: number; xp: number; badges: number; overallProgress: number };
  currentCourseId: string | null;
}

// Response HTTP:
interface GetLearningPathResponse { data: LearningPath }
```

Các interface là tài liệu contract; repository dùng JS nên có thể triển khai JSDoc thay vì thêm cấu hình TypeScript.

Ví dụ trạng thái khi chưa có nội dung:

```json
{
  "data": {
    "courses": [],
    "stats": { "streakDays": 0, "xp": 0, "badges": 0, "overallProgress": 0 },
    "currentCourseId": null
  }
}
```

Adapter FE chỉ chuẩn hóa dữ liệu hiển thị/null, giữ nguyên `status`, `canAccess`, `lockedReason`, counts và XP của server. Không chạy lại một bộ quy tắc nghiệp vụ khác rồi ghi đè trạng thái server. Pure function tính status trong FE chỉ cần khi test fixture/preview yêu cầu, không được coi là authorization.

### 5.2. POST `/api/users/progress` — tiếp tục dùng API hiện có

Ghi danh course đang mở:

```json
{ "courseId": "c1", "status": "ACTIVE", "progressPercent": 0 }
```

Lưu/hoàn thành lesson:

```json
{ "courseId": "c1", "moduleId": "m1234567", "lessonId": 42, "status": "COMPLETED", "progressPercent": 100 }
```

Packet Tracer tương tự nhưng dùng `labId`, bỏ `lessonId`. Có thể bỏ moduleId để server suy ra từ liên kết thật. ID lesson/Lab nhận số nguyên hoặc chuỗi chữ số để tương thích client cũ; ID course/module luôn là chuỗi. Cấm gửi cả lessonId và labId.

HTTP 200 giữ tương thích envelope cũ, thêm snapshot và transition:

```ts
interface EarnedBadge {
  id: number;
  userId: number;
  badgeName: string;
  badgeIcon: string | null;
  earnedAt: string; // ISO timestamp
}

interface ProgressTransition {
  changed: boolean;
  courseId: string;
  moduleId: string | null;
  courseProgress: number;
  moduleCompleted: boolean;   // true chỉ trong request gây chuyển sang completed
  courseCompleted: boolean;   // true chỉ trong request gây chuyển sang completed
  unlockedCourseId: string | null;
  xpAwarded: number;          // delta tính bởi server trong request này
  badgesAwarded: EarnedBadge[];
}

interface UpdateProgressResponse {
  data: {
    id: number;
    userId: number;
    courseId: string;
    moduleId: string | null;
    lessonId: number | null;
    labId: number | null;
    status: 'ACTIVE' | 'COMPLETED';
    progressPercent: number;
    completedAt: string | null;
    updatedAt: string;
  };
  overallPercent: number; // Tiến độ course vừa cập nhật, không phải overall toàn bản đồ
  transition: ProgressTransition;
  learningPath: LearningPath;
}
```

Ví dụ `transition` khi task cuối cùng của course hoàn thành:

```json
{
  "changed": true,
  "courseId": "c2",
  "moduleId": "m7",
  "courseProgress": 100,
  "moduleCompleted": true,
  "courseCompleted": true,
  "unlockedCourseId": "c3",
  "xpAwarded": 135,
  "badgesAwarded": [
    { "id": 12, "userId": 5, "badgeName": "CCNA: c2", "badgeIcon": "workspace_premium", "earnedAt": "2026-09-10T10:00:00.000Z" }
  ]
}
```

135 trong ví dụ là 10 lesson + 25 module + 100 course. Không hardcode số này; task cuối có thể là Lab và có mức khác. Request lặp sau thành công có `courseCompleted: false`, `unlockedCourseId: null`, `xpAwarded: 0`. Dùng snapshot để hiển thị course đã completed, dùng transition để quyết định animation.

### 5.3. PATCH `/api/learning/modules/:moduleId/progress`

```json
{ "completed": true }
```

HTTP 200: `{ "data": { ...ProgressTransition, "learningPath": ... } }`.

Đây là endpoint **xác nhận/đồng bộ module đã đủ task**. Nó kiểm tra các lesson và Lab phía server. Nó không đánh dấu hàng loạt lesson/Lab xong thay người dùng. Khi task cuối hoàn thành qua POST progress hoặc CLI submit, module/course đã tự cập nhật; không cần gọi thêm PATCH để mở khóa. Gọi PATCH lặp an toàn, không nhận thưởng lần nữa.

Nếu UI có nút “Xác nhận hoàn thành chương”, chỉ bật khi DTO đã báo mọi task đủ điều kiện. Nếu chưa đủ, dẫn người học tới lesson/Lab còn thiếu. Không thiết kế một nút cho phép bấm xong module ở bất kỳ thời điểm nào.

### 5.4. POST `/api/users/progress/video`

```json
{ "lessonId": 42, "watchedSeconds": 5, "lastPosition": 120, "isCompleted": false }
```

- `watchedSeconds`: số giây tăng thêm, integer 0..300 mỗi heartbeat; `lastPosition`: integer 0..86400.
- `isCompleted` nhận để tương thích payload cũ, không dùng để tự cấp completion. `VideoProgress.isCompleted` được đồng bộ theo completion thực của UserProgress.
- Response `{ "success": true, "data": <VideoProgress> }`.
- Không invalidate bản đồ ở mỗi heartbeat. Chỉ cập nhật learning state khi POST progress/CLI submit thật sự đổi tiến độ.
- Heartbeat là phép cộng thời gian, **không idempotent**. Không bật tự retry mutation này và không gửi cùng một delta từ hai timer. Cleanup timer khi đổi lesson, logout, unmount. Đừng cộng thời gian từ thao tác tua.
- Thao tác completion lesson và telemetry video là hai request tương thích hệ thống hiện có; completion không phụ thuộc việc một heartbeat cuối có về thành công hay không.

### 5.5. CLI Lab submit

Giữ URL `/api/lab-attempts/:attemptId/submit` và flow `api.submitCliLabAttempt`. Khi đạt và có liên kết course/module, HTTP 200 trả:

```ts
{
  data: {
    attempt: ExistingLabAttemptDTO;
    result: ExistingGradingResult;
    learningPath: LearningPath;
    transition: ProgressTransition;
  }
}
```

`api.submitCliLabAttempt` hiện unwrap `json.data`, vì vậy caller đọc `result.learningPath` và `result.transition`. Nếu không đạt hoặc Lab độc lập không thuộc course, hai field này có thể không tồn tại. Không tự gọi thêm POST progress để đánh dấu CLI Lab.

Nộp lại cùng attempt đã kết thúc vẫn trả 409 theo logic Lab hiện hữu. Học lại bằng attempt mới có thể chấm đạt nhưng không cộng lại XP/badge/activity hoàn thành cũ.

### 5.6. GET courses cũ và guest

`GET /api/learning/courses?page=1&limit=10` giữ `{ data: Course[], pagination }`. Trường `progress`, `isStarted`, `totalHours` vẫn có; thêm `learningStatus`, `prerequisiteId`, `lockedReason`, counts. `course.status` của endpoint này là **trạng thái xuất bản**, còn `module.status` vẫn dùng `active` để tương thích UI cũ.

Không nhầm `active` cũ với `current` trong DTO Learning Path. Không chạy `mapCourse` metadata cũ lên DTO Learning Path mới: mapper cũ có thể ghi đè thời lượng/competencies và khóa tất cả module khi chưa ghi danh.

Guest được xem catalog cũ, không gọi GET Learning Path cá nhân. Thiết kế guest một phần giới thiệu/preview course với CTA đăng nhập, ẩn thống kê cá nhân. Đừng dựng giả `xp = 2450`, `streak = 7` hoặc gắn tiến độ của người trước vào guest.

Admin GET courses có thể gồm DRAFT để quản trị; GET Learning Path luôn theo catalog đã xuất bản kể cả người dùng có role ADMIN. Trang quản trị tiếp tục dùng publication status. Trang hành trình dùng API Learning Path.

### 5.7. Lỗi và cách FE xử lý

| HTTP/code | Hành vi FE |
| --- | --- |
| 401 | Theo sự kiện `unauthorized` và AuthContext hiện có; xóa cache cá nhân, hiện CTA đăng nhập, không retry vô hạn |
| 400 `INVALID_PAYLOAD` | Hiện lỗi input phù hợp; giữ modal/task state, không animate completion |
| 400 `CONTENT_MISMATCH` | Dữ liệu route/module cũ không khớp; invalidate và tải lại course, không thử đổi ID để vượt lỗi |
| 400 `DERIVED_COURSE_PROGRESS` | FE đang dùng sai flow; chỉ cho enrollment course với 0/ACTIVE |
| 400 `USE_MODULE_ENDPOINT` | Không gửi progress dạng module-only vào URL legacy |
| 403 `COURSE_LOCKED`, `MODULE_LOCKED` | Hiện `message` lý do khóa, cập nhật snapshot qua refetch; giữ focus và không điều hướng tiếp |
| 403 `SERVER_GRADED_LAB` | Điều hướng tới workspace CLI, không đánh dấu hoàn thành thủ công |
| 403 `USER_INACTIVE` | Hiện trạng thái tài khoản; dừng mọi mutation |
| 404 `*_NOT_FOUND` | Nội dung đã ẩn/xóa/không tồn tại; giải thích và cho quay về bản đồ |
| 409 `MODULE_EMPTY` | Nội dung đang được cập nhật |
| 409 `MODULE_INCOMPLETE` | Cho biết cần làm các lesson/Lab còn thiếu; không trình bày như lỗi mạng |
| 429 `PROGRESS_RATE_LIMITED` | Tạm dừng nút lưu, đợi theo `Retry-After` nếu client có truyền header; không retry dồn dập |
| 500 `LEARNING_PATH_ERROR`, `LAB_REQUEST_FAILED` | Thông báo thân thiện, cho thử lại; không hoàn thành giả trên UI |

Lỗi Zod có `{ code, message, errors: [{ path, message }] }`. Lỗi auth và Lab cũ có thể chỉ có `{ message }`; không bắt buộc mọi lỗi phải có `code`. HTTP status là tín hiệu fallback.

`apiFetch` hiện chỉ throw `Error(message)` nên Agent FE cần mở rộng theo cách tương thích: thêm `error.status`, `error.code`, `error.details` và nếu cần `error.retryAfter`, giữ `message` cùng sự kiện `unauthorized`/`api_error`. Không log token hay raw response chứa dữ liệu riêng tư.

## 6. Phân chia file và trách nhiệm frontend

Giữ cấu trúc components/services/hooks/utils hiện hữu, không chuyển toàn bộ repo sang feature architecture.

```text
src/
  components/Content/Roadmap.js                 # page/container, auth + query + layout
  components/Content/learningPath/
    LearningPathMap.jsx                        # SVG + positioned node, không gọi API
    CourseNodeItem.jsx                         # button, label, icon, progress
    CourseDetailModal.jsx                      # metadata, module/task list và CTA
    LearningStats.jsx                          # bốn chỉ số từ server
    LearningPathSkeleton.jsx                   # khung loading tương ứng layout thật
  hooks/
    useLearningPath.js                        # useQuery, query keys, error/retry policy
    useLearningProgress.js                    # mutation + cache + transition
    usePathLayout.js                          # ResizeObserver và memo geometry
  utils/
    learningPathAdapter.js                    # chuẩn hóa presentation, không đổi quyền
    learningPathGeometry.js                   # pure positions + Bezier segments
    learningPathMotion.js                     # path reveal/glow/unlock, cleanup
  services/Api.js                             # thêm api.getLearningPath/completeModule
  css/Roadmap.css                             # style có prefix lp-, dùng token chung
```

Nếu cần hook reduced motion phản ứng khi người dùng đổi setting, tạo hook dùng `matchMedia` với listener và cleanup. Có thể tái sử dụng helper kiểm tra hiện có, nhưng helper gọi một lần không thay thế listener reactive.

Các điểm nối cần sửa có giới hạn: `CourseDetail.js` để xử lý khóa/CTA/enrollment, `Lesson.js` để lưu qua mutation và nhận lỗi, `Labs.js`/`CliLabWorkspace.js` để chuyển kết quả completion vào cache chung, `AuthContext.js` chỉ cho việc dọn cache khi logout/account change nếu đặt cleanup ở đó.

## 7. Client API và React Query

### 7.1. Mở rộng transport hiện có

Thêm vào object `api` trong `src/services/Api.js`:

```js
getLearningPath: async (token, options = {}) => {
  const json = await apiFetch('/learning/learning-path', token, options);
  return json.data;
},
completeModule: async (token, moduleId) => {
  const json = await apiFetch(
    `/learning/modules/${encodeURIComponent(moduleId)}/progress`,
    token,
    { method: 'PATCH', body: JSON.stringify({ completed: true }) }
  );
  return json.data;
},
```

Không bọc hai hàm này bằng `safeApiFetch`: helper đó nuốt lỗi thành fallback làm error state bị biến thành empty state. Dùng AbortSignal của React Query qua `options.signal`; với Render cold start, giữ skeleton và thông báo chờ lâu, không cho request treo vô hạn mà không có cách thử lại.

### 7.2. Query keys và auth isolation

```js
const learningKeys = {
  path: (userId) => ['learning-path', userId],
  courses: (userId) => ['courses', userId ?? 'guest'],
  progress: (userId) => ['user-progress', userId],
  profile: (userId) => ['profile', userId],
};

useQuery({
  queryKey: learningKeys.path(user?.id),
  queryFn: ({ signal }) => api.getLearningPath(token, { signal }),
  enabled: !authLoading && isAuthenticated,
  staleTime: 30_000,
  gcTime: 5 * 60_000,
  retry: (failureCount, error) =>
    failureCount < 2 && (!error.status || error.status >= 500),
});
```

userId trong query key chỉ dùng phân vùng cache ở browser, không được gửi làm danh tính cho server. Không đưa raw token vào query key. Khi logout/đổi tài khoản, cancel query cũ và remove cache cá nhân; không dùng `keepPreviousData`/placeholder của user trước. Callback mutation phải kiểm tra tài khoản hiện tại vẫn là tài khoản lúc gửi trước khi set cache hoặc báo unlock.

Query key đề xuất phải thống nhất ở các hook mới; nếu một trang đã có key khác, lập mapping và invalidate đúng key hiện hữu thay vì tự tạo hai cache cho cùng dữ liệu. Không gọi `queryClient.clear()` mỗi lần hoàn thành task.

### 7.3. Mutation flow

1. Lấy course/module/lesson ID từ DTO/route đã đối chiếu. Không lấy ID từ nhãn course.
2. `onMutate`: cancel GET Learning Path đang chạy để response cũ không ghi đè snapshot mới; khóa CTA đang pending. Không optimistic unlock/XP.
3. Gọi API hiện tại qua mutation. Giữ `retry: false` cho writes; nút thử lại thực hiện thao tác có chủ đích. Video heartbeat không auto retry.
4. `onSuccess`: nhận snapshot đúng envelope; setQueryData cho `['learning-path', user.id]` khi phù hợp. Đồng bộ counts/course detail, invalidate `user-progress`, `courses`, `profile` của đúng user.
5. Chuyển riêng `transition` vào UI event để chạy animation/toast một lần, sau khi snapshot đã được xác nhận.
6. `onError`: giữ trạng thái học tập trước khi gửi, hiển thị message, xử lý khóa/auth theo bảng lỗi. Không mở chặng tiếp theo.
7. `onSettled`: refetch đúng những query cần thiết; không reload toàn trang.

Với request song song, response có thể về khác thứ tự dù transaction backend đã tuần tự. Dùng cùng mutation `scope.id`, ví dụ `learning-progress-${user.id}`, cho các thao tác cập nhật learning state; hợp nhất hai nơi lưu completion trong Lesson hiện tại để không gửi trùng. Khi không bảo đảm serialization (tab khác hoặc caller legacy), ưu tiên invalidate/refetch snapshot cuối cùng sau writes thay vì ghi đè cache bằng response đến muộn. Không giả định response có revision/version vì backend hiện chưa cung cấp trường đó.

Trong Lesson hiện đang có ít nhất hai đường gọi `api.updateUserProgress`: VideoPlayer completion và handler phần trăm. Agent cần chọn một hook điều phối. Không đổi các phép lưu completion thành fire-and-forget không bắt lỗi, hoặc dùng UI `isCompleted` local làm trạng thái chính sau API 403/500.

## 8. Luồng màn hình và điều hướng

### 8.1. Roadmap đăng nhập

```text
AuthContext sẵn sàng
  → GET Learning Path
  → stats + node completed/current/locked
  → mở modal course
  → xem module/lesson/Lab còn thiếu
  → tiếp tục học
```

Node completed: mở modal, CTA “Ôn tập lại”. Node current: mở modal, CTA “Tiếp tục học” hoặc “Bắt đầu học”. Node locked: button focus được, `aria-disabled=true`, hiển thị `lockedReason`; không điều hướng vào course từ click đó.

Nếu không có course: “Lộ trình CCNA đang được cập nhật.” Nếu mọi course hoàn thành: banner hoàn thành hành trình, cho ôn tập, không ép một node thành current.

### 8.2. CTA từ modal

| Điều kiện | Điều hướng |
| --- | --- |
| Muốn xem trang chi tiết | `navigate('/course/' + course.id + '?from=roadmap')` |
| Course chưa ghi danh | POST enrollment 0/ACTIVE, chờ thành công, sau đó điều hướng |
| Có `nextLessonId` | `navigate('/lesson?course=' + course.id + '&lesson=' + course.nextLessonId)` |
| Module hiện tại hết lesson nhưng còn Lab | Chọn Lab chưa hoàn thành của module đó; `navigate('/labs?labId=' + lab.id)` |
| Module đã xong, course còn Lab chỉ gắn course | Hiển thị các Lab còn thiếu, dùng cùng deep link `/labs?labId=...` |
| Module rỗng/thiếu nội dung | Hiển thị empty state trong modal, không gắn nhãn “Cập nhật” lên node và không tạo lesson giả |
| Ôn tập course hoàn thành | Tới CourseDetail hoặc lesson đầu tiên theo lựa chọn người học |

Các URL là route React, không tự thêm `/#` vào chuỗi truyền cho navigate. HashRouter sẽ xử lý hash. Không dùng `window.location.href` cho điều hướng nội bộ.

### 8.3. Từ Lesson/Lab quay về bản đồ

Lesson/CLI thường hoàn thành khi Roadmap không mounted. Cần quyết định presentation rõ ràng:

- Hiện toast xác nhận ngay trên màn học, kèm CTA “Xem lộ trình”.
- Lưu một UI event tạm từ mutation vừa thành công, có userId, courseId, nextCourseId và dấu consumed; không lưu XP/progress chính vào event.
- Khi mở Roadmap trong cùng session, event có `courseCompleted=true` và `unlockedCourseId` được giữ ở trạng thái chờ. Học viên bấm “Mở khóa chặng tiếp theo” rồi `LearningPathMap` mới chạy timeline: node vừa hoàn thành phồng lên, confetti nổ tại tâm node, đường nối sáng dần và node kế tiếp nảy sang trạng thái hiện tại. Event được consume khi bấm.
- Nếu event trong RAM không còn nhưng snapshot backend có cặp `completed → current` và course current chưa bắt đầu, CTA vẫn được tạo từ trạng thái server. LocalStorage chỉ lưu khóa xác nhận đã xem animation cho cặp user/course; không lưu progress, quyền truy cập hoặc XP.
- Với `user.role=ADMIN`, header có nút “Admin: Test mở khóa” để chạy lại animation trên một cặp node thật. Đây là preview giao diện, không gọi mutation và không thay đổi database.
- Refresh hoặc GET/refetch đơn thuần không tạo event và không bắn confetti. Nếu không chuyển ngay sang Roadmap, snapshot vẫn đúng; không bắt người học phải xem animation để hoàn tất nghiệp vụ.
- Đổi tài khoản/logout phải xóa event. Reduced motion vẫn nhận toast/nhãn completion dù timeline bị tắt.

## 9. Bố cục và giao diện

### 9.1. Cấu trúc trang

1. Header: card ngang theo ảnh tham chiếu, gồm tiêu đề, `x/y chặng hoàn thành`, mô tả bên trái và segmented control Tự động/Ngang/Dọc bên phải. Không có `+1 Module`. CTA mở khóa của học viên chỉ xuất hiện khi đủ điều kiện; nút test chỉ hiện với Admin.
2. Legend completed/current/locked và hướng dẫn click nằm dưới header; trên mobile xếp dọc.
3. Summary: streak, XP, badge, tiến độ tổng. Lấy toàn bộ từ `stats`; khi chưa biết không hiển thị 0 như dữ liệu đã tải.
4. Map viewport: đường SVG dưới, node/label semantic ở trên, có vùng scroll nội bộ khi cần. Tự động dùng breakpoint; Ngang/Dọc là override geometry thật.
5. CTA hiện tại dựa trên lesson/Lab thật; `contentReady=false` không tạo CTA hoặc lesson giả.
6. CourseDetailModal có tên/mô tả/progress, counts module và Lab, skills, thời lượng video biết được, badge, module/task list.

Dùng blue/cyan và slate từ tokens, font hệ thống, bo góc vừa phải, bóng nhẹ. Current là điểm nhấn mạnh nhất. Trạng thái completed/locked phải có icon và chữ, không chỉ khác màu. Label dài xuống dòng có giới hạn chiều rộng, không che node/đường đi.

### 9.2. Geometry thuần, không đo từng node DOM

`calculateZigzagPositions({ containerWidth, count, ...config })` trả `{ nodes, canvasWidth, canvasHeight }`. `generatePathSegments(positionedNodes)` trả mảng segment gồm `fromId`, `toId`, `pathData`, trạng thái đường nối.

Desktop khi container >= 1024px:

```text
nodeSize = 72px
paddingX = 96px, paddingY = 88px
horizontalSpacing >= 260px (tăng nếu label cần)
verticalAmplitude = 90px
x(i) = paddingX + nodeSize / 2 + i × horizontalSpacing
y(i) = centerY + (i chẵn ? +verticalAmplitude : -verticalAmplitude)
label: node trên → bottom; node dưới → top
canvasWidth = max(containerWidth, 2×paddingX + nodeSize + (n−1)×horizontalSpacing)
```

Với nhiều node, scroll ngang trong map; không làm toàn trang tràn ngang. Không ép mọi course vào một viewport bằng cách thu nhỏ chữ.

Mobile/tablet dưới 1024px, ưu tiên đường dọc:

```text
nodeSize = 56..64px theo container
verticalSpacing >= 160px
horizontalAmplitude = clamp(24px, containerWidth×0.12, 64px)
x(i) = centerX + (i chẵn ? -horizontalAmplitude : +horizontalAmplitude)
y(i) = paddingY + nodeSize / 2 + i × verticalSpacing
label: node trái → right; node phải → left
```

Ở 320–374px, nếu node + label trái/phải không đủ không gian, dùng label dưới node và tăng verticalSpacing; vẫn giữ zigzag dọc. Tính vùng label trước khi quyết định amplitude. Không để label thành cột quá hẹp hoặc phải cuộn ngang trên điện thoại.

Bezier:

```text
Desktop:
cp1 = (x1 + (x2−x1)×0.5, y1)
cp2 = (x2 − (x2−x1)×0.5, y2)

Mobile:
cp1 = (x1, y1 + (y2−y1)×0.5)
cp2 = (x2, y2 − (y2−y1)×0.5)

path = M x1 y1 C cp1.x cp1.y, cp2.x cp2.y, x2 y2
```

Track bed 12–14px neutral, progress stroke 5–6px blue; đường future nét đứt nhẹ. SVG có `pointer-events: none`, `aria-hidden=true`; node button nằm phía trên che đầu đường. Path geometry dựa trên data và container size, không query bounding rect từng node. `getTotalLength()` chỉ dùng cho animation stroke.

Guard count=0, count=1, width chưa đo/0 và NaN. Hook ResizeObserver chỉ cập nhật khi kích thước có ý nghĩa thay đổi, disconnect khi unmount. Geometry dùng useMemo. Không đọc `window.innerWidth` trong render.

### 9.3. Modal và task list

- Selected state lưu `selectedCourseId`; lookup lại course từ snapshot mới để modal không giữ object progress cũ.
- Header code/title, description; progressbar có nhãn số.
- “x/y chương” và “x/y Lab” tách rõ vì coursePercent không bằng completedModules/totalModules.
- `estimatedHours=null`: ẩn hoặc “Chưa cập nhật thời lượng”; khi có, ghi “Thời lượng video ước tính”, không gọi là tổng công sức học.
- `skills=[]`: vẫn giữ tiêu đề block và hiện “Admin chưa cập nhật kỹ năng trọng tâm” để phản ánh đúng trạng thái dữ liệu; `examCode=null` thì ẩn phần exam. Không lấy metadata cứng trong Api.js hoặc component để lấp thiếu dữ liệu.
- `badgeName` là điều kiện/huy hiệu sẽ nhận, không chứng tỏ đã nhận; popup nhận thưởng chỉ từ `badgesAwarded`.
- Module/lesson/Lab list lấy nguyên ID và `canAccess`/status. Completed module có thể được ôn tập; parent course locked thì vẫn không được đi vào qua CTA.
- Modal không có checkbox thay đổi completion và không có `Test Unlock`; hoàn thành/mở khóa chỉ đến từ mutation lesson/lab thật và snapshot backend trả về.
- Trên mobile modal không vượt viewport, nội dung có scroll riêng, footer CTA vẫn chạm được.

## 10. Animation GSAP và Motion

| Hiệu ứng | Owner/property | Trigger |
| --- | --- | --- |
| Vẽ đường | GSAP `strokeDashoffset` trên SVG path | Map load đầu có data + geometry |
| Current glow | GSAP opacity/scale trên lớp ring riêng | Một current node, tắt khi trạng thái đổi |
| Unlock sequence | GSAP timeline theo refs | Mutation transition thật, `courseCompleted=true` |
| Stats hover | Một implementation duy nhất, GSAP hoặc CSS | Pointer hover; không tác động layout |
| Modal enter/exit | Chọn native/CSS hoặc Motion trên wrapper riêng | Modal open/close |
| GooeyNav/DeleteButton | Giữ Motion hiện hữu | Không sửa vì feature Roadmap |

Timeline unlock khoảng 0.8–1.6 giây: completed node nhấn nhẹ → đổi check → optional confetti nhỏ → nối đường sáng → next node mở → current ring. React vẫn quyết định nội dung icon/status; GSAP không sửa dữ liệu nghiệp vụ.

Không để Motion và GSAP cùng ghi transform/opacity trên một element. Nếu cần cả hai, dùng wrapper khác nhau và ghi rõ owner. Dùng `useGSAP` scoped, cleanup timeline/tween/gsap.matchMedia; không tạo infinite tween mới mỗi render. Tránh `.from()` khiến phần tử bị kẹt opacity 0 sau StrictMode rerender; dùng fromTo và cleanup/clearProps cụ thể.

Confetti là tùy chọn. Chỉ thêm dependency nếu thực sự chọn thiết kế đó; lazy-load và cleanup, không đưa một thư viện lớn vào initial bundle chỉ để có hiệu ứng.

Auto-scroll current node khi layout sẵn sàng lần đầu hoặc user chọn “Về chặng hiện tại”. Không scroll lại mỗi background refetch; không cướp focus. Với reduced motion dùng `behavior: auto`, tắt pulse vô hạn, reveal dài, burst, confetti; giữ kết quả nghiệp vụ và thông báo.

## 11. Loading, lỗi, guest và accessibility

| Trạng thái | UI bắt buộc |
| --- | --- |
| Auth đang restore | Loading ổn định, chưa gọi query cá nhân |
| Guest | Preview/catalog và CTA đăng nhập, không có dữ liệu người trước |
| Query pending | Skeleton stats/map với chiều cao ổn định |
| Chờ Render lâu | Thông báo “Máy chủ đang khởi động, vui lòng chờ…” sau ngưỡng hợp lý, không nhấp nháy trạng thái |
| Lỗi ban đầu | “Không thể tải lộ trình học tập” và nút thử lại gọi refetch |
| Background refetch lỗi | Giữ snapshot cuối và thông báo nhẹ; không xóa map thành màn trắng |
| Courses rỗng | Thông báo nội dung đang cập nhật, không SVG rỗng bị lỗi |
| Mutation pending | Chỉ disable CTA liên quan, không khóa toàn giao diện |
| Module rỗng | Trạng thái cập nhật nội dung, không có completion giả |
| Hoàn thành toàn bộ | Banner thành tựu và nút ôn tập; currentCourseId có thể null |

Checklist accessibility:

- Node là `<button>`, Tab order theo thứ tự course trong dữ liệu, không theo tọa độ zigzag.
- Locked node dùng `aria-disabled` và handler giải thích; nếu dùng `disabled` thật sẽ mất keyboard focus và không nghe được lý do, nên không dùng trong thiết kế này.
- Nhãn ví dụ: “Introduction to Networks, đã hoàn thành, tiến độ 100%”; trạng thái và phần trăm không chỉ thể hiện bằng màu.
- Progress có `role=progressbar`, `aria-valuemin=0`, `aria-valuemax=100`, `aria-valuenow` hợp lệ.
- Modal dùng dialog semantics, aria-labelledby, focus vào dialog, trap focus, Escape đóng, trả focus đúng nút gọi; khóa scroll nền và cleanup.
- Toast/feedback có `aria-live=polite`. Toast hiện tại chưa có đầy đủ thuộc tính này; bổ sung nhẹ tại điểm dùng hoặc primitive chung với regression test phù hợp.
- Focus ring rõ trên nền sáng/tối; touch target tối thiểu khoảng 44px; không có nội dung chỉ xuất hiện khi hover.
- SVG trang trí không tạo hàng chục tab stop hay lặp screen reader labels.
- Resize/unlock không tự chuyển keyboard focus sang node khác.

## 12. Kế hoạch triển khai theo giai đoạn

| Giai đoạn | Công việc cụ thể | File chính | Điều kiện xong |
| --- | --- | --- | --- |
| 1. Nối contract | Bổ sung API methods, error status/code, JSDoc DTO, adapter giữ server status | Api.js, learningPathAdapter.js | GET thật trả đúng data, phân biệt 401/error/empty |
| 2. Server state | Hook query/mutation, query keys theo user, logout cleanup, serialize progress | useLearningPath.js, useLearningProgress.js | Không rò cache giữa 2 tài khoản; lỗi write không đổi tiến độ |
| 3. UI dữ liệu thật | Page, stats, node, modal, lockedReason, course/lesson/Lab CTA | Roadmap và learningPath components | Click/keyboard đi đúng route, không hardcode số course/XP |
| 4. Geometry | Pure positions/segments, ResizeObserver, desktop ngang/mobile dọc, label guard | geometry, usePathLayout, Roadmap.css | Không overlap/NaN/tràn ngang ở 320/375/768/1024/1440 |
| 5. Nối trang học | Gộp duplicate completion trong Lesson, hook kết quả Packet Tracer/CLI, course enrollment và guard | CourseDetail, Lesson, Labs, CliLabWorkspace | Task cuối đổi đúng course/module và giữ trạng thái sau reload |
| 6. Transition | Consume event một lần, animation khi mounted hoặc khi người dùng quay lại map, reduced motion | learningPathMotion.js, UI event trong hook | Refresh/refetch/retry không confetti lại |
| 7. Accessibility | Focus trap/restore, semantic nodes/progress, live feedback, mobile modal | Modal, Node, Toast, CSS | Tab/Enter/Space/Escape dùng đầy đủ |
| 8. Nghiệm thu | Tests contract/UI/geometry, build CRA, kiểm tra browser các viewport | Tests + todo.md | Tất cả checklist bên dưới đạt; báo rõ giới hạn |

Làm tương tác với dữ liệu thật trước animation. Không tạo bản UI tĩnh rồi coi tích hợp đã xong. Mỗi giai đoạn giữ được luồng lesson/Lab/exam hiện có.

## 13. Kịch bản nghiệm thu FE–BE–DB

1. **Tài khoản mới:** course đầu current, các course sau locked, stats từ server; click khóa hiện đúng prerequisite. Refresh không thay đổi trạng thái.
2. **Ghi danh:** POST course 0/ACTIVE thành công rồi mới chuyển lesson; 403/500 phải giữ trang và báo lỗi.
3. **Task đầu:** gửi lesson đúng string moduleId; response cập nhật phần trăm, reload GET vẫn giống. Người dùng B không thấy tiến độ A.
4. **Cuối module:** module hoàn thành, module kế tiếp mở; course chưa xong nếu còn Lab hoặc module khác.
5. **CLI Lab:** không có completion qua local button; chấm đạt từ workspace mới cập nhật path. Chấm không đạt vẫn khóa course tiếp theo.
6. **Cuối course:** task cuối → courseCompleted true → next current → stats/badge đúng → một timeline. Không reload toàn ứng dụng.
7. **Request lặp/double-click:** không thêm XP/badge; không animation unlock lặp.
8. **Mất mạng khi ghi:** không tự completed; nút thử lại phục hồi dữ liệu server. Heartbeat không retry cộng thời gian trùng.
9. **Dữ liệu thay đổi:** course bị ẩn/xóa, module rỗng, bài bị xóa đều có state đúng, không crash, không tự bịa phần trăm.
10. **Token hết hạn/account switch:** không tiếp tục mutation bằng tài khoản cũ, không thấy snapshot hoặc unlock event cũ.
11. **Nhiều viewport:** 320/375/768/1024/1440px, danh sách 0/1/3/8 nodes, nhãn tiếng Việt dài; không bị đè label, CTA luôn chạm được.
12. **Accessibility:** Tab đúng thứ tự, locked lý do đọc được, modal Escape/focus restore đúng, reduced motion không pulse/confetti/forced smooth scroll.
13. **Mở deep link:** `/#/roadmap`, `/#/course/c1`, `/#/lesson?course=c1&lesson=42`, `/#/labs?labId=7`; refresh vẫn theo HashRouter.
14. **Hoàn thành tất cả:** currentCourseId null hợp lệ, overallProgress 100, có ôn tập, không lỗi auto-scroll không tìm thấy node.

Unit test geometry: positions.length=n, segments.length=max(0,n−1), xen kẽ Y desktop/X mobile, không NaN, container hẹp không label overlap, không mutate input.

Test component/hook bằng Jest/Testing Library có sẵn: loading/error/empty/guest, server status, route/locked click, mutation fail, auth cache, one-time transition, keyboard modal, reduced motion. Không cài thêm Vitest/Jest. Mock matchMedia/ResizeObserver đúng môi trường JSDOM; không mock API success ở mọi test.

## 14. Kiểm thử backend và cách chạy lại

```powershell
# Từ thư mục ccna-master. Trên Windows dùng npm.cmd/npx.cmd nếu npm.ps1 bị chặn.
npm.cmd run test:learning
npm.cmd run test:cli
npx.cmd prisma validate
npm.cmd run build
```

Integration dùng PostgreSQL trống có tên kết thúc `_test`, không dùng DATABASE_URL của production. Ví dụ database tạm đã được dùng trong lượt này:

```powershell
docker run --rm --detach --name ccna-learningpath-test --publish 127.0.0.1:55432:5432 --env POSTGRES_USER=learning_test --env POSTGRES_PASSWORD=learning_test --env POSTGRES_DB=learning_path_test --tmpfs /var/lib/postgresql/data postgres:16-alpine
$env:DATABASE_URL = 'postgresql://learning_test:learning_test@127.0.0.1:55432/learning_path_test'
$env:JWT_SECRET = 'temporary-local-integration-secret'
npx.cmd prisma db push
$env:LEARNING_PATH_INTEGRATION = '1'
npm.cmd run test:learning
$env:LAB_INTEGRATION = '1'
npm.cmd run test:cli
docker stop ccna-learningpath-test
```

Các credential ở đoạn này chỉ là thông tin tạo DB kiểm thử dùng một lần. Integration tạo fixture riêng và xóa theo đúng ID đã tạo; Learning Path suite từ chối DB không mang hậu tố `_test` hoặc đã có course. Nó tạo trigger tạm để chứng minh rollback khi cấp badge lỗi. Không chạy suite này trên database học viên thật.

CI hiện có đã được bổ sung `test:learning` ở quality gate và PostgreSQL integration, giữ nguyên test/build/deploy cũ. Không cần thêm workflow hoặc thay Vercel/Render architecture.

## 15. Giới hạn và quyết định cần giữ khi triển khai FE

- Chưa có frontend Game Path trong lượt backend này; mọi component, animation, responsive và accessibility ở kế hoạch vẫn cần Agent FE thực hiện.
- Không có prerequisite tùy chỉnh hoặc nhiều nhánh; đổi thứ tự/ẩn course thay đổi chuỗi hiện tại. Khi admin sửa curriculum, tiến độ được tính lại theo nội dung đang hiển thị. FE không tự giữ mở khóa vĩnh viễn trái kết quả server.
- XP hiện là điểm hoàn thành của curriculum hiện tại; muốn XP tích lũy vĩnh viễn cần BE/DB thêm reward ledger, không giải quyết bằng localStorage.
- Streak dùng User.streak hiện hữu; cập nhật theo ngày học là hạng mục backend riêng nếu muốn mở rộng. Không gộp chuỗi luyện CLI riêng ở endpoint achievements vào streak toàn khóa.
- Thời lượng từ video metadata có thể thiếu và không bao gồm đọc/lab. Không lấy số hardcode làm dữ liệu server.
- Chưa có kiểm chứng tổng số giây xem để chống gian lận completion lesson. Không quảng bá chức năng như hệ thống giám sát/chống gian lận thi.
- Heartbeat cộng delta nên không idempotent; completion và thưởng được bảo vệ khi retry. Client phải xử lý hai nhóm write khác nhau.
- Limiter dùng bộ nhớ từng backend process như các limiter hiện hữu; khóa transaction/dedup tiến độ nằm ở PostgreSQL. Nếu tăng tải nhiều replica, có thể thay store limiter sau, không thay nghiệp vụ FE.
- Các API đọc nội dung công khai cũ vẫn phục vụ catalog/preview; course locking trong lượt này là ràng buộc ghi tiến độ và mở/hoàn thành CLI liên quan, không phải paywall hay phân quyền bí mật nội dung.
- Không có kiểm chứng deployment Vercel/Render thật trong lượt này. Chạy smoke test CORS, JWT và API base URL ở môi trường triển khai trước khi nghiệm thu production.

## 16. Báo cáo bàn giao theo `coure.md`

| Hạng mục | Kết quả/phạm vi |
| --- | --- |
| 1. Repository architecture | CRA React SPA/HashRouter → fetch wrapper → Express → Prisma adapter-pg → PostgreSQL |
| 2. Tái sử dụng | Auth middleware, Prisma singleton, UserProgress/UserBadge/UserActivity/VideoProgress/StudyLog, CLI grader và route hiện có |
| 3. File mới | domain/learningPath.js; services/learningPathService.js; validation/learningPathSchema.js; controllers/learningPathController.js; learningPath/learningPath.test.js; learningPath/learningPath.integration.test.js; tài liệu này |
| 4. File sửa | learningController, userController, labAttemptController, adminController, learning/users routes, rateLimiter; package.json thêm test script; ci-cd.yml chạy suite; fixture networkApi.integration.test.js được publish để phù hợp prerequisite mới; todo/lessons ghi kết quả |
| 5. Learning Path architecture | Domain tính dữ liệu thật, service transaction, controller DTO; FE page/hook/components theo mục 6 |
| 6. React Query | Provider có sẵn; kế hoạch query key, auth isolation và mutation ở mục 7, FE chưa triển khai |
| 7. Axios/API | Xác nhận client học viên dùng fetch thực tế; kế hoạch mở rộng wrapper hiện hữu |
| 8. Express | Hai endpoint Learning Path/module; các đường ghi cũ dùng cùng nghiệp vụ |
| 9. Zod | Strict payload, ID đúng kiểu, cấm userId/XP và reset/completion giả qua summary |
| 10. Prisma/database | Tái sử dụng schema, không migration/reset/seed production; có kiểm thử thật trên PostgreSQL tạm |
| 11. Auth/authorization | JWT, active account, relation validation, course/module prerequisite, CLI server grading, transaction lock |
| 12. GSAP | Chưa triển khai FE; ownership/timeline/cleanup đã lập kế hoạch |
| 13. Motion/GSAP | Kế hoạch tách owner trên element/wrapper, giữ Motion UI hiện hữu |
| 14. Responsive | Kế hoạch desktop ngang/mobile dọc, guard 320px và label dài |
| 15. Accessibility | Kế hoạch button/dialog/focus/live feedback/reduced motion; không tuyên bố FE đã đạt |
| 16. Tests | 34/34 Learning Path (domain + HTTP/PostgreSQL), 53/53 CLI/simulation (có HTTP/PostgreSQL), 10/10 component NetworkLab đạt |
| 17. Lint/typecheck | ESLint trên các file backend/test thay đổi đạt; repo dùng JS, không thêm một script typecheck TypeScript giả |
| 18. Build | CRA `npm.cmd run build` đạt với BUILD_PATH riêng; Prisma validate, CI YAML, code fence/JSON contract, git diff --check đạt |
| 19. Giới hạn | Mục 15, đặc biệt XP/streak, telemetry và deployment |

Build có cảnh báo bundle hiện hữu lớn và deprecation `fs.F_OK` trên Node 24; Prisma có warning preview flag `driverAdapters` và integration có warning từ pg/adapter. Không có lỗi test/lint/build. Database/container kiểm thử và thư mục build tạm đã được dọn, không thay dữ liệu DB dự án hoặc deploy. Báo cáo chi tiết lệnh và xử lý ExecutionPolicy Windows nằm ở đầu `todo.md`.

## 17. Checklist Agent FE trước khi bàn giao lại

Audit source và test ngày 11/09/2026 sau khi nối unlock transition: **9/11 mục hoàn thành**.

- [x] API thật và DTO đúng envelope; ID course/module luôn là chuỗi.
- [x] Không hardcode business data, không nuốt lỗi GET thành empty state.
- [x] Course/module gating dùng server, lesson/Lab progress đồng bộ theo mutation response.
- [ ] Cache tách theo user, logout/account switch cleanup, không stale response ghi đè. `useLearningPath` mới xóa path/progress của user cũ; chưa xóa courses/profile và chưa chủ động xóa transition event khi logout.
- [x] Bản đồ/CTA/modal đầy đủ trạng thái và đi đúng route có sẵn.
- [x] Lab và lesson nối vào cùng learning state, không gửi thêm completion giả.
- [x] Geometry không lệ thuộc DOM mỗi node, hỗ trợ 320px và danh sách thay đổi.
- [x] Animation chỉ từ trạng thái completion thật, cleanup và reduced motion đầy đủ. Học viên phải có transition `courseCompleted + unlockedCourseId` hoặc snapshot server `completed → current chưa bắt đầu`; Admin có preview riêng không ghi dữ liệu. `LearningPathMap` gọi timeline sau click, confetti có cleanup và reduced motion bỏ chuyển động.
- [ ] Keyboard, focus, screen reader, error/loading/empty được kiểm chứng. Component đã có semantics/focus trap và các state, nhưng test hiện chưa phủ Tab focus trap, reduced motion và các state cấp trang guest/error/empty.
- [x] Unit/component tests, ESLint và build CRA đạt; báo rõ warning/giới hạn còn lại.
- [x] Cập nhật todo.md/lessons.md và báo cáo file thay đổi/lý do/kết quả; giữ nguyên phần backend contract nếu không có yêu cầu thay nghiệp vụ.
