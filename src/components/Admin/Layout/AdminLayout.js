import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import '../../../css/Admin/AdminLayout.css';
import '../../../css/Admin/AdminVariables.css';

const AdminLayout = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarHover, setSidebarHover] = useState(false);
  const [mobile, setMobile] = useState(() => window.innerWidth < 1024);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    const onChange = () => {
      setMobile(media.matches);
      setDrawerOpen(false);
      setSidebarHover(false);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => setDrawerOpen(false), [pathname]);

  useEffect(() => {
    if (!mobile || !drawerOpen) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
        document.querySelector('.topbar-menu-btn')?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobile, drawerOpen]);

  return (
    <div className={[
      'admin-layout',
      !mobile && collapsed && 'sidebar-collapsed',
      !mobile && sidebarHover && 'sidebar-hover',
      drawerOpen && 'admin-drawer-open',
    ].filter(Boolean).join(' ')}>
      {mobile && drawerOpen && (
        <button
          className="admin-sidebar-backdrop"
          aria-label="Đóng menu quản trị"
          onClick={() => setDrawerOpen(false)}
        />
      )}
      <div
        id="admin-navigation"
        className="admin-sidebar-container"
        aria-hidden={mobile && !drawerOpen ? true : undefined}
        onClick={(event) => {
          if (mobile && event.target.closest('a')) setDrawerOpen(false);
        }}
        onMouseEnter={() => !mobile && collapsed && setSidebarHover(true)}
        onMouseLeave={() => setSidebarHover(false)}
      >
        <Sidebar collapsed={collapsed} />
      </div>
      <div className="admin-main-content">
        <TopBar
          sidebarExpanded={mobile ? drawerOpen : !collapsed}
          onToggleSidebar={() => mobile ? setDrawerOpen(!drawerOpen) : setCollapsed(!collapsed)}
        />
        <div className="admin-page-content">{children}</div>
      </div>
    </div>
  );
};

export default AdminLayout;
