import React from 'react';
import { NavLink } from 'react-router-dom';
import BrandLogo from '../../../components/branding/BrandLogo';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  FileText,
  Activity,
  Wrench,
  FolderOpen,
} from 'lucide-react';

const Sidebar = () => {
  return (
    <div className="admin-sidebar">
      {/* Logo */}
      <div className="admin-sidebar-header">
        <BrandLogo className="admin-brand" />
      </div>

      {/* Navigation */}
      <nav className="admin-sidebar-nav">
        <NavLink
          to="/admin/dashboard"
          className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
        >
          <LayoutDashboard size={19} />
          <span>Tổng quan</span>
        </NavLink>
        <NavLink
          to="/admin/users"
          className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
        >
          <Users size={19} />
          <span>Quản lý người dùng</span>
        </NavLink>
        <NavLink
          to="/admin/courses"
          className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
        >
          <BookOpen size={19} />
          <span>Quản lý khóa học</span>
        </NavLink>
        <NavLink
          to="/admin/exams"
          className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
        >
          <FileText size={19} />
          <span>Quản lý bài kiểm tra</span>
        </NavLink>
        <NavLink
          to="/admin/labs"
          className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
        >
          <Activity size={19} />
          <span>Quản lý thực hành</span>
        </NavLink>
        <NavLink
          to="/admin/resources"
          className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
        >
          <FolderOpen size={19} />
          <span>Quản lý tài liệu</span>
        </NavLink>
        <NavLink
          to="/admin/tools"
          className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
        >
          <Wrench size={19} />
          <span>Quản lý công cụ</span>
        </NavLink>
      </nav>
    </div>
  );
};

export default Sidebar;
