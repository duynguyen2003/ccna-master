import React, { useRef } from 'react';
import {
  X,
  Upload,
  CheckCircle2,
  FileText,
  PencilLine,
  Trash2,
  Image as ImageIcon,
  Download
} from 'lucide-react';
import { OPTION_LABELS } from './constants';
import SimpleRTE from './SimpleRTE';

// ─── QuestionDrawer ───────────────────────────────────────────────────────────

export const QuestionDrawer = ({
  isOpen,
  onClose,
  isEditMode,
  draft,
  onDraftChange,
  onOptionChange,
  onImageUpload,
  onRemoveImage,
  uploadingImage,
  onSave,
  error
}) => {
  if (!isOpen) return null;

  return (
    <div className={`efb-drawer-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}>
      <div className="efb-drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="efb-drawer-header">
          <div>
            <h3>{isEditMode ? 'Chỉnh Sửa Câu Hỏi' : 'Thêm Câu Hỏi Mới'}</h3>
            <span style={{ fontSize: '13px', color: '#64748b' }}>Trắc nghiệm 4 đáp án</span>
          </div>
          <button type="button" className="efb-drawer-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="efb-drawer-body">
          {error && <div className="exam-builder-error">{error}</div>}

          {/* RTE for Question */}
          <div className="efb-field">
            <span style={{ fontWeight: 600 }}>Nội dung câu hỏi *</span>
            <SimpleRTE
              value={draft.question}
              onChange={(val) => onDraftChange('question', val)}
              placeholder="Nhập nội dung câu hỏi tại đây..."
            />
          </div>

          {/* Network Diagram Image */}
          <div className="efb-field">
            {!draft.imageUrl ? (
              <label className="efb-dnd-zone">
                <ImageIcon size={28} color="#6366f1" />
                <div>
                  <p style={{ color: '#6366f1', fontWeight: 600 }}>Tải ảnh sơ đồ mạng</p>
                  <span>Định dạng JPG, PNG, tối đa 5MB</span>
                </div>
                <input type="file" accept="image/*" disabled={uploadingImage} onChange={onImageUpload} hidden />
              </label>
            ) : (
              <div className="efb-image-preview" style={{ position: 'relative', display: 'inline-block' }}>
                <img src={draft.imageUrl} alt="Sơ đồ mạng" style={{ width: '100%', borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                <button
                  type="button"
                  className="efb-btn-secondary"
                  onClick={onRemoveImage}
                  style={{ position: 'absolute', top: '10px', right: '10px', background: 'white' }}
                >
                  <Trash2 size={14} color="#ef4444" /> Xóa ảnh
                </button>
              </div>
            )}
          </div>

          {/* Options vertically stacked */}
          <div className="efb-field">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>Đáp án & Đáp án đúng *</span>
              <button 
                type="button" 
                className="efb-btn-secondary" 
                onClick={() => onDraftChange('options', [...draft.options, ''])}
                style={{ padding: '4px 12px', fontSize: '12px' }}
              >
                + Thêm đáp án
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {draft.options.map((opt, i) => {
                const isCorrect = Array.isArray(draft.correctAnswer) && draft.correctAnswer.includes(i);
                
                const toggleCorrect = () => {
                  let next;
                  if (isCorrect) {
                    next = draft.correctAnswer.filter(idx => idx !== i);
                  } else {
                    next = [...draft.correctAnswer, i];
                  }
                  onDraftChange('correctAnswer', next);
                };

                const removeOption = () => {
                  if (draft.options.length <= 2) return;
                  const nextOptions = draft.options.filter((_, idx) => idx !== i);
                  // Update correct answers to reflect new indices
                  const nextCorrect = draft.correctAnswer
                    .filter(idx => idx !== i)
                    .map(idx => (idx > i ? idx - 1 : idx));
                  onDraftChange('options', nextOptions);
                  onDraftChange('correctAnswer', nextCorrect);
                };

                return (
                  <div key={i} className={`efb-option-item ${isCorrect ? 'efb-option-correct' : ''}`} style={{ padding: '10px 14px' }}>
                    <button type="button" className="efb-option-radio" onClick={toggleCorrect}>
                      {isCorrect ? <CheckCircle2 size={18} color="#4f46e5" /> : <span className="efb-radio-dot" />}
                    </button>
                    <div style={{ fontWeight: 600, color: '#64748b', width: '20px' }}>{OPTION_LABELS[i]}</div>
                    <input
                      className="efb-option-input"
                      placeholder={`Nội dung đáp án ${OPTION_LABELS[i]}`}
                      value={opt}
                      onChange={(e) => onOptionChange(i, e.target.value)}
                      style={{ fontSize: '14px' }}
                    />
                    {draft.options.length > 2 && (
                      <button type="button" className="efb-icon-btn efb-icon-danger" onClick={removeOption} style={{ marginLeft: '8px' }}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Explanation with RTE */}
          <div className="efb-field">
            <span style={{ fontWeight: 600 }}>Giải thích đáp án</span>
            <SimpleRTE
              value={draft.explanation}
              onChange={(val) => onDraftChange('explanation', val)}
              placeholder="Nhập giải thích cho học sinh sau khi xem kết quả..."
            />
          </div>
        </div>

        <div className="efb-drawer-footer">
          <button type="button" className="efb-btn-ghost" onClick={onClose} style={{ padding: '0 16px', color: '#64748b', textDecoration: 'none' }}>
            Hủy
          </button>
          <button type="button" className="efb-btn-primary" onClick={onSave}>
            Lưu câu hỏi
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── ImportModal ──────────────────────────────────────────────────────────────

export const ImportModal = ({
  isOpen,
  onClose,
  onDownloadTemplate,
  onFileChange,
  importMessage
}) => {
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  return (
    <div className={`efb-modal-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}>
      <div className="efb-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="efb-modal-header">
          <div>
            <h3>Nhập Câu Hỏi Hàng Loạt</h3>
            <p>Tải lên file CSV chứa danh sách câu hỏi</p>
          </div>
          <button type="button" className="efb-drawer-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="efb-modal-body">
          {importMessage && <p className="exam-builder-success">{importMessage}</p>}
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '13px', color: '#475569' }}>Cấu trúc: question, optionA..D, correctAnswer...</span>
            <button type="button" className="efb-btn-secondary" onClick={onDownloadTemplate} style={{ height: '32px' }}>
              <Download size={14} /> Tải file mẫu
            </button>
          </div>

          <label className="efb-dnd-zone" style={{ padding: '40px 20px' }}>
            <Upload size={32} color="#6366f1" />
            <div>
              <p style={{ color: '#0f172a', fontWeight: 600 }}>Kéo thả hoặc nhấp để chọn file</p>
              <span>Chỉ hỗ trợ file .csv</span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                onFileChange(e);
                onClose(); // Auto close after file selection
              }}
              hidden
            />
          </label>
        </div>
      </div>
    </div>
  );
};

// ─── QuestionList ─────────────────────────────────────────────────────────────

export const QuestionList = ({ questions, onEdit, onDelete }) => {
  if (!questions.length) return null;

  return (
    <div className="efb-qlist" style={{ marginTop: '20px' }}>
      <div className="efb-qlist-header">
        <FileText size={16} color="#6366f1" />
        <span style={{ color: '#0f172a', fontSize: '16px' }}>Danh Sách Câu Hỏi ({questions.length})</span>
      </div>

      {questions.map((q, idx) => (
        <div key={idx} className="efb-qcard">
          <div className="efb-qcard-top">
            <span className="efb-qnum">{idx + 1}</span>
            <div className="efb-qtext" dangerouslySetInnerHTML={{ __html: q.question }} />
            <div className="efb-qcard-actions">
              <button type="button" className="efb-icon-btn" onClick={() => onEdit(idx)}>
                <PencilLine size={14} />
              </button>
              <button type="button" className="efb-icon-btn efb-icon-danger" onClick={() => onDelete(idx)}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          <div className="efb-qoptions">
            {q.options.map((opt, oi) => {
              const isCorrect = Array.isArray(q.correctAnswer) && q.correctAnswer.includes(oi);
              return (
                <div key={oi} className={`efb-qoption ${isCorrect ? 'correct' : ''}`}>
                  {isCorrect
                    ? <CheckCircle2 size={15} className="efb-qoption-correct-icon" />
                    : <span className="efb-qoption-dot" />}
                  <span style={{ fontWeight: 600, marginRight: '4px', color: isCorrect ? '#15803d' : '#64748b' }}>{OPTION_LABELS[oi]}.</span>
                  <span>{opt || `(Trống)`}</span>
                </div>
              );
            })}
          </div>

          {q.imageUrl && (
            <div className="efb-qimage">
              <img src={q.imageUrl} alt={`Sơ đồ mạng câu hỏi ${idx + 1}`} />
            </div>
          )}

          {q.explanation && (
            <div className="efb-qexplan">
              <span>Giải thích:</span> <div dangerouslySetInnerHTML={{ __html: q.explanation }} style={{ display: 'inline' }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default QuestionDrawer;
