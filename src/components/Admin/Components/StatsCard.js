// src/components/Admin/Components/StatsCard.js
import React, { useMemo, useRef } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import MiniSparkline from '../Charts/MiniSparkline';
import { DASHBOARD_COLORS } from '../../../config/dashboardConfig';
import { gsap, useGSAP } from '../../../utils/adminMotion';

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
  const valueRef = useRef(null);
  const color = DASHBOARD_COLORS[colorName] || DASHBOARD_COLORS.blue;
  const animatedValue = useMemo(() => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return { number: value, suffix: '' };
    }

    if (typeof value === 'string') {
      const match = value.trim().match(/^(-?\d+(?:\.\d+)?)(%)?$/);
      if (match) {
        return { number: Number(match[1]), suffix: match[2] || '' };
      }
    }

    return null;
  }, [value]);

  useGSAP(() => {
    if (loading || !animatedValue || !valueRef.current) return undefined;

    const media = gsap.matchMedia();
    const formatValue = (currentValue) => (
      `${Math.round(currentValue).toLocaleString('vi-VN')}${animatedValue.suffix}`
    );

    media.add({
      reduceMotion: '(prefers-reduced-motion: reduce)',
      allowMotion: '(prefers-reduced-motion: no-preference)'
    }, ({ conditions }) => {
      if (conditions.reduceMotion) {
        valueRef.current.textContent = formatValue(animatedValue.number);
        return undefined;
      }

      const counter = { current: 0 };
      gsap.to(counter, {
        current: animatedValue.number,
        duration: 0.8,
        ease: 'power2.out',
        onUpdate: () => {
          if (valueRef.current) {
            valueRef.current.textContent = formatValue(counter.current);
          }
        }
      });

      return undefined;
    });

    return () => media.revert();
  }, {
    dependencies: [animatedValue, loading],
    revertOnUpdate: true
  });

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
          <p ref={valueRef}>{typeof value === 'number' ? value.toLocaleString('vi-VN') : value}</p>
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
