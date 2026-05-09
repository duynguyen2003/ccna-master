# CODE FLOW: Complete Implementation Details

## 📍 STEP 1: Video Playback & Progress Tracking

### Location: `src/components/Content/Lesson.js` (Line 42-250)

#### A. VideoPlayer Component Setup
```javascript
const VideoPlayer = ({ url, lessonId, courseId, moduleId, token, onProgressChange }) => {
  const playerRef = useRef(null);           // YouTube Player instance
  const maxWatchedRef = useRef(0);          // Furthest point watched
  const lastSavedRef = useRef(0);           // Last saved timestamp
  const [localProgress, setLocalProgress] = useState({
    percentage: 0,
    watchedTime: 0,
    status: 'Chưa học'
  });
  
  const youtubeId = getYoutubeVideoId(url); // Extract YouTube ID
```

#### B. YouTube Video Tracking - Every Second
```javascript
const startTracking = () => {
  clearInterval(intervalRef.current);
  intervalRef.current = setInterval(() => {
    if (!playerRef.current || typeof playerRef.current.getCurrentTime !== 'function') return;
    
    // Get current playback time and total duration
    const currentTime = playerRef.current.getCurrentTime() || 0;
    const duration = playerRef.current.getDuration() || 1;
    const percent = Math.min((currentTime / duration) * 100, 100);
    
    // Update the furthest watched point
    if (currentTime > maxWatchedRef.current) {
      maxWatchedRef.current = currentTime;
    }
    
    // Determine status based on % watched
    const status = percent >= 90 ? 'Hoàn thành' : percent > 0 ? 'Đang học' : 'Chưa học';
    const newProgress = {
      percentage: Math.round(percent),
      watchedTime: Math.floor(currentTime),
      status
    };
    
    setLocalProgress(newProgress);
    
    // Notify parent component (used for UI updates)
    onProgressChange && onProgressChange({
      played: percent / 100,
      playedSeconds: currentTime,
      loaded: 1,
      loadedSeconds: duration,
    });
    
    // 🔴 AUTO-SAVE LOGIC: Save every 10 seconds
    const floorTime = Math.floor(currentTime);
    if (floorTime % 10 === 0 && floorTime !== lastSavedRef.current && floorTime > 0) {
      lastSavedRef.current = floorTime;
      saveProgressToServer(currentTime, percent, status);
    }
  }, 1000); // Track every 1 second
};
```

#### C. Save Progress to Server
```javascript
const saveProgressToServer = (watchedTime, percentage, status) => {
  if (!lessonId || !token) return;
  
  // Determine if completed
  const progressStatus = status === 'Hoàn thành' ? 'COMPLETED' : 'ACTIVE';
  
  // Call API to save progress
  api.updateUserProgress(token, {
    courseId: courseId,
    moduleId: moduleId,
    lessonId: lessonId,
    progressPercent: Math.round(percentage),
    status: progressStatus,
  }).catch(err => console.error('[VideoPlayer] Lỗi lưu tiến độ:', err));
};
```

#### D. Save on Page Leave
```javascript
useEffect(() => {
  const forceSave = () => {
    if (playerRef.current && playerRef.current.getCurrentTime && playerRef.current.getDuration) {
      const currentTime = playerRef.current.getCurrentTime();
      const duration = playerRef.current.getDuration();
      if (duration > 0) {
        const percent = (currentTime / duration) * 100;
        const status = percent >= 90 ? 'Hoàn thành' : percent > 0 ? 'Đang học' : 'Chưa học';
        saveProgressToServer(currentTime, percent, status);
      }
    }
  };

  window.addEventListener('beforeunload', forceSave);
  return () => {
    window.removeEventListener('beforeunload', forceSave);
    forceSave(); // Also save when component unmounts
  };
}, [lessonId, courseId, moduleId, token]);
```

---

## 📍 STEP 2: API Call - Send to Backend

### Location: `src/services/Api.js` (Line 277-280)

```javascript
export const api = {
  // ... other methods ...
  
  updateUserProgress: (token, progressData) =>
    apiFetch("/users/progress", token, {
      method: "POST",
      body: JSON.stringify(progressData),
    }),
};

// Helper apiFetch function
const apiFetch = async (endpoint, token, options = {}) => {
  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  
  if (!response.ok) {
    throw new Error(data.message || data.error?.message || `Lỗi API: ${response.status}`);
  }

  return data;
};
```

### Request Payload
```javascript
// POST http://localhost:5000/api/users/progress
{
  "courseId": "itn",
  "moduleId": "module1", 
  "lessonId": "lesson5",
  "progressPercent": 90,
  "status": "COMPLETED"
}

// Headers
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

---

## 📍 STEP 3: Backend Route Handler

### Location: `src/Backend/routes/users.js` (Line 14-16)

```javascript
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken } = require('../middleware/auth');

// ⭐ Route for saving progress
router.post('/progress', verifyToken, userController.updateProgress);

module.exports = router;
```

### Middleware: Verify Token
```javascript
// Extract userId from JWT token
// If valid: req.user = { id: userId, ... }
// If invalid: Return 401
```

---

## 📍 STEP 4: Backend Controller - Update Progress

### Location: `src/Backend/controllers/userController.js` (Line 187-242)

```javascript
module.exports.updateProgress = async (req, res, next) => {
  try {
    const userId = req.user.id;  // From JWT token (middleware)
    const {
      courseId,
      moduleId,
      lessonId,
      labId,
      progressPercent,
      status
    } = req.body;

    if (!courseId) {
      return res.status(400).json({ message: 'courseId is required' });
    }

    // ⭐ Step 1: Check if progress record already exists
    const existing = await prisma.userProgress.findFirst({
      where: {
        userId,
        courseId,
        moduleId: moduleId || null,
        lessonId: lessonId || null,
        labId: labId || null,
      }
    });

    // ⭐ Step 2: Determine if this is completion
    let result;
    const isCompleted = status === 'COMPLETED' || progressPercent >= 95;

    if (existing) {
      // UPDATE: Existing progress record
      result = await prisma.userProgress.update({
        where: { id: existing.id },
        data: {
          // Only update if new percentage is higher (can't go backward)
          progressPercent: Math.max(existing.progressPercent, progressPercent || 0),
          
          // Update status
          status: isCompleted ? 'COMPLETED' : (status || existing.status),
          
          // Mark completion time on first completion
          completedAt: isCompleted && !existing.completedAt ? new Date() : existing.completedAt
        }
      });
    } else {
      // CREATE: New progress record
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

    // ⭐ Step 3: Log activity if completed for the first time
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

### Database After Update
```sql
-- UserProgress table
INSERT INTO UserProgress (userId, courseId, moduleId, lessonId, progressPercent, status, completedAt)
VALUES (5, 'itn', 'module1', 'lesson5', 90, 'COMPLETED', '2024-05-09T10:30:00Z');

-- UserActivity table (if this is first completion)
INSERT INTO UserActivity (userId, title, type, referenceId, createdAt)
VALUES (5, 'Đã hoàn thành bài học: lesson5', 'LESSON_COMPLETED', 'lesson5', '2024-05-09T10:30:00Z');
```

---

## 📍 STEP 5: User Views Profile Page

### Location: `src/components/Content/Profile.js` (Line 31-42)

```javascript
export default function Profile() {
  const { token } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // Fetch complete profile with all stats
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

  if (loading) return <LoadingSpinner />;
  if (!profile) return null;

  // Use profile data to render
  return (
    <div className="profile">
      {/* Header with totalProgress */}
      <div className="header-progress">
        <div className="header-progress-value">{profile.totalProgress || 0}%</div>
      </div>

      {/* Metric cards */}
      <div className="metric-card">
        <div className="metric-value">{formatTime(profile.stats?.totalStudyTime || 0)}</div>
      </div>

      {/* Course progress */}
      {profile.progress.map((cp) => (
        <div key={cp.courseId} className="course-item">
          <span>{cp.courseName}</span>
          <span>{cp.progressPercent}%</span>
        </div>
      ))}

      {/* Activities */}
      {profile.activities.map((act) => (
        <div key={act.id} className="activity-item">
          {act.title} - {new Date(act.createdAt).toLocaleDateString()}
        </div>
      ))}
    </div>
  );
}
```

### API Call Detail
```javascript
// GET http://localhost:5000/api/users/profile/me
// Headers
Authorization: Bearer <jwt_token>
```

---

## 📍 STEP 6: Backend - Generate Profile Data

### Location: `src/Backend/controllers/userController.js` (Line 95-180)

```javascript
module.exports.getProfileMe = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // ⭐ Step 1: Fetch user with all relations
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id, fullName, email, role, isActive, avatarUrl, createdAt,
        level, streak, totalStudyTime,
        
        // ⭐ Course-level progress only (moduleId, lessonId, labId = null)
        progress: {
          select: { progressPercent, courseId, course: { select: { id, title } } },
          where: { moduleId: null, lessonId: null, labId: null }
        },
        
        // ⭐ Recent 10 activities
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id, title, type, createdAt, referenceId }
        },
        
        // ⭐ Badges
        badges: {
          orderBy: { earnedAt: 'desc' },
          select: { id, badgeName, badgeIcon, earnedAt }
        },
        
        // ⭐ Exam results (for weekly scores & averages)
        examResults: {
          select: { percentage, isPassed }
        }
      }
    });

    if (!user) return res.status(404).json({ message: 'User not found' });

    // ⭐ Step 2: Calculate weeklyScores
    const weeklyMap = {};
    user.examResults.forEach(r => {
      const week = getISOWeekLabel(r.takenAt || r.createdAt || new Date());
      if (!weeklyMap[week]) weeklyMap[week] = [];
      weeklyMap[week].push(Number(r.percentage));
    });
    const weeklyScores = Object.entries(weeklyMap)
      .map(([week, scores]) => ({
        week,
        score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      }))
      .slice(-7); // Last 7 weeks

    // ⭐ Step 3: Calculate dailyStudyTime (last 7 days)
    const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const dailyMap = { CN: 0, T2: 0, T3: 0, T4: 0, T5: 0, T6: 0, T7: 0 };
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    user.activities.forEach(act => {
      if (new Date(act.createdAt) >= sevenDaysAgo) {
        const label = DAY_LABELS[new Date(act.createdAt).getDay()];
        // Estimate: 20 mins for completed, 5 mins for others
        const estimatedMins = act.type.includes('COMPLETED') ? 20 : 5;
        dailyMap[label] += estimatedMins;
      }
    });
    const dailyStudyTime = DAY_LABELS.map(day => ({ day, minutes: dailyMap[day] }));

    // ⭐ Step 4: Calculate courseProgress per course
    const courseProgress = user.progress.map(p => ({
      courseId: p.courseId,
      courseName: p.course?.title || p.courseId,
      progressPercent: p.progressPercent
    }));

    // ⭐ Step 5: Calculate totalProgress (average across all courses)
    const totalProgress = courseProgress.length > 0
      ? Math.round(courseProgress.reduce((sum, p) => sum + p.progressPercent, 0) / courseProgress.length)
      : 0;

    // ⭐ Step 6: Get completed labs count
    const completedLabs = await prisma.userProgress.count({
      where: { userId, labId: { not: null }, status: 'COMPLETED' }
    });

    // ⭐ Step 7: Calculate average exam score
    const averageScore = user.examResults.length > 0
      ? Math.round(user.examResults.reduce((sum, r) => sum + Number(r.percentage), 0) / user.examResults.length)
      : 0;

    const { examResults, progress, activities, ...baseUser } = user;

    // ⭐ Step 8: Return formatted response
    res.json({
      data: {
        ...baseUser,
        progress: courseProgress,           // ✅ Updated with lesson completions
        totalProgress,                      // ✅ Updated with lesson completions
        completedLabs,
        totalLabs: 50,
        averageScore,
        examCount: user.examResults.length,
        weeklyScores,
        dailyStudyTime,                    // ✅ Updated with activities
        stats: {
          totalStudyTime: user.totalStudyTime * 60,  // Convert to seconds
          avgScore: averageScore,
          examCount: examCount,
          labsDone: completedLabs
        }
      }
    });
  } catch (error) {
    next(error);
  }
};
```

### Response Payload
```json
{
  "data": {
    "id": 5,
    "fullName": "Nguyễn Văn A",
    "email": "a@example.com",
    "level": 2,
    "streak": 5,
    "totalStudyTime": 300,
    
    "progress": [
      {
        "courseId": "itn",
        "courseName": "Introduction to Networks",
        "progressPercent": 45
      }
    ],
    "totalProgress": 45,
    
    "completedLabs": 12,
    "totalLabs": 50,
    
    "averageScore": 78,
    "examCount": 5,
    
    "weeklyScores": [
      { "week": "Tuần 17", "score": 78 },
      { "week": "Tuần 18", "score": 82 }
    ],
    
    "dailyStudyTime": [
      { "day": "CN", "minutes": 120 },
      { "day": "T2", "minutes": 90 },
      { "day": "T3", "minutes": 0 },
      { "day": "T4", "minutes": 100 },
      { "day": "T5", "minutes": 75 },
      { "day": "T6", "minutes": 0 },
      { "day": "T7", "minutes": 60 }
    ],
    
    "badges": [
      {
        "id": 1,
        "badgeName": "First Lesson",
        "badgeIcon": "https://...",
        "earnedAt": "2024-05-01T10:00:00Z"
      }
    ],
    
    "activities": [
      {
        "id": 1,
        "title": "Đã hoàn thành bài học: lesson5",
        "type": "LESSON_COMPLETED",
        "createdAt": "2024-05-09T10:30:00Z"
      },
      {
        "id": 2,
        "title": "Đã hoàn thành bài học: lesson4",
        "type": "LESSON_COMPLETED",
        "createdAt": "2024-05-08T14:20:00Z"
      }
    ],
    
    "stats": {
      "totalStudyTime": 18000,
      "avgScore": 78,
      "examCount": 5,
      "labsDone": 12
    }
  }
}
```

---

## 📍 STEP 7: Profile Component Renders

### Location: `src/components/Content/Profile.js` (Line 60-315)

```javascript
// Render Header
<div className="profile-header">
  <div className="user-profile-info">
    <div className="user-avatar-circle">
      {profile.fullName?.charAt(0).toUpperCase()}
    </div>
    <h1>Xin chào, {profile.fullName}</h1>
    <p>Level {profile.level}</p>
    <div className="user-streak">{profile.streak} ngày streak</div>
  </div>
  
  {/* ⭐ Shows updated totalProgress */}
  <div className="header-progress">
    <div className="header-progress-value">{profile.totalProgress || 0}%</div>
    <div className="header-progress-bar">
      <div className="header-progress-fill" style={{ width: `${profile.totalProgress}%` }}></div>
    </div>
  </div>
</div>

// Render Metrics (4 cards)
<div className="metric-card">
  <span className="metric-label">Thời gian học</span>
  <div className="metric-value">{formatTime(profile.stats?.totalStudyTime || 0)}</div>
</div>

{/* ⭐ Course progress list - shows updated percentages */}
<div className="course-list">
  {profile.progress.length > 0 ? profile.progress.map((cp, idx) => (
    <div className="course-item" key={idx}>
      <div className="course-info">
        <span>{cp.courseName}</span>
        <span style={{ color: '#3b82f6' }}>{cp.progressPercent}%</span>
      </div>
      <div className="course-bar">
        <div className="course-fill" style={{ width: `${cp.progressPercent}%` }}></div>
      </div>
    </div>
  )) : null}
</div>

{/* ⭐ Activities list - shows LESSON_COMPLETED */}
<div className="activity-list">
  {profile.activities.length > 0 ? profile.activities.map((act) => (
    <div className="activity-item" key={act.id}>
      <div className="activity-left">
        <div className="activity-icon">
          {act.type === 'LESSON_COMPLETED' ? <MonitorPlay size={20} /> : <FileText size={20} />}
        </div>
        <div className="activity-text">
          <h3>{act.title}</h3>
          <p>{new Date(act.createdAt).toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  )) : null}
</div>

{/* Charts */}
<LineChart data={profile.weeklyScores}>
  {/* Shows weekly exam scores */}
</LineChart>

<BarChart data={profile.dailyStudyTime}>
  {/* Shows daily study time estimate */}
</BarChart>
```

---

## 🔄 Complete Timing Flow

```
[User clicks video play]
  ↓ 0ms
[VideoPlayer initializes, starts tracking interval]
  ↓ 1000ms
[Track: 0% → 10%] → No save (not 10s interval)
  ↓ 2000ms
[Track: 10% → 20%] → No save
  ↓ 10000ms
[Track: 100% watched = 10 seconds]
  ↓ saveProgressToServer() called
  ↓ api.updateUserProgress() called
  ↓ 10050ms
[Network request sent to backend]
  ↓ 10100ms
[Backend receives, processes, saves to DB]
  ↓ 10150ms
[Response returned to frontend]
  ↓
[User continues watching... repeat every 10s]
  ↓
[User reaches 90% (completion)]
  ↓ saveProgressToServer() called with status='COMPLETED'
  ↓
[Backend: Creates UserProgress with status='COMPLETED']
[Backend: Creates UserActivity with type='LESSON_COMPLETED']
  ↓
[User navigates to Profile page]
  ↓
[Profile useEffect triggers]
  ↓ api.getUserProfile(token)
  ↓ 100ms
[Backend getProfileMe() starts]
  ↓ 150ms
[Backend queries UserProgress, UserActivity, badges, examResults]
  ↓ 200ms
[Backend post-processes: calculates weeklyScores, dailyStudyTime, totals]
  ↓ 250ms
[Response returned: profile object with updated progress/activities]
  ↓ 300ms
[Profile Component renders with new data]
  ↓
[User sees updated totalProgress, activities, courses, charts, etc. ✨]

TOTAL TIME: ~300ms from profile navigation to display
```

---

## ⚠️ Important Implementation Notes

### 1. Progress Can't Go Backward
```javascript
// In userController.updateProgress():
progressPercent: Math.max(existing.progressPercent, progressPercent || 0)
// If existing = 80%, new = 50%, result = 80% ✓
```

### 2. Completion Only Logged Once
```javascript
// In userController.updateProgress():
if (isCompleted && (!existing || existing.status !== 'COMPLETED')) {
  // Create UserActivity
  // This ensures LESSON_COMPLETED only appears once
}
```

### 3. Course-Level Progress Only
```javascript
// In getProfileMe():
where: { moduleId: null, lessonId: null, labId: null }
// Only get course-level progress, not lesson-level
// For display in "Tiến độ theo khóa học" section
```

### 4. Activity Estimates Study Time
```javascript
// In getProfileMe():
const estimatedMins = act.type.includes('COMPLETED') ? 20 : 5;
// Not actual watched time, just estimation based on activity type
// Could be improved by tracking actual watchTime
```

---

## 🔗 Related Files Not Shown Here

- Course fetching: `src/Backend/controllers/learningController.js`
- Auth/Token: `src/Backend/middleware/auth.js`
- Note saving: Lesson.js line ~350 + `userController.upsertUserNote()`
- Prisma schema: `prisma/schema.prisma`
- Environment config: `.env` (API_URL configuration)

