import AppIcon from '../../../components/ui/AppIcon';
import React, { useEffect, useRef } from 'react';
import '../styles/Auth.css';
import { useNavigate } from 'react-router-dom';
import loginBackground from '../../../assets/images/login1.webp';
import BrandLogo from '../../../components/branding/BrandLogo';

const AuthLayout = ({ children, toast, className = '' }) => {
  const navigate = useNavigate();
  const dialogRef = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    if (dialog.showModal) dialog.showModal();
    else dialog.setAttribute('open', '');
    return () => {
      dialog.close?.();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialogRef}
      aria-label="Tài khoản NetMaster"
      className={`auth-page${className ? ` ${className}` : ''}`}
      onCancel={(event) => {
        event.preventDefault();
        navigate('/');
      }}
    >
      {toast}
      <div className="auth-container">
        <button
          onClick={() => navigate('/')}
          className="auth-close-btn"
          aria-label="Đóng"
          title="Đóng"
        >
          <AppIcon name={'close'} className="app-icon" style={{ fontSize: '20px' }} />
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
    </dialog>
  );
};

export default AuthLayout;
