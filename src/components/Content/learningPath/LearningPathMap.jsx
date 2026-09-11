import React, { useRef, useEffect } from 'react';
import CourseNodeItem from './CourseNodeItem';
import {
  animatePathReveal,
  animateCurrentPulse,
  killMotion,
  killUnlockSequence,
  playUnlockSequence,
} from '../../../utils/learningPathMotion';
import { useReducedMotion } from '../../../hooks/useReducedMotion';

export const LearningPathMap = ({
  nodes = [],
  segments = [],
  canvasWidth = 1024,
  canvasHeight = 400,
  isDesktop = true,
  currentCourseId = null,
  unlockTransition = null,
  onUnlockAnimationComplete,
  onSelectCourse,
  onLockedClick,
}) => {
  const reducedMotion = useReducedMotion();
  const mapContainerRef = useRef(null);
  const pathRefs = useRef({});
  const nodeRefs = useRef({});
  const pulseTweenRef = useRef(null);
  const lastUnlockRef = useRef(null);

  // Khởi chạy animation vẽ đường và nhịp thở của current node khi layout sẵn sàng
  useEffect(() => {
    const validPaths = Object.values(pathRefs.current).filter(Boolean);

    // 1. Vẽ đường reveal
    const revealTimeline = animatePathReveal(validPaths, reducedMotion);

    // 2. Pulse ring cho current node
    if (currentCourseId && nodeRefs.current[currentCourseId]) {
      const nodeEl = nodeRefs.current[currentCourseId];
      const ringEl = nodeEl.closest('.lp-node-wrapper')?.querySelector('.lp-current-pulse-ring');
      if (ringEl) {
        pulseTweenRef.current = animateCurrentPulse(ringEl, reducedMotion);
      }
    }

    return () => {
      if (revealTimeline) revealTimeline.kill();
      if (pulseTweenRef.current) pulseTweenRef.current.kill();
      killMotion(validPaths);
    };
  }, [segments, currentCourseId, reducedMotion]);

  useEffect(() => {
    if (!unlockTransition?.courseId || !unlockTransition?.unlockedCourseId) return undefined;

    const transitionKey = `${unlockTransition.courseId}:${unlockTransition.unlockedCourseId}:${
      unlockTransition.timestamp || ''
    }`;
    if (lastUnlockRef.current === transitionKey) return undefined;

    const completedNodeEl = nodeRefs.current[unlockTransition.courseId];
    const nextNodeEl = nodeRefs.current[unlockTransition.unlockedCourseId];
    const connectingSegment = segments.find(
      (segment) =>
        segment.fromId === unlockTransition.courseId &&
        segment.toId === unlockTransition.unlockedCourseId
    );
    const connectingPathEl = connectingSegment ? pathRefs.current[connectingSegment.id] : null;

    if (!completedNodeEl || !nextNodeEl) return undefined;

    lastUnlockRef.current = transitionKey;
    const timeline = playUnlockSequence({
      completedNodeEl,
      connectingPathEl,
      nextNodeEl,
      reducedMotion,
      onComplete: onUnlockAnimationComplete,
    });

    return () => killUnlockSequence(timeline);
  }, [unlockTransition, segments, reducedMotion, onUnlockAnimationComplete]);

  if (!nodes || nodes.length === 0) {
    return (
      <div className="lp-map-empty-state">
        <p>Lộ trình CCNA đang được cập nhật.</p>
      </div>
    );
  }

  return (
    <div
      ref={mapContainerRef}
      className={`lp-map-scroll-viewport ${isDesktop ? 'lp-desktop-scroll' : 'lp-mobile-scroll'}`}
    >
      <div
        className="lp-map-canvas"
        style={{
          width: `${canvasWidth}px`,
          height: `${canvasHeight}px`,
        }}
      >
        {/* Layer 1: SVG Track Beds và Progress Paths */}
        <svg
          className="lp-map-svg-layer"
          width={canvasWidth}
          height={canvasHeight}
          viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
          aria-hidden="true"
        >
          <defs>
            {/* Gradient cho đường hoàn thành */}
            <linearGradient id="lp-gradient-completed" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>

            {/* Gradient cho đường đang hoạt động */}
            <linearGradient id="lp-gradient-active" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#2563eb" />
            </linearGradient>
          </defs>

          {/* 1.1: Track Bed (nền đường xám rộng phía dưới) */}
          {segments.map((seg) => (
            <path key={`bed-${seg.id}`} d={seg.pathData} className="lp-svg-track-bed" />
          ))}

          {/* 1.2: Progress Stroke (đường tiến độ có màu sắc/nét đứt) */}
          {segments.map((seg) => (
            <path
              key={`prog-${seg.id}`}
              ref={(el) => {
                pathRefs.current[seg.id] = el;
              }}
              d={seg.pathData}
              className={`lp-svg-progress-path lp-svg-path-${seg.status}`}
            />
          ))}
        </svg>

        {/* Layer 2: HTML Course Nodes */}
        <div className="lp-map-nodes-layer">
          {nodes.map((node) => {
            const isCurrent = node.id === currentCourseId || node.status === 'current';
            const isCompleted = node.status === 'completed';
            const isLocked = node.status === 'locked';

            return (
              <CourseNodeItem
                key={node.id}
                ref={(el) => {
                  nodeRefs.current[node.id] = el;
                }}
                node={node}
                isCurrent={isCurrent}
                isCompleted={isCompleted}
                isLocked={isLocked}
                onSelectCourse={onSelectCourse}
                onLockedClick={onLockedClick}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LearningPathMap;
