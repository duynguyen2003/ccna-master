import React, { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { gsap, useGSAP } from '../../../utils/adminMotion';

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
  const [shouldRender, setShouldRender] = useState(isOpen);
  const overlayRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (isOpen) setShouldRender(true);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useGSAP(() => {
    if (!shouldRender || !overlayRef.current) return undefined;

    const overlay = overlayRef.current;
    const modal = overlay.querySelector('.admin-modal-container');
    if (!modal) return undefined;

    const media = gsap.matchMedia();

    media.add({
      reduceMotion: '(prefers-reduced-motion: reduce)',
      allowMotion: '(prefers-reduced-motion: no-preference)'
    }, ({ conditions }) => {
      if (conditions.reduceMotion) {
        gsap.set([overlay, modal], {
          clearProps: 'opacity,visibility,transform,pointerEvents'
        });
        if (!isOpen) setShouldRender(false);
        return;
      }

      if (isOpen) {
        gsap.set(overlay, { pointerEvents: 'auto' });
        gsap.timeline()
          .fromTo(overlay, {
            autoAlpha: 0
          }, {
            autoAlpha: 1,
            duration: 0.2,
            ease: 'power1.out',
            clearProps: 'opacity,visibility'
          })
          .fromTo(modal, {
            autoAlpha: 0,
            y: 20,
            scale: 0.98
          }, {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.3,
            ease: 'power3.out',
            clearProps: 'opacity,visibility,transform'
          }, 0);
        return;
      }

      gsap.set(overlay, { pointerEvents: 'none' });
      gsap.timeline({
        onComplete: () => setShouldRender(false)
      })
        .to(modal, {
          autoAlpha: 0,
          y: 12,
          scale: 0.985,
          duration: 0.16,
          ease: 'power2.in'
        })
        .to(overlay, {
          autoAlpha: 0,
          duration: 0.14,
          ease: 'power1.in'
        }, '-=0.06');
    });

    return () => media.revert();
  }, {
    scope: overlayRef,
    dependencies: [isOpen, shouldRender],
    revertOnUpdate: true
  });

  if (!shouldRender) return null;

  return (
    <div
      className="admin-modal-overlay"
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className={`admin-modal-container ${className}`}
        style={{
          minWidth,
          maxWidth
        }}
      >
        <div className="admin-modal-header">
          <div className="admin-modal-header-info">
            <h3 id={titleId}>{title}</h3>
            {description ? <p>{description}</p> : null}
          </div>
          <button onClick={onClose} className="admin-modal-close" aria-label="Đóng hộp thoại">
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
