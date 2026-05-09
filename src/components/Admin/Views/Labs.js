import React, { useState, useEffect, useContext, useRef, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  FileCode2,
  Eye,
  Pencil,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link2,
  ImageIcon,
  FileUp
} from 'lucide-react';
import { adminApi } from '../../../services/api/adminApi';
import { AuthContext } from '../../../context/AuthContext';
import AdminModal from '../Components/AdminModal';
import AdminPagination from '../Components/AdminPagination';
import CustomSelect from '../Components/CustomSelect';
import '../../../css/Admin/AdminViews.css';

const LAB_TABS = [
  { id: 'basic', label: 'Thông tin cơ bản' },
  { id: 'content', label: 'Nội dung & Các bước' },
  { id: 'media', label: 'Tài nguyên & Công cụ' }
];

const CATEGORY_OPTIONS = [
  { value: '', label: '-- Chọn danh mục --' },
  { value: 'Routing', label: 'Routing' },
  { value: 'Switching', label: 'Switching' },
  { value: 'Security', label: 'Security' },
  { value: 'Services', label: 'Services' },
  { value: 'Automation', label: 'Automation' },
  { value: 'Troubleshooting', label: 'Troubleshooting' }
];

const DIFFICULTY_OPTIONS = [
  { value: 'EASY', label: 'Dễ (EASY)' },
  { value: 'MEDIUM', label: 'Trung bình (MEDIUM)' },
  { value: 'HARD', label: 'Khó (HARD)' }
];

const DIFFICULTY_LABEL_MAP = {
  EASY: 'Dễ',
  MEDIUM: 'Trung bình',
  HARD: 'Khó'
};

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Nháp' },
  { value: 'PUBLISHED', label: 'Đã xuất bản' },
  { value: 'ARCHIVED', label: 'Lưu trữ' }
];

const STATUS_BADGE_MAP = {
  DRAFT: { label: 'Nháp', className: 'inactive' },
  PUBLISHED: { label: 'Đã xuất bản', className: 'active' },
  ARCHIVED: { label: 'Lưu trữ', className: 'student' }
};

const createInitialFormData = () => ({
  title: '',
  category: '',
  difficulty: 'EASY',
  status: 'DRAFT',
  duration: '',
  guideContent: '',
  objective: '',
  courseId: '',
  moduleId: '',
  toolsText: '',
  filePka: null,
  thumbnailImg: null,
  topologyImg: null,
  steps: [{ title: '', commands: '', note: '' }]
});

const parseToolsInput = (toolsText) =>
  String(toolsText || '')
    .split(/[\n,]/)
    .map((tool) => tool.trim())
    .filter(Boolean);

const normalizeToolsToText = (toolsValue) => {
  if (Array.isArray(toolsValue)) return toolsValue.join(', ');
  if (typeof toolsValue === 'string') return toolsValue;
  return '';
};

const normalizeStepCommandsToText = (commandsValue) => {
  if (Array.isArray(commandsValue)) return commandsValue.join('\n');
  if (typeof commandsValue === 'string') return commandsValue;
  return '';
};

const hasRichTextContent = (html) =>
  String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .trim()
    .length > 0;

const mapLabToFormData = (lab) => {
  const normalizedSteps = Array.isArray(lab?.steps) && lab.steps.length > 0
    ? lab.steps.map((step) => ({
      title: String(step?.title || ''),
      commands: normalizeStepCommandsToText(step?.commands),
      note: String(step?.note || '')
    }))
    : [{ title: '', commands: '', note: '' }];

  return {
    title: String(lab?.title || ''),
    category: String(lab?.category || ''),
    difficulty: String(lab?.difficulty || 'EASY'),
    status: String(lab?.status || 'DRAFT'),
    duration: String(lab?.duration || ''),
    guideContent: String(lab?.guideContent || ''),
    objective: String(lab?.objective || ''),
    courseId: String(lab?.courseId || ''),
    moduleId: String(lab?.moduleId || ''),
    toolsText: normalizeToolsToText(lab?.tools),
    filePka: null,
    thumbnailImg: null,
    topologyImg: null,
    steps: normalizedSteps
  };
};

const RichTextEditor = ({ value, onChange, placeholder }) => {
  const editorRef = useRef(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const runCommand = (command, commandValue = null) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, commandValue);
    onChange(editorRef.current.innerHTML);
  };

  const handleLink = () => {
    const url = window.prompt('Nhập URL liên kết');
    if (!url) return;
    runCommand('createLink', url);
  };

  return (
    <div className="labm-rte-shell">
      <div className="labm-rte-toolbar">
        <button
          type="button"
          className="labm-rte-btn"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runCommand('bold')}
          title="In đậm"
        >
          <Bold size={14} />
        </button>
        <button
          type="button"
          className="labm-rte-btn"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runCommand('italic')}
          title="In nghiêng"
        >
          <Italic size={14} />
        </button>
        <button
          type="button"
          className="labm-rte-btn"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runCommand('underline')}
          title="Gạch chân"
        >
          <Underline size={14} />
        </button>
        <button
          type="button"
          className="labm-rte-btn"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runCommand('insertUnorderedList')}
          title="Danh sách chấm"
        >
          <List size={14} />
        </button>
        <button
          type="button"
          className="labm-rte-btn"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runCommand('insertOrderedList')}
          title="Danh sách số"
        >
          <ListOrdered size={14} />
        </button>
        <button
          type="button"
          className="labm-rte-btn"
          onMouseDown={(event) => event.preventDefault()}
          onClick={handleLink}
          title="Chèn liên kết"
        >
          <Link2 size={14} />
        </button>
      </div>

      <div
        ref={editorRef}
        className="labm-rte-editor"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={(event) => onChange(event.currentTarget.innerHTML)}
      />
    </div>
  );
};

const Labs = () => {
  const { token } = useContext(AuthContext);

  const [labs, setLabs] = useState([]);
  const [courses, setCourses] = useState([]);
  const [courseModules, setCourseModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingModules, setLoadingModules] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 10;

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState('create'); // create | edit
  const [editingLabId, setEditingLabId] = useState(null);
  const [activeTab, setActiveTab] = useState('basic');
  const [formData, setFormData] = useState(createInitialFormData());
  const [previews, setPreviews] = useState({ thumbnail: null, topology: null });
  const [error, setError] = useState('');

  const [selectedLabForView, setSelectedLabForView] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  const toolsPreview = useMemo(() => parseToolsInput(formData.toolsText), [formData.toolsText]);

  const fetchLabs = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const res = await adminApi.getLabs(token, page);
      setLabs(res.data || []);
      if (res.pagination) {
        setTotalPages(res.pagination.totalPages || 1);
        setTotalItems(res.pagination.total || 0);
        setCurrentPage(res.pagination.page || 1);
      }
    } catch (fetchError) {
      console.error(fetchError);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchCourses = useCallback(async () => {
    try {
      const res = await adminApi.getCourses(token, 1);
      setCourses(res.data || []);
    } catch (fetchError) {
      console.error('Failed to load courses', fetchError);
    }
  }, [token]);

  useEffect(() => {
    fetchLabs(currentPage);
  }, [fetchLabs, currentPage]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  useEffect(() => {
    const fetchModules = async () => {
      if (!formData.courseId) {
        setCourseModules([]);
        return;
      }
      try {
        setLoadingModules(true);
        const res = await adminApi.getModules(token, formData.courseId);
        setCourseModules(res.data || []);
      } catch (fetchError) {
        console.error('Failed to load modules', fetchError);
        setCourseModules([]);
      } finally {
        setLoadingModules(false);
      }
    };

    fetchModules();
  }, [formData.courseId, token]);

  const resetFormState = useCallback(() => {
    setFormData(createInitialFormData());
    setPreviews({ thumbnail: null, topology: null });
    setCourseModules([]);
    setActiveTab('basic');
    setError('');
    setEditingLabId(null);
    setEditorMode('create');
  }, []);

  const openCreateEditor = () => {
    resetFormState();
    setEditorMode('create');
    setIsEditorOpen(true);
  };

  const openEditEditor = (lab) => {
    setEditorMode('edit');
    setEditingLabId(lab.id);
    setFormData(mapLabToFormData(lab));
    setPreviews({
      thumbnail: lab.imageUrl || null,
      topology: lab.topologyImgUrl || null
    });
    setActiveTab('basic');
    setError('');
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
    setError('');
  };

  const openViewModal = (lab) => {
    setSelectedLabForView(lab);
    setIsViewModalOpen(true);
  };

  const handleAddStep = () => {
    setFormData((prev) => ({
      ...prev,
      steps: [...prev.steps, { title: '', commands: '', note: '' }]
    }));
  };

  const handleRemoveStep = (index) => {
    setFormData((prev) => ({
      ...prev,
      steps: prev.steps.filter((_, stepIndex) => stepIndex !== index)
    }));
  };

  const handleStepChange = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      steps: prev.steps.map((step, stepIndex) =>
        stepIndex === index ? { ...step, [field]: value } : step
      )
    }));
  };

  const handleFileChange = (event, field) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (field === 'filePka' && !/\.(pkt|pka)$/i.test(file.name)) {
      setError('File Packet Tracer phải có đuôi .pkt hoặc .pka');
      event.target.value = '';
      return;
    }

    setError('');
    setFormData((prev) => ({ ...prev, [field]: file }));

    if (field === 'thumbnailImg' || field === 'topologyImg') {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews((prev) => ({
          ...prev,
          [field === 'thumbnailImg' ? 'thumbnail' : 'topology']: reader.result
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    const title = formData.title.trim();
    if (!title) {
      setActiveTab('basic');
      setError('Vui lòng nhập tiêu đề bài Lab');
      return;
    }

    if (editorMode === 'edit' && !editingLabId) {
      setError('Không xác định được bài Lab cần cập nhật');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payload = new FormData();
      payload.append('title', title);
      payload.append('category', formData.category);
      payload.append('difficulty', formData.difficulty);
      payload.append('status', formData.status);
      payload.append('duration', formData.duration.trim());
      payload.append('guideContent', hasRichTextContent(formData.guideContent) ? formData.guideContent : '');
      payload.append('objective', formData.objective.trim());
      payload.append('tools', JSON.stringify(toolsPreview));

      if (formData.courseId) payload.append('courseId', formData.courseId);
      if (formData.moduleId) payload.append('moduleId', formData.moduleId);

      if (formData.filePka) payload.append('filePka', formData.filePka);
      if (formData.thumbnailImg) payload.append('thumbnailImg', formData.thumbnailImg);
      if (formData.topologyImg) payload.append('topologyImg', formData.topologyImg);

      const formattedSteps = formData.steps
        .map((step) => ({
          title: step.title.trim(),
          commands: step.commands
            .split('\n')
            .map((command) => command.trim())
            .filter(Boolean),
          note: step.note.trim()
        }))
        .filter((step) => step.title || step.commands.length > 0 || step.note);
      payload.append('steps', JSON.stringify(formattedSteps));

      if (editorMode === 'edit') {
        await adminApi.updateLab(token, editingLabId, payload);
      } else {
        await adminApi.createLab(token, payload);
      }

      closeEditor();
      resetFormState();
      fetchLabs(currentPage);
    } catch (submitError) {
      setError(submitError.message || 'Không thể lưu bài Lab');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa bài Lab này?')) return;
    try {
      await adminApi.deleteLab(token, id);
      fetchLabs(currentPage);
    } catch (deleteError) {
      alert(deleteError.message);
    }
  };

  if (isEditorOpen) {
    return (
      <div className="labm-editor-page">
        <div className="labm-editor-shell">
          <div className="labm-editor-header">
            <button type="button" className="labm-back-btn" onClick={closeEditor}>
              <ArrowLeft size={14} />
              <span>TRỞ LẠI DANH SÁCH</span>
            </button>
            <h2>{editorMode === 'edit' ? 'Chỉnh sửa bài Lab' : 'Tạo bài Lab mới'}</h2>
            <p>Nhập thông tin theo từng tab, bố cục giống màn quản lý bài kiểm tra.</p>
          </div>

          <div className="labm-tabs">
            {LAB_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`labm-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {error ? <div className="labm-form-error-banner">{error}</div> : null}

          <div className="labm-editor-scroll">
            {activeTab === 'basic' ? (
              <div className="labm-tab-panel">
                <div className="acm-field">
                  <span>Tiêu đề bài Lab *</span>
                  <input
                    className="acm-input"
                    placeholder="Nhập tên bài Lab..."
                    value={formData.title}
                    onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
                  />
                </div>

                <div className="labm-grid-3">
                  <div className="acm-field">
                    <span>Danh mục</span>
                    <CustomSelect
                      value={formData.category}
                      onChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
                      options={CATEGORY_OPTIONS}
                    />
                  </div>

                  <div className="acm-field">
                    <span>Độ khó</span>
                    <CustomSelect
                      value={formData.difficulty}
                      onChange={(value) => setFormData((prev) => ({ ...prev, difficulty: value }))}
                      options={DIFFICULTY_OPTIONS}
                    />
                  </div>

                  <div className="acm-field">
                    <span>Thời lượng</span>
                    <input
                      className="acm-input"
                      placeholder="VD: 30 phút"
                      value={formData.duration}
                      onChange={(event) => setFormData((prev) => ({ ...prev, duration: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="labm-grid-3">
                  <div className="acm-field">
                    <span>Trạng thái</span>
                    <CustomSelect
                      value={formData.status}
                      onChange={(value) => setFormData((prev) => ({ ...prev, status: value }))}
                      options={STATUS_OPTIONS}
                    />
                  </div>
                </div>

                <div className="labm-grid-2">
                  <div className="acm-field">
                    <span>Khóa học</span>
                    <CustomSelect
                      value={formData.courseId}
                      onChange={(value) => setFormData((prev) => ({ ...prev, courseId: value, moduleId: '' }))}
                      options={[
                        { value: '', label: '-- Không chọn --' },
                        ...courses.map((course) => ({ value: course.id, label: `${course.code} - ${course.title}` }))
                      ]}
                    />
                  </div>

                  <div className={`acm-field ${!formData.courseId ? 'labm-field-muted' : ''}`}>
                    <span>Module {loadingModules ? <small>(Đang tải...)</small> : null}</span>
                    <div className={!formData.courseId ? 'labm-select-disabled' : ''}>
                      <CustomSelect
                        value={formData.moduleId}
                        onChange={(value) => setFormData((prev) => ({ ...prev, moduleId: value }))}
                        options={[
                          { value: '', label: '-- Không chọn --' },
                          ...courseModules.map((moduleItem) => ({ value: moduleItem.id, label: moduleItem.title }))
                        ]}
                        placeholder={formData.courseId ? 'Chọn module...' : 'Chọn khóa học trước'}
                      />
                    </div>
                    {!formData.courseId ? (
                      <p className="acm-field-hint">Chọn khóa học trước để chọn module.</p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === 'content' ? (
              <div className="labm-tab-panel">
                <div className="acm-field">
                  <span>Mục tiêu</span>
                  <textarea
                    className="acm-textarea"
                    rows="2"
                    placeholder="Nêu mục tiêu chính của bài thực hành..."
                    value={formData.objective}
                    onChange={(event) => setFormData((prev) => ({ ...prev, objective: event.target.value }))}
                  />
                </div>

                <div className="acm-field">
                  <span>Nội dung hướng dẫn (Rich Text)</span>
                  <RichTextEditor
                    value={formData.guideContent}
                    onChange={(value) => setFormData((prev) => ({ ...prev, guideContent: value }))}
                    placeholder="Nhập nội dung hướng dẫn tổng quan..."
                  />
                </div>

                <div className="acm-field">
                  <div className="labm-step-header">
                    <span>Các bước</span>
                    <button type="button" className="acm-secondary-btn" onClick={handleAddStep}>
                      <Plus size={14} /> Thêm bước
                    </button>
                  </div>

                  <div className="labm-step-scroll">
                    {formData.steps.map((step, index) => (
                      <div key={index} className="labm-step-card">
                        <div className="labm-step-card-head">
                          <strong>Bước {index + 1}</strong>
                          {formData.steps.length > 1 ? (
                            <button
                              type="button"
                              className="labm-step-remove"
                              onClick={() => handleRemoveStep(index)}
                              title="Xóa bước"
                            >
                              <Trash2 size={15} />
                            </button>
                          ) : null}
                        </div>

                        <div className="labm-step-fields">
                          <input
                            className="acm-input"
                            placeholder="Tiêu đề bước..."
                            value={step.title}
                            onChange={(event) => handleStepChange(index, 'title', event.target.value)}
                          />
                          <textarea
                            className="acm-textarea labm-code-input"
                            rows="3"
                            placeholder="Mỗi lệnh một dòng"
                            value={step.commands}
                            onChange={(event) => handleStepChange(index, 'commands', event.target.value)}
                          />
                          <input
                            className="acm-input"
                            placeholder="Ghi chú thêm (nếu có)..."
                            value={step.note}
                            onChange={(event) => handleStepChange(index, 'note', event.target.value)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === 'media' ? (
              <div className="labm-tab-panel">
                <div className="labm-upload-grid">
                  <div
                    className="labm-upload-card"
                    onClick={() => document.getElementById('lab-thumb').click()}
                  >
                    <div className="labm-upload-card-title">
                      <ImageIcon size={15} /> imageUrl (Thumbnail)
                    </div>
                    {previews.thumbnail ? (
                      <img src={previews.thumbnail} alt="Thumbnail preview" className="labm-upload-preview" />
                    ) : (
                      <p>Bấm để tải ảnh lên</p>
                    )}
                    <input
                      id="lab-thumb"
                      type="file"
                      hidden
                      accept="image/*"
                      onChange={(event) => handleFileChange(event, 'thumbnailImg')}
                    />
                  </div>

                  <div
                    className="labm-upload-card"
                    onClick={() => document.getElementById('lab-topology').click()}
                  >
                    <div className="labm-upload-card-title">
                      <ImageIcon size={15} /> topologyImgUrl
                    </div>
                    {previews.topology ? (
                      <img src={previews.topology} alt="Topology preview" className="labm-upload-preview" />
                    ) : (
                      <p>Bấm để tải ảnh topology</p>
                    )}
                    <input
                      id="lab-topology"
                      type="file"
                      hidden
                      accept="image/*"
                      onChange={(event) => handleFileChange(event, 'topologyImg')}
                    />
                  </div>
                </div>

                <div className="acm-field">
                  <span>fileUrl (.pkt / .pka)</span>
                  <label className="labm-file-input">
                    <FileUp size={16} />
                    <span>{formData.filePka ? formData.filePka.name : 'Chon file Packet Tracer'}</span>
                    <input
                      type="file"
                      accept=".pkt,.pka"
                      onChange={(event) => handleFileChange(event, 'filePka')}
                    />
                  </label>
                </div>

                <div className="acm-field">
                  <span>Cong cu</span>
                  <textarea
                    className="acm-textarea"
                    rows="3"
                    placeholder="Packet Tracer, Wireshark, PuTTY..."
                    value={formData.toolsText}
                    onChange={(event) => setFormData((prev) => ({ ...prev, toolsText: event.target.value }))}
                  />
                  <div className="labm-tools-preview">
                    {toolsPreview.length > 0 ? (
                      toolsPreview.map((tool) => (
                        <span key={tool} className="labm-tool-chip">{tool}</span>
                      ))
                    ) : (
                      <span className="labm-tools-empty">Danh sach cong cu se hien thi o day.</span>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="labm-editor-actions">
            <button
              type="button"
              className="admin-modal-btn-secondary"
              onClick={closeEditor}
              disabled={submitting}
            >
              Hủy
            </button>
            <button
              type="button"
              className="admin-btn-primary"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Đang lưu...' : editorMode === 'edit' ? 'Cập nhật bài Lab' : 'Lưu bài Lab'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="users-wrapper">
      <div className="admin-table-header" style={{ padding: '0 0 20px 0', border: 'none' }}>
        <h3>Quản lý Bài Lab (.pkt)</h3>
        <div className="admin-table-actions">
          <button className="admin-btn-primary" onClick={openCreateEditor}>
            <Plus size={18} /> Thêm Bài Lab
          </button>
        </div>
      </div>

      <div className="admin-datatable-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th className="text-center">ID</th>
              <th>Bài Lab</th>
              <th className="text-center">Danh mục</th>
              <th className="text-center">Độ khó</th>
              <th className="text-center">Trạng thái</th>
              <th className="text-center">Thời lượng</th>
              <th>Thuộc khóa học</th>
              <th className="text-center">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center' }}>Đang tải...</td>
              </tr>
            ) : labs.length > 0 ? (
              labs.map((lab) => {
                const statusMeta = STATUS_BADGE_MAP[lab.status] || STATUS_BADGE_MAP.DRAFT;
                return (
                  <tr key={lab.id}>
                    <td className="text-center">{lab.id}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '40px',
                            height: '40px',
                            backgroundColor: 'rgba(42, 133, 255, 0.1)',
                            color: 'var(--admin-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '4px',
                            flexShrink: 0
                          }}
                        >
                          <FileCode2 size={20} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div className="labm-lab-title" title={lab.title}>{lab.title}</div>
                          {lab.fileUrl ? (
                            <div className="labm-lab-file" title={lab.fileUrl.split('/').pop()}>
                              {lab.fileUrl.split('/').pop()}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="text-center">{lab.category || '-'}</td>
                    <td className="text-center">
                      <span
                        className={`admin-badge ${
                          lab.difficulty === 'EASY'
                            ? 'active'
                            : lab.difficulty === 'HARD'
                              ? 'admin'
                              : 'student'
                        }`}
                      >
                        {DIFFICULTY_LABEL_MAP[lab.difficulty] || lab.difficulty}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className={`admin-badge ${statusMeta.className}`}>{statusMeta.label}</span>
                    </td>
                    <td className="text-center">{lab.duration || '-'}</td>
                    <td className="labm-course-title" title={lab.course?.title || '-'}>{lab.course?.title || '-'}</td>
                    <td className="text-center">
                      <div className="admin-row-actions" style={{ justifyContent: 'center', display: 'flex', gap: '4px' }}>
                        <button
                          className="admin-action-btn"
                          title="Xem"
                          onClick={() => openViewModal(lab)}
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          className="admin-action-btn"
                          title="Sửa"
                          onClick={() => openEditEditor(lab)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="admin-action-btn delete"
                          title="Xóa"
                          onClick={() => handleDelete(lab.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center' }}>Chưa có bài Lab nào</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AdminPagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
      />

      <AdminModal
        title="Chi tiết bài Lab"
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        onConfirm={() => setIsViewModalOpen(false)}
        confirmText="Đóng"
      >
        {selectedLabForView ? (
          <div className="exam-view-details">
            <div><b>Tiêu đề:</b> {selectedLabForView.title}</div>
            <div><b>Danh mục:</b> {selectedLabForView.category || '-'}</div>
            <div><b>Độ khó:</b> {DIFFICULTY_LABEL_MAP[selectedLabForView.difficulty] || selectedLabForView.difficulty || '-'}</div>
            <div><b>Thời lượng:</b> {selectedLabForView.duration || '-'}</div>
            <div><b>Khóa học:</b> {selectedLabForView.course?.title || '-'}</div>
            <div><b>Module:</b> {selectedLabForView.module?.title || selectedLabForView.moduleId || '-'}</div>
            <div><b>Mục tiêu:</b> {selectedLabForView.objective || '-'}</div>
            <div><b>Số bước:</b> {Array.isArray(selectedLabForView.steps) ? selectedLabForView.steps.length : 0}</div>
            <div><b>Công cụ:</b> {Array.isArray(selectedLabForView.tools) ? selectedLabForView.tools.join(', ') : '-'}</div>
            <div><b>Ảnh đại diện:</b> {selectedLabForView.imageUrl ? <a href={selectedLabForView.imageUrl} target="_blank" rel="noreferrer">Mở ảnh</a> : '-'}</div>
            <div><b>Ảnh topology:</b> {selectedLabForView.topologyImgUrl ? <a href={selectedLabForView.topologyImgUrl} target="_blank" rel="noreferrer">Mở ảnh</a> : '-'}</div>
            <div><b>File bài tập:</b> {selectedLabForView.fileUrl ? <a href={selectedLabForView.fileUrl} target="_blank" rel="noreferrer">Mở file</a> : '-'}</div>
          </div>
        ) : null}
      </AdminModal>
    </div>
  );
};

export default Labs;
