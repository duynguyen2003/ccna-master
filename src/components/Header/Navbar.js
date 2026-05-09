import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navbar = () => {
  const location = useLocation();

  // Hàm check active path
  const isActive = (path) => location.pathname === path;

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        <Link className={`sidebar-link ${isActive('/') ? 'active' : ''}`} to="/">
          <span className="material-icons-round">home</span>
          <span className="tag-name">Trang chủ</span>
        </Link>
        <Link className={`sidebar-link ${isActive('/roadmap') || location.pathname.startsWith('/course') ? 'active' : ''}`} to="/roadmap">
          <span className="material-icons-round">auto_stories</span>
          <span className="tag-name">Khóa học</span>
        </Link>
        <Link className={`sidebar-link ${isActive('/labs') ? 'active' : ''}`} to="/labs">
          <span className="material-icons-round">terminal</span>
          <span className="tag-name">Thực hành</span>
        </Link>
        <Link 
          className={`sidebar-link ${location.pathname.startsWith('/exam') ? 'active' : ''}`} 
          to="/exam/testing-center"
        >
          <span className="material-icons-round">quiz</span>
          <span className="tag-name">Kiểm tra</span>
        </Link>
        <Link className={`sidebar-link ${isActive('/resources') ? 'active' : ''}`} to="/resources">
          <span className="material-icons-round">folder</span>
          <span className="tag-name">Tài liệu</span>
        </Link>
      </nav>
    </aside>
  );
};

export default Navbar;
