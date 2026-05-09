import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../services/Api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../Toast';
import AuthLayout from './AuthLayout';
import { GoogleLogin } from '@react-oauth/google';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, setPendingToast } = useAuth();
  const { ToastComponent } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  // Error state
  const [errors, setErrors] = useState({});
  const [globalError, setGlobalError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setIsLoading(true);
      setGlobalError('');
      const data = await api.googleLogin(credentialResponse.credential);

      // Save token and user to context
      login(data.user, data.accessToken);

      // Set pending toast - will be shown after navigation
      setPendingToast({ message: `Xin chào, ${data.user.fullName}! 👋`, type: 'success' });

      if (data.user.role === 'ADMIN') {
        navigate('/admin/dashboard');
      } else {
        const from = location.state?.from?.pathname || '/roadmap';
        navigate(from);
      }
    } catch (error) {
      setGlobalError(error.message || 'Đăng nhập Google thất bại');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle input change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    if (globalError) setGlobalError('');
  };

  // Validate
  const validateForm = () => {
    const newErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Vui lòng nhập email';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email không đúng định dạng';
    }

    if (!formData.password) {
      newErrors.password = 'Vui lòng nhập mật khẩu';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setGlobalError('');

    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const data = await api.login(formData.email.trim(), formData.password);

      // Cất "Vé thông hành" (accessToken) vào localStorage + Context
      login(data.user, data.accessToken);

      // Set pending toast - will be shown after navigation
      setPendingToast({ message: `Xin chào, ${data.user.fullName}! 👋`, type: 'success' });

      // Chuyển hướng vào trang Admin hoặc Lộ trình học tùy vai trò
      if (data.user.role === 'ADMIN') {
        navigate('/admin');
      } else {
        const redirectPath = location.state?.from || '/roadmap';
        navigate(redirectPath);
      }
    } catch (error) {
      setGlobalError(error.message || 'Đăng nhập thất bại. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout toast={ToastComponent}>
      <div className="auth-header">
        <h1 className="auth-title">Đăng nhập tài khoản</h1>
        <p className="auth-subtitle">Truy cập vào lộ trình học và hệ thống thực hành.</p>
      </div>

      {globalError && (
        <div className="form-global-error">
          <span className="material-icons-round">error_outline</span>
          {globalError}
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {/* Email */}
        <div className="form-group">
          <label className="form-label" htmlFor="login-email">Địa chỉ Email</label>
          <div className="form-input-wrapper">
            <input
              id="login-email"
              className={`form-input ${errors.email ? 'input-error' : ''}`}
              type="email"
              name="email"
              placeholder="nhap-email@example.com"
              value={formData.email}
              onChange={handleChange}
              autoComplete="email"
            />
            <span className="form-input-icon material-icons-round">mail</span>
          </div>
          {errors.email && (
            <div className="form-error">
              <span className="material-icons-round">error</span>
              {errors.email}
            </div>
          )}
        </div>

        {/* Password */}
        <div className="form-group">
          <div className="form-label-row">
            <label className="form-label" htmlFor="login-password">Mật khẩu</label>
          </div>
          <div className="form-input-wrapper">
            <input
              id="login-password"
              className={`form-input ${errors.password ? 'input-error' : ''}`}
              type={showPassword ? 'text' : 'password'}
              name="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              autoComplete="current-password"
            />
            <span className="form-input-icon material-icons-round">lock</span>
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              <span className="material-icons-round">
                {showPassword ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </div>
          {errors.password && (
            <div className="form-error">
              <span className="material-icons-round">error</span>
              {errors.password}
            </div>
          )}
        </div>

        <button
          type="submit"
          className="auth-submit"
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="spinner"></div>
          ) : (
            <>
              ĐĂNG NHẬP <span className="material-icons-round" style={{ fontSize: 18 }}>arrow_forward</span>
            </>
          )}
        </button>

        <div style={{ textAlign: 'right', marginTop: '-8px' }}>
          <Link to="/forgot-password" title='Quên mật khẩu?' className="auth-inline-link" style={{ fontSize: '13px', fontWeight: '500', color: '#1e293b' }}>
            Quên mật khẩu?
          </Link>
        </div>

        <div className="auth-divider">
          <span>OR</span>
        </div>

        <div style={{ justifyContent: 'center', }}>
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => {
              setGlobalError('Đăng nhập Google thất bại');
            }}
            text="signin_with"
            shape="pill"
            theme="outline"
            size="large"
          />
        </div>
      </form>

      <div className="auth-footer">
        <p>
          Chưa có tài khoản?
          <Link to="/register" className="auth-link">Đăng ký ngay.</Link>
        </p>
      </div>
    </AuthLayout>
  );
};

export default Login;
