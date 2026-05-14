// src/components/Admin/Components/QuickActions.jsx
import React from 'react';
import { PlusCircle, UserPlus, FileText, Settings, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const QuickActions = () => {
  const navigate = useNavigate();

  const actions = [
    { 
      label: 'Thêm khóa học', 
      icon: PlusCircle, 
      color: '#3b82f6', 
      path: '/admin/courses' 
    },
    { 
      label: 'Tạo kỳ thi mới', 
      icon: FileText, 
      color: '#a855f7', 
      path: '/admin/exams' 
    },
    { 
      label: 'Thêm học viên', 
      icon: UserPlus, 
      color: '#22c55e', 
      path: '/admin/users' 
    },
    { 
      label: 'Gửi thông báo', 
      icon: Send, 
      color: '#f59e0b', 
      path: '/admin/settings' 
    }
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
      {actions.map((action, index) => (
        <button
          key={index}
          onClick={() => navigate(action.path)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px 8px',
            background: '#ffffff',
            border: '1px solid #f1f5f9',
            borderRadius: '12px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#f8fafc';
            e.currentTarget.style.borderColor = action.color;
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = '#ffffff';
            e.currentTarget.style.borderColor = '#f1f5f9';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: `${action.color}15`,
            color: action.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <action.icon size={18} />
          </div>
          <span style={{ 
            fontSize: '11px', 
            fontWeight: 600, 
            color: '#475569',
            textAlign: 'center' 
          }}>
            {action.label}
          </span>
        </button>
      ))}
    </div>
  );
};

export default QuickActions;
