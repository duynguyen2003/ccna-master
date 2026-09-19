import React from 'react';
import { Link } from 'react-router-dom';
import '../../css/Footer.css';

const COL_COURSES = [
  { label: 'Lộ trình học CCNA', to: '/roadmap' },
  { label: 'Danh sách bài lab', to: '/labs' },
  { label: 'Bài thi thử', to: '/exam/testing-center' },
];

const COL_RESOURCES = [
  { label: 'Công cụ Subnetting Calculator', to: '/tools/subnet' },
  { label: 'Công cụ VLSM Calculator', to: '/tools/vlsm' },
  { label: 'Tra cứu Cisco CLI', to: '/tools/cli' },
  { label: 'Tra cứu Port & Giao thức', to: '/tools/ports' },
];

const COL_ABOUT = [
  { label: 'Câu hỏi thường gặp (FAQ)', to: '/?section=faq' },
];

const NavColumn = ({ title, links }) => (
  <div className="footer__col">
    <h3 className="footer__col-title">{title}</h3>
    <ul className="footer__nav">
      {links.map(({ label, to }) => (
        <li key={label}>
          <Link to={to} className="footer__nav-link">
            {label}
          </Link>
        </li>
      ))}
    </ul>
  </div>
);

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer" role="contentinfo">
      <div className="footer__inner">
        <div className="footer__grid">
          <div className="footer__col">
            <Link to="/" className="footer__brand-logo" aria-label="NetMastery - Trang chủ">
              <div className="footer__brand-icon">
                <span className="material-icons-round">router</span>
              </div>
              <span className="footer__brand-name">NetMastery</span>
            </Link>
            <p className="footer__brand-slogan">
              Nền tảng học và luyện thi CCNA thực chiến. Từ nền tảng đến kỹ sư mạng chuyên nghiệp.
            </p>
          </div>

          <NavColumn title="Khóa học" links={COL_COURSES} />
          <NavColumn title="Tài nguyên" links={COL_RESOURCES} />
          <NavColumn title="Về NetMastery" links={COL_ABOUT} />
        </div>
      </div>

      <hr className="footer__divider" />

      <div className="footer__bottom">
        <p className="footer__copyright">
          &copy; {currentYear} <strong>NetMastery</strong>. All rights reserved. Đồ án tốt nghiệp —
          Nền tảng học CCNA trực tuyến.
        </p>
        <p className="footer__made-with">
          Made with <span aria-label="tình yêu">♥</span> for future Network Engineers
        </p>
      </div>
    </footer>
  );
};

export default Footer;
