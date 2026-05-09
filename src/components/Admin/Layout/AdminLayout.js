import React, { useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import '../../../css/Admin/AdminLayout.css';
import '../../../css/Admin/AdminVariables.css';

const AdminLayout = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`admin-layout ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div
        className="admin-sidebar-container"
        onMouseEnter={() => collapsed && document.querySelector('.admin-layout').classList.add('sidebar-hover')}
        onMouseLeave={() => collapsed && document.querySelector('.admin-layout').classList.remove('sidebar-hover')}
      >
        <Sidebar collapsed={collapsed} />
      </div>
      <div className="admin-main-content">
        <TopBar onToggleSidebar={() => setCollapsed(!collapsed)} />
        <div className="admin-page-content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
