import React, { useRef, useState } from 'react';
import {
  ArrowLeft,
  ListChecks,
  Settings2,
  Shuffle,
  EyeOff,
  Target,
  ChevronRight,
  Plus,
  Upload,
  Info
} from 'lucide-react';
import CustomSelect from '../../Components/CustomSelect';
import QuestionDrawer, { QuestionList, ImportModal } from './QuestionEditor';
import { difficultyOptions } from './constants';

const ExamEditor = ({
  isEditMode,
  formData,
  setFormData,
  questions,
  questionDraft,
  setQuestionDraft,
  editingQuestionIndex,
  modules,
  error,
  importMessage,
  uploadingQuestionImage,
  shuffleQuestions,
  setShuffleQuestions,
  hideResult,
  setHideResult,
  courseOptions,
  handleCourseChange,
  handleQuestionOptionChange,
  handleQuestionImageUpload,
  handleBulkImportQuestions,
  handleSaveQuestion,
  handleEditQuestion,
  handleDeleteQuestion,
  handleSubmitExam,
  resetQuestionDraft,
  onClose
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const handleDownloadCsvTemplate = () => {
    const sampleCsv = [
      'question,optionA,optionB,optionC,optionD,correctAnswer,explanation,imageUrl',
      '"Router nào là default gateway?","R1","R2","SW1","PC1","A","Default gateway là router kết nối ra mạng ngoài.",""'
    ].join('\n');

    const blob = new Blob([sampleCsv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'exam-questions-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const moduleOptions = [
    { value: '', label: 'Chọn chương (không bắt buộc)' },
    ...modules.map((m) => ({ value: m.id, label: m.title }))
  ];

  const handleOpenDrawerForNew = () => {
    resetQuestionDraft();
    setIsDrawerOpen(true);
  };

  const handleOpenDrawerForEdit = (idx) => {
    handleEditQuestion(idx);
    setIsDrawerOpen(true);
  };

  const handleSaveFromDrawer = () => {
    handleSaveQuestion();
    setIsDrawerOpen(false);
  };

  return (
    <div className="efb-page">
      {/* Bottom Sticky Actions */}
      <div className="efb-sticky-actions">
        <div style={{ display: 'flex', gap: '12px', flex: 1, alignItems: 'center' }}>
          <button type="button" className="efb-back-btn" onClick={onClose} style={{ marginBottom: 0 }}>
            <ArrowLeft size={16} />
            <span style={{ fontSize: '12px' }}>HỦY BỎ & TRỞ LẠI</span>
          </button>
        </div>
        <button type="button" className="efb-btn-primary" onClick={handleSubmitExam}>
          Lưu bài thi
        </button>
      </div>

      <div className="efb-page-content" style={{ paddingBottom: '80px' }}>
        <div className="efb-shell">
          <header className="efb-editor-header">
            <div className="efb-header-main">
              <div className="efb-header-title-group">
                <h1 className="efb-page-title">{isEditMode ? 'Chỉnh sửa bài thi' : 'Tạo bài thi mới'}</h1>
              </div>

              <div className="efb-header-stepper">
                <div className="efb-stepper">
                  <button 
                    className={`efb-step ${currentStep === 1 ? 'active' : ''}`}
                    onClick={() => setCurrentStep(1)}
                    style={{ border: 'none', cursor: 'pointer', padding: 0 }}
                  >1</button>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: currentStep === 1 ? '#0f172a' : '#94a3b8' }}>Cài đặt bài thi</span>
                  <div className="efb-step-line" />
                  <button 
                    className={`efb-step ${currentStep === 2 ? 'active' : ''}`}
                    onClick={() => setCurrentStep(2)}
                    style={{ border: 'none', cursor: 'pointer', padding: 0 }}
                  >2</button>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: currentStep === 2 ? '#0f172a' : '#94a3b8' }}>Nội dung câu hỏi</span>
                </div>
              </div>
            </div>
          </header>

          {error && <p className="exam-builder-error" style={{ marginBottom: '20px' }}>{error}</p>}

          {currentStep === 1 && (
            <div style={{ animation: 'fadeIn 0.3s', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Card 1: Thông tin cơ bản */}
              <section className="efb-card" style={{ padding: '24px', background: 'white' }}>
                <div className="efb-card-header" style={{ marginBottom: '20px' }}>
                  <div className="efb-card-badge" style={{ color: '#6366f1', background: 'transparent' }}><Info size={20} /></div>
                  <span style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Thông tin cơ bản</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <label className="efb-field efb-field-full">
                    <span style={{ fontSize: '13px', fontWeight: 500, color: '#475569' }}>Tiêu đề bài thi</span>
                    <input
                      className="efb-input"
                      placeholder="Nhập tiêu đề bài thi (VD: Kiểm tra cuối kỳ Toán lớp 10)"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    />
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '20px' }}>
                    <label className="efb-field">
                      <span style={{ fontSize: '13px', fontWeight: 500, color: '#475569' }}>Mã đề thi</span>
                      <input
                        className="efb-input"
                        placeholder="EX-101"
                        value={formData.examCode}
                        onChange={(e) => setFormData({ ...formData, examCode: e.target.value })}
                      />
                    </label>

                    <label className="efb-field">
                      <span style={{ fontSize: '13px', fontWeight: 500, color: '#475569' }}>Thời gian (phút)</span>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="number"
                          className="efb-input"
                          placeholder="45"
                          value={formData.durationMinutes}
                          onChange={(e) => setFormData({ ...formData, durationMinutes: e.target.value === '' ? '' : parseInt(e.target.value, 10) })}
                        />
                      </div>
                    </label>

                    <label className="efb-field">
                      <span style={{ fontSize: '13px', fontWeight: 500, color: '#475569' }}>Trạng thái</span>
                      <CustomSelect
                        value={formData.status}
                        onChange={(val) => setFormData({ ...formData, status: val })}
                        options={[
                          { value: 'DRAFT', label: 'Đang soạn thảo' },
                          { value: 'OPEN', label: 'Đang mở (Công khai)' }
                        ]}
                      />
                    </label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <label className="efb-field">
                      <span style={{ fontSize: '13px', fontWeight: 500, color: '#475569' }}>Chuyên môn / Khóa học</span>
                      <CustomSelect
                        value={formData.courseId}
                        onChange={(val) => handleCourseChange(val)}
                        options={courseOptions}
                      />
                    </label>

                    <label className="efb-field">
                      <span style={{ fontSize: '13px', fontWeight: 500, color: '#475569' }}>Chương bài học</span>
                      <CustomSelect
                        value={formData.moduleId}
                        onChange={(val) => setFormData({ ...formData, moduleId: val })}
                        options={moduleOptions}
                        disabled={!formData.courseId}
                      />
                    </label>
                  </div>
                </div>
              </section>

              {/* Bottom Row: 2 Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                
                {/* Card 2: Cài đặt nâng cao */}
                <section className="efb-card" style={{ padding: '24px', background: 'white' }}>
                  <div className="efb-card-header" style={{ marginBottom: '24px' }}>
                    <div className="efb-card-badge" style={{ color: '#6366f1', background: 'transparent' }}><Settings2 size={20} /></div>
                    <span style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Cài đặt Nâng cao</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <label className="efb-field">
                      <span style={{ fontSize: '13px', fontWeight: 500, color: '#475569' }}>Điểm sàn (%)</span>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="number"
                          className="efb-input"
                          placeholder="50"
                          style={{ paddingRight: '45px' }}
                          value={formData.passingScore}
                          onChange={(e) => setFormData({ ...formData, passingScore: e.target.value === '' ? '' : parseInt(e.target.value, 10) })}
                        />
                        <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', color: '#475569', fontWeight: 500 }}>%</span>
                      </div>
                    </label>

                    <div className="efb-field">
                      <span style={{ fontSize: '13px', fontWeight: 500, color: '#475569', marginBottom: '8px', display: 'block' }}>Độ khó</span>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, difficulty: 'EASY' })}
                          className={`efb-segment-btn ${formData.difficulty === 'EASY' ? 'active' : ''}`}
                        >
                          Dễ
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, difficulty: 'MEDIUM' })}
                          className={`efb-segment-btn ${formData.difficulty === 'MEDIUM' ? 'active' : ''}`}
                        >
                          Vừa
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, difficulty: 'HARD' })}
                          className={`efb-segment-btn ${formData.difficulty === 'HARD' ? 'active' : ''}`}
                        >
                          Khó
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Card 3: Cấu hình thi */}
                <section className="efb-card" style={{ padding: '24px', background: 'white' }}>
                  <div className="efb-card-header" style={{ marginBottom: '24px' }}>
                    <div className="efb-card-badge" style={{ color: '#6366f1', background: 'transparent' }}><ListChecks size={20} /></div>
                    <span style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Cấu hình thi</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="efb-toggle-item" style={{ border: '1px solid #e2e8f0', background: '#f8fafc', padding: '16px', borderRadius: '8px' }}>
                      <div className="efb-toggle-info" style={{ gap: '0' }}>
                        <div>
                          <strong style={{ fontSize: '14px', color: '#1e293b' }}>Trộn câu hỏi</strong>
                          <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginTop: '4px' }}>Đảo thứ tự câu cho mỗi thí sinh</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className={`efb-toggle-btn ${shuffleQuestions ? 'on' : ''}`}
                        onClick={() => setShuffleQuestions((p) => !p)}
                      >
                        <span />
                      </button>
                    </div>

                    <div className="efb-toggle-item" style={{ border: '1px solid #e2e8f0', background: '#f8fafc', padding: '16px', borderRadius: '8px' }}>
                      <div className="efb-toggle-info" style={{ gap: '0' }}>
                        <div>
                          <strong style={{ fontSize: '14px', color: '#1e293b' }}>Ẩn kết quả thi</strong>
                          <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginTop: '4px' }}>Thí sinh không xem được đáp án sau nộp</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className={`efb-toggle-btn ${hideResult ? 'on' : ''}`}
                        onClick={() => setHideResult((p) => !p)}
                      >
                        <span />
                      </button>
                    </div>
                  </div>
                </section>

              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" className="efb-btn-primary" onClick={() => setCurrentStep(2)} style={{ padding: '12px 32px', borderRadius: '8px' }}>
                  Tiếp tục sang phần Câu hỏi <ChevronRight size={18} style={{ marginLeft: '8px' }} />
                </button>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div style={{ animation: 'fadeIn 0.3s' }}>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                <button type="button" className="efb-btn-primary" onClick={handleOpenDrawerForNew}>
                  <Plus size={16} /> Thêm câu hỏi thủ công
                </button>
                <button type="button" className="efb-btn-secondary" onClick={() => setIsImportModalOpen(true)}>
                  <Upload size={16} /> Nhập từ File (CSV)
                </button>
              </div>

              {questions.length === 0 ? (
                <div className="exam-builder-empty" style={{ padding: '60px 20px' }}>
                  <ListChecks size={40} color="#cbd5e1" style={{ marginBottom: '12px' }} />
                  <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#475569' }}>Chưa có câu hỏi nào</p>
                  <p style={{ marginTop: '6px', fontSize: '13px' }}>Bắt đầu bằng cách thêm câu hỏi thủ công hoặc nhập từ file.</p>
                </div>
              ) : (
                <QuestionList
                  questions={questions}
                  onEdit={handleOpenDrawerForEdit}
                  onDelete={handleDeleteQuestion}
                />
              )}
            </div>
          )}

          <QuestionDrawer
            isOpen={isDrawerOpen}
            onClose={() => setIsDrawerOpen(false)}
            isEditMode={editingQuestionIndex !== null}
            draft={questionDraft}
            onDraftChange={(field, val) => setQuestionDraft((p) => ({ ...p, [field]: val }))}
            onOptionChange={handleQuestionOptionChange}
            onImageUpload={handleQuestionImageUpload}
            onRemoveImage={() => setQuestionDraft((p) => ({ ...p, imageUrl: '' }))}
            uploadingImage={uploadingQuestionImage}
            onSave={handleSaveFromDrawer}
            error={error}
          />

          <ImportModal
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
            onDownloadTemplate={handleDownloadCsvTemplate}
            onFileChange={handleBulkImportQuestions}
            importMessage={importMessage}
          />
        </div>
      </div>
    </div>
  );
};

export default ExamEditor;
