import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/Api';
import { useToast } from '../Toast';
import AuthLayout from './AuthLayout';

const ForgotPassword = () => {
  const { showToast, ToastComponent } = useToast();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [globalError, setGlobalError] = useState('');
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const validate = () => {
    if (!email.trim()) {
      setError('Vui lòng nhập email');
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Email không đúng định dạng');
      return false;
    }

    setError('');
    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setGlobalError('');

    if (!validate()) return;

    setIsLoading(true);
    try {
      const data = await api.forgotPassword(email.trim());
      setResult(data);
      showToast(data.message || 'Đã gửi yêu cầu đặt lại mật khẩu.', 'success');
    } catch (submitError) {
      setGlobalError(submitError.message || 'Không thể xử lý yêu cầu lúc này.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout toast={ToastComponent}>
      <div className="auth-header">
        <h1 className="auth-title">Quên mật khẩu</h1>
        <p className="auth-subtitle">
          Nhập email đã đăng ký để nhận liên kết đặt lại mật khẩu.
        </p>
      </div>

      {globalError && (
        <div className="form-global-error">
          <span className="material-icons-round">error_outline</span>
          {globalError}
        </div>
      )}

      {result && (
        <div className="auth-success-box">
          <span className="material-icons-round">mark_email_read</span>
          <div>
            <strong style={{ display: 'block', marginBottom: '4px' }}>Yêu cầu đã được gửi</strong>
            <p style={{ margin: 0, fontSize: '13px' }}>{result.message}</p>
            {result.resetUrl && (
              <a
                href={result.resetUrl}
                className="auth-link"
                style={{ display: 'inline-block', marginTop: '10px', fontSize: '13px' }}
              >
                Mở link đặt lại mật khẩu
              </a>
            )}
            <div style={{ marginTop: '20px' }}>
              <Link to="/login" className="auth-submit" style={{ textDecoration: 'none' }}>
                QUAY LẠI ĐĂNG NHẬP
              </Link>
            </div>
          </div>
        </div>
      )}

      {!result && (
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="forgot-password-email">Địa chỉ Email</label>
            <div className="form-input-wrapper">
              <input
                id="forgot-password-email"
                className={`form-input ${error ? 'input-error' : ''}`}
                type="email"
                name="email"
                placeholder="nhap-email@example.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (error) setError('');
                  if (globalError) setGlobalError('');
                }}
                autoComplete="email"
              />
              <span className="form-input-icon material-icons-round">mail</span>
            </div>
            {error && (
              <div className="form-error">
                <span className="material-icons-round">error</span>
                {error}
              </div>
            )}
          </div>

          <div className="auth-info-box">
            <span className="material-icons-round">info</span>
            <div>
              Liên kết đặt lại mật khẩu sẽ có hiệu lực trong 30 phút.
            </div>
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
                GỬI YÊU CẦU <span className="material-icons-round" style={{ fontSize: 18 }}>send</span>
              </>
            )}
          </button>
        </form>
      )}

      <div className="auth-footer">
        <p>
          Đã nhớ mật khẩu? <Link to="/login" className="auth-link">Đăng nhập.</Link>
        </p>
      </div>
    </AuthLayout>
  );
};

export default ForgotPassword;
