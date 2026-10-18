import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../../services/Api';
import { useToast } from '../../../components/ui/Toast';
import AuthLayout from '../components/AuthLayout';
import { useAuth } from '../../../context/AuthContext';
import { useGoogleLogin } from '@react-oauth/google';
import { AlertCircle, Eye, EyeOff, Lock, Mail, UserPlus } from 'lucide-react';

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

  // Show/hide password
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Handle input change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
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
    <AuthLayout toast={ToastComponent} className="auth-page--register">
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

      <form className="auth-form auth-motion-form register-form" onSubmit={handleSubmit} noValidate>
        {/* Full Name */}
        <div className="form-group auth-field-group">
          <label className="form-label" htmlFor="register-fullname">
            Họ và tên
          </label>
          <div
            className={`form-input-wrapper auth-input-field${errors.fullName ? ' is-error' : ''}`}
          >
            <input
              id="register-fullname"
              className={`form-input ${errors.fullName ? 'input-error' : ''}`}
              type="text"
              name="fullName"
              placeholder="Nhập họ và tên"
              value={formData.fullName}
              onChange={handleChange}
              autoComplete="name"
              aria-invalid={Boolean(errors.fullName)}
              aria-describedby={errors.fullName ? 'register-fullname-error' : undefined}
            />
            <span className="form-input-icon auth-input-icon" aria-hidden="true">
              <UserPlus size={17} strokeWidth={1.8} />
            </span>
          </div>
          <div className="auth-field-message" aria-live="polite">
            {errors.fullName && (
              <div id="register-fullname-error" className="form-error auth-field-error">
                <AlertCircle size={13} aria-hidden="true" />
                {errors.fullName}
              </div>
            )}
          </div>
        </div>

        {/* Email */}
        <div className="form-group auth-field-group">
          <label className="form-label" htmlFor="register-email">
            Địa chỉ Email
          </label>
          <div className={`form-input-wrapper auth-input-field${errors.email ? ' is-error' : ''}`}>
            <input
              id="register-email"
              className={`form-input ${errors.email ? 'input-error' : ''}`}
              type="email"
              name="email"
              placeholder="email@example.com"
              value={formData.email}
              onChange={handleChange}
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'register-email-error' : undefined}
            />
            <span className="form-input-icon auth-input-icon" aria-hidden="true">
              <Mail size={17} strokeWidth={1.8} />
            </span>
          </div>
          <div className="auth-field-message" aria-live="polite">
            {errors.email && (
              <div id="register-email-error" className="form-error auth-field-error">
                <AlertCircle size={13} aria-hidden="true" />
                {errors.email}
              </div>
            )}
          </div>
        </div>

        {/* Password */}
        <div className="form-group auth-field-group">
          <label className="form-label" htmlFor="register-password">
            Mật khẩu
          </label>
          <div
            className={`form-input-wrapper auth-input-field${errors.password ? ' is-error' : ''}`}
          >
            <input
              id="register-password"
              className={`form-input ${errors.password ? 'input-error' : ''}`}
              type={showPassword ? 'text' : 'password'}
              name="password"
              placeholder="Tối thiểu 6 ký tự"
              value={formData.password}
              onChange={handleChange}
              autoComplete="new-password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'register-password-error' : undefined}
            />
            <span className="form-input-icon auth-input-icon" aria-hidden="true">
              <Lock size={17} strokeWidth={1.8} />
            </span>
            <button
              type="button"
              className="password-toggle auth-password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              aria-pressed={showPassword}
              aria-controls="register-password"
            >
              <span
                className={`auth-visibility-icon${showPassword ? ' is-hidden' : ''}`}
                aria-hidden="true"
              >
                <Eye size={17} strokeWidth={1.8} />
              </span>
              <span
                className={`auth-visibility-icon${showPassword ? '' : ' is-hidden'}`}
                aria-hidden="true"
              >
                <EyeOff size={17} strokeWidth={1.8} />
              </span>
            </button>
          </div>
          <div className="auth-field-message" aria-live="polite">
            {errors.password && (
              <div id="register-password-error" className="form-error auth-field-error">
                <AlertCircle size={13} aria-hidden="true" />
                {errors.password}
              </div>
            )}
          </div>
        </div>

        {/* Confirm Password */}
        <div className="form-group auth-field-group">
          <label className="form-label" htmlFor="register-confirm">
            Nhập lại mật khẩu
          </label>
          <div
            className={`form-input-wrapper auth-input-field${errors.confirmPassword ? ' is-error' : ''}`}
          >
            <input
              id="register-confirm"
              className={`form-input ${errors.confirmPassword ? 'input-error' : ''}`}
              type={showConfirmPassword ? 'text' : 'password'}
              name="confirmPassword"
              placeholder="Xác nhận lại mật khẩu"
              value={formData.confirmPassword}
              onChange={handleChange}
              autoComplete="new-password"
              aria-invalid={Boolean(errors.confirmPassword)}
              aria-describedby={errors.confirmPassword ? 'register-confirm-error' : undefined}
            />
            <span className="form-input-icon auth-input-icon" aria-hidden="true">
              <Lock size={17} strokeWidth={1.8} />
            </span>
            <button
              type="button"
              className="password-toggle auth-password-toggle"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? 'Ẩn mật khẩu xác nhận' : 'Hiện mật khẩu xác nhận'}
              aria-pressed={showConfirmPassword}
              aria-controls="register-confirm"
            >
              <span
                className={`auth-visibility-icon${showConfirmPassword ? ' is-hidden' : ''}`}
                aria-hidden="true"
              >
                <Eye size={17} strokeWidth={1.8} />
              </span>
              <span
                className={`auth-visibility-icon${showConfirmPassword ? '' : ' is-hidden'}`}
                aria-hidden="true"
              >
                <EyeOff size={17} strokeWidth={1.8} />
              </span>
            </button>
          </div>
          <div className="auth-field-message" aria-live="polite">
            {errors.confirmPassword && (
              <div id="register-confirm-error" className="form-error auth-field-error">
                <AlertCircle size={13} aria-hidden="true" />
                {errors.confirmPassword}
              </div>
            )}
          </div>
        </div>

        <button type="submit" className="auth-submit" disabled={isLoading}>
          {isLoading ? (
            <div className="spinner"></div>
          ) : (
            <>
              ĐĂNG KÝ{' '}
              <span className="material-icons-round" style={{ fontSize: 18 }}>
                how_to_reg
              </span>
            </>
          )}
        </button>

        <div className="auth-divider">
          <span>HOẶC</span>
        </div>

        {process.env.REACT_APP_GOOGLE_CLIENT_ID ? (
          <ActiveGoogleLoginBtn
            onSuccess={handleGoogleSuccess}
            onError={() => setGlobalError('Đăng nhập Google thất bại')}
            isLoading={isLoading}
          />
        ) : (
          <button
            type="button"
            className="google-btn"
            onClick={() =>
              setGlobalError(
                'Tính năng Đăng ký qua Google cần được cấu hình REACT_APP_GOOGLE_CLIENT_ID.'
              )
            }
            disabled={isLoading}
          >
            <GoogleIcon />
            Đăng nhập với Google
          </button>
        )}
      </form>

      <div className="auth-footer">
        <p>
          Đã có tài khoản?
          <Link to="/login" className="auth-link">
            Đăng nhập.
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
};

const GoogleIcon = () => (
  <svg className="google-icon" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

const ActiveGoogleLoginBtn = ({ onSuccess, onError, isLoading }) => {
  const loginWithGoogle = useGoogleLogin({
    onSuccess,
    onError,
  });

  return (
    <button
      type="button"
      className="google-btn"
      onClick={() => loginWithGoogle()}
      disabled={isLoading}
    >
      <GoogleIcon />
      Đăng nhập với Google
    </button>
  );
};

export default Register;
