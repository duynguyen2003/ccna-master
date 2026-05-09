import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/Api';
import { useToast } from '../Toast';
import AuthLayout from './AuthLayout';
import { useAuth } from '../../context/AuthContext';
import { GoogleLogin } from '@react-oauth/google';

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

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setIsLoading(true);
      setGlobalError('');
      const data = await api.googleLogin(credentialResponse.credential);
      login(data.user, data.accessToken);
      setPendingToast({ message: `Xin chào, ${data.user.fullName}! 👋`, type: 'success' });
      if (data.user.role === 'ADMIN') {
        navigate('/admin/dashboard');
      } else {
        navigate('/roadmap');
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

        <div style={{ justifyContent: 'center' }}>
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => {
              setGlobalError('Đăng nhập Google thất bại');
            }}
            text="signup_with"
            shape="pill"
            theme="outline"
            size="large"
          />
        </div>
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
