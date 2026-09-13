import React from 'react';
import { GooeyNav } from '../ui/gooey-nav';

const navItems = [
  {
    label: 'Trang chủ',
    href: '/',
    icon: <span className="material-icons-round">home</span>,
    isActive: (pathname) => pathname === '/',
  },
  {
    label: 'Khóa học',
    href: '/roadmap',
    icon: <span className="material-icons-round">auto_stories</span>,
    isActive: (pathname) => pathname === '/roadmap' || pathname.startsWith('/course'),
  },
  {
    label: 'Thực hành',
    href: '/labs',
    icon: <span className="material-icons-round">terminal</span>,
    isActive: (pathname) => pathname === '/labs' || pathname.startsWith('/labs'),
  },
  {
    label: 'Kiểm tra',
    href: '/exam/testing-center',
    icon: <span className="material-icons-round">quiz</span>,
    isActive: (pathname) => pathname.startsWith('/exam'),
  },
  {
    label: 'Tài liệu',
    href: '/resources',
    icon: <span className="material-icons-round">folder</span>,
    isActive: (pathname) => pathname === '/resources',
  },
];

const Navbar = () => {
  return (
    <aside className="sidebar" aria-label="Main Navigation">
      <GooeyNav
        items={navItems}
        orientation="auto"
        itemLayout="stacked"
        activeColor="#2563eb"
        barColor="#f1f5f9"
        activeLabelColor="#ffffff"
        inactiveLabelColor="#64748b"
        separation={18}
        radius={14}
        className="sidebar-gooey-nav"
      />
    </aside>
  );
};

export default Navbar;
