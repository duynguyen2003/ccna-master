import React, { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';

const AdminProtectedRoute = ({ children }) => {
  const { user, isAuthenticated, loading } = useContext(AuthContext);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0B0B0C', color: '#FFF' }}>Đang tải hệ thống Admin...</div>;
  }

  // Chuyển về login nếu chưa đăng nhập
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Trở về trang chủ nếu không phải ADMIN
  if (user?.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  return children ? children : <Outlet />;
};

export default AdminProtectedRoute;
