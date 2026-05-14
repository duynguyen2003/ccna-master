// src/components/Admin/Charts/MiniSparkline.jsx
import React from 'react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';

const MiniSparkline = ({ data, color = '#3b82f6' }) => {
  const chartData = React.useMemo(() => {
    // Nếu không có dữ liệu, trả về một mảng số 0 để đường kẻ nằm phẳng ở đáy
    if (!data || data.length === 0) {
      return Array(7).fill({ value: 0 });
    }
    // Chuyển đổi mảng số đơn giản sang định dạng Recharts yêu cầu
    return data.map(v => typeof v === 'object' ? v : { value: v });
  }, [data]);

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
