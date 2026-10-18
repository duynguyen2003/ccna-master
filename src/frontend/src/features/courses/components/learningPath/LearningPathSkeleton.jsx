import React from 'react';

export const LearningPathSkeleton = ({ isDesktop = true }) => {
  return (
    <div className="lp-skeleton-wrapper" aria-busy="true" aria-label="Đang tải lộ trình học tập">
      {/* Stats Skeleton */}
      <div className="lp-stats-container lp-skeleton-stats">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="lp-stat-card lp-skeleton-card">
            <div className="lp-skeleton-circle" />
            <div className="lp-skeleton-text-group">
              <div className="lp-skeleton-line lp-skeleton-w40" />
              <div className="lp-skeleton-line lp-skeleton-w70" />
            </div>
          </div>
        ))}
      </div>

      {/* Map Canvas Skeleton */}
      <div className="lp-map-skeleton-container" style={{ height: isDesktop ? '420px' : '650px' }}>
        <div className="lp-skeleton-nodes-row">
          {[1, 2, 3].map((i) => (
            <div key={i} className="lp-skeleton-node-item">
              <div className="lp-skeleton-node-circle" />
              <div className="lp-skeleton-line lp-skeleton-w60" />
              <div className="lp-skeleton-line lp-skeleton-w80" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LearningPathSkeleton;
