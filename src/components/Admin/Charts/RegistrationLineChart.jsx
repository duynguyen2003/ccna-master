// src/components/Admin/Charts/RegistrationLineChart.jsx
import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import AdminMotionSwap from '../Components/AdminMotionSwap';

const RegistrationLineChart = ({ data, loading = false }) => {
  const chartData = Array.isArray(data) ? data : [];

  if (loading) {
    return (
      <AdminMotionSwap stateKey="loading">
        <div className="skeleton" style={{ width: '100%', height: '200px' }}></div>
      </AdminMotionSwap>
    );
  }

  if (chartData.length === 0 || chartData.every((entry) => Number(entry.value) === 0)) {
    return (
      <AdminMotionSwap stateKey="empty">
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: 230,
            color: '#94a3b8',
            gap: '8px',
          }}
        >
          <TrendingUp size={30} strokeWidth={1.5} />
          <p style={{ fontSize: '13px', margin: 0 }}>Chưa có dữ liệu đăng ký</p>
        </div>
      </AdminMotionSwap>
    );
  }

  return (
    <AdminMotionSwap stateKey="ready" style={{ width: '100%', height: 230 }}>
      <ResponsiveContainer>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            dy={10}
          />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              borderRadius: '8px',
              border: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#3b82f6"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorValue)"
            dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 6, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </AdminMotionSwap>
  );
};

export default RegistrationLineChart;
