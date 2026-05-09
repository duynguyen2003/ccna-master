import React from 'react';
import { Link } from 'react-router-dom';
import '../../css/Footer.css';

const COL_COURSES = [
  { label: 'Mạng căn bản (Network Fundamentals)', to: '/roadmap' },
  { label: 'Định tuyến & Chuyển mạch (Routing & Switching)', to: '/lesson' },
  { label: 'Bảo mật mạng (Security)', to: '/lesson' },
  { label: 'Tự động hóa mạng (Automation)', to: '/lesson' },
];

const COL_RESOURCES = [
  { label: 'Làm đề thi thử (Mock Exams)', to: '/exam' },
  { label: 'Bài tập Packet Tracer Labs', to: '/labs' },
  { label: 'Công cụ Subnetting Calculator', to: '/tools/subnet' },
  { label: 'Lộ trình học tập', to: '/roadmap' },
];

const COL_ABOUT = [
  { label: 'Giới thiệu đồ án tốt nghiệp', to: '/' },
  { label: 'Câu hỏi thường gặp (FAQ)', to: '/' },
  { label: 'Điều khoản sử dụng', to: '/' },
  { label: 'Chính sách bảo mật', to: '/' },
];

const NavColumn = ({ title, links }) => (
  <div className="footer__col">
    <h3 className="footer__col-title">{title}</h3>
    <ul className="footer__nav">
      {links.map(({ label, to }) => (
        <li key={label}>
          <Link to={to} className="footer__nav-link">{label}</Link>
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
            <ul className="footer__contact-list">
              <li className="footer__contact-item">
                <span className="material-icons-round">mail_outline</span>
                contact@netmastery.edu.vn
              </li>
              <li className="footer__contact-item">
                <span className="material-icons-round">phone_in_talk</span>
                1900 1234
              </li>
            </ul>
          </div>

          <NavColumn title="Khóa học" links={COL_COURSES} />
          <NavColumn title="Tài nguyên" links={COL_RESOURCES} />
          <NavColumn title="Về NetMastery" links={COL_ABOUT} />

        </div>
      </div>

      <hr className="footer__divider" />

      <div className="footer__bottom">
        <p className="footer__copyright">
          &copy; {currentYear} <strong>NetMastery</strong>. All rights reserved.
          Đồ án tốt nghiệp — Nền tảng học CCNA trực tuyến.
        </p>
        <p className="footer__made-with">
          Made with <span aria-label="tình yêu">♥</span> for future Network Engineers
        </p>
      </div>
    </footer>
  );
};

export default Footer;
