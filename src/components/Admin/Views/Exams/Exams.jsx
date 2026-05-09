import React, { useState, useContext, useEffect, useRef, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { AuthContext } from '../../../../context/AuthContext';
import AdminModal from '../../Components/AdminModal';
import { useExams } from './useExams';
import { useExamForm } from './useExamForm';
import { getStatusFromExam, getDifficultyLabel } from './utils';
import ExamStats from './ExamStats';
import ExamToolbar from './ExamToolbar';
import { ExamGrid, ExamListShell } from './ExamViews';
import ExamEditor from './ExamEditor';
import AdminPagination from '../../Components/AdminPagination';
import '../../../../css/Admin/AdminViews.css';
import '../../../../css/Admin/AdminExamBuilder.css';

const Exams = () => {
  const { token } = useContext(AuthContext);
  const [selectedExamForView, setSelectedExamForView] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  const {
    courses,
    loading,
    searchKeyword,
    setSearchKeyword,
    statusFilter,
    setStatusFilter,
    viewMode,
    setViewMode,
    filteredExams,
    examStats,
    fetchExams,
    deleteExam,
    // pagination state
    currentPage,
    setCurrentPage,
    totalPages,
    totalItems,
    pageSize
  } = useExams();

  const {
    isModalOpen,
    setIsModalOpen,
    isEditMode,
    formData,
    setFormData,
    questions,
    questionDraft,
    setQuestionDraft,
    editingQuestionIndex,
    error,
    importMessage,
    uploadingQuestionImage,
    shuffleQuestions,
    setShuffleQuestions,
    hideResult,
    setHideResult,
    openCreateModal,
    openEditModal,
    handleCourseChange,
    handleQuestionOptionChange,
    handleQuestionImageUpload,
    handleBulkImportQuestions,
    handleSaveQuestion,
    handleEditQuestion,
    handleDeleteQuestion,
    handleSubmitExam,
    resetQuestionDraft,
    modules
  } = useExamForm(token, fetchExams);

  const courseOptions = useMemo(() => [
    { value: '', label: 'Chọn khóa học' },
    ...courses.map((c) => ({ value: c.id, label: `${c.code} – ${c.title}` }))
  ], [courses]);

  const openViewModal = (exam) => {
    setSelectedExamForView(exam);
    setIsViewModalOpen(true);
  };

  return (
    <div className="exam-hub-page">
      {isModalOpen ? (
        <ExamEditor
          isEditMode={isEditMode}
          formData={formData}
          setFormData={setFormData}
          questions={questions}
          questionDraft={questionDraft}
          setQuestionDraft={setQuestionDraft}
          editingQuestionIndex={editingQuestionIndex}
          error={error}
          importMessage={importMessage}
          uploadingQuestionImage={uploadingQuestionImage}
          shuffleQuestions={shuffleQuestions}
          setShuffleQuestions={setShuffleQuestions}
          hideResult={hideResult}
          setHideResult={setHideResult}
          onClose={() => setIsModalOpen(false)}
          courseOptions={courseOptions}
          modules={modules}
          handleCourseChange={handleCourseChange}
          handleQuestionOptionChange={handleQuestionOptionChange}
          handleQuestionImageUpload={handleQuestionImageUpload}
          handleBulkImportQuestions={handleBulkImportQuestions}
          handleSaveQuestion={handleSaveQuestion}
          handleEditQuestion={handleEditQuestion}
          handleDeleteQuestion={handleDeleteQuestion}
          handleSubmitExam={handleSubmitExam}
          resetQuestionDraft={resetQuestionDraft}
        />
      ) : (
        <>
          <div className="exam-hub-header">
            <div>
              <h2>Quản lý Bài thi</h2>
              <p>Tạo đề trắc nghiệm, quản lý câu hỏi và chấm điểm tự động.</p>
            </div>

            <button className="exam-hub-create-btn" onClick={openCreateModal}>
              <Plus size={18} /> <span>Tạo bài thi mới</span>
            </button>
          </div>

          <ExamStats stats={examStats} />

          <ExamToolbar
            searchKeyword={searchKeyword}
            onSearchChange={setSearchKeyword}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />

          {loading ? (
            <div className="exam-hub-empty">Đang tải danh sách đề thi...</div>
          ) : filteredExams.length === 0 ? (
            <div className="exam-hub-empty">Không có đề thi phù hợp bộ lọc.</div>
          ) : viewMode === 'grid' ? (
            <ExamGrid
              exams={filteredExams}
              onView={openViewModal}
              onEdit={openEditModal}
              onDelete={deleteExam}
            />
          ) : (
            <ExamListShell
              exams={filteredExams}
              onView={openViewModal}
              onEdit={openEditModal}
              onDelete={deleteExam}
            />
          )}

          <AdminPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </>
      )}

      <AdminModal
        title="Chi tiết đề thi"
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        onConfirm={() => setIsViewModalOpen(false)}
        confirmText="Đóng"
      >
        {selectedExamForView && (
          <div className="exam-view-details">
            <div><b>Tiêu đề:</b> {selectedExamForView.title}</div>
            <div><b>Mã đề:</b> {selectedExamForView.examCode || '---'}</div>
            <div><b>Khóa học:</b> {selectedExamForView.course?.title || 'Không gán khóa học'}</div>
            <div><b>Chương:</b> {selectedExamForView.module?.title || selectedExamForView.moduleId || 'Không gán chương'}</div>
            <div><b>Số câu hỏi:</b> {selectedExamForView.totalQuestions}</div>
            <div><b>Thời gian:</b> {selectedExamForView.durationMinutes} phút</div>
            <div><b>Điểm đạt:</b> {selectedExamForView.passingScore}%</div>
            <div><b>Độ khó:</b> {getDifficultyLabel(selectedExamForView.difficulty)}</div>
            <div><b>Lượt dự thi:</b> {selectedExamForView?._count?.results || 0}</div>
            <div><b>Trạng thái:</b> {getStatusFromExam(selectedExamForView) === 'OPEN' ? 'Đang mở' : 'Nháp'}</div>
          </div>
        )}
      </AdminModal>
    </div>
  );
};

export default Exams;
