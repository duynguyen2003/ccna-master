import React from 'react';

const colorMap = {
  0: 'blue',
  1: 'green',
  2: 'orange',
  3: 'purple'
};

const StatsCard = ({ title, value, icon: Icon, index = 0 }) => {
  const color = colorMap[index % 4] || 'blue';

  return (
    <div className="admin-stats-card">
      <div className="admin-stats-info">
        <h3>{title}</h3>
        <p>{value}</p>
      </div>
      <div className={`admin-stats-icon ${color}`}>
        <Icon size={24} />
      </div>
    </div>
  );
};

export default StatsCard;
