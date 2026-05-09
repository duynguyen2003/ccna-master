import React, { useContext } from 'react';
import { LogOut, Menu } from 'lucide-react';
import { AuthContext } from '../../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

const TopBar = ({ onToggleSidebar }) => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const pageTitles = {
    dashboard: 'Tổng quan hệ thống',
    users: 'Quản lý người dùng',
    courses: 'Quản lý khóa học',
    exams: 'Quản lý bài thi',
    labs: 'Quản lý bài thực hành',
    resources: 'Quản lý tài liệu',
    tools: 'Quản lý công cụ'
  };

  const getPageTitle = () => {
    const segments = location.pathname.split('/').filter(Boolean);
    // segments: ['admin', 'courses', '1'] or ['admin', 'courses']
    
    if (segments.length >= 2) {
      const module = segments[1];
      if (segments.length > 2 && module === 'courses') {
        return 'Chi tiết khóa học';
      }
      return pageTitles[module] || module.charAt(0).toUpperCase() + module.slice(1);
    }
    
    return 'Admin Dashboard';
  };

  return (
    <div className="admin-topbar">
      <div className="topbar-left">
        <button className="topbar-menu-btn" onClick={onToggleSidebar}>
          <Menu size={22} />
        </button>
        <span className="topbar-breadcrumb">{getPageTitle()}</span>
      </div>
      <div className="topbar-actions">
        <button className="admin-logout-btn" onClick={handleLogout}>
          <LogOut size={16} />
          <span>Logout</span>
        </button>
        <div className="admin-topbar-avatar">
          {user?.fullName?.charAt(0)?.toUpperCase() || 'A'}
        </div>
      </div>
    </div>
  );
};

export default TopBar;
