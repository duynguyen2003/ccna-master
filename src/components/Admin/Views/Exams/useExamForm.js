import { useState, useCallback } from 'react';
import { adminApi } from '../../../../services/api/adminApi';
import { 
  defaultFormData, 
  defaultQuestionDraft, 
  OPTION_LABELS 
} from './constants';
import { 
  normalizeQuestionFromApi, 
  toImportedQuestionsFromCsv, 
  normalizeImportedQuestion 
} from './utils';

export const useExamForm = (token, onSuccess) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedExam, setSelectedExam] = useState(null);
  const [formData, setFormData] = useState(defaultFormData);
  const [questions, setQuestions] = useState([]);
  const [questionDraft, setQuestionDraft] = useState(defaultQuestionDraft);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState(null);
  const [modules, setModules] = useState([]);
  const [error, setError] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [uploadingQuestionImage, setUploadingQuestionImage] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [hideResult, setHideResult] = useState(false);

  const fetchModules = useCallback(async (courseId) => {
    if (!courseId) {
      setModules([]);
      return;
    }
    try {
      const res = await adminApi.getModules(token, courseId);
      setModules(res.data || []);
    } catch (err) {
      console.error(err);
      setModules([]);
    }
  }, [token]);

  const syncQuestions = (nextQuestions) => {
    setQuestions(nextQuestions);
    setFormData((prev) => ({
      ...prev,
      totalQuestions: nextQuestions.length
    }));
  };

  const resetQuestionDraft = () => {
    setQuestionDraft(defaultQuestionDraft);
    setEditingQuestionIndex(null);
  };

  const openCreateModal = () => {
    setSelectedExam(null);
    setIsEditMode(false);
    setError('');
    setImportMessage('');
    setModules([]);
    setFormData(defaultFormData);
    syncQuestions([]);
    resetQuestionDraft();
    setShowAdvanced(false);
    setShuffleQuestions(false);
    setHideResult(false);
    setIsModalOpen(true);
  };

  const openEditModal = async (exam) => {
    setSelectedExam(exam);
    setIsEditMode(true);
    setError('');
    setImportMessage('');
    syncQuestions([]);
    resetQuestionDraft();
    setShowAdvanced(false);
    setShuffleQuestions(false);
    setHideResult(false);
    setFormData({
      title: exam.title || '',
      examCode: exam.examCode || '',
      totalQuestions: exam.totalQuestions || 0,
      durationMinutes: exam.durationMinutes || 60,
      passingScore: exam.passingScore || 70,
      difficulty: exam.difficulty || '',
      courseId: exam.courseId || '',
      moduleId: exam.moduleId || '',
      status: exam.status || 'DRAFT'
    });
    setIsModalOpen(true);
    try {
      const examDetailRes = await adminApi.getExamById(token, exam.id);
      const examDetail = examDetailRes.exam || exam;
      const mappedQuestions = (examDetail.questions || []).map((questionItem) => normalizeQuestionFromApi(questionItem));

      setSelectedExam(examDetail);
      setFormData({
        title: examDetail.title || '',
        examCode: examDetail.examCode || '',
        totalQuestions: mappedQuestions.length,
        durationMinutes: examDetail.durationMinutes || 60,
        passingScore: examDetail.passingScore || 70,
        difficulty: examDetail.difficulty || '',
        courseId: examDetail.courseId || '',
        moduleId: examDetail.moduleId || '',
        status: examDetail.status || 'DRAFT'
      });
      syncQuestions(mappedQuestions);

      if (examDetail.courseId) {
        await fetchModules(examDetail.courseId);
      } else {
        setModules([]);
      }
    } catch (err) {
      setError(err.message || 'Không thể tải chi tiết bài thi.');
      setModules([]);
    }
  };

  const handleCourseChange = async (courseId) => {
    setFormData((prev) => ({
      ...prev,
      courseId,
      moduleId: ''
    }));
    await fetchModules(courseId);
  };

  const handleQuestionOptionChange = (index, value) => {
    setQuestionDraft((prev) => ({
      ...prev,
      options: prev.options.map((option, optionIndex) => (optionIndex === index ? value : option))
    }));
  };

  const handleQuestionImageUpload = async (event) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = '';
    if (!selectedFile) return;
    if (!selectedFile.type.startsWith('image/')) {
      setError('Vui lòng chọn đúng file ảnh cho sơ đồ mạng.');
      return;
    }
    try {
      setUploadingQuestionImage(true);
      setError('');
      const response = await adminApi.uploadExamQuestionImage(token, selectedFile);
      if (!response?.imageUrl) {
        throw new Error('Upload ảnh không thành công.');
      }
      setQuestionDraft((prev) => ({
        ...prev,
        imageUrl: response.imageUrl
      }));
    } catch (err) {
      setError(err.message || 'Không thể tải ảnh câu hỏi.');
    } finally {
      setUploadingQuestionImage(false);
    }
  };

  const handleBulkImportQuestions = async (event) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = '';
    if (!selectedFile) return;
    try {
      setError('');
      setImportMessage('');
      const rawText = await selectedFile.text();
      if (!rawText.trim()) {
        throw new Error('File import đang trống.');
      }
      let rawQuestions = [];
      const isJsonFile = selectedFile.name.toLowerCase().endsWith('.json');
      if (isJsonFile) {
        const parsed = JSON.parse(rawText);
        if (Array.isArray(parsed)) {
          rawQuestions = parsed;
        } else if (Array.isArray(parsed?.questions)) {
          rawQuestions = parsed.questions;
        } else {
          throw new Error('JSON không đúng định dạng. Dùng mảng câu hỏi hoặc { questions: [] }.');
        }
      } else {
        rawQuestions = toImportedQuestionsFromCsv(rawText);
      }
      if (rawQuestions.length === 0) {
        throw new Error('Không tìm thấy câu hỏi hợp lệ trong file.');
      }
      const importedQuestions = [];
      const failedRows = [];
      rawQuestions.forEach((rawQuestion, index) => {
        try {
          importedQuestions.push(normalizeImportedQuestion(rawQuestion, index));
        } catch (validationError) {
          failedRows.push(validationError.message);
        }
      });
      if (importedQuestions.length === 0) {
        throw new Error(failedRows[0] || 'Không import được câu hỏi nào.');
      }
      const nextQuestions = [...questions, ...importedQuestions];
      syncQuestions(nextQuestions);
      setImportMessage(
        failedRows.length > 0
          ? `Đã nhập ${importedQuestions.length} câu, bỏ qua ${failedRows.length} dòng lỗi.`
          : `Đã nhập thành công ${importedQuestions.length} câu hỏi.`
      );
    } catch (importError) {
      setError(importError.message || 'Không thể nhập câu hỏi từ file.');
    }
  };

  const handleSaveQuestion = () => {
    const trimmedQuestion = questionDraft.question.trim();
    const cleanedOptions = questionDraft.options.map((option) => option.trim());
    if (!trimmedQuestion) {
      setError('Vui lòng nhập nội dung câu hỏi.');
      return;
    }
    if (cleanedOptions.some((option) => !option)) {
      setError('Vui lòng nhập đầy đủ 4 đáp án.');
      return;
    }
    const nextQuestion = {
      question: trimmedQuestion,
      options: cleanedOptions,
      correctAnswer: questionDraft.correctAnswer, // Lưu dạng mảng index
      explanation: questionDraft.explanation.trim(),
      imageUrl: questionDraft.imageUrl?.trim() || ''
    };
    const nextQuestions = [...questions];
    if (editingQuestionIndex !== null) {
      nextQuestions[editingQuestionIndex] = nextQuestion;
    } else {
      nextQuestions.push(nextQuestion);
    }
    syncQuestions(nextQuestions);
    resetQuestionDraft();
    setError('');
  };

  const handleEditQuestion = (index) => {
    const targetQuestion = questions[index];
    setQuestionDraft({
      question: targetQuestion.question,
      options: [...targetQuestion.options],
      correctAnswer: targetQuestion.correctAnswer,
      explanation: targetQuestion.explanation || '',
      imageUrl: targetQuestion.imageUrl || ''
    });
    setEditingQuestionIndex(index);
  };

  const handleDeleteQuestion = (index) => {
    const nextQuestions = questions.filter((_, questionIndex) => questionIndex !== index);
    syncQuestions(nextQuestions);
    if (editingQuestionIndex === index) {
      resetQuestionDraft();
    }
  };

  const handleSubmitExam = async () => {
    try {
      setError('');
      if (!formData.title.trim()) throw new Error('Vui lòng nhập tên bài thi.');
      if (!formData.durationMinutes) throw new Error('Vui lòng nhập thời gian thi.');
      if (questions.length === 0) throw new Error('Cần ít nhất 1 câu hỏi cho bài thi.');

      const payload = {
        title: formData.title.trim(),
        examCode: formData.examCode.trim() || null,
        totalQuestions: questions.length,
        durationMinutes: formData.durationMinutes,
        passingScore: formData.passingScore,
        difficulty: formData.difficulty || null,
        courseId: formData.courseId || null,
        moduleId: formData.moduleId || null,
        status: formData.status || 'DRAFT',
        questions
      };

      if (isEditMode && selectedExam) {
        await adminApi.updateExam(token, selectedExam.id, payload);
      } else {
        await adminApi.createExam(token, payload);
      }

      setIsModalOpen(false);
      onSuccess();
    } catch (err) {
      setError(err.message);
    }
  };

  return {
    isModalOpen,
    setIsModalOpen,
    isEditMode,
    formData,
    setFormData,
    questions,
    questionDraft,
    setQuestionDraft,
    editingQuestionIndex,
    modules,
    error,
    setError,
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
    resetQuestionDraft
  };
};
