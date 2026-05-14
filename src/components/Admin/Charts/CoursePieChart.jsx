// src/components/Admin/Charts/CoursePieChart.jsx
import React from 'react';
import { PieChart as PieIcon } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ef4444'];

const CoursePieChart = ({ data, loading = false }) => {
  if (loading) {
    return <div className="skeleton" style={{ width: '100%', height: '120px' }}></div>;
  }

  const hasData = data && data.length > 0 && data.some(d => d.value > 0);

  if (!hasData) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 100, color: '#94a3b8', gap: '12px' }}>
        <PieIcon size={24} strokeWidth={1.5} />
        <p style={{ fontSize: '12px', margin: 0 }}>Chưa có dữ liệu</p>
      </div>
    );
  }

  const chartData = data.map((item, i) => ({
    ...item,
    color: item.color || COLORS[i % COLORS.length]
  }));

  return (
    <div className="donut-wrap">
      {/* Cố định kích thước để tránh donut bị phình to */}
      <PieChart width={90} height={90}>
        <Pie
          data={chartData}
          cx={40}
          cy={40}
          innerRadius={28}
          outerRadius={42}
          paddingAngle={2}
          dataKey="value"
          stroke="none"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip 
          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '11px' }}
          formatter={(v, n) => [`${v} HV`, n]} 
        />
      </PieChart>

      <div className="donut-legend">
        {chartData.map((c) => (
          <div key={c.name} className="legend-row">
            <span className="legend-dot" style={{ background: c.color }} />
            <span className="legend-name" title={c.name}>{c.name}</span>
            <span className="legend-val">{c.value} HV</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CoursePieChart;
