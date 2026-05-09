import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/Api';

// Tạo Context
export const AuthContext = createContext(null);

// Custom hook để sử dụng Auth dễ dàng
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth phải được dùng bên trong AuthProvider');
  }
  return context;
};

// Provider bọc quanh App
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true); // loading ban đầu khi đọc localStorage
  const [pendingToast, setPendingToast] = useState(null); // Toast to show after navigation

  // Khởi tạo: đọc localStorage khi app load
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem('accessToken');
      const savedUser = localStorage.getItem('userData');
      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      }
    } catch (error) {
      console.error('Lỗi đọc localStorage:', error);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('userData');
    } finally {
      setLoading(false);
    }
  }, []);

  // Hàm đăng nhập: lưu token + user vào state + localStorage
  const login = useCallback((userData, accessToken) => {
    setUser(userData);
    setToken(accessToken);
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('userData', JSON.stringify(userData));
  }, []);

  // Hàm đăng xuất: xóa mọi thứ
  const logout = useCallback(async () => {
    try {
      // Gọi API logout (tùy chọn, để Backend hủy refresh token)
      if (token) {
        await api.logout(token);
      }
    } catch (error) {
      console.error('Lỗi gọi API logout:', error);
    } finally {
      // Dù API lỗi vẫn dọn sạch frontend
      setUser(null);
      setToken(null);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('userData');
    }
  }, [token]);

  // Hàm cập nhật thông tin user
  const updateUser = useCallback((data) => {
    setUser(prev => {
      const updated = { ...prev, ...data };
      localStorage.setItem('userData', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Lắng nghe sự kiện token hết hạn từ Api.js
  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
      // Tuỳ chọn: show toast (phụ thuộc vào implementation Toast ở UI)
    };

    window.addEventListener('unauthorized', handleUnauthorized);
    return () => window.removeEventListener('unauthorized', handleUnauthorized);
  }, [logout]);

  const value = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    loading,
    login,
    logout,
    updateUser,
    pendingToast,
    setPendingToast,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
