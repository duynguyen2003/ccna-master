import React from 'react';
import { FileText } from 'lucide-react';
import MarkdownRenderer from '../../../components/common/MarkdownRenderer';

export default function InstructorNotes({ content }) {
  if (!content?.trim()) return null;
  return (
    <section className="lc-lesson-notes" aria-labelledby="lesson-notes-title">
      <div className="lc-notes-head">
        <div>
          <span className="lc-progress-label">Tài liệu bài học</span>
          <h2 id="lesson-notes-title">Ghi chú từ giảng viên</h2>
        </div>
        <FileText size={20} aria-hidden="true" />
      </div>
      <div className="lc-text-content">
        <MarkdownRenderer content={content} />
      </div>
    </section>
  );
}
