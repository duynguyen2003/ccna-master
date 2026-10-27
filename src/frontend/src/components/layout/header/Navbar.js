import AppIcon from '../../ui/AppIcon';
import React from 'react';
import '../styles/Navbar.css';
import { GooeyNav } from '../../ui/gooey-nav';

const navItems = [
  {
    label: 'Trang chủ',
    href: '/',
    icon: <AppIcon name={'home'} className="app-icon" />,
    isActive: (pathname) => pathname === '/',
  },
  {
    label: 'Khóa học',
    href: '/roadmap',
    icon: <AppIcon name={'auto_stories'} className="app-icon" />,
    isActive: (pathname) =>
      pathname === '/roadmap' || pathname.startsWith('/course') || pathname === '/lesson',
  },
  {
    label: 'Thực hành',
    href: '/labs',
    icon: <AppIcon name={'terminal'} className="app-icon" />,
    isActive: (pathname) => pathname === '/labs' || pathname.startsWith('/labs'),
  },
  {
    label: 'Kiểm tra',
    href: '/exam/testing-center',
    icon: <AppIcon name={'quiz'} className="app-icon" />,
    isActive: (pathname) => pathname.startsWith('/exam'),
  },
  {
    label: 'Tài liệu',
    href: '/resources',
    icon: <AppIcon name={'folder'} className="app-icon" />,
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
        activeColor="var(--color-primary)"
        barColor="var(--color-muted)"
        activeLabelColor="var(--color-on-primary)"
        inactiveLabelColor="var(--color-muted-foreground)"
        separation={18}
        radius={14}
        className="sidebar-gooey-nav"
      />
    </aside>
  );
};

export default Navbar;
