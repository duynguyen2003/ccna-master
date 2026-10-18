import React, { forwardRef } from 'react';
import { Globe, Layers, Server, ShieldCheck, Cpu, Lock, Check, Play } from 'lucide-react';

const ICON_COMPONENTS = {
  network: Globe,
  switching: Layers,
  enterprise: Server,
  security: ShieldCheck,
  automation: Cpu,
};

export const CourseNodeItem = forwardRef(
  (
    {
      node,
      isCurrent = false,
      isCompleted = false,
      isLocked = false,
      onSelectCourse,
      onLockedClick,
    },
    ref
  ) => {
    const IconComponent = ICON_COMPONENTS[node.iconType] || Globe;
    const progressPercent = node.progressPercent || 0;
    const nodeSize = node.nodeSize || 72;

    // Tính toán vòng tròn tiến độ SVG bao quanh node
    const strokeWidth = 4;
    const radius = (nodeSize - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

    const handleClick = (e) => {
      e.currentTarget.blur();
      if (isLocked) {
        if (typeof onLockedClick === 'function') {
          onLockedClick(node);
        } else if (typeof onSelectCourse === 'function') {
          onSelectCourse(node);
        }
        return;
      }
      if (typeof onSelectCourse === 'function') {
        onSelectCourse(node);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick(e);
      }
    };

    let statusText = 'Chưa mở';
    if (isCompleted) statusText = 'Đã hoàn thành';
    else if (isCurrent) statusText = 'Đang học';

    const accessibleLabel = `${node.code || 'Khóa học'}: ${node.title}, ${statusText}, tiến độ ${progressPercent}%${
      isLocked && node.lockedReason ? `. Lý do khóa: ${node.lockedReason}` : ''
    }`;

    return (
      <div
        className={`lp-node-wrapper lp-node-${node.status} ${isCurrent ? 'lp-node-is-current' : ''}`}
        style={{
          left: `${node.x}px`,
          top: `${node.y}px`,
          width: `${nodeSize}px`,
          height: `${nodeSize}px`,
        }}
      >
        {/* Pulsing ring cho current node */}
        {isCurrent && <div className="lp-current-pulse-ring" aria-hidden="true" />}

        {/* Nút node tương tác chính */}
        <button
          ref={ref}
          type="button"
          className={`lp-node-button lp-node-btn-${node.status}`}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          aria-label={accessibleLabel}
          aria-disabled={isLocked}
          tabIndex={0}
          style={{ width: `${nodeSize}px`, height: `${nodeSize}px` }}
        >
          {/* Vòng tròn tiến độ SVG */}
          <svg
            className="lp-node-progress-svg"
            width={nodeSize}
            height={nodeSize}
            aria-hidden="true"
          >
            <circle
              className="lp-node-progress-track"
              cx={nodeSize / 2}
              cy={nodeSize / 2}
              r={radius}
              strokeWidth={strokeWidth}
            />
            <circle
              className="lp-node-progress-indicator"
              cx={nodeSize / 2}
              cy={nodeSize / 2}
              r={radius}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </svg>

          {/* Icon trung tâm của Node */}
          <div className="lp-node-center-icon" aria-hidden="true">
            <IconComponent size={nodeSize > 60 ? 28 : 22} />
          </div>

          {/* Badge biểu thị trạng thái ở góc node */}
          <div className={`lp-node-badge lp-badge-${node.status}`} aria-hidden="true">
            {isCompleted && <Check size={13} strokeWidth={3} />}
            {isCurrent && <Play size={11} fill="currentColor" />}
            {isLocked && <Lock size={12} strokeWidth={2.5} />}
          </div>
        </button>

        {/* Nhãn mô tả thông tin Node */}
        <div
          className={`lp-node-label-container lp-label-${node.labelPlacement}`}
          onClick={handleClick}
          aria-hidden="true"
        >
          <div className="lp-label-code-row">
            <span className="lp-label-code">{node.code}</span>
            {isCompleted && <span className="lp-label-pill lp-pill-completed">✓ Xong</span>}
            {isCurrent && <span className="lp-label-pill lp-pill-current">Đang học</span>}
            {isLocked && <span className="lp-label-pill lp-pill-locked">Khóa</span>}
          </div>
          <span className="lp-label-title">{node.title}</span>
          <div className="lp-label-progress-row">
            <span className="lp-label-progress-text">{progressPercent}% hoàn thành</span>
          </div>
        </div>
      </div>
    );
  }
);

CourseNodeItem.displayName = 'CourseNodeItem';
export default CourseNodeItem;
