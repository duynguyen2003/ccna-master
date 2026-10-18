import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import HeartbeatLoader from '../../../components/ui/HeartbeatLoader';

// Component bảo vệ route - chỉ cho truy cập khi đã đăng nhập
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  // Đang kiểm tra localStorage, chờ 1 chút
  if (loading) {
    return <HeartbeatLoader label="Đang kiểm tra xác thực..." />;
  }

  // Chưa đăng nhập -> Đá ra trang login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Đã đăng nhập -> Cho xem nội dung
  return children;
};

export default ProtectedRoute;
