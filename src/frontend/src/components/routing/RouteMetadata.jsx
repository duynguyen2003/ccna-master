import { useEffect, useLayoutEffect } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { legacyLocationPath } from './legacyRoutes';

const titles = [
  ['/roadmap', 'Lộ trình CCNA'],
  ['/course/', 'Khóa học CCNA'],
  ['/lesson', 'Bài học CCNA'],
  ['/labs', 'Thực hành mạng'],
  ['/exam/take/', 'Làm bài kiểm tra'],
  ['/exam/result/', 'Kết quả kiểm tra'],
  ['/exam/review/', 'Xem lại bài kiểm tra'],
  ['/exam', 'Kiểm tra CCNA'],
  ['/profile', 'Hồ sơ học tập'],
  ['/resources', 'Tài liệu CCNA'],
  ['/tools/subnet', 'Tính subnet'],
  ['/tools/vlsm', 'Tính VLSM'],
  ['/tools/ports', 'Tra cứu port'],
  ['/tools/cli', 'Tra cứu Cisco CLI'],
  ['/login', 'Đăng nhập'],
  ['/register', 'Đăng ký'],
  ['/forgot-password', 'Quên mật khẩu'],
  ['/reset-password/', 'Đặt lại mật khẩu'],
  ['/admin', 'Quản trị'],
];

export default function RouteMetadata() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  useLayoutEffect(() => {
    document.documentElement.dataset.appSection = pathname.startsWith('/admin')
      ? 'admin'
      : 'student';
  }, [pathname]);
  useEffect(() => {
    const followOldLink = () => {
      const target = legacyLocationPath(window.location);
      if (target) navigate(target, { replace: true });
    };
    window.addEventListener('hashchange', followOldLink);
    return () => window.removeEventListener('hashchange', followOldLink);
  }, [navigate]);
  useEffect(() => {
    const label =
      titles.find(([prefix]) => pathname.startsWith(prefix))?.[1] || 'Học và thực hành CCNA';
    document.title = `${label} | NetMaster`;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', `${label}: học và thực hành CCNA trên NetMaster.`);
    if (navigationType !== 'POP' && !window.location.hash) window.scrollTo(0, 0);
    window.dispatchEvent(new Event('netmaster:navigation'));
    let focused = false;
    const update = () => {
      const selector = /^\/(login|register|forgot-password|reset-password)/.test(pathname)
        ? '.auth-container h1'
        : '#main-content h1';
      const heading = document.querySelector(selector);
      if (!heading || heading.getClientRects().length === 0) return;
      if (/^\/(course|lesson)/.test(pathname))
        document.title = `${heading.textContent.trim()} | NetMaster`;
      if (!focused) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
        focused = true;
      }
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['open', 'hidden'],
    });
    return () => observer.disconnect();
  }, [pathname, navigationType]);
  return null;
}
