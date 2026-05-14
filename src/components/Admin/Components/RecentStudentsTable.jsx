// src/components/Admin/Components/RecentStudentsTable.jsx
import React from 'react';
import { Users } from 'lucide-react';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ef4444'];

const RecentStudentsTable = ({ students, loading = false }) => {
  if (loading) {
    return (
      <div className="admin-datatable-container">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="skeleton" style={{ width: '100%', height: '50px', marginBottom: '10px' }}></div>
        ))}
      </div>
    );
  }

  if (!students || students.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', color: '#94a3b8', gap: '8px' }}>
        <Users size={28} strokeWidth={1.5} />
        <p style={{ fontSize: '13px', margin: 0 }}>Chưa có học viên nào trong hệ thống</p>
      </div>
    );
  }

  return (
    <div className="admin-datatable-container" style={{ marginTop: 0, border: 'none', boxShadow: 'none', padding: 0 }}>
      <table className="admin-table">
        <thead>
          <tr>
            <th>HỌC VIÊN</th>
            <th>KHÓA HỌC</th>
            <th>TIẾN ĐỘ</th>
            <th>THAM GIA</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student, i) => {
            const color = student.color || COLORS[i % COLORS.length];
            return (
              <tr key={student.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: `${color}15`,
                      color: color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 700,
                      flexShrink: 0
                    }}>
                      {student.initials}
                    </div>
                    <span style={{ fontWeight: 500, fontSize: '13px' }}>{student.name}</span>
                  </div>
                </td>
                <td>
                  <span className="admin-badge" style={{
                    backgroundColor: `${color}10`,
                    color: color,
                    fontSize: '11px'
                  }}>
                    {student.course}
                  </span>
                </td>
                <td style={{ width: '150px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="progress-bar-bg" style={{ flex: 1, height: '6px' }}>
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${student.progress}%`, backgroundColor: color }}
                      ></div>
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748b', minWidth: '30px' }}>{student.progress}%</span>
                  </div>
                </td>
                <td style={{ fontSize: '12px', color: '#94a3b8' }}>{student.time}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default RecentStudentsTable;
