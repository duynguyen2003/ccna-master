import React, { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AuthContext } from '../../../context/AuthContext';
import HeartbeatLoader from '../../../components/ui/HeartbeatLoader';

const AdminProtectedRoute = ({ children }) => {
  const { user, isAuthenticated, loading } = useContext(AuthContext);

  if (loading) {
    return <HeartbeatLoader fullScreen label="Đang kiểm tra xác thực..." />;
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
