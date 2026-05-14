// src/components/Admin/Components/PlanLimitsInfo.jsx
import React from 'react';
import { FREE_PLAN } from '../../../config/dashboardConfig';

const PlanLimitsInfo = ({ stats, loading = false }) => {
  const limits = [
    { 
      label: 'Học viên', 
      current: stats?.totalUsers || 0, 
      max: FREE_PLAN.max_students, 
      unit: '',
      color: '#f59e0b'
    },
    { 
      label: 'Khóa học', 
      current: stats?.totalCourses || 0, 
      max: FREE_PLAN.max_courses, 
      unit: '',
      color: '#3b82f6'
    },
    { 
      label: 'Dung lượng', 
      current: stats?.storageUsed || 150, 
      max: FREE_PLAN.max_storage_mb, 
      unit: 'MB',
      color: '#22c55e'
    },
  ];

  if (loading) {
    return (
      <div className="progress-list">
        {[1, 2, 3].map(i => (
          <div key={i} className="progress-item">
            <div className="skeleton" style={{ width: '100%', height: '40px' }}></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="progress-list">
      {limits.map((item, index) => {
        const percent = Math.min(Math.round((item.current / item.max) * 100), 100);
        return (
          <div key={index} className="progress-item">
            <div className="progress-item-header">
              <span>{item.label}</span>
              <span style={{ color: item.color }}>{percent}%</span>
            </div>
            <div className="progress-bar-bg">
              <div 
                className="progress-bar-fill" 
                style={{ width: `${percent}%`, backgroundColor: item.color }}
              ></div>
            </div>
            <div className="progress-item-footer">
              <span>{item.current} {item.unit}</span>
              <span>Giới hạn: {item.max} {item.unit}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PlanLimitsInfo;
