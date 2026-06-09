import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/Api';
import { useToast } from '../Toast';
import AuthLayout from './AuthLayout';
import { useAuth } from '../../context/AuthContext';
import { useGoogleLogin } from '@react-oauth/google';

const Register = () => {
  const navigate = useNavigate();
  const { showToast, ToastComponent } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  // Error state
  const [errors, setErrors] = useState({});
  const [globalError, setGlobalError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, setPendingToast } = useAuth();

  const handleGoogleSuccess = async (tokenResponse) => {
    try {
      setIsLoading(true);
      setGlobalError('');
      const data = await api.googleLogin(tokenResponse.access_token);
      login(data.user, data.accessToken);
      setPendingToast({ message: `Xin chào, ${data.user.fullName}! 👋`, type: 'success' });
      if (data.user.role === 'ADMIN') {
        navigate('/admin/dashboard');
      } else {
        navigate('/');
      }
    } catch (error) {
      setGlobalError(error.message || 'Đăng ký/Đăng nhập Google thất bại');
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError: () => setGlobalError('Đăng nhập Google thất bại'),
  });

  // Show/hide password
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Handle input change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    if (globalError) setGlobalError('');
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Vui lòng nhập họ tên';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Vui lòng nhập email';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email không đúng định dạng';
    }

    if (!formData.password) {
      newErrors.password = 'Vui lòng nhập mật khẩu';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Vui lòng nhập lại mật khẩu';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Mật khẩu nhập lại không khớp';
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
      await api.register(formData.fullName.trim(), formData.email.trim(), formData.password);
      showToast('Đăng ký thành công! Đang chuyển đến trang đăng nhập...', 'success');

      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } catch (error) {
      setGlobalError(error.message || 'Đăng ký thất bại. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout toast={ToastComponent}>
      <div className="auth-header">
        <h1 className="auth-title">Đăng ký tài khoản</h1>
        <p className="auth-subtitle">Tham gia NetMastery để bắt đầu hành trình của bạn.</p>
      </div>

      {globalError && (
        <div className="form-global-error">
          <span className="material-icons-round">error_outline</span>
          {globalError}
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {/* Full Name */}
        <div className="form-group">
          <label className="form-label" htmlFor="register-fullname">Họ và tên</label>
          <div className="form-input-wrapper">
            <input
              id="register-fullname"
              className={`form-input ${errors.fullName ? 'input-error' : ''}`}
              type="text"
              name="fullName"
              placeholder="Nhập họ và tên"
              value={formData.fullName}
              onChange={handleChange}
              autoComplete="name"
            />
            <span className="form-input-icon material-icons-round">person</span>
          </div>
          {errors.fullName && (
            <div className="form-error">
              <span className="material-icons-round">error</span>
              {errors.fullName}
            </div>
          )}
        </div>

        {/* Email */}
        <div className="form-group">
          <label className="form-label" htmlFor="register-email">Địa chỉ Email</label>
          <div className="form-input-wrapper">
            <input
              id="register-email"
              className={`form-input ${errors.email ? 'input-error' : ''}`}
              type="email"
              name="email"
              placeholder="email@example.com"
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
          <label className="form-label" htmlFor="register-password">Mật khẩu</label>
          <div className="form-input-wrapper">
            <input
              id="register-password"
              className={`form-input ${errors.password ? 'input-error' : ''}`}
              type={showPassword ? 'text' : 'password'}
              name="password"
              placeholder="Tối thiểu 6 ký tự"
              value={formData.password}
              onChange={handleChange}
              autoComplete="new-password"
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

        {/* Confirm Password */}
        <div className="form-group">
          <label className="form-label" htmlFor="register-confirm">Nhập lại mật khẩu</label>
          <div className="form-input-wrapper">
            <input
              id="register-confirm"
              className={`form-input ${errors.confirmPassword ? 'input-error' : ''}`}
              type={showConfirmPassword ? 'text' : 'password'}
              name="confirmPassword"
              placeholder="Xác nhận lại mật khẩu"
              value={formData.confirmPassword}
              onChange={handleChange}
              autoComplete="new-password"
            />
            <span className="form-input-icon material-icons-round">lock</span>
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              tabIndex={-1}
            >
              <span className="material-icons-round">
                {showConfirmPassword ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </div>
          {errors.confirmPassword && (
            <div className="form-error">
              <span className="material-icons-round">error</span>
              {errors.confirmPassword}
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
              ĐĂNG KÝ <span className="material-icons-round" style={{ fontSize: 18 }}>how_to_reg</span>
            </>
          )}
        </button>

        <div className="auth-divider">
          <span>HOẶC</span>
        </div>

        <button
          type="button"
          className="google-btn"
          onClick={() => loginWithGoogle()}
          disabled={isLoading}
        >
          <svg className="google-icon" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Đăng nhập với Google
        </button>
      </form>

      <div className="auth-footer">
        <p>
          Đã có tài khoản?
          <Link to="/login" className="auth-link">Đăng nhập.</Link>
        </p>
      </div>
    </AuthLayout>
  );
};

export default Register;
