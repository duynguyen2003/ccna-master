// src/components/Admin/Views/Dashboard.js
import React, { useState, useEffect, useContext } from 'react';
import { Users, BookOpen, Award, TrendingUp, ArrowRight, AlertCircle } from 'lucide-react';
import { adminApi } from '../../../services/api/adminApi';
import { AuthContext } from '../../../context/AuthContext';
import StatsCard from '../Components/StatsCard';
import ActivityBarChart from '../Charts/ActivityBarChart';
import CoursePieChart from '../Charts/CoursePieChart';
import RegistrationLineChart from '../Charts/RegistrationLineChart';
import RecentStudentsTable from '../Components/RecentStudentsTable';
import QuickActions from '../Components/QuickActions';
import '../../../css/Admin/AdminViews.css';

const Dashboard = () => {
  const { token, user } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('week');

  // States for modular dashboard data
  const [summary, setSummary] = useState(null);
  const [activity, setActivity] = useState(null);
  const [distribution, setDistribution] = useState(null);
  const [trends, setTrends] = useState(null);
  const [students, setStudents] = useState(null);
  const [logs, setLogs] = useState(null);

  // Individual loading states
  const [loadings, setLoadings] = useState({
    summary: true,
    activity: true,
    distribution: true,
    trends: true,
    students: true,
    logs: true
  });

  // Error states
  const [errors, setErrors] = useState({
    summary: null,
    activity: null,
    distribution: null,
    trends: null,
    students: null,
    logs: null
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;

      // 1. Fetch Summary
      adminApi.getDashboardSummary(token)
        .then(data => setSummary(data))
        .catch(err => setErrors(prev => ({ ...prev, summary: err.message })))
        .finally(() => setLoadings(prev => ({ ...prev, summary: false })));

      // 2. Fetch Activity
      adminApi.getDashboardActivity(token)
        .then(data => setActivity(data))
        .catch(err => setErrors(prev => ({ ...prev, activity: err.message })))
        .finally(() => setLoadings(prev => ({ ...prev, activity: false })));

      // 3. Fetch Distribution
      adminApi.getDashboardDistribution(token)
        .then(data => setDistribution(data))
        .catch(err => setErrors(prev => ({ ...prev, distribution: err.message })))
        .finally(() => setLoadings(prev => ({ ...prev, distribution: false })));

      // 4. Fetch Trends
      adminApi.getDashboardTrends(token)
        .then(data => setTrends(data))
        .catch(err => setErrors(prev => ({ ...prev, trends: err.message })))
        .finally(() => setLoadings(prev => ({ ...prev, trends: false })));

      // 5. Fetch Students
      adminApi.getRecentStudents(token)
        .then(data => setStudents(data))
        .catch(err => setErrors(prev => ({ ...prev, students: err.message })))
        .finally(() => setLoadings(prev => ({ ...prev, students: false })));

      // 6. Fetch Logs
      adminApi.getLogs(token, 1, 20)
        .then(data => setLogs(data.data || []))
        .catch(err => setErrors(prev => ({ ...prev, logs: err.message })))
        .finally(() => setLoadings(prev => ({ ...prev, logs: false })));
    };

    fetchData();
  }, [token]);

  const renderError = (msg) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontSize: '13px', padding: '20px' }}>
      <AlertCircle size={16} /> {msg || 'Lỗi tải dữ liệu'}
    </div>
  );

  return (
    <div className="dashboard-wrapper">
      {/* Welcome Banner */}
      <div className="admin-welcome">
        <div className="admin-welcome-info">
          <h2>Tổng quan hệ thống</h2>
          <p>Welcome back, {user?.fullName || 'Admin'} — đây là tổng quan nền tảng CCNA của bạn hôm nay.</p>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="admin-stats-grid">
        <StatsCard
          title="Tổng học viên"
          value={summary?.totalUsers ?? 0}
          icon={Users}
          trend={summary?.recentUsersCount > 0 ? 'up' : 'neutral'}
          trendValue={summary?.recentUsersCount > 0 ? `+${summary.recentUsersCount} tuần này` : 'Chưa có mới'}
          colorName="blue"
          loading={loadings.summary}
        />
        <StatsCard
          title="Tiến độ trung bình"
          value={`${summary?.avgProgress ?? 0}%`}
          icon={TrendingUp}
          trend={summary?.avgProgress > 50 ? 'up' : 'neutral'}
          trendValue="Khóa học đang hoạt động"
          colorName="green"
          loading={loadings.summary}
        />
        <StatsCard
          title="Bài học hoàn thành"
          value={summary?.completedLessons ?? 0}
          icon={BookOpen}
          trend="up"
          trendValue="Tổng tất cả học viên"
          colorName="purple"
          loading={loadings.summary}
        />
        <StatsCard
          title="Tỷ lệ pass thi"
          value={`${summary?.examPassRate ?? 0}%`}
          icon={Award}
          trend={summary?.examPassRate >= 70 ? 'up' : summary?.examPassRate > 0 ? 'down' : 'neutral'}
          trendValue={summary?.examPassRate > 0 ? 'Dựa trên tất cả lượt thi' : 'Chưa có lượt thi'}
          colorName="orange"
          loading={loadings.summary}
        />
      </div>

      {/* ── CHARTS ROW: Bar chart + Panel phải ── */}
      <div className="charts-row">
        {/* Trái: Bar chart chiếm 1fr */}
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <div>
              <h3>Hoạt động học tập</h3>
              <p className="dashboard-card-subtitle">Số bài học hoàn thành</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className={`admin-badge ${activeTab === 'week' ? 'active' : 'inactive'}`}
                style={{ border: 'none', cursor: 'pointer', background: activeTab === 'week' ? '#3b82f6' : 'transparent', color: activeTab === 'week' ? '#fff' : '#64748b' }}
                onClick={() => setActiveTab('week')}
              >
                Tuần này
              </button>
              <button
                className={`admin-badge ${activeTab === 'month' ? 'active' : 'inactive'}`}
                style={{ border: 'none', cursor: 'pointer', background: activeTab === 'month' ? '#3b82f6' : 'transparent', color: activeTab === 'month' ? '#fff' : '#64748b' }}
                onClick={() => setActiveTab('month')}
              >
                Tháng này
              </button>
            </div>
          </div>
          {errors.activity ? renderError(errors.activity) : <ActivityBarChart data={activity} loading={loadings.activity} />}
        </div>

        {/* Phải: Donut + Plan Limits xếp dọc */}
        <div className="charts-right">
          {/* Card 1: Phân bổ khóa học */}
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <h3>Phân bổ khóa học</h3>
            </div>
            {errors.distribution ? renderError(errors.distribution) : <CoursePieChart data={distribution} loading={loadings.distribution} />}
          </div>

          {/* Card 2: Lối tắt nhanh (Option 1) */}
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <h3>Lối tắt nhanh</h3>
            </div>
            <QuickActions />
          </div>
        </div>
      </div>

      {/* ── BOTTOM ROW: Area chart + Bảng học viên ── */}
      <div className="bottom-row">
        {/* Trái: Xu hướng đăng ký — 320px cố định */}
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <div>
              <h3>Xu hướng đăng ký</h3>
              <p className="dashboard-card-subtitle">6 tháng gần nhất</p>
            </div>
          </div>
          {errors.trends ? renderError(errors.trends) : <RegistrationLineChart data={trends} loading={loadings.trends} />}
        </div>

        {/* Phải: Bảng học viên gần đây — 1fr */}
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <h3>Học viên gần đây</h3>
            <a href="/admin/students" className="view-all-link">Xem tất cả →</a>
          </div>
          {errors.students ? renderError(errors.students) : <RecentStudentsTable students={students} loading={loadings.students} />}
        </div>
      </div>

      {/* ── Nhật ký bảo mật — hàng riêng, full width ── */}
      <div className="dashboard-card" style={{ marginBottom: '32px' }}>
        <div className="dashboard-card-header">
          <h3>Nhật ký bảo mật</h3>
          <a href="/admin/logs" className="view-all-link">Tất cả →</a>
        </div>

        {loadings.logs ? (
          <div className="progress-list">
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '40px', marginBottom: '8px' }}></div>)}
          </div>
        ) : errors.logs ? renderError(errors.logs) : (
          <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
            {logs && logs.length > 0 ? logs.map(log => (
              <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{log.action}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
                    {log.details ? (
                      <span style={{ fontSize: '12px', color: '#475569', fontWeight: 500 }}>{log.details}</span>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>Không có mô tả</span>
                    )}
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>{log.targetTable} • Thực hiện bởi: {log.admin?.fullName || 'Admin'}</span>
                  </div>
                </div>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                  {new Date(log.createdAt).toLocaleString('vi-VN', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            )) : <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', padding: '20px' }}>Chưa có nhật ký</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
