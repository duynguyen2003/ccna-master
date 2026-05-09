# Quick Reference: Files & Components Map

## 📁 Frontend - Video & Lesson Flow

### Lesson Component (Main Entry)
- **File**: `src/components/Content/Lesson.js`
- **Purpose**: Container component for all lesson content
- **Key State**:
  - `selectedLessonId`: ID bài học đang xem
  - `lessonProgress`: Object tracking progress từng bài
  - `lessons`: Array bài học trong module hiện tại
  - `activeModule`: Module đang học

### VideoPlayer Component (Progress Tracking)
- **File**: `src/components/Content/Lesson.js` (Line 42-250)
- **Purpose**: Theo dõi tiến độ video, auto-save progress
- **Props**:
  ```javascript
  {
    url: "https://youtu.be/...",     // Video URL
    lessonId: "lesson5",              // Lesson ID
    courseId: "itn",                  // Course ID
    moduleId: "module1",              // Module ID
    token: "jwt_token",               // Auth token
    onProgressChange: callback        // Progress update callback
  }
  ```
- **Progress Tracking**:
  - YouTube: Sử dụng YouTube IFrame API
  - MP4: Sử dụng HTML5 `<video>` tag
  - **Interval**: Mỗi 1 giây lấy position
  - **Save Frequency**: Mỗi 10 giây hoặc khi rời trang

### Lesson's Note System
- **File**: `src/components/Content/Lesson.js` (Line ~350-400)
- **Purpose**: Ghi chú bài học với auto-save
- **Logic**:
  - Fetch note khi chọn bài (từ `/users/notes/:lessonId`)
  - Debounce 700ms khi user gõ
  - Auto-save via `api.updateUserNote()`

---

## 📁 Frontend - API Service

### Main API Service
- **File**: `src/services/Api.js`
- **Export**: `api` object + `API_URL` constant

### Key Methods
```javascript
// Courses
api.getCourses(token)                          // GET /learning/courses
api.getModulesByCourse(token, courseId)        // GET /learning/courses/:id/modules
api.getLessonsByModule(token, moduleId)        // GET /learning/modules/:id/lessons

// Progress (⭐ MAIN)
api.getUserProgress(token)                     // GET /users/progress
api.updateUserProgress(token, progressData)    // POST /users/progress (from VideoPlayer)

// Notes
api.getUserNote(token, lessonId)               // GET /users/notes/:lessonId
api.updateUserNote(token, noteData)            // POST /users/notes

// Profile (⭐ MAIN)
api.getUserProfile(token)                      // GET /users/profile/me
```

### API URL Structure
```
Base: http://localhost:5000/api

Routes:
├─ /learning/...        (Courses, Modules, Lessons)
├─ /users/...           (Profile, Progress, Notes)
├─ /exams/...           (Exams, Results)
└─ /auth/...            (Login, Register)
```

---

## 📁 Frontend - Profile Component

### Profile Component
- **File**: `src/components/Content/Profile.js`
- **Purpose**: Hiển thị profile và stats của user
- **Main State**:
  ```javascript
  const [profile, setProfile] = useState(null)  // Complete profile object
  ```
- **Data Fetch** (Line 31-42):
  ```javascript
  useEffect(() => {
    api.getUserProfile(token)
      .then(data => setProfile(data))
  }, [token])
  ```

### Sections trong Profile
1. **Header**: Avatar, Name, Level, Streak, Total Progress
2. **Metrics** (4 cards): Study time, Avg score, Exam count, Labs done
3. **Course Progress**: List tiến độ từng khóa
4. **Achievements**: Huy hiệu
5. **Charts**: Weekly scores (line) + Daily study time (bar)
6. **Recent Activities**: Hoạt động gần đây

### Data Used
```javascript
profile: {
  fullName, email, avatarUrl, level, streak, totalStudyTime,
  totalProgress,                    // Tổng % (updated ✨)
  progress: [                       // Course-level (updated ✨)
    { courseId, courseName, progressPercent }
  ],
  completedLabs, totalLabs,         // Lab stats
  averageScore, examCount,          // Exam stats
  weeklyScores,                     // Chart data
  dailyStudyTime,                   // Chart data
  activities: [                     // Recent activities (updated ✨)
    { id, title, type, createdAt }
  ],
  badges: [                         // Achievements
    { badgeName, badgeIcon }
  ],
  stats: {
    totalStudyTime, avgScore, examCount, labsDone
  }
}
```

---

## 📁 Backend - Routes

### Learning Routes
- **File**: `src/Backend/routes/learning.js`
- **Endpoints**:
  ```javascript
  GET  /learning/courses
  GET  /learning/courses/:courseId/modules
  GET  /learning/modules/:moduleId/lessons
  GET  /learning/labs
  GET  /learning/resources
  ```

### User Routes (⭐ MAIN)
- **File**: `src/Backend/routes/users.js`
- **Endpoints**:
  ```javascript
  GET  /users/profile        → userController.getProfileMe
  GET  /users/profile/me     → userController.getProfileMe
  
  GET  /users/progress       → userController.getUserProgress
  POST /users/progress       → userController.updateProgress (⭐ Save from VideoPlayer)
  
  GET  /users/notes/:lessonId   → userController.getUserNote
  POST /users/notes             → userController.upsertUserNote
  ```

### Exam Routes
- **File**: `src/Backend/routes/exams.js`
- **Key**: Exam submit, results, history

### Auth Routes
- **File**: `src/Backend/routes/auth.js`
- **Key**: Login, register, logout, forgot password

### Admin Routes
- **File**: `src/Backend/routes/admin.js`
- **Key**: Manage courses, modules, lessons

---

## 📁 Backend - Controllers

### Learning Controller
- **File**: `src/Backend/controllers/learningController.js`
- **Main Function**: `getCourses()` - Lấy courses with stats
  - Tính `totalHours` từ lessons
  - Tính `progress` từ UserProgress
  - Tính `isStarted`

### User Controller (⭐ MAIN)
- **File**: `src/Backend/controllers/userController.js`

#### `getProfileMe()` (Line 95-180)
- **Purpose**: Lấy profile đầy đủ + stats
- **Returns**: Profile với progress, activities, badges, stats
- **Post-Processing**:
  - `weeklyScores`: Average exam % per week
  - `dailyStudyTime`: Estimated study time per day
  - `courseProgress`: Progress per course
  - `totalProgress`: Average across courses
  - `completedLabs`: Count completed labs
  - `averageScore`: Average exam score

#### `updateProgress()` (Line 187-242) ⭐ CRITICAL
- **Purpose**: Lưu progress từ VideoPlayer
- **Input**:
  ```javascript
  {
    courseId, moduleId, lessonId, labId,
    progressPercent, status
  }
  ```
- **Database Operations**:
  1. Find or create `UserProgress` record
  2. Update progress (chỉ nếu % cao hơn)
  3. If completed: Create `UserActivity` entry
- **Status Logic**:
  - `isCompleted = status === 'COMPLETED' || progressPercent >= 95`
  - Set `completedAt = now()` nếu lần đầu hoàn thành

#### `getUserProgress()` (Line 177-186)
- **Purpose**: Lấy tất cả progress records
- **Returns**: Array UserProgress

### Exam Controller
- **File**: `src/Backend/controllers/examController.js`
- **Key Functions**: Submit exam, get results

### Auth Controller
- **File**: `src/Backend/controllers/authController.js`
- **Key Functions**: Login, register, verify token

### Admin Controller
- **File**: `src/Backend/controllers/adminController.js`
- **Key Functions**: CRUD courses, modules, lessons

---

## 📁 Backend - Database Models (Prisma)

### Key Tables

#### UserProgress
```prisma
model UserProgress {
  id              Int      @id @default(autoincrement())
  userId          Int
  courseId        String
  moduleId        String?
  lessonId        String?
  labId           Int?
  progressPercent Int      @default(0)      // 0-100 ⭐
  status          String   @default("ACTIVE") // ACTIVE, COMPLETED ⭐
  completedAt     DateTime?                  // ⭐ Set when completed
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

#### UserActivity
```prisma
model UserActivity {
  id          Int      @id @default(autoincrement())
  userId      Int
  title       String   // "Đã hoàn thành bài học: lesson5"
  type        String   // LESSON_COMPLETED, LAB_COMPLETED ⭐
  referenceId String?
  createdAt   DateTime @default(now())
}
```

#### User (Key fields)
```prisma
model User {
  id             Int
  fullName       String
  email          String
  level          Int
  streak         Int
  totalStudyTime Int
  avatarUrl      String?
  
  progress       UserProgress[]
  activities     UserActivity[]
  badges         Badge[]
  examResults    ExamResult[]
}
```

---

## 🔄 Data Flow Checklist

### When User Completes Video (90%+)

- [ ] VideoPlayer.saveProgressToServer() called
- [ ] POST /api/users/progress with:
  - courseId, moduleId, lessonId
  - progressPercent = 90
  - status = "COMPLETED"
- [ ] Backend updateProgress():
  - [ ] Find/Create UserProgress
  - [ ] Update progressPercent = 90
  - [ ] Set status = "COMPLETED"
  - [ ] Set completedAt = now()
  - [ ] Create UserActivity (LESSON_COMPLETED)

### When User Views Profile

- [ ] GET /api/users/profile/me called
- [ ] Backend getProfileMe():
  - [ ] Query User + progress (where moduleId=null, lessonId=null, labId=null)
  - [ ] Query activities (last 10)
  - [ ] Query badges
  - [ ] Query examResults
- [ ] Post-process:
  - [ ] weeklyScores: avg scores per week
  - [ ] dailyStudyTime: estimate mins per day
  - [ ] courseProgress: per-course %
  - [ ] totalProgress: average %
  - [ ] completedLabs: count
  - [ ] averageScore: avg exam %
- [ ] Profile Component renders with updated data

---

## 🐛 Common Issues & Solutions

### Progress not saving?
1. Check Network tab: POST /users/progress
   - Status 200? ✅
   - Status 401? → Auth token expired
   - Status 400? → Invalid body
2. Check videoRef is getting current time correctly
3. Check condition: `floorTime % 10 === 0`

### Profile not updating?
1. Check: api.getUserProfile() called?
2. Check: Response includes `progress` and `activities`?
3. Refresh page to force new fetch
4. Check browser cache: Ctrl+Shift+Delete

### Activities showing wrong data?
1. Check: `type` field in UserActivity
2. Check: `referenceId` is set correctly
3. Check: `createdAt` is recent

---

## 📊 Statistics Calculated

| Metric | Source | Formula | Location |
|--------|--------|---------|----------|
| **totalProgress** | UserProgress (course-level) | avg % all courses | getProfileMe() |
| **completedLabs** | UserProgress where labId != null | count(status='COMPLETED') | getProfileMe() |
| **averageScore** | ExamResult | avg(percentage) | getProfileMe() |
| **examCount** | ExamResult | count(*) | getProfileMe() |
| **weeklyScores** | ExamResult + getISOWeekLabel() | avg % per week | getProfileMe() |
| **dailyStudyTime** | UserActivity last 7 days | estimate mins/day | getProfileMe() |
| **courseProgress** | UserProgress per courseId | % per course | getProfileMe() |

---

## 🎯 Key Takeaways

### ✅ Working well
- Video tracking: smooth, every second
- Auto-save: every 10 seconds + on-leave
- Progress storage: immutable (no going backward)
- Activity logging: records completions

### ⚠️ Areas to improve
- Real-time sync: Profile doesn't auto-refresh
- Total study time: Not auto-updated
- Badge system: No auto-trigger
- Level system: Not auto-calculated

### 💡 Extension points
- Add WebSocket for real-time profile updates
- Add badge triggers for milestones
- Add level calculation logic
- Add notifications for completions
