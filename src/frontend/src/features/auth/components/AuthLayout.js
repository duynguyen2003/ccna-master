import React from 'react';
import { useNavigate } from 'react-router-dom';
import loginBackground from '../../../assets/images/login1.png';
import BrandLogo from '../../../components/branding/BrandLogo';

const AuthLayout = ({ children, toast, className = '' }) => {
  const navigate = useNavigate();
  return (
    <div className={`auth-page${className ? ` ${className}` : ''}`}>
      {toast}
      <div className="auth-container">
        <button
          onClick={() => navigate('/')}
          className="auth-close-btn"
          aria-label="Đóng"
          title="Đóng"
        >
          <span className="material-icons-round" style={{ fontSize: '20px' }}>
            close
          </span>
        </button>

        {/* Left Panel - Visuals */}
        <div className="auth-left-panel">
          <div
            className="auth-bg-image"
            style={{ backgroundImage: `url(${loginBackground})` }}
          ></div>
          <div className="auth-overlay"></div>

          {/* Glassmorphism Portal Card */}
          <div className="auth-portal-card">
            <BrandLogo className="portal-brand" inverse />
            <p className="portal-subtitle">Hệ thống Đào tạo Quản trị mạng Toàn cầu</p>
          </div>
        </div>

        {/* Right Panel - Form Content */}
        <div className="auth-right-panel">
          <div className="auth-content-wrapper">{children}</div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
