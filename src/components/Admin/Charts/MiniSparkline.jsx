// src/components/Admin/Charts/MiniSparkline.jsx
import React from 'react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';

const MiniSparkline = ({ data, color = '#3b82f6' }) => {
  // Default mock data if none provided
  const chartData = data || [
    { value: 30 }, { value: 40 }, { value: 35 }, 
    { value: 50 }, { value: 45 }, { value: 60 }, { value: 55 }
  ];

  return (
    <div className="admin-stats-sparkline">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id={`gradient-${color}`} x1="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fillOpacity={1}
            fill={`url(#gradient-${color})`}
            isAnimationActive={true}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MiniSparkline;
