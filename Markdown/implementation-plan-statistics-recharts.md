# Implementation Plan — Detailed Statistics with Recharts (Real API Data)

## Overview

Add a professional statistics section to the user profile using `recharts`, featuring metric cards and interactive charts. All chart data is sourced from real API endpoints — no mock data.

---

## Files to Modify

```
Frontend:
  src/components/Content/Profile.js     ← [MODIFY]
  src/css/Profile.css                   ← [MODIFY]

Backend:
  src/Backend/controllers/userController.js   ← [MODIFY]
  src/Backend/routes/users.js                 ← [MODIFY] (if needed)
```

---

## Backend Changes

### [MODIFY] `userController.js` — Enrich `getProfileMe`

Update the `getProfileMe` controller to compute and return the following additional fields:

#### Fields to add

| Field | Source | Logic |
|---|---|---|
| `weeklyScores` | `ExamResult` collection | Group exam results by ISO week number for the last 7 weeks. Calculate average score per week. |
| `dailyStudyTime` | `VideoProgress` collection | Group total `watchedTime` by day of week for the last 7 days. |
| `totalStudyTime` | `VideoProgress` collection | Sum of all `watchedTime` in seconds for the current user. |
| `avgScore` | `ExamResult` collection | Mean of all `percentage` values across all exam results. |
| `examCount` | `ExamResult` collection | Count of all completed exam attempts. |
| `labsDone` | `VideoProgress` collection | Count of lessons where `status === 'completed'`. |

#### Implementation pattern

Use `Promise.all` to fetch all sources in parallel, preventing sequential waterfall delays:

```javascript
const getProfileMe = async (req, res) => {
  try {
    const userId = req.user._id;

    const [user, examResults, videoProgress] = await Promise.all([
      User.findById(userId).select('-password'),
      ExamResult.find({ userId }).sort({ completedAt: 1 }),
      VideoProgress.find({ userId }),
    ]);

    // --- weeklyScores: last 7 weeks ---
    const weeklyMap = {};
    examResults.forEach(r => {
      const week = getISOWeekLabel(r.completedAt); // e.g. "Tuần 1", "Tuần 2"
      if (!weeklyMap[week]) weeklyMap[week] = [];
      weeklyMap[week].push(r.percentage);
    });
    const weeklyScores = Object.entries(weeklyMap).map(([week, scores]) => ({
      week,
      score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    })).slice(-7);

    // --- dailyStudyTime: last 7 days ---
    const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const dailyMap = { CN:0, T2:0, T3:0, T4:0, T5:0, T6:0, T7:0 };
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    videoProgress
      .filter(p => new Date(p.updatedAt) >= sevenDaysAgo)
      .forEach(p => {
        const label = DAY_LABELS[new Date(p.updatedAt).getDay()];
        dailyMap[label] += Math.round(p.watchedTime / 60); // convert seconds → minutes
      });
    const dailyStudyTime = DAY_LABELS.map(day => ({ day, minutes: dailyMap[day] }));

    // --- summary metrics ---
    const totalStudyTime = videoProgress.reduce((sum, p) => sum + (p.watchedTime || 0), 0);
    const avgScore = examResults.length
      ? Math.round(examResults.reduce((sum, r) => sum + r.percentage, 0) / examResults.length)
      : 0;
    const examCount = examResults.length;
    const labsDone  = videoProgress.filter(p => p.status === 'completed').length;

    return res.status(200).json({
      user,
      weeklyScores,
      dailyStudyTime,
      stats: { totalStudyTime, avgScore, examCount, labsDone },
    });

  } catch (error) {
    console.error('[getProfileMe]', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};
```

#### Helper function — `getISOWeekLabel`

Add this utility in the same file or a shared `utils/date.js`:

```javascript
function getISOWeekLabel(date) {
  const d = new Date(date);
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `Tuần ${week}`;
}
```

---

## Frontend Changes

### [MODIFY] `Profile.js`

#### Step 1 — Install and import recharts

```bash
npm install recharts
```

```javascript
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts';
```

#### Step 2 — State variables

```javascript
const [profileData, setProfileData] = useState(null);
const [loading, setLoading]         = useState(true);
const [error, setError]             = useState(null);
```

#### Step 3 — Fetch real data from API

```javascript
useEffect(() => {
  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get('/users/profile/me');
      setProfileData(res.data);
    } catch (err) {
      setError('Không thể tải dữ liệu. Vui lòng thử lại.');
      console.error('[Profile] fetch error:', err);
    } finally {
      setLoading(false);
    }
  };
  fetchProfile();
}, []);
```

#### Step 4 — Render with loading and error states

```jsx
if (loading) return <ProfileSkeleton />;
if (error)   return <p className="profile-error">{error}</p>;

const { stats, weeklyScores, dailyStudyTime } = profileData;

// Format totalStudyTime from seconds → "Xh Ym"
const formatTime = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
};
```

#### Step 5 — Metric cards JSX

```jsx
<div className="stats-grid">
  <div className="stat-card">
    <span className="stat-label">Tổng thời gian học</span>
    <span className="stat-value">{formatTime(stats.totalStudyTime)}</span>
  </div>
  <div className="stat-card">
    <span className="stat-label">Điểm trung bình</span>
    <span className="stat-value">{stats.avgScore} <small>/ 100</small></span>
  </div>
  <div className="stat-card">
    <span className="stat-label">Bài kiểm tra đã làm</span>
    <span className="stat-value">{stats.examCount} <small>bài</small></span>
  </div>
  <div className="stat-card">
    <span className="stat-label">Lab hoàn thành</span>
    <span className="stat-value">{stats.labsDone} <small>/ 50</small></span>
  </div>
</div>
```

#### Step 6 — Line chart: weekly scores

```jsx
<div className="chart-container">
  <h3 className="chart-title">Điểm kiểm tra theo tuần</h3>
  <ResponsiveContainer width="100%" height={220}>
    <LineChart data={weeklyScores}>
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
      <XAxis dataKey="week" tick={{ fontSize: 12, fill: '#9ca3af' }} />
      <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#9ca3af' }} />
      <Tooltip
        contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8 }}
        labelStyle={{ color: '#fff' }}
        formatter={(val) => [`${val} điểm`, 'Kết quả']}
      />
      <Line
        type="monotone"
        dataKey="score"
        stroke="#2563eb"
        strokeWidth={2}
        dot={{ r: 4, fill: '#2563eb' }}
        activeDot={{ r: 6 }}
      />
    </LineChart>
  </ResponsiveContainer>
</div>
```

#### Step 7 — Bar chart: daily study time

```jsx
<div className="chart-container">
  <h3 className="chart-title">Thời gian học theo ngày (phút)</h3>
  <ResponsiveContainer width="100%" height={200}>
    <BarChart data={dailyStudyTime}>
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
      <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#9ca3af' }} />
      <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} />
      <Tooltip
        contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8 }}
        labelStyle={{ color: '#fff' }}
        formatter={(val) => [`${val} phút`, 'Thời gian']}
      />
      <Bar dataKey="minutes" fill="#0ea5e9" radius={[5, 5, 0, 0]} />
    </BarChart>
  </ResponsiveContainer>
</div>
```

#### Step 8 — Empty state (user has no data yet)

```jsx
{weeklyScores.length === 0 && (
  <div className="chart-empty">
    <span>📊</span>
    <p>Chưa có dữ liệu kiểm tra. Hãy bắt đầu làm bài để xem thống kê!</p>
  </div>
)}
```

---

### [MODIFY] `Profile.css` — Add new styles

```css
/* ── Stats grid ────────────────────────────────────── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.stat-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stat-label {
  font-size: 12px;
  color: #9ca3af;
}

.stat-value {
  font-size: 22px;
  font-weight: 500;
  color: #fff;
}

.stat-value small {
  font-size: 13px;
  color: #9ca3af;
  font-weight: 400;
}

/* ── Chart containers ──────────────────────────────── */
.chart-container {
  background: rgba(255, 255, 255, 0.04);
  border: 0.5px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 12px;
}

.chart-title {
  font-size: 14px;
  font-weight: 500;
  color: #e5e7eb;
  margin: 0 0 16px;
}

/* ── Empty state ───────────────────────────────────── */
.chart-empty {
  text-align: center;
  padding: 32px 16px;
  color: #6b7280;
  font-size: 14px;
}

.chart-empty span {
  font-size: 28px;
  display: block;
  margin-bottom: 8px;
}

/* ── Error state ───────────────────────────────────── */
.profile-error {
  color: #f87171;
  text-align: center;
  padding: 24px;
  font-size: 14px;
}

/* ── Responsive ────────────────────────────────────── */
@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
```

---

## Verification Plan

### API verification (Postman)

| Endpoint | Expected response |
|---|---|
| `GET /api/users/profile/me` | Returns `{ user, stats, weeklyScores[], dailyStudyTime[] }` |
| User with no exam history | `weeklyScores: []`, `stats.avgScore: 0` |
| User with no video progress | `dailyStudyTime` all zeros, `stats.totalStudyTime: 0` |

### Manual verification

| Scenario | What to check |
|---|---|
| Normal user with data | Charts render correctly with real values |
| New user (no activity) | Empty state message shown, no chart crash |
| API error / 500 | Error message shown instead of blank screen |
| Mobile screen (375px) | Stats grid stacks to 1 column, charts stay responsive |
| Very fast typing / re-render | No duplicate API calls (check Network tab) |

### Edge cases

- User has exam results but no video progress → only bar chart shows zeros
- User has video progress but no exam results → only line chart shows empty state
- `watchedTime` is `null` or missing → guard with `|| 0` in backend aggregation
- `completedAt` date is invalid → wrap `getISOWeekLabel` in try/catch

---

## Implementation Order

```
Step 1  →  Update userController.js  (add weeklyScores, dailyStudyTime, stats)
Step 2  →  Test API with Postman     (verify response shape before touching frontend)
Step 3  →  Install recharts          (npm install recharts)
Step 4  →  Update Profile.js         (state → fetch → loading/error → charts)
Step 5  →  Update Profile.css        (stats-grid, chart-container, empty/error states)
Step 6  →  Manual test all scenarios
```
