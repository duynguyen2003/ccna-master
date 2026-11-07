import React from 'react';
import { Copy, Check } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import useClipboard from '@ccna/agent-ui/clipboard';
import './styles/AnimatedCopyButton.css';

const FADE = { duration: 0.16, ease: [0.22, 1, 0.36, 1] };
const SPRING = { type: 'spring', stiffness: 480, damping: 22, mass: 0.65 };

export default function AnimatedCopyButton({
  value,
  label = 'Sao chép',
  className = '',
  tone = 'default',
  disabled = false,
  onError,
  onCopied,
}) {
  const { state, sequence, copy, status } = useClipboard(value, onError, onCopied);
  const reduced = useReducedMotion() ?? false;
  const copied = state === 'copied';
  const fade = reduced ? { duration: 0 } : FADE;
  return (
    <button
      type="button"
      className={`animated-copy-button ${className}`}
      data-tone={tone}
      data-state={state}
      aria-label={label}
      aria-busy={state === 'pending'}
      disabled={disabled || value == null}
      onClick={copy}
      style={{
        width: 32,
        height: 32,
        minWidth: 32,
        minHeight: 32,
        maxWidth: 32,
        maxHeight: 32,
        flex: '0 0 32px',
        padding: 0,
        transform: 'none',
      }}
    >
      <span className="animated-copy-button__frame" aria-hidden="true">
        <motion.span
          className="animated-copy-button__icon"
          initial={false}
          animate={{ opacity: copied ? 0 : 1, scale: copied && !reduced ? 0.55 : 1 }}
          transition={fade}
        >
          <Copy size={16} aria-hidden="true" />
        </motion.span>
        <AnimatePresence initial={false}>
          {copied && (
            <motion.span
              key={sequence}
              className="animated-copy-button__icon animated-copy-button__check"
              initial={{ opacity: 0, scale: reduced ? 1 : 0.45 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: reduced ? 1 : 0.65 }}
              transition={{ opacity: fade, scale: reduced ? { duration: 0 } : SPRING }}
            >
              <Check size={17} strokeWidth={2.4} aria-hidden="true" />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <span className="animated-copy-button__status" role="status" aria-live="polite">
        {status}
      </span>
    </button>
  );
}
