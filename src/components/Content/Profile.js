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

  // Giả lập hoặc tính toán các thông số chưa có trực tiếp từ profile API nếu cần
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
        {/* Header Card */}
        <div className="header-card">
          <div className="bg-circle blue"></div>
          <div className="bg-circle purple"></div>

          <div className="header-content">
            <div className="user-info">
              <div className="profile-avatar">
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
              <div>
                <h1>
                  Xin chào, {profile.fullName} <span>👋</span>
                </h1>
                <p className="subtitle">Học viên CCNA • Level {profile.level || 1}</p>
                <div className="streak">
                  <Flame size={16} />
                  {profile.streak || 0} ngày streak
                </div>
              </div>
            </div>

            <div className="progress-box">
              <div className="progress-top">
                <div>
                  <p>Tiến độ tổng thể</p>
                  <div className="percent">{profile.totalProgress || 0}%</div>
                </div>
                <button className="primary-btn">
                  Tiếp tục học <ChevronRight size={18} />
                </button>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${profile.totalProgress || 0}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        <div className="main-grid">
          <div className="left-column">
            {/* Progress by Course */}
            <div className="card">
              <div className="card-header">
                <BookOpen size={22} />
                <h2>Tiến độ theo khóa học</h2>
              </div>

              {courseProgress.length > 0 ? courseProgress.map((cp, idx) => (
                <div className="course" key={idx}>
                  <div className="course-row">
                    <span>{cp.courseName || cp.courseId}</span>
                    <span className="blue">{cp.progressPercent}%</span>
                  </div>
                  <div className="bar">
                    <div className="fill blue-bg" style={{ width: `${cp.progressPercent}%` }}></div>
                  </div>
                </div>
              )) : (
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Chưa có tiến độ khóa học nào.</p>
              )}
            </div>

            {/* Recent Activity */}
            <div className="card">
              <div className="card-header">
                <Activity size={22} />
                <h2>Hoạt động gần đây</h2>
              </div>

              {recentActivities.length > 0 ? recentActivities.map((act) => (
                <div className="activity" key={act.id}>
                  {act.type === 'Lesson' ? <MonitorPlay size={24} /> : <FileText size={24} />}
                  <div>
                    <h3>{act.title}</h3>
                    <p>{new Date(act.createdAt).toLocaleDateString()}</p>
                  </div>
                  <button>Xem lại</button>
                </div>
              )) : (
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Chưa có hoạt động gần đây.</p>
              )}
            </div>
          </div>

          <div className="right-column">
            {/* Achievements */}
            <div className="card">
              <div className="card-header">
                <Trophy size={22} />
                <h2>Thành tích</h2>
              </div>

              <div className="achievement-grid">
                {badges.length > 0 ? badges.map((badge, idx) => (
                  <div className="achievement" key={idx}>
                    <Zap size={20} />
                    <span>{badge.badgeName}</span>
                  </div>
                )) : (
                  <p style={{ color: '#64748b', fontSize: '0.9rem', gridColumn: 'span 3' }}>Chưa có thành tích.</p>
                )}
              </div>
            </div>

            {/* Statistics */}
            <div className="card stats-detail-card">
              <div className="card-header">
                <BarChart2 size={22} />
                <h2>Thống kê chi tiết</h2>
              </div>

              {/* Metric Grid */}
              <div className="stats-metrics-grid">
                <div className="stat-metric-card">
                  <span className="stat-metric-label">Tổng thời gian học</span>
                  <span className="stat-metric-value">{formatTime(stats?.totalStudyTime || 0)}</span>
                </div>
                <div className="stat-metric-card">
                  <span className="stat-metric-label">Điểm trung bình</span>
                  <span className="stat-metric-value">{stats?.avgScore || 0} <small>/ 100</small></span>
                </div>
                <div className="stat-metric-card">
                  <span className="stat-metric-label">Bài kiểm tra đã làm</span>
                  <span className="stat-metric-value">{stats?.examCount || 0} <small>bài</small></span>
                </div>
                <div className="stat-metric-card">
                  <span className="stat-metric-label">Lab hoàn thành</span>
                  <span className="stat-metric-value">{stats?.labsDone || 0} <small>/ 50</small></span>
                </div>
              </div>

              {/* Weekly Scores Chart */}
              <div className="chart-wrapper">
                <h3 className="chart-section-title">Điểm kiểm tra theo tuần</h3>
                {weeklyScores && weeklyScores.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={weeklyScores}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                      <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: '12px' }}
                        labelStyle={{ color: '#fff', marginBottom: '4px' }}
                        cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="#2563eb"
                        strokeWidth={3}
                        dot={{ r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="chart-empty-state">
                    <span>📊</span>
                    <p>Chưa có dữ liệu kiểm tra</p>
                  </div>
                )}
              </div>

              {/* Daily Study Time Chart */}
              <div className="chart-wrapper">
                <h3 className="chart-section-title">Thời gian học theo ngày (phút)</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={dailyStudyTime || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: '12px' }}
                      labelStyle={{ color: '#fff', marginBottom: '4px' }}
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    />
                    <Bar dataKey="minutes" fill="#0ea5e9" radius={[4, 4, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}