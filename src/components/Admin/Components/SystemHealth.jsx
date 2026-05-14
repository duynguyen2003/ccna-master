// src/components/Admin/Components/SystemHealth.jsx
import React from 'react';
import { Server, Database, Shield, Zap } from 'lucide-react';

const SystemHealth = ({ loading = false }) => {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '32px', width: '100%' }}></div>)}
      </div>
    );
  }

  const statusItems = [
    { 
      label: 'Cơ sở dữ liệu', 
      status: 'Ổn định', 
      icon: Database, 
      color: '#22c55e',
      sub: 'Kết nối: 12ms' 
    },
    { 
      label: 'Máy chủ API', 
      status: 'Hoạt động', 
      icon: Server, 
      color: '#3b82f6',
      sub: 'Uptime: 99.9%' 
    },
    { 
      label: 'Bảo mật SSL', 
      status: 'An toàn', 
      icon: Shield, 
      color: '#a855f7',
      sub: 'Chứng chỉ: Valid' 
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {statusItems.map((item, index) => (
        <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: `${item.color}10`,
            color: item.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <item.icon size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>{item.label}</span>
              <span style={{ fontSize: '10px', fontWeight: 700, color: item.color, textTransform: 'uppercase' }}>
                {item.status}
              </span>
            </div>
            <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '1px' }}>{item.sub}</div>
          </div>
        </div>
      ))}
      
      <div style={{ 
        marginTop: '6px',
        padding: '10px', 
        backgroundColor: '#f8fafc', 
        borderRadius: '8px',
        border: '1px solid #f1f5f9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Zap size={14} style={{ color: '#f59e0b' }} />
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Version 2.1.0</span>
        </div>
        <span style={{ fontSize: '10px', color: '#94a3b8' }}>Build: 140526</span>
      </div>
    </div>
  );
};

export default SystemHealth;
