import React, { useState, useEffect, useContext, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, ChevronDown, ChevronRight,
  BookOpen, FileText, Video, Tag, X, Check, CheckCircle2,
  Loader2, AlertTriangle, Link, AlignLeft, Hash, ArrowRight,
  Save, PlusCircle, Layers, Clock, Eye, Pencil
} from 'lucide-react';
import { adminApi } from '../../../services/api/adminApi';
import { AuthContext } from '../../../context/AuthContext';
import AdminModal from '../Components/AdminModal';
import '../../../css/Admin/AdminViews.css';
import '../../../css/Lesson.css';
import MarkdownRenderer from '../../Common/MarkdownRenderer';

// ─── Constants ────────────────────────────────────────────────────────────────
const stepLabels = ['Cơ bản', 'Nội dung', 'Rà soát'];
const initialModuleForm = { title: '', description: '' };
const initialLessonForm = {
  title: '', sectionNumber: '', contentHtml: '', videoUrl: '', videoDuration: ''
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const isValidUrl = (value) => {
  if (!value) return true;
  try { new URL(value); return true; } catch { return false; }
};

const getNextSectionNumber = (moduleItem) => {
  if (!moduleItem?.lessons?.length) return '';
  const sorted = [...moduleItem.lessons].sort((a, b) => {
    return (parseFloat(a.sectionNumber) || 0) - (parseFloat(b.sectionNumber) || 0);
  });
  const lastNum = sorted[sorted.length - 1].sectionNumber;
  if (!lastNum) return '';
  const parts = lastNum.split('.');
  const num = parseInt(parts[parts.length - 1], 10);
  if (!isNaN(num)) {
    parts[parts.length - 1] = (num + 1).toString();
    return parts.join('.');
  }
  return lastNum;
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function Stepper({ current, total }) {
  return (
    <div className="acm-stepper">
      {Array.from({ length: total }).map((_, index) => {
        const stepNumber = index + 1;
        const done = stepNumber < current;
        const active = stepNumber === current;
        return (
          <div key={stepNumber} className="acm-stepper-item">
            <div className={`acm-step-dot ${done ? 'done' : ''} ${active ? 'active' : ''}`}>
              {done ? <Check size={12} /> : stepNumber}
            </div>
            <span className={`acm-step-label ${active ? 'active' : ''}`}>
              {stepLabels[index]}
            </span>
            {stepNumber < total
              ? <span className={`acm-step-line ${done ? 'done' : ''}`} />
              : null}
          </div>
        );
      })}
    </div>
  );
}

function Toast({ message, onClose }) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 2800);
    return () => window.clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="acm-toast" role="status">
      <CheckCircle2 size={16} />
      <span>{message}</span>
      <button type="button" onClick={onClose}><X size={14} /></button>
    </div>
  );
}

// Fix 3: React.memo để tránh re-render không cần thiết
const ModuleAccordion = React.memo(function ModuleAccordion({
  module, index, isOpen, activeModuleId, activeLessonId,
  onToggle, onActivateModule, onCreateLesson, onEditModule,
  onDeleteModule, onSelectLesson, onDeleteLesson
}) {
  return (
    <article className={`acm-module-item ${isOpen ? 'open' : ''}`}>
      <button
        type="button"
        className="acm-module-toggle"
        onClick={() => { onToggle(module.id); onActivateModule(module); }}
      >
        <span className="acm-module-index">{index + 1}</span>
        <span className="acm-module-main">
          <strong>{module.title}</strong>
          <small>{module.lessons?.length || 0} bài học</small>
        </span>
        <span className="acm-module-badge">{module.lessons?.length || 0}</span>
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>

      {isOpen ? (
        <div className="acm-module-content">
          <div className="acm-module-lesson-list">
            {(module.lessons || []).map((lesson) => (
              <div key={lesson.id} className="acm-module-lesson-row">
                <button
                  type="button"
                  // Fix 7: so sánh trực tiếp vì đã normalize
                  className={`acm-module-lesson-item ${activeLessonId === lesson.id ? 'active' : ''}`}
                  onClick={() => onSelectLesson(module, lesson)}
                >
                  {lesson.videoUrl ? <Video size={13} /> : <FileText size={13} />}
                  <span>
                    {lesson.sectionNumber ? `${lesson.sectionNumber} ` : ''}
                    {lesson.title}
                  </span>
                </button>
                <button
                  type="button"
                  className="acm-action-btn danger acm-module-lesson-delete"
                  title="Xóa bài học"
                  onClick={() => onDeleteLesson(lesson.id)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>

          <div className="acm-module-actions">
            <button
              type="button"
              // Fix 7: so sánh trực tiếp
              className={`acm-module-add-lesson ${activeModuleId === module.id ? 'active' : ''}`}
              onClick={() => onCreateLesson(module)}
            >
              <Plus size={13} /> Thêm bài học
            </button>
            <button type="button" className="acm-module-edit" title="Sửa chương"
              onClick={() => onEditModule(module)}>
              <Pencil size={13} />
            </button>
            <button type="button" className="acm-module-delete" title="Xóa chương"
              onClick={() => onDeleteModule(module.id)}>
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
});

function ReviewRow({ label, value, mono }) {
  return (
    <div className="acm-review-row">
      <span>{label}</span>
      <strong className={mono ? 'mono' : ''}>{value || '—'}</strong>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const CourseDetail = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { token } = useContext(AuthContext);

  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [topics, setTopics] = useState([]);
  const [openModules, setOpenModules] = useState({});
  const [activeModuleId, setActiveModuleId] = useState(null);
  const [editingLessonId, setEditingLessonId] = useState(null);

  const [loading, setSaving] = useState(true);
  const [savingLesson, setSavingLesson] = useState(false);
  const [savingModule, setSavingModule] = useState(false);

  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  const [moduleForm, setModuleForm] = useState(initialModuleForm);
  const [lessonForm, setLessonForm] = useState(initialLessonForm);
  const [topicInput, setTopicInput] = useState('');
  const [step, setStep] = useState(1);

  // Fix 6: tách error state
  const [pageError, setPageError] = useState('');
  const [modalError, setModalError] = useState('');
  const [lessonErrors, setLessonErrors] = useState({});
  const [toast, setToast] = useState('');

  // Fix 2: isMounted ref
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const activeModule = useMemo(
    () => modules.find(mod => mod.id === activeModuleId) || null,
    [modules, activeModuleId]
  );

  const courseStats = useMemo(() => ({
    moduleCount: modules.length,
    lessonCount: modules.reduce((sum, m) => sum + (m.lessons?.length || 0), 0)
  }), [modules]);

  const buildOpenMap = useCallback((moduleList, prev = {}) => {
    const nextMap = {};
    moduleList.forEach((m, index) => {
      nextMap[m.id] = Object.prototype.hasOwnProperty.call(prev, m.id)
        ? prev[m.id]
        : index === 0;
    });
    return nextMap;
  }, []);

  // Fix 2 + Fix 7: guard setState + normalize ID
  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent && isMounted.current) setSaving(true);
      setPageError('');

      const [coursesRes, modulesRes, topicsRes] = await Promise.all([
        adminApi.getCourses(token, 1),
        adminApi.getModules(token, courseId),
        adminApi.getTopics(token, courseId)
      ]);

      if (!isMounted.current) return;

      const list = coursesRes.data || [];
      const found = list.find(item => String(item.id) === String(courseId));
      setCourse(found || { id: courseId, title: `Khóa học #${courseId}` });

      // Fix 7: normalize tất cả ID thành string 1 lần duy nhất
      const modulesData = (modulesRes.data || []).map(m => ({
        ...m,
        id: String(m.id),
        lessons: (m.lessons || []).map(l => ({ ...l, id: String(l.id) }))
      }));

      setModules(modulesData);
      setOpenModules(prev => buildOpenMap(modulesData, prev));
      setTopics(topicsRes.data || []);

      setActiveModuleId(prev =>
        prev && !modulesData.some(mod => mod.id === prev) ? null : prev
      );
      setEditingLessonId(prev =>
        prev && !modulesData.some(mod => (mod.lessons || []).some(l => l.id === prev))
          ? null
          : prev
      );
    } catch (err) {
      if (isMounted.current) setPageError(err.message || 'Không thể tải dữ liệu khóa học.');
    } finally {
      if (!silent && isMounted.current) setSaving(false);
    }
  }, [token, courseId, buildOpenMap]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fix 5: bỏ default value, yêu cầu truyền targetStep tường minh
  const validateStep = useCallback((targetStep) => {
    const nextErrors = {};
    if (targetStep === 1 && !lessonForm.title.trim()) {
      nextErrors.title = 'Tên bài học là trường bắt buộc.';
    }
    if (targetStep === 2 && lessonForm.videoUrl.trim() && !isValidUrl(lessonForm.videoUrl.trim())) {
      nextErrors.videoUrl = 'Video URL không hợp lệ.';
    }
    setLessonErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [lessonForm]);

  // Fix 4: useCallback cho tất cả handlers
  const toggleModule = useCallback((moduleId) => {
    setOpenModules(prev => ({ ...prev, [moduleId]: !prev[moduleId] }));
  }, []);

  const activateModule = useCallback((moduleItem) => {
    setActiveModuleId(String(moduleItem.id));
    setEditingLessonId(null);
    setLessonForm(initialLessonForm);
    setLessonErrors({});
    setStep(1);
  }, []);

  const openCreateLessonComposer = useCallback((moduleItem) => {
    setActiveModuleId(String(moduleItem.id));
    setEditingLessonId(null);
    setStep(1);
    setLessonErrors({});
    setLessonForm({ ...initialLessonForm, sectionNumber: getNextSectionNumber(moduleItem) });
    setOpenModules(prev => ({ ...prev, [String(moduleItem.id)]: true }));
  }, []);

  const openEditLessonComposer = useCallback((moduleItem, lesson) => {
    setActiveModuleId(String(moduleItem.id));
    setEditingLessonId(String(lesson.id));
    setStep(1);
    setLessonErrors({});
    setLessonForm({
      title: lesson.title || '',
      sectionNumber: lesson.sectionNumber || '',
      videoUrl: lesson.videoUrl || '',
      videoDuration: lesson.videoDuration || '',
      contentHtml: lesson.contentHtml || ''
    });
    setOpenModules(prev => ({ ...prev, [String(moduleItem.id)]: true }));
  }, []);

  const openCreateModuleModal = useCallback(() => {
    setEditingModule(null);
    setModuleForm(initialModuleForm);
    setModalError(''); // Fix 6
    setIsModuleModalOpen(true);
  }, []);

  const openEditModuleModal = useCallback((moduleItem) => {
    setEditingModule(moduleItem);
    setModuleForm({ title: moduleItem.title || '', description: moduleItem.description || '' });
    setModalError(''); // Fix 6
    setIsModuleModalOpen(true);
  }, []);

  const handleLessonChange = useCallback((field, value) => {
    let finalValue = value;
    if (field === 'sectionNumber') finalValue = value.replace(/[^0-9.]/g, '');
    setLessonForm(prev => ({ ...prev, [field]: finalValue }));
    if (lessonErrors[field]) setLessonErrors(prev => ({ ...prev, [field]: '' }));
  }, [lessonErrors]);

  const handleSubmitModule = useCallback(async () => {
    try {
      setModalError(''); // Fix 6
      if (!moduleForm.title.trim()) throw new Error('Vui lòng nhập tên chương.');
      setSavingModule(true);

      if (editingModule) {
        await adminApi.updateModule(token, editingModule.id, {
          title: moduleForm.title.trim(),
          description: moduleForm.description.trim()
        });
        setToast('Đã cập nhật chương.');
      } else {
        await adminApi.createModule(token, courseId, {
          title: moduleForm.title.trim(),
          description: moduleForm.description.trim()
        });
        setToast('Đã tạo chương mới.');
      }

      setIsModuleModalOpen(false);
      setEditingModule(null);
      setModuleForm(initialModuleForm);
      await fetchData(true);
    } catch (err) {
      setModalError(err.message || 'Không thể lưu chương.'); // Fix 6
    } finally {
      setSavingModule(false);
    }
  }, [moduleForm, editingModule, token, courseId, fetchData]);

  const handleDeleteModule = useCallback(async (moduleId) => {
    if (!window.confirm('Bạn có chắc muốn xóa chương này và toàn bộ bài học bên trong?')) return;
    try {
      await adminApi.deleteModule(token, moduleId);
      setToast('Đã xóa chương.');
      if (activeModuleId === moduleId) {
        setActiveModuleId(null);
        setEditingLessonId(null);
        setLessonForm(initialLessonForm);
      }
      await fetchData(true);
    } catch (err) {
      setPageError(err.message || 'Không thể xóa chương.'); // Fix 6
    }
  }, [token, activeModuleId, fetchData]);

  const handleDeleteLesson = useCallback(async (lessonId) => {
    if (!window.confirm('Bạn có chắc muốn xóa bài học này?')) return;
    try {
      await adminApi.deleteLesson(token, lessonId);
      setToast('Đã xóa bài học.');
      if (editingLessonId === lessonId) {
        setEditingLessonId(null);
        setLessonForm(initialLessonForm);
        setStep(1);
      }
      await fetchData(true);
    } catch (err) {
      setPageError(err.message || 'Không thể xóa bài học.'); // Fix 6
    }
  }, [token, editingLessonId, fetchData]);

  const handleAddTopic = useCallback(async () => {
    const title = topicInput.trim();
    if (!title) return;
    try {
      await adminApi.createTopic(token, courseId, { title });
      setTopicInput('');
      await fetchData(true);
      setToast('Đã thêm chủ đề.');
    } catch (err) {
      setPageError(err.message || 'Không thể thêm chủ đề.'); // Fix 6
    }
  }, [topicInput, token, courseId, fetchData]);

  const handleDeleteTopic = useCallback(async (topicId) => {
    if (!window.confirm('Xóa chủ đề này?')) return;
    try {
      await adminApi.deleteTopic(token, topicId);
      await fetchData(true);
      setToast('Đã xóa chủ đề.');
    } catch (err) {
      setPageError(err.message || 'Không thể xóa chủ đề.'); // Fix 6
    }
  }, [token, fetchData]);

  // Fix 1 + Fix 5: bỏ double fetch, truyền step tường minh
  const handleSaveLesson = useCallback(async (andAddAnother = false) => {
    if (!activeModuleId) return;
    if (!validateStep(step)) return; // Fix 5

    try {
      setSavingLesson(true);
      setLessonErrors(prev => ({ ...prev, submit: '' }));

      const payload = {
        title: lessonForm.title.trim(),
        sectionNumber: lessonForm.sectionNumber.trim(),
        videoUrl: lessonForm.videoUrl.trim(),
        videoDuration: lessonForm.videoDuration.trim(),
        contentHtml: lessonForm.contentHtml
      };

      if (editingLessonId) {
        await adminApi.updateLesson(token, editingLessonId, payload);
        setToast('Đã cập nhật bài học.');
      } else {
        await adminApi.createLesson(token, activeModuleId, payload);
        setToast('Đã tạo bài học thành công.');
      }

      await fetchData(true);

      if (!editingLessonId && andAddAnother) {
        // Fix 1: đọc từ state mới nhất, không gọi API lần 2
        setModules(prev => {
          const updatedModule = prev.find(m => m.id === activeModuleId);
          setLessonForm({
            ...initialLessonForm,
            sectionNumber: getNextSectionNumber(updatedModule)
          });
          return prev;
        });
        setLessonErrors({});
        setStep(1);
        return;
      }

      if (!editingLessonId) setActiveModuleId(null);
      setEditingLessonId(null);
      setLessonForm(initialLessonForm);
      setLessonErrors({});
      setStep(1);
    } catch (err) {
      setLessonErrors(prev => ({ ...prev, submit: err.message || 'Không thể lưu bài học.' }));
    } finally {
      setSavingLesson(false);
    }
  }, [activeModuleId, validateStep, step, lessonForm, editingLessonId, token, fetchData]);

  // Fix 5: truyền step tường minh
  const handleNext = useCallback(() => {
    if (!validateStep(step)) return;
    setStep(prev => Math.min(prev + 1, 3));
  }, [validateStep, step]);

  const handleBack = useCallback(() => {
    setStep(prev => Math.max(prev - 1, 1));
  }, []);

  const handleCloseToast = useCallback(() => setToast(''), []);

  if (loading) {
    return (
      <div className="users-wrapper acm-loading-page">
        <Loader2 size={20} className="acm-spin" /> Đang tải dữ liệu...
      </div>
    );
  }

  return (
    <div className="users-wrapper acm-detail-page">
      <header className="acm-detail-head">
        <button type="button" className="acm-ghost-btn" onClick={() => navigate('/admin/courses')}>
          <ArrowLeft size={16} /> Quay lại
        </button>
        <div className="acm-detail-info">
          <h3 className="acm-detail-title">{course?.title || 'Khóa học'}</h3>
          <p className="acm-detail-subtitle">
            Mã: {course?.code || course?.id} · {courseStats.moduleCount} chương · {courseStats.lessonCount} bài học
          </p>
        </div>
        <button type="button" className="acm-primary-btn" onClick={openCreateModuleModal}>
          <Plus size={15} /> Thêm chương
        </button>
      </header>

      {/* Fix 6: dùng pageError */}
      {pageError ? <p className="acm-form-error">{pageError}</p> : null}

      <section className="acm-topic-panel">
        <div className="acm-topic-header">
          <Tag size={15} /><strong>Chủ đề khóa học</strong>
        </div>
        <div className="acm-topic-list">
          {topics.length === 0 ? <span className="acm-topic-empty">Chưa có chủ đề</span> : null}
          {topics.map((topic) => (
            <span key={topic.id} className="acm-topic-chip">
              {topic.title}
              <button type="button" onClick={() => handleDeleteTopic(topic.id)}>
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
        <div className="acm-topic-input-row">
          <input
            className="acm-input"
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            placeholder="Thêm chủ đề mới"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTopic(); } }}
          />
          <button type="button" className="acm-secondary-btn" onClick={handleAddTopic}>
            <Plus size={14} /> Thêm
          </button>
        </div>
      </section>

      <section className="acm-detail-layout">
        <aside className="acm-module-sidebar">
          <div className="acm-module-sidebar-head">
            <h4>Modules</h4><span>{modules.length}</span>
          </div>
          {modules.length === 0 ? (
            <div className="acm-empty-state compact">
              <BookOpen size={30} /><p>Chưa có module. Hãy tạo chương đầu tiên.</p>
            </div>
          ) : (
            <div className="acm-module-list">
              {modules.map((moduleItem, index) => (
                // Fix 3: ModuleAccordion đã được React.memo
                // Fix 4: tất cả handlers đã useCallback → stable reference
                <ModuleAccordion
                  key={moduleItem.id}
                  module={moduleItem}
                  index={index}
                  isOpen={!!openModules[moduleItem.id]}
                  activeModuleId={activeModuleId}
                  activeLessonId={editingLessonId}
                  onToggle={toggleModule}
                  onActivateModule={activateModule}
                  onCreateLesson={openCreateLessonComposer}
                  onEditModule={openEditModuleModal}
                  onDeleteModule={handleDeleteModule}
                  onSelectLesson={openEditLessonComposer}
                  onDeleteLesson={handleDeleteLesson}
                />
              ))}
            </div>
          )}
        </aside>

        <main className="acm-composer-pane">
          {!activeModule ? (
            <div className="acm-composer-empty">
              <div className="acm-empty-icon"><PlusCircle size={28} /></div>
              <h4>Chọn module để xem và sửa</h4>
              <p>Bấm vào module và chọn bài học bên trái để xem lại nội dung đã tạo.</p>
            </div>
          ) : (
            <div className="acm-composer">
              <div className="acm-composer-header">
                <div>
                  <p className="acm-composer-module">{activeModule.title}</p>
                  <p className="acm-composer-mode">
                    {editingLessonId ? 'Đang sửa bài học đã tạo' : 'Đang tạo bài học mới'}
                  </p>
                  <h4 className="acm-composer-title">
                    {lessonForm.title || 'Bài học chưa có tiêu đề'}
                  </h4>
                </div>
                <Stepper current={step} total={3} />
              </div>

              <div className="acm-composer-body">
                {step === 1 ? (
                  <div className="acm-step-content">
                    <label className="acm-field">
                      <span><AlignLeft size={12} /> Tiêu đề bài học *</span>
                      <input
                        className={`acm-input ${lessonErrors.title ? 'error' : ''}`}
                        value={lessonForm.title}
                        onChange={(e) => handleLessonChange('title', e.target.value)}
                        placeholder="VD: Network Services - DHCP, DNS, NAT"
                      />
                      {lessonErrors.title ? <em className="acm-error-text">{lessonErrors.title}</em> : null}
                    </label>
                    <label className="acm-field">
                      <span><Hash size={12} /> Số thứ tự (Section)</span>
                      <input
                        className="acm-input mono"
                        value={lessonForm.sectionNumber}
                        onChange={(e) => handleLessonChange('sectionNumber', e.target.value)}
                        placeholder="1.2.1"
                      />
                      <small className="acm-field-hint">Để trống nếu muốn hệ thống tự sinh số thứ tự.</small>
                    </label>
                    <div className="acm-note-box">
                      <Layers size={14} />
                      <p>Tiêu đề rõ ràng sẽ giúp học viên tìm bài và theo dõi tiến trình dễ hơn.</p>
                    </div>
                  </div>
                ) : null}

                {step === 2 ? (
                  <div className="acm-step-content">
                    <label className="acm-field">
                      <span><Link size={12} /> Video URL</span>
                      <input
                        className={`acm-input mono ${lessonErrors.videoUrl ? 'error' : ''}`}
                        value={lessonForm.videoUrl}
                        onChange={(e) => handleLessonChange('videoUrl', e.target.value)}
                        placeholder="https://youtube.com/watch?v=..."
                      />
                      {lessonErrors.videoUrl
                        ? <em className="acm-error-text">{lessonErrors.videoUrl}</em>
                        : null}
                    </label>
                    <label className="acm-field">
                      <span><Clock size={12} /> Thời lượng video</span>
                      <input
                        className="acm-input"
                        value={lessonForm.videoDuration}
                        onChange={(e) => handleLessonChange('videoDuration', e.target.value)}
                        placeholder="VD: 10:30"
                      />
                    </label>
                    <label className="acm-field">
                      <span><AlignLeft size={12} /> Nội dung bài học (Markdown)</span>
                      <div className="acm-editor-split" style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                        <div className="acm-editor-box" style={{ flex: 1 }}>
                          <div className="acm-editor-toolbar" style={{ borderBottom: '1px solid #e2e8f0', padding: '0.5rem', background: '#f8fafc', display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Soạn thảo Markdown</span>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Clock size={11} /> Auto save
                            </span>
                          </div>
                          <textarea
                            className="acm-editor-textarea"
                            style={{ width: '100%', minHeight: '350px', padding: '1rem', border: 'none', outline: 'none', resize: 'vertical', fontFamily: 'monospace', fontSize: '14px', lineHeight: 1.6 }}
                            value={lessonForm.contentHtml}
                            onChange={(e) => handleLessonChange('contentHtml', e.target.value)}
                            placeholder="Sử dụng Markdown..."
                          />
                        </div>
                        <div className="acm-editor-preview" style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '0.5rem', background: '#fff', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                          <div style={{ borderBottom: '1px solid #e2e8f0', padding: '0.5rem 1rem', background: '#f8fafc', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
                            Xem trước (Live Preview)
                          </div>
                          <div className="acm-preview-content" style={{ padding: '1rem', overflowY: 'auto', maxHeight: '400px' }}>
                            <MarkdownRenderer content={lessonForm.contentHtml || ''} />
                          </div>
                        </div>
                      </div>
                    </label>
                    <small className="acm-field-hint">{lessonForm.contentHtml.length} ký tự (Lưu dạng Markdown)</small>
                  </div>
                ) : null}

                {step === 3 ? (
                  <div className="acm-step-content">
                    <div className="acm-review-card">
                      <h5><Eye size={13} /> Tóm tắt bài học</h5>
                      <ReviewRow label="Tiêu đề" value={lessonForm.title} />
                      <ReviewRow label="Section" value={lessonForm.sectionNumber || '(Tự sinh)'} mono />
                      <ReviewRow label="Module" value={activeModule.title} />
                      <ReviewRow label="Video URL" value={lessonForm.videoUrl || '—'} mono />
                      <ReviewRow label="Thời lượng" value={lessonForm.videoDuration || '—'} />
                      <ReviewRow label="Độ dài nội dung" value={`${lessonForm.contentHtml.length} ký tự`} />
                    </div>
                    {!lessonForm.videoUrl && !lessonForm.contentHtml ? (
                      <div className="acm-warning-box">
                        <AlertTriangle size={15} />
                        <p>Bài học đang để trống. Bạn có thể lưu nháp và bổ sung sau.</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {lessonErrors.submit
                  ? <p className="acm-form-error">{lessonErrors.submit}</p>
                  : null}
              </div>

              <div className="acm-composer-footer">
                <button
                  type="button"
                  className="acm-btn-muted"
                  disabled={savingLesson}
                  onClick={step === 1 ? () => {
                    setActiveModuleId(null);
                    setEditingLessonId(null);
                    setLessonForm(initialLessonForm);
                    setLessonErrors({});
                  } : handleBack}
                >
                  <ArrowLeft size={13} />
                  {step === 1 ? 'Hủy' : 'Quay lại'}
                </button>

                <div className="acm-composer-actions-right">
                  {step < 3 ? (
                    <button type="button" className="acm-primary-btn" onClick={handleNext} disabled={savingLesson}>
                      Tiếp theo <ArrowRight size={13} />
                    </button>
                  ) : (
                    <>
                      {!editingLessonId ? (
                        <button
                          type="button"
                          className="acm-btn-outline"
                          disabled={savingLesson}
                          onClick={() => handleSaveLesson(true)}
                        >
                          {savingLesson ? <Loader2 size={13} className="acm-spin" /> : <PlusCircle size={13} />}
                          Lưu & thêm mới
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="acm-primary-btn"
                        disabled={savingLesson}
                        onClick={() => handleSaveLesson(false)}
                      >
                        {savingLesson ? <Loader2 size={13} className="acm-spin" /> : <Save size={13} />}
                        {editingLessonId ? 'Lưu cập nhật' : 'Lưu bài học'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeModule ? (
            <section className="acm-module-lessons">
              <h5>Danh sách bài học trong module</h5>
              {activeModule.lessons?.length ? (
                <div className="acm-lesson-list">
                  {activeModule.lessons.map((lesson) => (
                    <article
                      key={lesson.id}
                      // Fix 7: so sánh trực tiếp
                      className={`acm-lesson-row ${editingLessonId === lesson.id ? 'active' : ''}`}
                    >
                      <span>
                        {lesson.videoUrl ? <Video size={13} /> : <FileText size={13} />}
                        {lesson.sectionNumber ? `${lesson.sectionNumber} ` : ''}
                        {lesson.title}
                      </span>
                      <div className="acm-lesson-row-actions">
                        <button
                          type="button"
                          className="acm-action-btn"
                          title="Sửa bài học"
                          onClick={() => openEditLessonComposer(activeModule, lesson)}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="acm-action-btn danger"
                          title="Xóa bài học"
                          onClick={() => handleDeleteLesson(lesson.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="acm-cell-muted">Module này chưa có bài học nào.</p>
              )}
            </section>
          ) : null}
        </main>
      </section>

      <AdminModal
        title={editingModule ? 'Cập nhật chương' : 'Thêm chương mới'}
        description="Bạn có thể xem lại thông tin chương đã tạo và cập nhật trực tiếp."
        isOpen={isModuleModalOpen}
        onClose={() => { setIsModuleModalOpen(false); setEditingModule(null); }}
        onConfirm={handleSubmitModule}
        confirmText={savingModule ? 'Đang lưu...' : editingModule ? 'Lưu thay đổi' : 'Tạo chương'}
      >
        {/* Fix 6: dùng modalError */}
        {modalError ? <p className="acm-form-error">{modalError}</p> : null}
        <div className="acm-form-grid">
          <label className="acm-field">
            <span>Tên chương *</span>
            <input
              className="acm-input"
              placeholder="VD: Introduction to TCP/IP"
              value={moduleForm.title}
              onChange={(e) => setModuleForm(prev => ({ ...prev, title: e.target.value }))}
            />
          </label>
          <label className="acm-field">
            <span>Mô tả</span>
            <textarea
              className="acm-textarea"
              value={moduleForm.description}
              onChange={(e) => setModuleForm(prev => ({ ...prev, description: e.target.value }))}
            />
          </label>
        </div>
      </AdminModal>

      {toast ? <Toast message={toast} onClose={handleCloseToast} /> : null}
    </div>
  );
};

export default CourseDetail;