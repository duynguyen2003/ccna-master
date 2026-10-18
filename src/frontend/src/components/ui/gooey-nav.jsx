import React, { useEffect, useId, useState, useMemo, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { cn } from '../../lib/utils';
import './gooey-nav.css';

// Damped spring so items separate and dock smoothly without overshoot
const SPRING = { type: 'spring', stiffness: 220, damping: 26, mass: 1 };

// The neck has thinned to nothing by the time the gap is this far open
const NECK_BREAK = 0.22;

// Nominal viewBox dimension; the SVG stretches via preserveAspectRatio="none"
const NECK_H = 100;
const NECK_W = 100;

const SIZES = {
  xs: {
    radius: 8,
    separation: 12,
  },
  sm: {
    radius: 10,
    separation: 14,
  },
  md: {
    radius: 14,
    separation: 18,
  },
  lg: {
    radius: 16,
    separation: 22,
  },
};

// SVG curve path for horizontal orientation
function horizontalNeckPath(gap, span) {
  if (!Number.isFinite(gap) || !Number.isFinite(span) || gap <= 0 || span <= 0) {
    return '';
  }
  const waist = NECK_H * (1 - gap / (span * NECK_BREAK));
  if (waist <= 0) return '';
  const start = span - gap;
  const mid = start + gap / 2;
  return `M${start} 0 Q${mid} ${NECK_H - waist} ${span} 0 L${span} ${NECK_H} Q${mid} ${waist} ${start} ${NECK_H} Z`;
}

// SVG curve path for vertical orientation
function verticalNeckPath(gap, span) {
  if (!Number.isFinite(gap) || !Number.isFinite(span) || gap <= 0 || span <= 0) {
    return '';
  }
  const waist = NECK_W * (1 - gap / (span * NECK_BREAK));
  if (waist <= 0) return '';
  const start = span - gap;
  const mid = start + gap / 2;
  return `M0 ${start} Q${NECK_W - waist} ${mid} 0 ${span} L${NECK_W} ${span} Q${waist} ${mid} ${NECK_W} ${start} Z`;
}

function Segment({
  gap,
  span,
  hasSeam,
  leftFill,
  rightFill,
  reduced,
  radii,
  isVertical,
  className,
  style,
  children,
}) {
  const marginSpring = useSpring(gap, SPRING);
  const rawId = useId();
  const gradientId = `gooey-neck-${rawId.replace(/:/g, '')}`;

  useEffect(() => {
    if (reduced) {
      marginSpring.jump(gap);
    } else {
      marginSpring.set(gap);
    }
  }, [gap, marginSpring, reduced]);

  const d = useTransform(marginSpring, (g) =>
    isVertical ? verticalNeckPath(g, span) : horizontalNeckPath(g, span)
  );

  const marginStyle = isVertical
    ? { marginTop: marginSpring, marginLeft: 0 }
    : { marginLeft: marginSpring, marginTop: 0 };

  return (
    <motion.li
      data-slot="gooey-nav-segment"
      className={cn('gooey-nav-segment', className)}
      style={{ ...style, ...marginStyle }}
      initial={false}
      animate={radii}
      transition={reduced ? { duration: 0 } : SPRING}
    >
      {hasSeam && (
        <svg
          aria-hidden="true"
          preserveAspectRatio="none"
          className={cn(
            'gooey-nav-seam-svg',
            isVertical ? 'gooey-nav-seam-v' : 'gooey-nav-seam-h'
          )}
          viewBox={isVertical ? `0 0 ${NECK_W} ${span}` : `0 0 ${span} ${NECK_H}`}
          style={
            isVertical
              ? { height: `${span}px`, width: '100%' }
              : { width: `${span}px`, height: '100%' }
          }
        >
          <defs>
            <linearGradient
              id={gradientId}
              x1="0"
              y1="0"
              x2={isVertical ? '0' : '1'}
              y2={isVertical ? '1' : '0'}
            >
              <stop offset="0" stopColor={leftFill} />
              <stop offset="1" stopColor={rightFill} />
            </linearGradient>
          </defs>
          <motion.path d={d} fill={`url(#${gradientId})`} />
        </svg>
      )}
      {children}
    </motion.li>
  );
}

function NavLabel({
  label,
  href,
  icon,
  isActive,
  itemLayout,
  activeLabelColor,
  inactiveLabelColor,
  onSelect,
}) {
  const isStacked = itemLayout === 'stacked';

  const content = (
    <>
      {icon && <span className="gooey-nav-icon">{icon}</span>}
      {label && <span className="gooey-nav-label-text">{label}</span>}
    </>
  );

  const className = cn(
    'gooey-nav-item-link',
    isStacked ? 'gooey-nav-item-stacked' : 'gooey-nav-item-inline',
    isActive ? 'is-active' : 'is-inactive'
  );

  const style = {
    color: isActive ? activeLabelColor : inactiveLabelColor,
  };

  const sharedProps = {
    'data-slot': 'gooey-nav-item',
    'data-active': isActive,
    'aria-current': isActive ? (href ? 'page' : true) : undefined,
    className,
    style,
    onClick: onSelect,
  };

  return href ? (
    <Link to={href} {...sharedProps}>
      {content}
    </Link>
  ) : (
    <button type="button" {...sharedProps}>
      {content}
    </button>
  );
}

const toItem = (item) => (typeof item === 'string' ? { label: item } : item);

export function GooeyNav({
  items = [],
  value,
  defaultValue = 0,
  onChange,
  size = 'md',
  orientation = 'auto',
  itemLayout = 'stacked',
  activeColor = '#2563eb',
  activeLabelColor = '#ffffff',
  barColor = '#f1f5f9',
  inactiveLabelColor = '#64748b',
  separation,
  radius,
  className,
  ...props
}) {
  const location = useLocation();
  const pathname = location?.pathname || '';
  const reduced = useReducedMotion() ?? false;

  // Responsive mobile detection for 'auto' orientation
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia ? window.matchMedia('(max-width: 768px)').matches : window.innerWidth <= 768;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(max-width: 768px)');
    const handleMediaChange = (e) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener('change', handleMediaChange);
    return () => mql.removeEventListener('change', handleMediaChange);
  }, []);

  const isVertical =
    orientation === 'auto' ? !isMobile : orientation === 'vertical';

  // Determine which route matches current pathname
  const routeIndex = useMemo(() => {
    return items.findIndex((item) => {
      const navItem = toItem(item);
      if (typeof navItem.isActive === 'function') {
        return navItem.isActive(pathname);
      }
      if (navItem.href) {
        return navItem.href === pathname;
      }
      return false;
    });
  }, [items, pathname]);

  const [uncontrolled, setUncontrolled] = useState(() =>
    routeIndex === -1 ? defaultValue : routeIndex
  );
  const [seenRoute, setSeenRoute] = useState(routeIndex);

  if (routeIndex !== seenRoute) {
    setSeenRoute(routeIndex);
    if (routeIndex !== -1 && value === undefined) {
      setUncontrolled(routeIndex);
    }
  }

  const active = value !== undefined ? value : uncontrolled;
  const span = separation !== undefined
    ? (isMobile ? Math.min(separation, 14) : separation)
    : (isMobile ? (SIZES[size]?.separation ?? 14) : (SIZES[size]?.separation ?? 18));
  const corner = radius !== undefined
    ? (isMobile ? Math.min(radius, 12) : radius)
    : (isMobile ? (SIZES[size]?.radius ?? 10) : (SIZES[size]?.radius ?? 14));

  const open = useCallback(
    (seam) =>
      seam === 0 ||
      seam === items.length ||
      seam - 1 === active ||
      seam === active,
    [items.length, active]
  );

  const fill = useCallback(
    (i) => (i === active ? activeColor : barColor),
    [active, activeColor, barColor]
  );

  return (
    <nav
      data-slot="gooey-nav"
      className={cn('gooey-nav-container', className)}
      {...props}
    >
      <ul
        key={isVertical ? 'vertical' : 'horizontal'}
        className={cn(
          'gooey-nav-list',
          isVertical ? 'orientation-vertical' : 'orientation-horizontal'
        )}
      >
        {items.map((item, i) => {
          const navItem = toItem(item);
          const isActive = i === active;

          // Corner radii logic
          const radii = isVertical
            ? {
                borderTopLeftRadius: open(i) ? corner : 0,
                borderTopRightRadius: open(i) ? corner : 0,
                borderBottomLeftRadius: open(i + 1) ? corner : 0,
                borderBottomRightRadius: open(i + 1) ? corner : 0,
              }
            : {
                borderTopLeftRadius: open(i) ? corner : 0,
                borderBottomLeftRadius: open(i) ? corner : 0,
                borderTopRightRadius: open(i + 1) ? corner : 0,
                borderBottomRightRadius: open(i + 1) ? corner : 0,
              };

          return (
            <Segment
              key={`${i}-${navItem.label}`}
              // Closed seams pull in 1px to avoid hairline artifacts
              gap={i === 0 ? 0 : open(i) ? span : -1}
              span={span}
              hasSeam={i > 0}
              leftFill={fill(i - 1)}
              rightFill={fill(i)}
              reduced={reduced}
              radii={radii}
              isVertical={isVertical}
              className={cn(
                isActive ? 'is-active' : 'is-inactive'
              )}
              style={{
                backgroundColor: isActive ? activeColor : barColor,
                boxShadow: isActive
                  ? '0 6px 16px -2px rgba(37, 99, 235, 0.35)'
                  : 'none',
              }}
            >
              <NavLabel
                {...navItem}
                isActive={isActive}
                itemLayout={itemLayout}
                activeLabelColor={activeLabelColor}
                inactiveLabelColor={inactiveLabelColor}
                onSelect={() => {
                  if (value === undefined) setUncontrolled(i);
                  onChange?.(i);
                }}
              />
            </Segment>
          );
        })}
      </ul>
    </nav>
  );
}

export default GooeyNav;
