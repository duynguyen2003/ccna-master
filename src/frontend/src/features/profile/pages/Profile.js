import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Profile.css';

import {
  Zap,
  Trophy,
  BookOpen,
  Activity,
  CheckCircle2,
  FileText,
  MonitorPlay,
  ChevronRight,
  BarChart2,
  Loader2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { api } from '../../../services/Api.js';
import { useAuth } from '../../../context/AuthContext';
import HeartbeatLoader from '../../../components/ui/HeartbeatLoader';
import StatusAlert from '../../../components/ui/StatusAlert';
import ActivityCalendar from '../components/ActivityCalendar';

export default function Profile() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [studyPeriod, setStudyPeriod] = useState('week');
  const [studyChartData, setStudyChartData] = useState([]);
  const [studyChartLoading, setStudyChartLoading] = useState(false);
  const [profileError, setProfileError] = useState(false);
  const [profileAttempt, setProfileAttempt] = useState(0);
  const [studyChartError, setStudyChartError] = useState(false);
  const [chartAttempt, setChartAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setProfile(null);
    setProfileError(false);
    const fetchProfile = async () => {
      try {
        const data = await api.getUserProfile(token);
        if (!data) throw new Error('PROFILE_UNAVAILABLE');
        if (!cancelled) setProfile(data);
      } catch (error) {
        if (!cancelled) setProfileError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (token) fetchProfile();
    else setLoading(false);
    return () => {
      cancelled = true;
    };
  }, [token, profileAttempt]);

  useEffect(() => {
    let cancelled = false;
    const fetchStudyChart = async () => {
      if (!token) return;
      setStudyChartLoading(true);
      setStudyChartError(false);
      try {
        const data = await api.getStudyTimeStats(token, studyPeriod);
        if (!cancelled) setStudyChartData(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) setStudyChartError(true);
      } finally {
        if (!cancelled) setStudyChartLoading(false);
      }
    };
    fetchStudyChart();
    return () => {
      cancelled = true;
    };
  }, [token, studyPeriod, chartAttempt]);

  if (loading) {
    return <HeartbeatLoader label="Đang tải hồ sơ học tập..." />;
  }

  if (profileError || !profile)
    return (
      <section className="profile-load-error" aria-label="Hồ sơ học tập">
        <h1>Hồ sơ học tập</h1>
        <StatusAlert variant="error" message="Không tải được hồ sơ. Vui lòng thử lại." />
        <button
          type="button"
          className="ui-button"
          onClick={() => setProfileAttempt((value) => value + 1)}
        >
          Thử lại
        </button>
      </section>
    );

  const recentActivities = profile.activities || [];
  const badges = profile.badges || [];
  const courseProgress = profile.progress || [];
  const { stats, weeklyScores } = profile;

  const formatTime = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    return `${h}h ${m}m`;
  };

  return (
    <div className="app profile-page">
      <div className="container">
        <div className="profile-grid">
          <ActivityCalendar />

          {/* Row 1: 4 Metric Cards */}
          <div className="metric-card">
            <span className="metric-label">Thời gian học</span>
            <div className="metric-value">{formatTime(stats?.totalStudyTime || 0)}</div>
          </div>

          <div className="metric-card">
            <span className="metric-label">Điểm TB</span>
            <div className="metric-value">
              {stats?.avgScore || 0} <small>/ 100</small>
            </div>
          </div>

          <div className="metric-card">
            <span className="metric-label">Bài kiểm tra</span>
            <div className="metric-value">
              {stats?.examCount || 0} <small>bài</small>
            </div>
          </div>

          <div className="metric-card">
            <span className="metric-label">Lab hoàn thành</span>
            <div className="metric-value">
              {stats?.labsDone || 0} <small>lab</small>
            </div>
          </div>

          {/* Row 2: Middle Cards (2 per row) */}
          <div className="section-card span-2">
            <div className="card-title">
              <BookOpen size={20} />
              <h2>Tiến độ theo khóa học</h2>
            </div>
            <div className="course-list">
              {courseProgress.length > 0 ? (
                courseProgress.map((cp, idx) => (
                  <div className="course-item" key={idx}>
                    <div className="course-info">
                      <span>{cp.courseName || cp.courseId}</span>
                      <span style={{ color: 'var(--color-primary)' }}>{cp.progressPercent}%</span>
                    </div>
                    <div className="course-bar">
                      <div
                        className="course-fill"
                        style={{ width: `${cp.progressPercent}%` }}
                      ></div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">📚</div>
                  <p>Chưa có tiến độ khóa học nào.</p>
                  <button className="btn-action" onClick={() => navigate('/roadmap')}>
                    Bắt đầu học ngay <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="section-card span-2">
            <div className="card-title">
              <Trophy size={20} />
              <h2>Thành tích</h2>
            </div>
            <div className="achievements-list">
              {badges.length > 0 ? (
                badges.map((badge, idx) => (
                  <div className="badge-item" key={idx}>
                    <div className="badge-icon">
                      <Zap size={16} />
                    </div>
                    <span className="badge-name">{badge.badgeName}</span>
                  </div>
                ))
              ) : (
                <div className="empty-state compact">
                  <div className="empty-icon">🏆</div>
                  <p>Chưa có thành tích.</p>
                  <button className="btn-text" onClick={() => navigate('/exam')}>
                    Khám phá thử thách →
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Row 3: Charts (2 per row) */}
          <div className="section-card span-2">
            <div className="card-title">
              <Activity size={20} />
              <h2>Điểm kiểm tra theo tuần</h2>
            </div>
            <div
              className={`chart-container${weeklyScores?.length ? '' : ' chart-container--empty'}`}
            >
              {weeklyScores && weeklyScores.length > 0 ? (
                <ResponsiveContainer
                  width="100%"
                  height={260}
                  minWidth={0}
                  initialDimension={{ width: 500, height: 260 }}
                >
                  <LineChart data={weeklyScores}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-muted-foreground)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="week"
                      tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--color-surface)',
                        border: '1px solid #e2e8f0',
                        borderRadius: 12,
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                      labelStyle={{ fontWeight: 600, marginBottom: '4px' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="var(--color-primary)"
                      strokeWidth={3}
                      dot={{
                        r: 4,
                        fill: 'var(--color-primary)',
                        strokeWidth: 2,
                        stroke: 'var(--color-on-primary)',
                      }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="empty-text">Chưa có dữ liệu kiểm tra.</p>
              )}
            </div>
          </div>

          {weeklyScores?.length > 0 && (
            <details className="chart-data section-card span-4">
              <summary>Xem bảng điểm</summary>
              <table>
                <thead>
                  <tr>
                    <th>Tuần</th>
                    <th>Điểm</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyScores.map((row, index) => (
                    <tr key={index}>
                      <td>{row.week}</td>
                      <td>{row.score}/100</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
          <div className="section-card span-2">
            <div className="card-title study-card-title">
              <div className="card-title__heading">
                <BarChart2 size={20} />
                <h2>Thời gian học</h2>
              </div>
              {/* Period Tabs */}
              <div className="study-periods" role="group" aria-label="Khoảng thời gian học">
                {[
                  { key: 'week', label: 'Tuần' },
                  { key: 'month', label: 'Tháng' },
                  { key: 'quarter', label: '3 Tháng' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={studyPeriod === key}
                    onClick={() => setStudyPeriod(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div
              className={`chart-container${studyChartLoading || studyChartData.length ? '' : ' chart-container--empty'}`}
            >
              {studyChartLoading ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                  }}
                >
                  <Loader2 className="spin" size={24} color="var(--color-primary)" />
                </div>
              ) : studyChartError ? (
                <div>
                  <StatusAlert variant="error" message="Không tải được biểu đồ thời gian học." />
                  <button
                    type="button"
                    className="ui-button ui-button--secondary"
                    onClick={() => setChartAttempt((value) => value + 1)}
                  >
                    Thử lại biểu đồ
                  </button>
                </div>
              ) : studyChartData.length > 0 ? (
                <ResponsiveContainer
                  width="100%"
                  height={260}
                  minWidth={0}
                  initialDimension={{ width: 500, height: 260 }}
                >
                  <BarChart data={studyChartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-muted-foreground)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--color-surface)',
                        border: '1px solid #e2e8f0',
                        borderRadius: 12,
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                      formatter={(value) => [`${value} phút`, 'Thời gian']}
                    />
                    <Bar
                      dataKey="minutes"
                      fill="var(--color-primary)"
                      radius={[4, 4, 0, 0]}
                      barSize={24}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="empty-text">Chưa có dữ liệu học tập trong khoảng này.</p>
              )}
            </div>
          </div>

          {!studyChartLoading && !studyChartError && studyChartData.length > 0 && (
            <details className="chart-data section-card span-4">
              <summary>Xem bảng thời gian học</summary>
              <table>
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Số phút</th>
                  </tr>
                </thead>
                <tbody>
                  {studyChartData.map((row, index) => (
                    <tr key={index}>
                      <td>{row.label}</td>
                      <td>{row.minutes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
          {/* Row 4: Recent Activity (Full width) */}
          <div className="section-card span-4">
            <div className="card-title">
              <Activity size={20} />
              <h2>Hoạt động gần đây</h2>
            </div>
            <div className="activity-list">
              {recentActivities.length > 0 ? (
                recentActivities.map((act) => {
                  // Xác định icon, nhãn và đường dẫn dựa trên loại hoạt động
                  let icon, badge, badgeColor, reviewPath;
                  switch (act.type) {
                    case 'LESSON_COMPLETED':
                      icon = <MonitorPlay size={20} />;
                      badge = 'Bài học';
                      badgeColor = 'var(--color-primary-soft)';
                      reviewPath = '/roadmap';
                      break;
                    case 'LAB_COMPLETED':
                      icon = <CheckCircle2 size={20} />;
                      badge = 'Lab thực hành';
                      badgeColor = 'var(--color-success-bg)';
                      reviewPath = `/labs`;
                      break;
                    case 'EXAM_COMPLETED':
                    case 'EXAM_PASSED':
                      icon = <FileText size={20} />;
                      badge = 'Bài thi';
                      badgeColor = 'var(--color-warning-bg)';
                      reviewPath = `/exam`;
                      break;
                    default:
                      icon = <Activity size={20} />;
                      badge = 'Hoạt động';
                      badgeColor = 'var(--color-muted)';
                      reviewPath = null;
                  }

                  return (
                    <div className="activity-item" key={act.id}>
                      <div className="activity-icon" aria-hidden="true">
                        {icon}
                      </div>
                      <h3 className="activity-title">{act.title}</h3>
                      <div className="activity-meta">
                        <span className="activity-badge" style={{ background: badgeColor }}>
                          {badge}
                        </span>
                        <time className="activity-time" dateTime={act.createdAt}>
                          <span>
                            {new Date(act.createdAt).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span>
                            {new Date(act.createdAt).toLocaleDateString('vi-VN', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })}
                          </span>
                        </time>
                      </div>
                      {reviewPath && (
                        <button
                          type="button"
                          className="btn-secondary activity-review"
                          onClick={() => navigate(reviewPath)}
                        >
                          Xem lại
                        </button>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="empty-state wide">
                  <div className="empty-icon">🕒</div>
                  <div>
                    <p>Chưa có hoạt động gần đây.</p>
                    <button className="btn-action" onClick={() => navigate('/roadmap')}>
                      Xem bài học mới <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
