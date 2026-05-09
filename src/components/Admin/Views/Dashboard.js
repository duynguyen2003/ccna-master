import React, { useState, useEffect, useContext } from 'react';
import { Users, BookOpen, FileText, TrendingUp, ArrowRight, Loader } from 'lucide-react';
import { adminApi } from '../../../services/api/adminApi';
import { AuthContext } from '../../../context/AuthContext';
import StatsCard from '../Components/StatsCard';
import '../../../css/Admin/AdminViews.css';

const Dashboard = () => {
  const { token, user } = useContext(AuthContext);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCourses: 0,
    totalExams: 0,
    recentUsers: 0
  });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [statsData, logsData] = await Promise.all([
          adminApi.getStats(token),
          adminApi.getLogs(token, 1, 5)
        ]);
        setStats(statsData);
        setLogs(logsData.data || []);
      } catch (error) {
        console.error("Lỗi tải dữ liệu Dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchData();
    }
  }, [token]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--admin-text-muted)' }}>
        <Loader size={24} className="spin" style={{ marginRight: '10px' }} /> Đang tải thống kê...
      </div>
    );
  }

  return (
    <div className="dashboard-wrapper">
      {/* Welcome Banner */}
      <div className="admin-welcome">
        <h2>Welcome back, {user?.fullName || 'Admin'}</h2>
        <p>Here is the latest overview of your CCNA platform.</p>
      </div>

      {/* Stats Cards */}
      <div className="admin-stats-grid">
        <StatsCard title="Tổng Học Viên" value={stats.totalUsers} icon={Users} index={0} />
        <StatsCard title="Tổng Khóa Học" value={stats.totalCourses} icon={BookOpen} index={1} />
        <StatsCard title="Bài Thi Đã Tạo" value={stats.totalExams} icon={FileText} index={2} />
        <StatsCard title="Học Viên Mới (7 ngày)" value={stats.recentUsers} icon={TrendingUp} index={3} />
      </div>

      {/* Admin Activity Log */}
      <div className="admin-datatable-container">
        <div className="admin-table-header">
          <h3>Nhật ký hoạt động bảo mật (Gần đây)</h3>
          <a href="#!" className="view-all-link">View All <ArrowRight size={14} /></a>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Quản trị viên</th>
              <th>Hành động</th>
              <th>Bảng</th>
              <th>Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {logs.length > 0 ? logs.map(log => (
              <tr key={log.id}>
                <td style={{ color: 'var(--admin-text-secondary)', fontSize: '13px' }}>{new Date(log.createdAt).toLocaleString('vi-VN')}</td>
                <td>{log.admin?.fullName || 'Không xác định'}</td>
                <td><span className="admin-badge active">{log.action}</span></td>
                <td><span style={{ color: 'var(--admin-text-secondary)' }}>{log.targetTable}</span></td>
                <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.description || '—'}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div className="admin-empty-state">
                    <Loader size={32} />
                    <span style={{ marginTop: '8px', color: 'var(--admin-text-muted)' }}>Chưa có hoạt động nào</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Dashboard;
