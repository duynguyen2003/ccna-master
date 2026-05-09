import React from 'react';
import { X } from 'lucide-react';
import '../../../../css/Admin/UserProfileModal.css';

const UserProfileModal = ({ isOpen, onClose, user, onArchive, onEdit }) => {
  if (!isOpen || !user) return null;

  // Formatting dates
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return 'Chưa bao giờ';
    const diff = new Date() - new Date(dateString);
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Vừa xong';
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    if (days === 1) return '1 ngày trước';
    return `${days} ngày trước`;
  };

  // Group progress by courseId
  const courseProgressMap = new Map();
  if (user.progress && user.progress.length > 0) {
    user.progress.forEach(p => {
      const courseId = p.course?.id || p.courseId;
      const title = p.course?.title || 'Khóa học không xác định';
      const level = p.course?.level || 'Khóa học';
      
      if (!courseProgressMap.has(courseId)) {
        courseProgressMap.set(courseId, { id: courseId, title, level, progressPercent: p.progressPercent || 0 });
      } else {
        const existing = courseProgressMap.get(courseId);
        if ((p.progressPercent || 0) > existing.progressPercent) {
          existing.progressPercent = p.progressPercent;
        }
      }
    });
  }

  const enrolledCourses = Array.from(courseProgressMap.values());
  const totalCourses = enrolledCourses.length;
  const completedCourses = enrolledCourses.filter(c => c.progressPercent === 100).length;

  return (
    <div className="user-profile-modal-overlay" onClick={onClose}>
      <div className="user-profile-modal-content" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="upm-header">
          <button className="upm-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
          
          <div className="upm-name-row">
            <h2 className="upm-name">{user.fullName || 'Chưa có tên'}</h2>
            <span className={`upm-status-badge ${user.isActive ? 'active' : 'inactive'}`}>
              {user.isActive ? 'Đang hoạt động' : 'Đã khóa'}
            </span>
          </div>
          <p className="upm-email">{user.email}</p>
        </div>

        {/* Stats Grid */}
        <div className="upm-stats-grid">
          <div className="upm-stat-item">
            <span className="upm-stat-label">NGÀY THAM GIA</span>
            <span className="upm-stat-value">{formatDate(user.createdAt)}</span>
          </div>
          <div className="upm-stat-item">
            <span className="upm-stat-label">HOẠT ĐỘNG GẦN NHẤT</span>
            <span className="upm-stat-value">{formatTimeAgo(user.lastLogin || user.createdAt)}</span>
          </div>
          <div className="upm-stat-item">
            <span className="upm-stat-label">TỔNG KHÓA HỌC</span>
            <span className="upm-stat-value">{totalCourses} Khóa học đã đăng ký</span>
          </div>
          <div className="upm-stat-item">
            <span className="upm-stat-label">TỈ LỆ HOÀN THÀNH</span>
            <span className="upm-stat-value highlight">Đã hoàn thành {completedCourses} khóa học</span>
          </div>
        </div>

        {/* Academic Progress */}
        <div className="upm-progress-section">
          <h3 className="upm-section-title">TIẾN TRÌNH HỌC TẬP</h3>
          
          {enrolledCourses.length > 0 ? (
            <div className="upm-course-list">
              {enrolledCourses.map(course => (
                <div className="upm-course-item" key={course.id}>
                  <div className="upm-course-info">
                    <span className="upm-course-title">{course.title}</span>
                    <span className="upm-course-category">
                      {course.level === 'BEGINNER' ? 'Chương trình cốt lõi' : (course.level === 'INTERMEDIATE' ? 'Chứng chỉ chuyên nghiệp' : 'Khóa học bổ sung')}
                    </span>
                  </div>
                  <div className="upm-course-progress-wrap">
                    {course.progressPercent === 100 ? (
                      <span className="upm-complete-badge">ĐÃ HOÀN THÀNH</span>
                    ) : (
                      <>
                        <div className="upm-progress-bar-bg">
                          <div className="upm-progress-bar-fill" style={{ width: `${course.progressPercent}%` }}></div>
                        </div>
                        <span className="upm-progress-text">{course.progressPercent}%</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="upm-empty-state">
              Chưa tham gia khóa học nào
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="upm-footer">
          <button className="upm-btn-archive" onClick={() => { onArchive(user); onClose(); }}>
            {user.isActive ? 'KHÓA TÀI KHOẢN' : 'MỞ KHÓA TÀI KHOẢN'}
          </button>
          <button className="upm-btn-edit" onClick={() => { onEdit(user); onClose(); }}>
            CHỈNH SỬA THÔNG TIN
          </button>
        </div>

      </div>
    </div>
  );
};

export default UserProfileModal;
