import React from 'react';
import { FileText, CheckCircle2, Users, Target } from 'lucide-react';

const ExamStats = ({ stats }) => {
  const cards = [
    {
      icon: <FileText size={20} />,
      value: stats.total,
      label: 'Tổng đề thi',
      mod: '',
      iconMod: ''
    },
    {
      icon: <CheckCircle2 size={20} />,
      value: stats.openCount,
      label: 'Đang mở',
      mod: 'is-open',
      iconMod: 'success'
    },
    {
      icon: <Users size={20} />,
      value: stats.totalAttempts,
      label: 'Tổng lượt thi',
      mod: '',
      iconMod: 'warning'
    },
    {
      icon: <Target size={20} />,
      value: `${stats.avgPassing}/100`,
      label: 'Điểm sàn TB',
      mod: '',
      iconMod: 'purple'
    },
  ];

  return (
    <div className="exam-hub-stats-grid">
      {cards.map(({ icon, value, label, mod, iconMod }) => (
        <div key={label} className={`exam-hub-stat-card ${mod}`}>
          <div className={`exam-hub-stat-icon ${iconMod}`}>{icon}</div>
          <div>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        </div>
      ))}
    </div>
  );
};
export default ExamStats;
