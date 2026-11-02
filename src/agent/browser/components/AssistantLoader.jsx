import React, { Component, useEffect, useState } from 'react';
import useMobile from '../hooks/useMobile.js';
import AiIcon from './AiIcon.jsx';
import '../styles/AssistantLoader.css';

export function AssistantClock() {
  return (
    <div className="ai-assistant-loading-indicator" aria-hidden="true">
      <div className="ld-clock" />
    </div>
  );
}

class PanelBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

// Import failures/timeouts belong to the UI loader, independently of request polling.
export default function AssistantLoader({
  load,
  children,
  onClose,
  timeoutMs = 12000,
  Dialog,
  theme = 'dark',
}) {
  const mobile = useMobile();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ phase: 'loading', Panel: null });
  useEffect(() => {
    let current = true;
    setState({ phase: 'loading', Panel: null });
    const fail = () => {
      if (!current) return;
      current = false;
      setState({ phase: 'error', Panel: null });
    };
    const timer = window.setTimeout(fail, timeoutMs);
    Promise.resolve()
      .then(load)
      .then((module) => {
        if (!current) return;
        if (!module?.default) {
          fail();
          return;
        }
        window.clearTimeout(timer);
        setState({ phase: 'ready', Panel: module.default });
      }, fail);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [load, attempt, timeoutMs]);
  const fallback = (failed) => (
    <aside className="cli-ai-loading" aria-label="Trợ lý AI">
      <header>
        <h3>Trợ lý AI</h3>
        <button
          type="button"
          className="cli-lab-button cli-lab-button--tertiary"
          onClick={onClose}
          aria-label="Đóng trợ lý AI"
        >
          Đóng
        </button>
      </header>
      <div
        role={failed ? 'alert' : 'status'}
        className={failed ? undefined : 'ai-assistant-loading-status'}
      >
        {failed ? 'Chưa tải được trợ lý. Kiểm tra kết nối rồi thử lại.' : 'Đang tải trợ lý…'}
      </div>
      {failed ? (
        <button
          type="button"
          className="cli-lab-button cli-lab-button--secondary cli-ai-retry"
          aria-label="Thử lại"
          title="Thử lại"
          onClick={() => {
            setState({ phase: 'loading', Panel: null });
            setAttempt((value) => value + 1);
          }}
        >
          <AiIcon name="replay" />
        </button>
      ) : (
        <AssistantClock />
      )}
    </aside>
  );
  const errorFallback = fallback(true);
  const wrap = (content) =>
    mobile && Dialog ? (
      <Dialog
        title="Trợ lý AI"
        className={`ai-assistant-loading-dialog cli-lab-editor cli-lab-stitch cli-lab-stitch--${theme}${theme === 'dark' ? ' is-dark' : ''}`}
        onClose={onClose}
      >
        {content}
      </Dialog>
    ) : (
      content
    );
  if (state.phase !== 'ready') return wrap(fallback(state.phase === 'error'));
  return (
    <PanelBoundary key={attempt} fallback={wrap(errorFallback)}>
      {children(state.Panel)}
    </PanelBoundary>
  );
}
