import React from 'react';
import { X } from 'lucide-react';

const AdminModal = ({
  title,
  description = '',
  isOpen,
  onClose,
  onConfirm,
  children,
  confirmText = 'Xác nhận',
  minWidth = '480px',
  maxWidth = '600px',
  bodyMaxHeight = '60vh',
  className = ''
}) => {
  if (!isOpen) return null;

  return (
    <div className="admin-modal-overlay">
      <div
        className={`admin-modal-container ${className}`}
        style={{
          minWidth,
          maxWidth
        }}
      >
        <div className="admin-modal-header">
          <div className="admin-modal-header-info">
            <h3>{title}</h3>
            {description ? <p>{description}</p> : null}
          </div>
          <button onClick={onClose} className="admin-modal-close">
            <X size={20} />
          </button>
        </div>

        <div className="admin-modal-body" style={{ maxHeight: bodyMaxHeight }}>
          {children}
        </div>

        <div className="admin-modal-footer">
          <button onClick={onClose} className="admin-modal-btn-secondary">
            Hủy
          </button>
          <button onClick={onConfirm} className="admin-btn-primary">
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminModal;
