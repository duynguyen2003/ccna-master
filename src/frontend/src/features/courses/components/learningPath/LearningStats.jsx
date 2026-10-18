import React from 'react';
import { Flame, Zap, Award, CheckCircle2 } from 'lucide-react';

export const LearningStats = ({ stats = {} }) => {
  const streakDays = stats.streakDays ?? 0;
  const xp = stats.xp ?? 0;
  const badges = stats.badges ?? 0;
  const overallProgress = stats.overallProgress ?? 0;

  return (
    <div className="lp-stats-container" role="region" aria-label="Thống kê học tập">
      <div className="lp-stat-card lp-stat-streak">
        <div className="lp-stat-icon-wrapper lp-icon-streak">
          <Flame size={22} className="lp-stat-icon" aria-hidden="true" />
        </div>
        <div className="lp-stat-info">
          <span className="lp-stat-value">{streakDays}</span>
          <span className="lp-stat-label">Ngày liên tiếp</span>
        </div>
      </div>

      <div className="lp-stat-card lp-stat-xp">
        <div className="lp-stat-icon-wrapper lp-icon-xp">
          <Zap size={22} className="lp-stat-icon" aria-hidden="true" />
        </div>
        <div className="lp-stat-info">
          <span className="lp-stat-value">{xp.toLocaleString('vi-VN')}</span>
          <span className="lp-stat-label">Điểm XP</span>
        </div>
      </div>

      <div className="lp-stat-card lp-stat-badges">
        <div className="lp-stat-icon-wrapper lp-icon-badges">
          <Award size={22} className="lp-stat-icon" aria-hidden="true" />
        </div>
        <div className="lp-stat-info">
          <span className="lp-stat-value">{badges}</span>
          <span className="lp-stat-label">Huy hiệu đạt được</span>
        </div>
      </div>

      <div className="lp-stat-card lp-stat-progress">
        <div className="lp-stat-icon-wrapper lp-icon-progress">
          <CheckCircle2 size={22} className="lp-stat-icon" aria-hidden="true" />
        </div>
        <div className="lp-stat-info lp-stat-progress-info">
          <div className="lp-stat-progress-header">
            <span className="lp-stat-label">Tiến độ CCNA</span>
            <span className="lp-stat-value">{overallProgress}%</span>
          </div>
          <div
            className="lp-progress-bar-track"
            role="progressbar"
            aria-valuenow={overallProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Tiến độ lộ trình toàn khóa"
          >
            <div className="lp-progress-bar-fill" style={{ width: `${overallProgress}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LearningStats;
