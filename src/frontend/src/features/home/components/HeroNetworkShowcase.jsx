import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Network, TerminalSquare } from 'lucide-react';
import SlidingTabs from '../../../components/ui/SlidingTabs';
import { loadProtocolLesson } from '../../protocols/data/lessonCatalog';
import './HomeShowcase.css';

export default function HeroNetworkShowcase({ children, onCliOpen }) {
  const host = useRef(null);
  const [view, setView] = useState('simulation');
  const [inView, setInView] = useState(typeof IntersectionObserver === 'undefined');
  const [pageVisible, setPageVisible] = useState(document.visibilityState !== 'hidden');
  const [retry, setRetry] = useState(0);
  const [runtime, setRuntime] = useState({ status: 'idle', Component: null, lesson: null });
  const Demo = runtime.Component;
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const headerHeight = document.querySelector('header')?.getBoundingClientRect().height || 0;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio >= 0.12),
      { threshold: 0.12, rootMargin: `-${headerHeight}px 0px 0px 0px` }
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const update = () => setPageVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  useEffect(() => {
    if (!inView || Demo) return;
    let current = true;
    setRuntime({ status: 'loading', Component: null, lesson: null });
    Promise.all([import('./HomeProtocolDemo'), loadProtocolLesson('http')]).then(
      ([module, lesson]) => {
        if (current) setRuntime({ status: 'ready', Component: module.default, lesson });
      },
      () => {
        if (current) setRuntime({ status: 'error', Component: null, lesson: null });
      }
    );
    return () => {
      current = false;
    };
  }, [inView, retry, Demo]);
  return (
    <div className="landing-hero__visual home-network-showcase" ref={host}>
      <div className="home-showcase__head">
        <span className="home-showcase__identity">
          <Network size={16} aria-hidden="true" /> Học mạng trực quan
        </span>
        <SlidingTabs value={view} className="home-showcase__tabs" aria-label="Chọn bản xem thử">
          <button
            type="button"
            aria-pressed={view === 'simulation'}
            onClick={() => setView('simulation')}
          >
            <Network size={14} aria-hidden="true" /> Mô phỏng
          </button>
          <button
            type="button"
            aria-pressed={view === 'cli'}
            onClick={() => {
              setView('cli');
              onCliOpen?.();
            }}
          >
            <TerminalSquare size={14} aria-hidden="true" /> Thử CLI
          </button>
        </SlidingTabs>
      </div>
      <div hidden={view !== 'simulation'} className="home-showcase__simulation">
        {Demo ? (
          <Demo lesson={runtime.lesson} visible={view === 'simulation' && inView && pageVisible} />
        ) : (
          <div
            className="home-showcase__placeholder"
            role={runtime.status === 'error' ? 'alert' : 'status'}
          >
            <Network size={36} aria-hidden="true" />
            <strong>Khi bạn mở một trang web</strong>
            <p>
              {runtime.status === 'error'
                ? 'Chưa tải được bản xem thử.'
                : 'Đang chuẩn bị mô phỏng HTTP…'}
            </p>
            {runtime.status === 'error' && (
              <button type="button" onClick={() => setRetry((n) => n + 1)}>
                Thử lại mô phỏng
              </button>
            )}
          </div>
        )}
      </div>
      <div hidden={view !== 'cli'} className="home-showcase__cli">
        {children}
      </div>
      <Link
        className="home-showcase__more"
        to={view === 'simulation' ? '/protocols?protocol=http' : '/labs'}
      >
        {view === 'simulation' ? 'Tự khám phá từng sự kiện' : 'Mở một bài lab thực hành'}
        <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </div>
  );
}
