import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import useReducedMotion from '../../hooks/useReducedMotion';
import './styles/Dialog.css';

export default function Dialog({ title, children, onClose, className = '', animateExit = false }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  const titleId = useId();
  const [closing, setClosing] = useState(false);
  const closedRef = useRef(false);
  const reducedMotion = useReducedMotion();
  closeRef.current = onClose;

  const finishClose = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    closeRef.current();
  }, []);

  const requestClose = () => {
    if (closing) return;
    if (animateExit && !reducedMotion) setClosing(true);
    else finishClose();
  };

  useEffect(() => {
    if (!closing) return undefined;
    const value = getComputedStyle(dialogRef.current)
      .getPropertyValue('--dialog-exit-duration')
      .trim();
    const duration = parseFloat(value) * (value.endsWith('ms') ? 1 : 1000);
    if (reducedMotion || !Number.isFinite(duration) || duration <= 0) {
      finishClose();
      return undefined;
    }
    // Keep a fallback if CSS animation is cancelled or disabled by the browser.
    const timer = setTimeout(finishClose, duration + 50);
    return () => clearTimeout(timer);
  }, [closing, reducedMotion, finishClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    dialog.querySelector('button')?.focus();
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = oldOverflow;
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialogRef}
      className={`ui-dialog ${className}`}
      aria-labelledby={titleId}
      aria-modal="true"
      data-closing={closing ? 'true' : undefined}
      onAnimationEnd={(event) => {
        if (closing && event.target === event.currentTarget) finishClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const items = [
          ...event.currentTarget.querySelectorAll(
            'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]'
          ),
        ];
        const first = items[0],
          last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div className="ui-dialog-panel" inert={closing ? '' : undefined}>
        <header className="ui-dialog-header">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="ui-dialog-close"
            aria-label="Đóng hộp thoại"
            disabled={closing}
            onClick={requestClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        {children}
      </div>
    </dialog>,
    document.body
  );
}
