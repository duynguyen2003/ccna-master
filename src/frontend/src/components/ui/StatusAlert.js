import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import './styles/StatusAlert.css';

const ALERT_VARIANTS = {
  default: { Icon: Info, role: 'status' },
  info: { Icon: Info, role: 'status' },
  success: { Icon: CheckCircle2, role: 'status' },
  warning: { Icon: AlertTriangle, role: 'alert' },
  destructive: { Icon: AlertCircle, role: 'alert' },
};

const normalizeVariant = (variant) => {
  if (variant === 'error') return 'destructive';
  return Object.prototype.hasOwnProperty.call(ALERT_VARIANTS, variant) ? variant : 'default';
};

export function StatusAlert({
  variant = 'default',
  message,
  children,
  onClose,
  leaving = false,
  className = '',
}) {
  const normalizedVariant = normalizeVariant(variant);
  const { Icon, role } = ALERT_VARIANTS[normalizedVariant];

  return (
    <div
      className={`app-status-alert app-status-alert--${normalizedVariant}${leaving ? ' app-status-alert--leaving' : ''}${className ? ` ${className}` : ''}`}
      data-variant={normalizedVariant}
      role={role}
      aria-live={role === 'alert' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <span className="app-status-alert__icon" aria-hidden="true">
        <Icon size={20} strokeWidth={2} />
      </span>
      <div className="app-status-alert__content">{children || message}</div>
      {onClose ? (
        <button
          type="button"
          className="app-status-alert__close"
          onClick={onClose}
          aria-label="Đóng thông báo"
        >
          <X size={17} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

export default StatusAlert;
