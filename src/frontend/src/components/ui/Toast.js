import React, { useState, useEffect, useCallback, useRef } from 'react';
import StatusAlert from './StatusAlert';

const TOAST_EXIT_DURATION = 180;

// Toast Component - Hiển thị thông báo tự động ẩn
const Toast = ({ message, type = 'success', duration = 3000, onClose }) => {
  const [isLeaving, setIsLeaving] = useState(false);
  const isClosing = useRef(false);
  const exitTimer = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const handleClose = useCallback(() => {
    if (isClosing.current) return;
    isClosing.current = true;
    setIsLeaving(true);
    exitTimer.current = window.setTimeout(
      () => onCloseRef.current?.(),
      TOAST_EXIT_DURATION
    );
  }, []);

  useEffect(() => {
    const timer = duration > 0 ? window.setTimeout(handleClose, duration) : null;
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [duration, handleClose]);

  useEffect(
    () => () => {
      if (exitTimer.current) window.clearTimeout(exitTimer.current);
    },
    []
  );

  return (
    <div className="app-toast-viewport">
      <StatusAlert
        variant={type}
        message={message}
        onClose={handleClose}
        leaving={isLeaving}
        className="app-status-alert--toast"
      />
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
