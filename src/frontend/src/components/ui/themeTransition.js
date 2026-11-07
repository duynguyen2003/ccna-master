import { flushSync } from 'react-dom';
import './styles/ThemeTransition.css';

// Protocol Explorer's uo(): button-centred reveal, 650 ms, same easing.
// Only one root transition can own the page, including local lab theme changes.
let active;

export function runThemeTransition(update, origin, nextTheme) {
  active?.stop(true);
  const root = document.documentElement;
  const trigger = origin?.currentTarget || origin;
  let committed = false;
  const commit = () => {
    if (committed) return;
    committed = true;
    flushSync(update);
  };
  const rect = trigger?.getBoundingClientRect?.() || {
    left: window.innerWidth / 2,
    top: window.innerHeight / 2,
    width: 0,
    height: 0,
  };
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const radius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );
  let transition;
  let animation;
  let overlay;
  let timer;
  let frame;
  let fallbackStarted = false;
  const finish = () => {
    clearTimeout(timer);
    cancelAnimationFrame(frame);
    overlay?.remove();
    if (active === owner) {
      active = undefined;
      root.classList.remove('netmaster-theme-transition');
    }
  };
  const owner = {
    stop(applyPending = false) {
      if (applyPending) commit();
      committed = true;
      animation?.cancel();
      transition?.skipTransition?.();
      finish();
    },
  };
  const fallback = () => {
    if (active !== owner || fallbackStarted) return;
    fallbackStarted = true;
    transition?.skipTransition?.();
    overlay = document.createElement('div');
    overlay.className = 'netmaster-theme-reveal';
    overlay.setAttribute('aria-hidden', 'true');
    Object.assign(overlay.style, {
      background: nextTheme === 'dark' ? '#0b1020' : '#fdfdfe',
      clipPath: `circle(0px at ${x}px ${y}px)`,
    });
    document.body.appendChild(overlay);
    // Establish the initial clip before the next frame changes its transition target.
    overlay.getBoundingClientRect();
    const reveal = () => {
      if (active !== owner) return;
      commit();
      overlay.style.setProperty('transition', 'opacity 150ms ease', 'important');
      overlay.style.opacity = '0';
      timer = setTimeout(finish, 150);
    };
    frame = requestAnimationFrame(() => {
      overlay.style.setProperty(
        'transition',
        'clip-path 650ms cubic-bezier(0.16, 1, 0.3, 1)',
        'important'
      );
      overlay.style.clipPath = `circle(${radius}px at ${x}px ${y}px)`;
      timer = setTimeout(reveal, 650);
    });
  };
  active = owner;
  root.classList.add('netmaster-theme-transition');
  if (!document.startViewTransition) {
    fallback();
    return () => owner.stop();
  }
  try {
    transition = document.startViewTransition(commit);
    Promise.resolve(transition.ready).then(() => {
      if (active !== owner) return;
      try {
        animation = root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          {
            duration: 650,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            pseudoElement: '::view-transition-new(root)',
          }
        );
      } catch {
        fallback();
      }
    }, fallback);
    Promise.resolve(transition.finished).then(() => {
      if (!fallbackStarted) finish();
    }, fallback);
  } catch {
    fallback();
  }
  return () => owner.stop();
}
