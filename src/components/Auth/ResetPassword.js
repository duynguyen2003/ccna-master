import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../services/Api';
import { useToast } from '../Toast';
import AuthLayout from './AuthLayout';

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { showToast, ToastComponent } = useToast();

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [globalError, setGlobalError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingToken, setIsCheckingToken] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const validateToken = async () => {
      setIsCheckingToken(true);
      setGlobalError('');
      try {
        await api.validateResetPasswordToken(token);
        if (isMounted) {
          setIsTokenValid(true);
        }
      } catch (error) {
        if (isMounted) {
          setIsTokenValid(false);
          setGlobalError(error.message || 'Liên kết đặt lại mật khẩu không hợp lệ.');
        }
      } finally {
        if (isMounted) {
          setIsCheckingToken(false);
        }
      }
    };

    validateToken();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const validateForm = () => {
    const nextErrors = {};

    if (!formData.password) {
      nextErrors.password = 'Vui lòng nhập mật khẩu mới';
    } else if (formData.password.length < 6) {
      nextErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự';
    }

    if (!formData.confirmPassword) {
      nextErrors.confirmPassword = 'Vui lòng nhập lại mật khẩu';
    } else if (formData.password !== formData.confirmPassword) {
      nextErrors.confirmPassword = 'Mật khẩu nhập lại không khớp';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (globalError) setGlobalError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setGlobalError('');

    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const data = await api.resetPassword(token, formData.password);
      setIsSuccess(true);
      showToast(data.message || 'Đặt lại mật khẩu thành công.', 'success');
      setTimeout(() => navigate('/login'), 1500);
    } catch (error) {
      setGlobalError(error.message || 'Không thể đặt lại mật khẩu.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout toast={ToastComponent}>
      <div className="auth-header">
        <h1 className="auth-title">Đặt lại mật khẩu</h1>
        <p className="auth-subtitle">
          Tạo mật khẩu mới để bảo mật tài khoản của bạn.
        </p>
      </div>

      {isCheckingToken && (
        <div className="auth-info-box">
          <span className="material-icons-round">hourglass_top</span>
          <div>Đang kiểm tra liên kết...</div>
        </div>
      )}

      {!isCheckingToken && globalError && (
        <div className="form-global-error">
          <span className="material-icons-round">error_outline</span>
          {globalError}
        </div>
      )}

      {isSuccess ? (
        <div className="auth-success-box">
          <span className="material-icons-round">check_circle</span>
          <div>
            <strong>Đặt lại mật khẩu thành công</strong>
            <p>Bạn sẽ được chuyển hướng đến trang đăng nhập sau giây lát.</p>
          </div>
        </div>
      ) : isTokenValid ? (
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="reset-password-new">Mật khẩu mới</label>
            <div className="form-input-wrapper">
              <input
                id="reset-password-new"
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
                onClick={() => setShowPassword((prev) => !prev)}
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

          <div className="form-group">
            <label className="form-label" htmlFor="reset-password-confirm">Xác nhận mật khẩu</label>
            <div className="form-input-wrapper">
              <input
                id="reset-password-confirm"
                className={`form-input ${errors.confirmPassword ? 'input-error' : ''}`}
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                placeholder="Nhập lại mật khẩu"
                value={formData.confirmPassword}
                onChange={handleChange}
                autoComplete="new-password"
              />
              <span className="form-input-icon material-icons-round">lock</span>
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
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
                ĐẶT LẠI MẬT KHẨU <span className="material-icons-round" style={{ fontSize: 18 }}>check</span>
              </>
            )}
          </button>
        </form>
      ) : !isCheckingToken ? (
        <div className="auth-footer">
          <Link to="/forgot-password" style={{ display: 'block', marginBottom: '10px' }} className="auth-link">Yêu cầu liên kết mới</Link>
          <Link to="/login" className="auth-link">Quay lại đăng nhập</Link>
        </div>
      ) : null}

      {!isSuccess && isTokenValid && (
        <div className="auth-footer">
          <p>
            Bỗng nhiên nhớ ra? <Link to="/login" className="auth-link">Đăng nhập.</Link>
          </p>
        </div>
      )}
    </AuthLayout>
  );
};

export default ResetPassword;
