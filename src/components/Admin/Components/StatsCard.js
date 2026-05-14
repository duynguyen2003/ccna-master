// src/components/Admin/Components/StatsCard.js
import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import MiniSparkline from '../Charts/MiniSparkline';
import { DASHBOARD_COLORS } from '../../../config/dashboardConfig';

const StatsCard = ({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  trendValue, 
  sparkData, 
  colorName = 'blue',
  loading = false 
}) => {
  const color = DASHBOARD_COLORS[colorName] || DASHBOARD_COLORS.blue;

  if (loading) {
    return (
      <div className="admin-stats-card">
        <div className="admin-stats-card-header">
          <div className="admin-stats-info">
            <div className="skeleton" style={{ width: '80px', height: '14px', marginBottom: '8px' }}></div>
            <div className="skeleton" style={{ width: '120px', height: '32px' }}></div>
          </div>
          <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '12px' }}></div>
        </div>
        <div className="admin-stats-card-footer">
          <div className="skeleton" style={{ width: '60px', height: '16px' }}></div>
          <div className="skeleton" style={{ width: '80px', height: '30px' }}></div>
        </div>
      </div>
    );
  }

  const renderTrend = () => {
    if (trend === 'up') return <span className="admin-stats-trend up"><TrendingUp size={14} /> {trendValue}</span>;
    if (trend === 'down') return <span className="admin-stats-trend down"><TrendingDown size={14} /> {trendValue}</span>;
    return <span className="admin-stats-trend neutral"><Minus size={14} /> {trendValue || '0%'}</span>;
  };

  return (
    <div className="admin-stats-card">
      <div className="admin-stats-card-header">
        <div className="admin-stats-info">
          <h3>{title}</h3>
          <p>{typeof value === 'number' ? value.toLocaleString('vi-VN') : value}</p>
        </div>
        <div className="admin-stats-icon-container" style={{ 
          backgroundColor: `${color}15`, 
          color: color,
          padding: '10px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Icon size={22} />
        </div>
      </div>
      
      <div className="admin-stats-card-footer">
        {renderTrend()}
        <MiniSparkline data={sparkData} color={color} />
      </div>
    </div>
  );
};

export default StatsCard;
