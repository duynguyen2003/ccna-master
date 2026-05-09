import React from 'react';
import {
  FileText,
  CircleHelp,
  Clock3,
  Target,
  Users,
  Eye,
  PencilLine,
  Trash2,
  CalendarDays
} from 'lucide-react';
import { getStatusFromExam, getDifficultyLabel, formatExamDate } from './utils';

// ─── Shared badge ─────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => (
  <span className={`exam-hub-status ${status === 'OPEN' ? 'open' : 'draft'}`}>
    {status === 'OPEN' ? 'Đang mở' : 'Nháp'}
  </span>
);

// ─── Mini stat item ───────────────────────────────────────────────────────────

const MiniStat = ({ icon, value, label }) => (
  <div>
    {icon}
    <strong>{value}</strong>
    <span>{label}</span>
  </div>
);

// ─── Grid card ────────────────────────────────────────────────────────────────

export const ExamCard = ({ exam, onView, onEdit, onDelete }) => {
  const status = getStatusFromExam(exam);

  return (
    <article className="exam-hub-card">
      <div className="exam-hub-card-top">
        <h3>{exam.title}</h3>
        <StatusBadge status={status} />
      </div>

      <p className="exam-hub-meta">
        Mã đề: <strong>{exam.examCode || '---'}</strong>
        {' | '}
        Khóa học: <strong>{exam.course?.code || 'Không gán'}</strong>
      </p>

      <div className="exam-hub-mini-stats">
        <MiniStat icon={<CircleHelp size={14} />} value={exam.totalQuestions} label="Câu hỏi" />
        <MiniStat icon={<Clock3 size={14} />} value={`${exam.durationMinutes}p`} label="Thời gian" />
        <MiniStat icon={<Target size={14} />} value={`${exam.passingScore}%`} label="Điểm đạt" />
        <MiniStat icon={<Users size={14} />} value={exam?._count?.results ?? 0} label="Dự thi" />
      </div>

      <div className="exam-hub-bottom">
        <span className="exam-hub-difficulty">{getDifficultyLabel(exam.difficulty)}</span>
        <div className="exam-hub-actions">
          <button type="button" onClick={onView}>   <Eye size={14} />       Xem  </button>
          <button type="button" onClick={onEdit}>   <PencilLine size={14} /> Sửa  </button>
          <button type="button" className="danger" onClick={onDelete}><Trash2 size={14} /> Xóa</button>
        </div>
      </div>
    </article>
  );
};

// ─── List row ─────────────────────────────────────────────────────────────────

export const ExamListRow = ({ exam, onView, onEdit, onDelete }) => {
  const status = getStatusFromExam(exam);

  return (
    <article className="exam-hub-list-row">
      <div className="exam-hub-col exam-hub-col-info">
        <div className="exam-hub-exam-icon"><FileText size={24} /></div>
        <div className="exam-hub-exam-main">
          <h3>{exam.title}</h3>
          <div className="exam-hub-exam-sub">
            <span className="exam-hub-chip">ID: {exam.examCode || '---'}</span>
            <span className="exam-hub-date">
              <CalendarDays size={14} />
              {formatExamDate(exam.createdAt)}
            </span>
          </div>
        </div>
      </div>

      <div className="exam-hub-col exam-hub-col-course">
        <span className="exam-hub-course-pill">{exam.course?.code || 'N/A'}</span>
      </div>

      <div className="exam-hub-col exam-hub-col-detail">
        <div><CircleHelp size={14} /><span>{exam.totalQuestions} câu hỏi</span></div>
        <div><Target size={14} />    <span>{exam.passingScore}% đạt</span></div>
        <div><Clock3 size={14} />    <span>{exam.durationMinutes} phút</span></div>
        <div><Users size={14} />     <span>{exam?._count?.results ?? 0} dự thi</span></div>
      </div>

      <div className="exam-hub-col exam-hub-col-status">
        <StatusBadge status={status} />
        <small>{getDifficultyLabel(exam.difficulty)}</small>
      </div>

      <div className="exam-hub-col exam-hub-col-actions">
        <button type="button" className="icon view" onClick={onView} aria-label="Xem kỳ thi">  <Eye size={18} />         </button>
        <button type="button" className="icon edit" onClick={onEdit} aria-label="Sửa kỳ thi">  <PencilLine size={18} /> </button>
        <button type="button" className="icon delete" onClick={onDelete} aria-label="Xóa kỳ thi">  <Trash2 size={18} />     </button>
      </div>
    </article>
  );
};

// ─── List shell (header + rows + footnote) ────────────────────────────────────

export const ExamListShell = ({ exams, onView, onEdit, onDelete }) => (
  <div className="exam-hub-list-shell">
    <div className="exam-hub-list-head">
      {['THÔNG TIN KỲ THI', 'KHÓA HỌC', 'CHI TIẾT', 'TRẠNG THÁI', 'THAO TÁC'].map((col) => (
        <span key={col}>{col}</span>
      ))}
    </div>

    <div className="exam-hub-list-body">
      {exams.map((exam) => (
        <ExamListRow
          key={exam.id}
          exam={exam}
          onView={() => onView(exam)}
          onEdit={() => onEdit(exam)}
          onDelete={() => onDelete(exam.id)}
        />
      ))}
    </div>

    <p className="exam-hub-footnote">Dữ liệu được cập nhật thời gian thực từ hệ thống.</p>
  </div>
);

// ─── Grid shell ───────────────────────────────────────────────────────────────

export const ExamGrid = ({ exams, onView, onEdit, onDelete }) => (
  <div className="exam-hub-grid">
    {exams.map((exam) => (
      <ExamCard
        key={exam.id}
        exam={exam}
        onView={() => onView(exam)}
        onEdit={() => onEdit(exam)}
        onDelete={() => onDelete(exam.id)}
      />
    ))}
  </div>
);