import React, { useState, useEffect } from "react";
import '../../css/Profile.css';
import {
  Zap,
  Trophy,
  BookOpen,
  Activity,
  Clock,
  CheckCircle2,
  Star,
  FileText,
  MonitorPlay,
  ChevronRight,
  Flame,
  BarChart2,
  Loader2,
} from "lucide-react";
import { 
  ResponsiveContainer, 
  LineChart, Line, 
  BarChart, Bar, 
  XAxis, YAxis, 
  CartesianGrid, Tooltip 
} from 'recharts';
import { api, API_URL } from "../../services/Api.js";
import { useAuth } from "../../context/AuthContext";

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

  if (loading) {
    return (
      <div className="profile-loading" style={{ minHeight: '80vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Loader2 className="spin" size={32} color="#2563eb" />
      </div>
    );
  }

  if (!profile) return null;

  const recentActivities = profile.activities || [];
  const badges = profile.badges || [];
  const courseProgress = profile.progress || [];
  const { stats, weeklyScores, dailyStudyTime } = profile;

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <div className="app">
      <div className="container">
        <div className="profile-grid">
          
          {/* Row 0: Header Card */}
          <div className="profile-header">
            <div className="user-profile-info">
              <div className="user-avatar-circle">
                {profile.avatarUrl ? (
                  <img 
                    src={profile.avatarUrl.startsWith('http') 
                      ? profile.avatarUrl 
                      : `${API_URL.replace('/api', '')}${profile.avatarUrl.startsWith('/') ? '' : '/'}${profile.avatarUrl}`
                    } 
                    alt="avatar" 
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.parentElement.innerText = profile.fullName?.charAt(0).toUpperCase() || "U";
                    }}
                  />
                ) : (
                  profile.fullName?.charAt(0).toUpperCase() || "U"
                )}
              </div>
              <div className="user-details">
                <h1>Xin chào, {profile.fullName} 👋</h1>
                <p>Học viên CCNA • Level {profile.level || 1}</p>
                <div className="user-streak">
                  <Flame size={14} />
                  {profile.streak || 0} ngày streak
                </div>
              </div>
            </div>

            <div className="header-progress">
              <p className="header-progress-label">Tiến độ tổng thể</p>
              <div className="header-progress-value">{profile.totalProgress || 0}%</div>
              <div className="header-progress-bar">
                <div className="header-progress-fill" style={{ width: `${profile.totalProgress || 0}%` }}></div>
              </div>
            </div>
          </div>

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
              {stats?.labsDone || 0} <small>/ 50</small>
            </div>
          </div>

          {/* Row 2: Middle Cards (2 per row) */}
          <div className="section-card span-2">
            <div className="card-title">
              <BookOpen size={20} />
              <h2>Tiến độ theo khóa học</h2>
            </div>
            <div className="course-list">
              {courseProgress.length > 0 ? courseProgress.map((cp, idx) => (
                <div className="course-item" key={idx}>
                  <div className="course-info">
                    <span>{cp.courseName || cp.courseId}</span>
                    <span style={{ color: '#3b82f6' }}>{cp.progressPercent}%</span>
                  </div>
                  <div className="course-bar">
                    <div className="course-fill" style={{ width: `${cp.progressPercent}%` }}></div>
                  </div>
                </div>
              )) : (
                <p className="empty-text">Chưa có tiến độ khóa học nào.</p>
              )}
            </div>
          </div>

          <div className="section-card span-2">
            <div className="card-title">
              <Trophy size={20} />
              <h2>Thành tích</h2>
            </div>
            <div className="achievements-list">
              {badges.length > 0 ? badges.map((badge, idx) => (
                <div className="badge-item" key={idx}>
                  <div className="badge-icon"><Zap size={16} /></div>
                  <span className="badge-name">{badge.badgeName}</span>
                </div>
              )) : (
                <p className="empty-text" style={{ gridColumn: 'span 2' }}>Chưa có thành tích.</p>
              )}
            </div>
          </div>

          {/* Row 3: Charts (2 per row) */}
          <div className="section-card span-2">
            <div className="card-title">
              <Activity size={20} />
              <h2>Điểm kiểm tra theo tuần</h2>
            </div>
            <div className="chart-container">
              {weeklyScores && weeklyScores.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyScores}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      labelStyle={{ fontWeight: 600, marginBottom: '4px' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="empty-text">Chưa có dữ liệu kiểm tra.</p>
              )}
            </div>
          </div>

          <div className="section-card span-2">
            <div className="card-title">
              <BarChart2 size={20} />
              <h2>Thời gian học theo ngày</h2>
            </div>
            <div className="chart-container">
              {dailyStudyTime && dailyStudyTime.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyStudyTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="minutes" fill="#0ea5e9" radius={[4, 4, 0, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="empty-text">Chưa có dữ liệu học tập.</p>
              )}
            </div>
          </div>

          {/* Row 4: Recent Activity (Full width) */}
          <div className="section-card span-4">
            <div className="card-title">
              <Activity size={20} />
              <h2>Hoạt động gần đây</h2>
            </div>
            <div className="activity-list">
              {recentActivities.length > 0 ? recentActivities.map((act) => (
                <div className="activity-item" key={act.id}>
                  <div className="activity-left">
                    <div className="activity-icon">
                      {act.type === 'Lesson' ? <MonitorPlay size={20} /> : <FileText size={20} />}
                    </div>
                    <div className="activity-text">
                      <h3>{act.title}</h3>
                      <p>{new Date(act.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <button className="btn-secondary">Xem lại</button>
                </div>
              )) : (
                <p className="empty-text">Chưa có hoạt động gần đây.</p>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}