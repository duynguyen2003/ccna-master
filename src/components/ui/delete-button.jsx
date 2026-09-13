import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  animate,
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'motion/react';
import { cn } from '../../lib/utils';
import './delete-button.css';

const HINGE = '3px 6px';
const LID_OPEN = -35;
const WALL_TOP = 6;
const WALL_TOP_OPEN = 13.5;
const WALL_BASE = 20;

const HOLD = { deleted: 1400, kept: 500 };

const EASE = [0.32, 0.72, 0, 1];
const EASE_LID = [0.34, 1.1, 0.64, 1];

const WIDTH = { duration: 0.5, ease: EASE };
const LID = { duration: 0.45, ease: EASE_LID };
const WALL = { duration: 0.45, ease: EASE };
const IN = { duration: 0.35, ease: EASE, delay: 0.08 };
const OUT = { duration: 0.25, ease: EASE };
const TAP = { duration: 0.18, ease: EASE };
const SWAP = { duration: 0.2, ease: EASE };
const SETTLE = { duration: 0.4, ease: EASE };
const PRESS = {
  type: 'spring',
  stiffness: 520,
  damping: 18,
  mass: 0.5,
};
const INSTANT = { duration: 0 };

const SIZES = {
  sm: {
    tile: 30,
    panel: 58,
    binSize: 15,
    circleSize: 22,
    iconSize: 12,
    strokeWidth: 2.5,
  },
  md: {
    tile: 38,
    panel: 70,
    binSize: 18,
    circleSize: 26,
    iconSize: 13,
    strokeWidth: 3,
  },
  lg: {
    tile: 48,
    panel: 84,
    binSize: 20,
    circleSize: 30,
    iconSize: 14,
    strokeWidth: 3.5,
  },
};

const ICON = {
  viewBox: '0 0 24 24',
  fill: 'none',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

const panelMotion = {
  hidden: { opacity: 0, x: -6, transition: OUT },
  shown: { opacity: 1, x: 0, transition: { ...IN, staggerChildren: 0.05 } },
};

const circleMotion = {
  hidden: { opacity: 0, scale: 0.85, transition: OUT },
  shown: { opacity: 1, scale: 1, transition: IN },
};

function Circle({
  label,
  onClick,
  className,
  sizeConfig,
  children,
}) {
  const reduced = useReducedMotion() ?? false;

  return (
    <motion.div className="flex" variants={reduced ? undefined : circleMotion}>
      <motion.button
        type="button"
        aria-label={label}
        onClick={onClick}
        whileHover={reduced ? undefined : { scale: 1.08 }}
        whileTap={reduced ? undefined : { scale: 0.85 }}
        transition={PRESS}
        className={cn('rare-delete-circle', className)}
      >
        <svg
          {...ICON}
          width={sizeConfig.iconSize}
          height={sizeConfig.iconSize}
          stroke="currentColor"
          strokeWidth={sizeConfig.strokeWidth}
        >
          {children}
        </svg>
      </motion.button>
    </motion.div>
  );
}

export function DeleteButton({
  onConfirm,
  onCancel,
  size = 'md',
  accentColor = '#dc2626',
  title = 'Xóa',
  disabled = false,
  className,
  style,
  ...props
}) {
  const reduced = useReducedMotion() ?? false;
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('idle'); // 'idle' | 'deleted' | 'kept'
  const containerRef = useRef(null);
  const triggerRef = useRef(null);

  const sizeConfig = SIZES[size] || SIZES.md;
  const timing = useCallback(
    (transition) => (reduced ? INSTANT : transition),
    [reduced]
  );

  const top = useMotionValue(WALL_TOP);
  const wall = useTransform(top, (y) => WALL_BASE - y);
  const bin = useMotionTemplate`M19 ${top}v${wall}a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V${top}`;
  const settle = useMotionValue(1);

  useEffect(() => {
    const walls = animate(
      top,
      open ? WALL_TOP_OPEN : WALL_TOP,
      reduced ? INSTANT : WALL
    );
    return () => walls.stop();
  }, [open, reduced, top]);

  useEffect(() => {
    if (status === 'idle') return;
    const nudge =
      status === 'kept' && !reduced
        ? animate(settle, [1, 0.88, 1], SETTLE)
        : null;
    const done = setTimeout(() => setStatus('idle'), HOLD[status]);
    return () => {
      nudge?.stop();
      clearTimeout(done);
    };
  }, [status, reduced, settle]);

  const resolve = useCallback(
    (next) => {
      setOpen(false);
      setStatus(next);
      triggerRef.current?.focus();
      if (next === 'deleted') {
        onConfirm?.();
      } else {
        onCancel?.();
      }
    },
    [onConfirm, onCancel]
  );

  // Close on clicking outside
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        resolve('kept');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, resolve]);

  return (
    <motion.div
      ref={containerRef}
      data-slot="delete-button"
      data-state={open ? 'open' : 'closed'}
      data-status={status}
      className={cn(
        'rare-delete-container',
        `size-${size}`,
        open && 'is-open',
        className
      )}
      style={style}
      animate={{ width: open ? sizeConfig.tile + sizeConfig.panel : sizeConfig.tile }}
      transition={timing(WIDTH)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) resolve('kept');
      }}
      {...props}
    >
      <motion.button
        ref={triggerRef}
        type="button"
        title={open ? 'Hủy' : title}
        aria-label={title}
        aria-expanded={open}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (disabled) return;
          if (open) return resolve('kept');
          setStatus('idle');
          setOpen(true);
        }}
        whileTap={reduced || disabled ? undefined : { scale: 0.92 }}
        transition={TAP}
        className="rare-delete-trigger"
      >
        <AnimatePresence mode="wait" initial={false}>
          {status === 'deleted' ? (
            <motion.svg
              key="done"
              {...ICON}
              width={sizeConfig.binSize}
              height={sizeConfig.binSize}
              stroke={accentColor}
              strokeWidth="2.5"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={timing(SWAP)}
            >
              <motion.path
                d="M4 12.5 9.5 18 20 7"
                initial={reduced ? undefined : { pathLength: 0 }}
                animate={reduced ? undefined : { pathLength: 1 }}
                transition={SETTLE}
              />
            </motion.svg>
          ) : (
            <motion.svg
              key="bin"
              {...ICON}
              width={sizeConfig.binSize}
              height={sizeConfig.binSize}
              stroke="currentColor"
              strokeWidth="2"
              className="overflow-visible"
              style={{ scale: settle }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={timing(SWAP)}
            >
              <motion.path d={bin} />
              <motion.g
                style={{ transformBox: 'view-box', transformOrigin: HINGE }}
                animate={{ rotate: open ? LID_OPEN : 0 }}
                transition={timing(LID)}
              >
                <path d="M3 6h18" />
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </motion.g>
            </motion.svg>
          )}
        </AnimatePresence>
      </motion.button>

      <span
        role="status"
        aria-live="polite"
        className="rare-delete-sr-only"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {status === 'deleted' ? 'Deleted' : status === 'kept' ? 'Kept' : ''}
      </span>

      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            style={{ width: sizeConfig.panel }}
            className="rare-delete-panel"
            variants={reduced ? undefined : panelMotion}
            initial="hidden"
            animate="shown"
            exit="hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <span aria-hidden="true" className="rare-delete-notch" />
            <Circle
              label="Xác nhận xóa"
              className="btn-confirm"
              sizeConfig={sizeConfig}
              onClick={() => resolve('deleted')}
            >
              <path d="M4 12.5 9.5 18 20 7" stroke="currentColor" />
            </Circle>
            <Circle
              label="Hủy thao tác"
              className="btn-cancel"
              sizeConfig={sizeConfig}
              onClick={() => resolve('kept')}
            >
              <path d="M6 6 18 18M18 6 6 18" stroke="currentColor" />
            </Circle>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default DeleteButton;
