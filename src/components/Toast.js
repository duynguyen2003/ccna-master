import React, { useState, useEffect, useCallback } from 'react';

// Toast Component - Hiển thị thông báo tự động ẩn
const Toast = ({ message, type = 'success', duration = 3000, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const handleClose = useCallback(() => {
    setIsLeaving(true);
    setTimeout(() => {
      setIsVisible(false);
      if (onClose) onClose();
    }, 300);
  }, [onClose]);

  useEffect(() => {
    // Slide in
    requestAnimationFrame(() => setIsVisible(true));

    // Auto close
    const timer = setTimeout(handleClose, duration);
    return () => clearTimeout(timer);
  }, [duration, handleClose]);

  const icons = {
    success: 'check_circle',
    error: 'error',
    info: 'info',
  };

  return (
    <div className={`toast-container ${isVisible && !isLeaving ? 'toast-visible' : ''} ${isLeaving ? 'toast-leaving' : ''}`}>
      <div className={`toast toast-${type}`}>
        <span className="material-icons-round toast-icon">{icons[type]}</span>
        <span className="toast-message">{message}</span>
        <button className="toast-close" onClick={handleClose}>
          <span className="material-icons-round">close</span>
        </button>
      </div>
    </div>
  );
};

// Hook để quản lý Toast dễ dàng
export const useToast = () => {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success', duration = 3000) => {
    setToast({ message, type, duration, key: Date.now() });
  }, []);

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  const ToastComponent = toast ? (
    <Toast
      key={toast.key}
      message={toast.message}
      type={toast.type}
      duration={toast.duration}
      onClose={hideToast}
    />
  ) : null;

  return { showToast, hideToast, ToastComponent };
};

export default Toast;
