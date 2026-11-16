import React, { useEffect, useRef, useState } from 'react';
import { BotAvatar } from 'bot-avatars';
import '../styles/DroidAvatar.css';

export function assistantIsWorking(state) {
  return Boolean(
    state?.online &&
    !state?.error &&
    (state?.phase === 'sending' ||
      (state?.pending && ['QUEUED', 'RUNNING'].includes(state?.request?.status)))
  );
}

export default function DroidAvatar({
  busy = false,
  visible = true,
  animate = true,
  size = 28,
  decorative = false,
  appearance = 'droid',
  greeting = false,
  onActivate,
}) {
  const flower = appearance === 'flower';
  const host = useRef(null);
  const canvas = useRef(null);
  const forwardingClick = useRef(false);
  const [inView, setInView] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const update = () => {
      setReduced(Boolean(media?.matches));
      setPageVisible(document.visibilityState !== 'hidden');
    };
    update();
    media?.addEventListener?.('change', update);
    document.addEventListener('visibilitychange', update);
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    if (host.current) observer?.observe(host.current);
    return () => {
      media?.removeEventListener?.('change', update);
      document.removeEventListener('visibilitychange', update);
      observer?.disconnect();
    };
  }, []);
  const paused = !visible || !animate || !inView || !pageVisible || reduced;
  const actionable = Boolean(onActivate);
  useEffect(() => {
    const control = host.current?.closest('button');
    if (paused || !control) return undefined;
    const reactToActivation = (event) => {
      if (
        forwardingClick.current ||
        !canvas.current ||
        event.target.tagName === 'CANVAS' ||
        control.matches(':disabled')
      )
        return;
      // Forward a button's pointer/keyboard click through the library's public
      // canvas handler; the nested click must not run the button action twice.
      forwardingClick.current = true;
      try {
        canvas.current.click();
      } finally {
        forwardingClick.current = false;
      }
    };
    control.addEventListener('click', reactToActivation);
    return () => control.removeEventListener('click', reactToActivation);
  }, [paused, actionable]);
  const state = busy ? 'working' : 'default';
  const Host = actionable ? 'button' : 'span';
  const canvasAvailable =
    typeof window !== 'undefined' && typeof window.CanvasRenderingContext2D !== 'undefined';
  return (
    <Host
      ref={host}
      className="ai-droid"
      type={actionable ? 'button' : undefined}
      onClick={onActivate}
      title={actionable ? 'Đặt câu hỏi cho Trợ lý AI' : undefined}
      style={{ width: size, height: size }}
      data-state={state}
      data-appearance={flower ? 'flower' : 'droid'}
      data-greeting={greeting ? 'true' : undefined}
      data-paused={paused ? 'true' : 'false'}
      data-interactive={paused ? 'false' : 'true'}
      role={actionable || decorative ? undefined : 'img'}
      aria-hidden={!actionable && decorative ? 'true' : undefined}
      aria-label={
        actionable
          ? 'Đặt câu hỏi cho Trợ lý AI'
          : decorative
            ? undefined
            : busy
              ? 'Trợ lý AI đang xử lý'
              : 'Trợ lý AI sẵn sàng'
      }
    >
      <span aria-hidden="true">
        {canvasAvailable ? (
          <BotAvatar
            ref={canvas}
            type={flower ? 'flower' : 'droid'}
            state={state}
            size={size}
            color={flower ? '#2FCB7A' : '#386298'}
            shading={flower ? 'fabric' : greeting ? 'plastic' : 'crisp'}
            speed={greeting ? 1 : 0.55}
            turn={greeting ? 1 : 0.2}
            jumpEvery={greeting ? 4 : 0}
            jumpHeight={greeting ? 22 : 12}
            jumpTime={0.5}
            jumpSpin={greeting ? 0.18 : 0.25}
            jumpLean={3}
            jumpClickSquashTime={0.16}
            interactive={!paused}
            paused={paused}
            onClick={(event) => {
              if (forwardingClick.current) event.stopPropagation();
            }}
          />
        ) : flower ? (
          <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
            <path
              fill="#2FCB7A"
              d="M31.2 19.82A20.5 20.5 0 0 1 68.8 19.82A5 5 0 0 0 72.9 22.8A20.5 20.5 0 0 1 84.51 58.55A5 5 0 0 0 82.95 63.37A20.5 20.5 0 0 1 52.54 85.47A5 5 0 0 0 47.46 85.47A20.5 20.5 0 0 1 17.05 63.37A5 5 0 0 0 15.49 58.55A20.5 20.5 0 0 1 27.1 22.8A5 5 0 0 0 31.2 19.82Z"
            />
            <path d="M39 46v10m21-10v10" stroke="#102d21" strokeWidth="7" strokeLinecap="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
            <path
              d="M16 3v4M7 12H4v10h3m18-10h3v10h-3"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
            <rect x="7" y="7" width="18" height="20" rx="7" fill="currentColor" />
            <rect x="10" y="12" width="12" height="9" rx="4" fill="var(--surface-primary, white)" />
            <path d="M13 15v3m6-3v3" stroke="currentColor" strokeWidth="2" />
          </svg>
        )}
      </span>
    </Host>
  );
}
