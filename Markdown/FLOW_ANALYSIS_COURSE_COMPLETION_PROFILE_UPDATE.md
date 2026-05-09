# Phân tích Flow: Course Completion → Profile Update

## 📋 Tóm tắt toàn bộ luồng

Khi user hoàn thành bài học, dữ liệu được cập nhật thông qua chuỗi sau:
1. **VideoPlayer Component** theo dõi tiến độ video (mỗi giây)
2. **Lưu progressProgressToServer** mỗi 10 giây hoặc khi hoàn thành
3. **API call: updateUserProgress** gửi dữ liệu lên backend
4. **userController.updateProgress** xử lý backend, ghi UserActivity
5. **Profile Component** fetch lại dữ liệu từ **getUserProfile** endpoint
6. **Profile hiển thị** tất cả thống kê được cập nhật

---

## 🎥 1. VIDEO PROGRESS TRACKING (Lesson.js)

### Vị trí file
- **Frontend**: [src/components/Content/Lesson.js](src/components/Content/Lesson.js)

### VideoPlayer Component - Theo dõi tiến độ (Line 42-250)

#### A. Initialization
```javascript
const VideoPlayer = ({ url, lessonId, courseId, moduleId, token, onProgressChange }) => {
  const maxWatchedRef = useRef(0);        // Thời điểm xem xa nhất
  const lastSavedRef = useRef(0);        // Thời điểm save cuối
  const [localProgress, setLocalProgress] = useState({ 
    percentage: 0, 
    watchedTime: 0, 
    status: 'Chưa học' 
  });
}
```

#### B. YouTube Video Tracking (Line 130-160)
- Mỗi giây tracking video progress:
  - Lấy `getCurrentTime()` từ YouTube Player
  - Tính phần trăm: `(currentTime / duration) * 100`
  - Xác định status:
    - `>= 90%` → **'Hoàn thành'** (COMPLETED)
    - `> 0%` → **'Đang học'** (ACTIVE)
    - `0%` → **'Chưa học'**

#### C. Auto-save Progress Logic (Line 157-175)
```javascript
// Lưu DB mỗi 10 giây
const floorTime = Math.floor(currentTime);
if (floorTime % 10 === 0 && floorTime !== lastSavedRef.current && floorTime > 0) {
  lastSavedRef.current = floorTime;
  saveProgressToServer(currentTime, percent, status);
}
```

**Quy tắc lưu:**
- Chỉ lưu khi `watchedTime % 10 === 0` (mỗi 10 giây)
- Tránh lưu lặp lại cùng thời điểm
- Lưu khi user rời trang (beforeunload event)

#### D. Save on Leave (Line 193-210)
```javascript
const forceSave = () => {
  if (playerRef.current && playerRef.current.getDuration) {
    const currentTime = playerRef.current.getCurrentTime();
    const duration = playerRef.current.getDuration();
    if (duration > 0) {
      const percent = (currentTime / duration) * 100;
      const status = percent >= 90 ? 'Hoàn thành' : 'Đang học';
      saveProgressToServer(currentTime, percent, status);
    }
  }
};

window.addEventListener('beforeunload', forceSave);  // F5, Close Tab
```

---

## 📤 2. API CALL: updateUserProgress

### Vị trí file
- **Frontend API**: [src/services/Api.js](src/services/Api.js#L277)

### API Endpoint (Line 277-280)
```javascript
updateUserProgress: (token, progressData) =>
  apiFetch("/users/progress", token, {
    method: "POST",
    body: JSON.stringify(progressData),
  }),
```

### Dữ liệu gửi lên
```javascript
// Từ VideoPlayer.saveProgressToServer():
{
  courseId: "itn",              // ID khóa học
  moduleId: "module1",          // ID module
  lessonId: "lesson5",          // ID bài học
  progressPercent: 90,          // Phần trăm tiến độ (0-100)
  status: "COMPLETED"           // ACTIVE hoặc COMPLETED
}
```

### Endpoint route
- **Backend Route**: [src/Backend/routes/users.js](src/Backend/routes/users.js)
  ```javascript
  router.post('/progress', verifyToken, userController.updateProgress);
  ```

---

## ⚙️ 3. BACKEND: updateProgress Handler

### Vị trí file
- **Backend Controller**: [src/Backend/controllers/userController.js](src/Backend/controllers/userController.js#L187-L242)

### updateProgress Function (Line 187-242)

```javascript
module.exports.updateProgress = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { courseId, moduleId, lessonId, labId, progressPercent, status } = req.body;

    // Tìm bản ghi tiến độ hiện tại
    const existing = await prisma.userProgress.findFirst({
      where: {
        userId,
        courseId,
        moduleId: moduleId || null,
        lessonId: lessonId || null,
        labId: labId || null,
      }
    });

    const isCompleted = status === 'COMPLETED' || progressPercent >= 95;

    if (existing) {
      // UPDATE: Chỉ cập nhật nếu % cao hơn
      result = await prisma.userProgress.update({
        where: { id: existing.id },
        data: {
          progressPercent: Math.max(existing.progressPercent, progressPercent || 0),
          status: isCompleted ? 'COMPLETED' : (status || existing.status),
          completedAt: isCompleted && !existing.completedAt ? new Date() : existing.completedAt
        }
      });
    } else {
      // CREATE: Tạo bản ghi mới
      result = await prisma.userProgress.create({
        data: {
          userId,
          courseId,
          moduleId: moduleId || null,
          lessonId: lessonId || null,
          labId: labId || null,
          progressPercent: progressPercent || 0,
          status: isCompleted ? 'COMPLETED' : (status || 'ACTIVE'),
          completedAt: isCompleted ? new Date() : null
        }
      });
    }

    // ⭐ QUAN TRỌNG: Khi hoàn thành bài học → Ghi lại UserActivity
    if (isCompleted && (!existing || existing.status !== 'COMPLETED')) {
      await prisma.userActivity.create({
        data: {
          userId,
          title: `Đã hoàn thành bài học: ${lessonId || labId || courseId}`,
          type: lessonId ? 'LESSON_COMPLETED' : (labId ? 'LAB_COMPLETED' : 'COURSE_COMPLETED'),
          referenceId: lessonId || labId || null
        }
      });
    }

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};
```

### Các cột trong UserProgress table
```prisma
model UserProgress {
  id                Int      @id @default(autoincrement())
  userId            Int
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  courseId          String
  course            Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  
  moduleId          String?
  module            Module?  @relation(fields: [moduleId], references: [id], onDelete: SetNull)
  
  lessonId          String?
  lesson            Lesson?  @relation(fields: [lessonId], references: [id], onDelete: SetNull)
  
  labId             Int?
  lab               Lab?     @relation(fields: [labId], references: [id], onDelete: SetNull)
  
  progressPercent   Int      @default(0)  // 0-100
  status            String   @default("ACTIVE")  // ACTIVE, COMPLETED
  completedAt       DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

---

## 📊 4. PROFILE DATA STRUCTURE

### Vị trí file
- **Backend**: [src/Backend/controllers/userController.js](src/Backend/controllers/userController.js#L95-L180) (`getProfileMe`)
- **Frontend**: [src/components/Content/Profile.js](src/components/Content/Profile.js)

### API Endpoint: getUserProfile (Line 95-180)

```javascript
module.exports.getProfileMe = async (req, res, next) => {
  const userId = req.user.id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id, fullName, email, role, isActive, avatarUrl, createdAt,
      level, streak, totalStudyTime,
      
      // 📌 Tiến độ từng khóa học
      progress: {
        select: { progressPercent, courseId, course: { select: { id, title } } },
        where: { moduleId: null, lessonId: null, labId: null }  // Chỉ course-level
      },
      
      // 📌 Hoạt động gần đây (10 mới nhất)
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id, title, type, createdAt, referenceId }
      },
      
      // 📌 Huy hiệu
      badges: {
        orderBy: { earnedAt: 'desc' },
        select: { id, badgeName, badgeIcon, earnedAt }
      },
      
      // 📌 Kết quả thi
      examResults: {
        select: { percentage, isPassed }
      }
    }
  });

  // 🔄 POST-PROCESS DATA
  
  // 1️⃣ weeklyScores: Điểm trung bình theo tuần
  const weeklyScores = Object.entries(weeklyMap).map(([week, scores]) => ({
    week,
    score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
  })).slice(-7);
  
  // 2️⃣ dailyStudyTime: Thời gian học theo ngày (7 ngày gần nhất)
  // Estimate: 15 phút/lesson, 5 phút/others
  const dailyStudyTime = DAY_LABELS.map(day => ({ day, minutes: dailyMap[day] }));
  
  // 3️⃣ courseProgress: Tiến độ từng khóa học
  const courseProgress = user.progress.map(p => ({
    courseId: p.courseId,
    courseName: p.course?.title || p.courseId,
    progressPercent: p.progressPercent
  }));
  
  // 4️⃣ totalProgress: Trung bình tiến độ tất cả khóa học
  const totalProgress = courseProgress.length > 0
    ? Math.round(courseProgress.reduce((sum, p) => sum + p.progressPercent, 0) / courseProgress.length)
    : 0;
  
  // 5️⃣ Labs completed
  const completedLabs = await prisma.userProgress.count({
    where: { userId, labId: { not: null }, status: 'COMPLETED' }
  });
  
  // 6️⃣ Average exam score
  const averageScore = user.examResults.length > 0
    ? Math.round(user.examResults.reduce((sum, r) => sum + Number(r.percentage), 0) / user.examResults.length)
    : 0;

  res.json({
    data: {
      ...baseUser,
      progress: courseProgress,
      totalProgress,
      completedLabs,
      totalLabs: 50,
      averageScore,
      examCount: examCount,
      weeklyScores,
      dailyStudyTime,
      stats: {
        totalStudyTime: user.totalStudyTime * 60,  // Phút → Giây
        avgScore: averageScore,
        examCount: examCount,
        labsDone: completedLabs
      }
    }
  });
};
```

### Response Object Structure
```javascript
{
  data: {
    id, fullName, email, role, isActive, avatarUrl, createdAt,
    level, streak, totalStudyTime,
    
    // 📊 Profile statistics
    progress: [
      { courseId, courseName, progressPercent },
      ...
    ],
    totalProgress: 45,              // % trung bình tất cả khóa
    
    // 🏆 Achievements
    completedLabs: 12,              // Số lab đã hoàn thành
    totalLabs: 50,                  // Tổng số lab
    badges: [
      { id, badgeName, badgeIcon, earnedAt },
      ...
    ],
    
    // 📈 Scores
    averageScore: 78,               // Điểm thi trung bình
    examCount: 5,                   // Số bài thi đã làm
    weeklyScores: [
      { week: 'Tuần 1', score: 75 },
      ...
    ],
    
    // 🕐 Study time
    dailyStudyTime: [
      { day: 'CN', minutes: 120 },
      { day: 'T2', minutes: 90 },
      ...
    ],
    stats: {
      totalStudyTime: 18000,        // Giây
      avgScore: 78,
      examCount: 5,
      labsDone: 12
    },
    
    // 📋 Activities
    activities: [
      { id, title, type, createdAt, referenceId },
      ...
    ]
  }
}
```

---

## 🎨 5. PROFILE COMPONENT - DISPLAY

### Vị trí file
- [src/components/Content/Profile.js](src/components/Content/Profile.js)

### Data Fetch (Line 35-50)
```javascript
export default function Profile() {
  const { token } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await api.getUserProfile(token);
        setProfile(data);
      } catch (error) {
        console.error("Failed to fetch profile", error);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchProfile();
  }, [token]);
}
```

### Sections hiển thị

#### 1️⃣ Header Card (Line 60-85)
- Avatar + Tên user
- Level
- Streak (ngày liên tiếp học)
- **Total Progress Bar** (tiến độ tổng thể)

#### 2️⃣ Metric Cards (Line 88-110) - 4 thẻ chính
```javascript
{
  icon: ⏱️  Thời gian học          → stats.totalStudyTime (formatTime)
  icon: 📊 Điểm TB                 → stats.avgScore / 100
  icon: 📝 Bài kiểm tra            → stats.examCount
  icon: 🧪 Lab hoàn thành          → stats.labsDone / 50
}
```

#### 3️⃣ Course Progress Section (Line 130-165)
- Danh sách khóa học
- Progress bar từng khóa học
- Hiển thị: courseName + progressPercent

#### 4️⃣ Achievements Section (Line 167-192)
- Danh sách huy hiệu
- Icon + badgeName

#### 5️⃣ Charts (Line 194-270)
- **LineChart**: Điểm kiểm tra theo tuần (`weeklyScores`)
- **BarChart**: Thời gian học theo ngày (`dailyStudyTime`)

#### 6️⃣ Recent Activities Section (Line 272-315)
- Danh sách hoạt động gần đây (10 mới nhất)
- Activity icon (Lesson/Lab/File)
- Title + Date
- "Xem lại" button

---

## 🔄 6. COMPLETE DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│                    LESSON COMPONENT (Lesson.js)                 │
│  User watches video and progresses from 0% to 100%              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              VIDEOPLAYER - TRACK PROGRESS EVERY SECOND           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ getCurrentTime(), getDuration()                          │   │
│  │ percentage = (currentTime / duration) * 100             │   │
│  │ status = 'Hoàn thành' (90%+), 'Đang học' (>0%), etc   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
         ┌──────────────────────────────────┐
         │ Save every 10 seconds? YES       │
         │ User left page? beforeunload → YES
         └──────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│         saveProgressToServer() - Prepare API Call               │
│  {                                                              │
│    courseId: "itn",                                             │
│    moduleId: "module1",                                         │
│    lessonId: "lesson5",                                         │
│    progressPercent: 90,                                         │
│    status: "COMPLETED" or "ACTIVE"                              │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
         api.updateUserProgress(token, progressData)
         ↓
         POST /api/users/progress
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│       BACKEND: userController.updateProgress()                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 1. Find existing UserProgress record                    │   │
│  │ 2. If exists: UPDATE (progressPercent, status)          │   │
│  │    Else: CREATE new record                              │   │
│  │ 3. If status='COMPLETED' AND first time:                │   │
│  │    → CREATE UserActivity (LESSON_COMPLETED)             │   │
│  │ 4. Return updated progress                              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Database Updates:                                              │
│  ├─ UserProgress table (new/updated record)                    │
│  └─ UserActivity table (if completed)                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│          PROFILE PAGE: User navigates to Profile                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ useEffect(() => {                                       │   │
│  │   fetchProfile = async () => {                          │   │
│  │     api.getUserProfile(token)  ← GET /api/users/profile │   │
│  │   }                                                      │   │
│  │ }, [token])                                             │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│       BACKEND: userController.getProfileMe()                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 1. Fetch User + all relations:                          │   │
│  │    - progress (course-level only)                       │   │
│  │    - activities (10 latest)                             │   │
│  │    - badges                                             │   │
│  │    - examResults                                        │   │
│  │ 2. Post-process data:                                   │   │
│  │    - weeklyScores: avg exam % per week                 │   │
│  │    - dailyStudyTime: estimate mins per day             │   │
│  │    - courseProgress: % for each course                 │   │
│  │    - totalProgress: average % across all courses        │   │
│  │    - completedLabs: count where status='COMPLETED'      │   │
│  │    - averageScore: avg exam percentage                 │   │
│  │    - stats object (combined metrics)                    │   │
│  │ 3. Return formatted response                            │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│         PROFILE COMPONENT: setProfile(data)                     │
│  Renders all sections with updated data:                        │
│  ├─ Header: totalProgress (%)                                  │
│  ├─ Metrics: stats (study time, avg score, exam count, labs)   │
│  ├─ Course Progress: progress array                            │
│  ├─ Achievements: badges array                                 │
│  ├─ Charts: weeklyScores, dailyStudyTime                       │
│  └─ Activities: activities array (last 10)                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📝 7. CÁC CÁC API ENDPOINTS LIÊN QUAN

### Courses & Learning

| Endpoint | Method | Auth | Mục đích |
|----------|--------|------|---------|
| `/learning/courses` | GET | ✅ | Lấy danh sách khóa học (có tính progress) |
| `/learning/courses/:courseId/modules` | GET | ✅ | Lấy module của khóa học |
| `/learning/modules/:moduleId/lessons` | GET | ✅ | Lấy bài học của module |

### User Progress

| Endpoint | Method | Auth | Mục đích |
|----------|--------|------|---------|
| `/users/progress` | GET | ✅ | Lấy tiến độ user (tất cả bài học, lab, khóa) |
| `/users/progress` | POST | ✅ | **Cập nhật tiến độ** (from VideoPlayer) |

### Profile & Activities

| Endpoint | Method | Auth | Mục đích |
|----------|--------|------|---------|
| `/users/profile/me` | GET | ✅ | **Lấy profile đầy đủ** (+ stats, activities) |
| `/users/profile` | GET | ✅ | Alias của `/users/profile/me` |

### User Notes

| Endpoint | Method | Auth | Mục đích |
|----------|--------|------|---------|
| `/users/notes/:lessonId` | GET | ✅ | Lấy ghi chú bài học |
| `/users/notes` | POST | ✅ | Cập nhật/tạo ghi chú |

---

## 🔑 8. CÁC KEY CHANGES TRONG PROFILE

Sau khi user hoàn thành bài học, những thứ được cập nhật:

### ✅ Được cập nhật tự động

1. **progress** (tiến độ khóa học)
   - `courseProgress` array: thêm/cập nhật item
   - `totalProgress`: tính lại % trung bình

2. **activities** (hoạt động gần đây)
   - Thêm entry `LESSON_COMPLETED` vào UserActivity
   - Hiển thị trong "Hoạt động gần đây" section

3. **stats**
   - `labsDone`: tăng nếu lab hoàn thành
   - `examCount`: tăng nếu exam hoàn thành (khác flow)

4. **dailyStudyTime** (thời gian học ngày)
   - Recalculate từ activities (estimate 15 min/lesson)
   - Update chart dữ liệu

5. **weeklyScores** (điểm kiểm tra theo tuần)
   - Cập nhật nếu exam hoàn thành

### ❌ Không cập nhật trực tiếp từ lesson completion

- `averageScore` (chỉ từ exam results)
- `badges` (cần riêng badge system)
- `streak` (cần separate logic)
- `level` (cần riêng leveling system)

---

## 🛠️ 9. DEBUGGING & MONITORING

### Kiểm tra progress được lưu không

1. Browser DevTools → Network tab → Filter: `progress`
   - Xem POST request được gửi đi không
   - Xem request body
   - Xem response status

2. Backend logs
   ```javascript
   console.log('UpdateProgress:', { userId, courseId, lessonId, progressPercent, status });
   ```

3. Database check
   ```sql
   SELECT * FROM UserProgress WHERE userId = ? AND lessonId = ?;
   SELECT * FROM UserActivity WHERE userId = ? AND type = 'LESSON_COMPLETED';
   ```

### Kiểm tra profile data

1. Browser DevTools → Network tab → Filter: `profile`
   - GET `/users/profile/me`
   - Xem response data

2. Render Profile Component
   - Xem console log profile object
   - Verify progress/activities/stats

---

## 📋 10. DATABASE SCHEMA - Key Tables

```prisma
model User {
  id          Int
  fullName    String
  email       String
  level       Int
  streak      Int
  totalStudyTime Int
  
  progress    UserProgress[]
  activities  UserActivity[]
  badges      Badge[]
  examResults ExamResult[]
}

model UserProgress {
  id              Int
  userId          Int
  courseId        String
  moduleId        String?
  lessonId        String?
  labId           Int?
  progressPercent Int       // 0-100
  status          String    // ACTIVE, COMPLETED
  completedAt     DateTime?
}

model UserActivity {
  id          Int
  userId      Int
  title       String      // "Đã hoàn thành bài học: lesson5"
  type        String      // LESSON_COMPLETED, LAB_COMPLETED, etc
  referenceId String?
  createdAt   DateTime
}

model Badge {
  id          Int
  userId      Int
  badgeName   String
  badgeIcon   String
  earnedAt    DateTime
}

model ExamResult {
  id          Int
  userId      Int
  examId      Int
  percentage  Float
  isPassed    Boolean
  takenAt     DateTime?
}
```

---

## 💡 11. KEY INSIGHTS & BEST PRACTICES

### ✅ Cách thức hoạt động hiện tại

1. **Video Progress Tracking**: Tuyệt vời ✨
   - Track mỗi giây
   - Auto-save mỗi 10s
   - Save on-leave (beforeunload)
   - Support YouTube + MP4

2. **Progress Storage**: Hợp lý 🎯
   - Chỉ cập nhật nếu % cao hơn (`Math.max`)
   - Không thể "đi lùi" progress
   - Có timestamp hoàn thành

3. **Activity Logging**: Hữu ích 📊
   - Ghi vào UserActivity khi hoàn thành lần đầu
   - Hiển thị được lịch sử

4. **Profile Stats**: Comprehensive 📈
   - Tính toán từ nhiều nguồn (progress, activities, exams)
   - Post-process để lấy insights (weekly, daily, totals)

### ⚠️ Cần cải thiện

1. **Real-time Updates**
   - Profile không auto-refresh khi progress thay đổi
   - Nên dùng WebSocket hoặc polling
   - Hoặc trigger refetch từ Lesson → Profile

2. **Totals & Aggregates**
   - `totalStudyTime` lưu ở User table nhưng không được cập nhật tự động
   - Nên compute từ UserActivity hoặc UserProgress

3. **Badges System**
   - Hiện chỉ lấy badges, chưa có logic tạo
   - Nên thêm trigger khi hoàn thành bài học

4. **Level & Streak**
   - Hiển thị nhưng không tính toán
   - Nên thêm logic nếu dùng

---

## 🎯 12. SUMMARY - Luồng chi tiết

```
[User xem video]
    ↓
[VideoPlayer tracks: 0% → 90%]
    ↓
[status = 'COMPLETED', progressPercent = 90]
    ↓
[saveProgressToServer() called]
    ↓
[api.updateUserProgress() - POST /users/progress]
    ↓
[Backend: updateProgress() handler]
    ├─ Find/Create UserProgress
    ├─ Set completedAt = now()
    └─ Create UserActivity (LESSON_COMPLETED)
    ↓
[Database updated]
    ↓
[User goes to Profile]
    ↓
[api.getUserProfile() - GET /users/profile/me]
    ↓
[Backend: getProfileMe() handler]
    ├─ Query User + relations (progress, activities, badges, examResults)
    ├─ Post-process to calculate stats
    └─ Return formatted response
    ↓
[Profile Component renders]
    ├─ Header: totalProgress (updated ✨)
    ├─ Metrics: stats (updated ✨)
    ├─ Courses: courseProgress (updated ✨)
    ├─ Activities: activities (updated ✨)
    └─ Charts: dailyStudyTime (updated ✨)
```

**Total Time**: ~1-2 seconds from video completion to profile page load
