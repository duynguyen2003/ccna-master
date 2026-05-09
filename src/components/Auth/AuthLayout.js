import React from 'react';
import { useNavigate } from 'react-router-dom';
import loginBackground from '../../image/login1.png';

const AuthLayout = ({ children, toast }) => {
  const navigate = useNavigate();
  return (
    <div className="auth-page">
      {toast}
      <div className="auth-container">
        <button
          onClick={() => navigate('/')}
          className="auth-close-btn"
          aria-label="Đóng"
          title="Đóng"
        >
          <span className="material-icons-round" style={{ fontSize: '20px' }}>close</span>
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
            <div className="portal-logo-wrapper">
              <div className="portal-logo">
                <span className="material-icons-round">router</span>
              </div>
            </div>
            <h1 className="portal-title">NetMastery</h1>
            <p className="portal-subtitle">Hệ thống Đào tạo Quản trị mạng Toàn cầu</p>
          </div>
        </div>

        {/* Right Panel - Form Content */}
        <div className="auth-right-panel">
          <div className="auth-content-wrapper">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
