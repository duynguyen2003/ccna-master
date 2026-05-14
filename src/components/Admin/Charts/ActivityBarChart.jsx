// src/components/Admin/Charts/ActivityBarChart.jsx
import React from 'react';
import { BarChart2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';

const ActivityBarChart = ({ data, loading = false }) => {
  if (loading) {
    return <div className="skeleton" style={{ width: '100%', height: '300px' }}></div>;
  }

  if (!data || data.length === 0 || data.every(d => d.value === 0)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, color: '#94a3b8', gap: '8px' }}>
        <BarChart2 size={32} strokeWidth={1.5} />
        <p style={{ fontSize: '13px', margin: 0 }}>Chưa có dữ liệu học tập trong 7 ngày qua</p>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value));

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: '#f1f5f9' }}
            contentStyle={{
              borderRadius: '8px',
              border: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              fontSize: '13px'
            }}
            formatter={(value) => [`${value} học viên`, 'Hoạt động']}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={50}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.value === maxValue ? '#3b82f6' : '#bfdbfe'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ActivityBarChart;
