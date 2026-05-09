import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Component bảo vệ route - chỉ cho truy cập khi đã đăng nhập
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  // Đang kiểm tra localStorage, chờ 1 chút
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: '12px',
        color: 'var(--slate-500)',
        fontSize: '15px',
      }}>
        <div className="spinner" style={{
          width: 24,
          height: 24,
          border: '2.5px solid var(--slate-200)',
          borderTopColor: 'var(--blue-primary)',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }}></div>
        Đang kiểm tra xác thực...
      </div>
    );
  }

  // Chưa đăng nhập -> Đá ra trang login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Đã đăng nhập -> Cho xem nội dung
  return children;
};

export default ProtectedRoute;
