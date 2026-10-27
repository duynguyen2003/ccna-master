import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/Api';

/**
 * Kiểm tra JWT token có còn hợp lệ (chưa hết hạn) không.
 * Trả về true nếu token hợp lệ, false nếu hết hạn hoặc không hợp lệ.
 */
const isTokenValid = (token) => {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // exp là Unix timestamp (giây), so với hiện tại (ms)
    return payload.exp * 1000 > Date.now();
  } catch {
    return false; // Token không parse được → coi như invalid
  }
};

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

function readStoredSession() {
  try {
    const savedToken = localStorage.getItem('accessToken');
    const savedUser = localStorage.getItem('userData');
    if (savedToken && savedUser && isTokenValid(savedToken))
      return { user: JSON.parse(savedUser), token: savedToken };
    return { user: null, token: null, clear: Boolean(savedToken || savedUser) };
  } catch {
    return { user: null, token: null, clear: true };
  }
}

// Restore local state before the first render; no backend request blocks public pages.
export const AuthProvider = ({ children }) => {
  const [initialSession] = useState(readStoredSession);
  const [user, setUser] = useState(initialSession.user);
  const [token, setToken] = useState(initialSession.token);
  const [loading, setLoading] = useState(true);
  const [pendingToast, setPendingToast] = useState(null);

  useEffect(() => {
    if (initialSession.clear) {
      try {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('userData');
      } catch {}
    }
    setLoading(false);
  }, [initialSession]);

  // Hàm đăng nhập: lưu token + user vào state + localStorage
  const login = useCallback((userData, accessToken) => {
    setUser(userData);
    setToken(accessToken);
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('userData', JSON.stringify(userData));
  }, []);

  // Hàm đăng xuất: xóa mọi thứ
  const logout = useCallback(async () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userData');
    try {
      // Gọi API logout (tùy chọn, để Backend hủy refresh token)
      if (token) {
        await api.logout(token);
      }
    } catch (error) {
      console.error('Lỗi gọi API logout:', error);
    }
  }, [token]);

  // Hàm cập nhật thông tin user
  const updateUser = useCallback((data) => {
    setUser((prev) => {
      const updated = { ...prev, ...data };
      localStorage.setItem('userData', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Lắng nghe sự kiện token hết hạn từ Api.js
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setToken(null);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('userData');
      // Tuỳ chọn: show toast (phụ thuộc vào implementation Toast ở UI)
    };

    window.addEventListener('unauthorized', handleUnauthorized);
    return () => window.removeEventListener('unauthorized', handleUnauthorized);
  }, []);

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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
