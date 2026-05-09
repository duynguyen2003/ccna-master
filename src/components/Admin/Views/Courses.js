import React, { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Image, BookOpen, Search, Loader2, GraduationCap, ListChecks, Pencil, ImagePlus } from 'lucide-react';
import { adminApi } from '../../../services/api/adminApi';
import { AuthContext } from '../../../context/AuthContext';
import AdminModal from '../Components/AdminModal';
import CustomSelect from '../Components/CustomSelect';
import AdminPagination from '../Components/AdminPagination';
import '../../../css/Admin/AdminViews.css';

const initialCourseForm = {
  code: '',
  title: '',
  description: '',
  level: 'BEGINNER',
  status: 'DRAFT',
  orderIndex: 0,
  thumbnail: null
};

const resolveMediaUrl = (url) => {
  if (!url) return '';
  if (String(url).startsWith('http://') || String(url).startsWith('https://')) {
    return url;
  }
  return `http://localhost:5000${url}`;
};

const levelOptions = [
  { value: 'BEGINNER', label: 'Cơ bản' },
  { value: 'INTERMEDIATE', label: 'Trung bình' },
  { value: 'ADVANCED', label: 'Nâng cao' }
];

const Courses = () => {
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();

  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [searchValue, setSearchValue] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 10;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [formData, setFormData] = useState(initialCourseForm);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCourses = useCallback(async (page = currentPage) => {
    try {
      setLoading(true);
      const res = await adminApi.getCourses(token, page);
      setCourses(res.data || []);
      if (res.pagination) {
        setTotalPages(res.pagination.totalPages || 1);
        setTotalItems(res.pagination.total || 0);
        setCurrentPage(res.pagination.page || 1);
      }
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách khóa học.');
    } finally {
      setLoading(false);
    }
  }, [token, currentPage]);

  useEffect(() => {
    fetchCourses(currentPage);
  }, [currentPage]);

  const filteredCourses = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase();
    if (!keyword) return courses;

    return courses.filter((course) => {
      const title = String(course.title || '').toLowerCase();
      const code = String(course.code || '').toLowerCase();
      const level = String(course.level || '').toLowerCase();
      return title.includes(keyword) || code.includes(keyword) || level.includes(keyword);
    });
  }, [courses, searchValue]);

  const publishedCount = useMemo(
    () => courses.filter((course) => course.status === 'PUBLISHED').length,
    [courses]
  );

  const openCreateModal = () => {
    setFormData(initialCourseForm);
    setPreviewUrl('');
    setEditingCourse(null);
    setIsModalOpen(true);
  };

  const openEditModal = (course) => {
    setEditingCourse(course);
    setFormData({
      code: course.code,
      title: course.title,
      description: course.description || '',
      level: course.level,
      status: course.status,
      orderIndex: course.orderIndex || 0,
      thumbnail: null
    });
    setPreviewUrl(resolveMediaUrl(course.thumbnailUrl));
    setIsModalOpen(true);
  };

  const handleSubmitCourse = async () => {
    try {
      setError('');

      if (!formData.code.trim() || !formData.title.trim()) {
        throw new Error('Vui lòng nhập đầy đủ mã và tên khóa học.');
      }

      setIsSubmitting(true);

      const payload = new FormData();
      payload.append('code', formData.code.trim());
      payload.append('title', formData.title.trim());
      payload.append('description', formData.description);
      payload.append('level', formData.level);
      payload.append('status', formData.status);
      payload.append('orderIndex', String(formData.orderIndex || 0));
      if (formData.thumbnail) payload.append('thumbnail', formData.thumbnail);

      if (editingCourse) {
        await adminApi.updateCourse(token, editingCourse.id, payload);
      } else {
        await adminApi.createCourse(token, payload);
      }

      setIsModalOpen(false);
      setEditingCourse(null);
      setFormData(initialCourseForm);
      setPreviewUrl('');
      await fetchCourses(currentPage);
    } catch (err) {
      setError(err.message || 'Không thể lưu khóa học.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa khóa học này?')) return;

    try {
      setDeletingId(id);
      await adminApi.deleteCourse(token, id);
      await fetchCourses(currentPage);
    } catch (err) {
      setError(err.message || 'Không thể xóa khóa học.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="users-wrapper acm-page">
      <section className="acm-hero">
        <div className="acm-hero-main">
          <h2 className="acm-hero-title">Quản lý khóa học</h2>
          <p className="acm-hero-subtitle">Theo dõi danh sách khóa học và điều hướng đến khu vực quản lý chương, bài học.</p>
        </div>
        <button className="acm-primary-btn" onClick={openCreateModal}>
          <Plus size={16} />
          Thêm khóa học
        </button>
      </section>

      <section className="acm-stats-grid">
        <article className="acm-stat-card">
          <div>
            <p className="acm-stat-label">Tổng khóa học</p>
            <p className="acm-stat-value">{totalItems}</p>
          </div>
          <GraduationCap size={18} />
        </article>
        <article className="acm-stat-card">
          <div>
            <p className="acm-stat-label">Đang xuất bản</p>
            <p className="acm-stat-value">{publishedCount}</p>
          </div>
          <ListChecks size={18} />
        </article>
      </section>

      <section className="acm-course-card">
        <div className="acm-course-toolbar">
          <label className="acm-search">
            <Search size={15} />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Tìm theo mã, tên hoặc mức độ"
            />
          </label>
        </div>

        {error ? <p className="acm-form-error">{error}</p> : null}

        {loading ? (
          <div className="acm-loading-state">
            <Loader2 size={18} className="acm-spin" /> Đang tải dữ liệu...
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="acm-empty-state">
            <BookOpen size={40} />
            <p>Không có khóa học phù hợp.</p>
          </div>
        ) : (
          <>
            <div className="acm-course-table-wrap">
              <table className="acm-course-table">
                <thead>
                  <tr>
                    <th className="text-center">Mã</th>
                    <th>Khóa học</th>
                    <th>Mô tả</th>
                    <th className="text-center">Mức độ</th>
                    <th className="text-center">Trạng thái</th>
                    <th className="text-center">Thứ tự</th>
                    <th className="text-center">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCourses.map((course) => (
                    <tr key={course.id}>
                      <td className="text-center">
                        <span className="acm-code-pill">{course.code}</span>
                      </td>
                      <td>
                        <div className="acm-course-name-cell">
                          <span className="acm-thumbnail">
                            {course.thumbnailUrl ? (
                              <img src={resolveMediaUrl(course.thumbnailUrl)} alt={course.title} />
                            ) : (
                              <Image size={16} />
                            )}
                          </span>
                          <span>{course.title}</span>
                        </div>
                      </td>
                      <td className="acm-cell-muted">
                        {course.description
                          ? course.description.length > 70
                            ? `${course.description.slice(0, 70)}...`
                            : course.description
                          : '—'}
                      </td>
                      <td className="text-center">
                        <span className="acm-level-pill">{course.level || '—'}</span>
                      </td>
                      <td className="text-center">
                        <span className={`acm-status-badge ${course.status === 'PUBLISHED' ? 'published' : 'draft'}`}>
                          {course.status || 'DRAFT'}
                        </span>
                      </td>
                      <td className="text-center">{course.orderIndex ?? 0}</td>
                      <td className="text-center">
                        <div className="acm-row-actions" style={{ justifyContent: 'center' }}>
                          <button
                            className="acm-action-btn"
                            title="Sửa khóa học"
                            onClick={() => openEditModal(course)}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            className="acm-action-btn"
                            title="Quản lý nội dung"
                            onClick={() => navigate(`/admin/courses/${course.id}`)}
                          >
                            <BookOpen size={15} />
                          </button>
                          <button
                            className="acm-action-btn danger"
                            title="Xóa"
                            disabled={deletingId === course.id}
                            onClick={() => handleDelete(course.id)}
                          >
                            {deletingId === course.id ? <Loader2 size={15} className="acm-spin" /> : <Trash2 size={15} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
          </>
        )}
      </section>

      <AdminModal
        title={editingCourse ? 'Cập nhật khóa học' : 'Thêm khóa học mới'}
        description={editingCourse ? 'Chỉnh sửa thông tin khóa học hiện tại.' : 'Nhập thông tin chi tiết để tạo học liệu cho sinh viên.'}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCourse(null);
          setPreviewUrl('');
        }}
        onConfirm={handleSubmitCourse}
        confirmText={isSubmitting ? 'Đang lưu...' : editingCourse ? 'Lưu thay đổi' : 'Tạo khóa học'}
        maxWidth="800px"
      >
        {error ? <p className="acm-form-error">{error}</p> : null}
        <div className="acm-modal-form">
          <div className="acm-modal-top-row">
            <div className="acm-modal-left-col">
              <label className="acm-field">
                <span>MÃ KHÓA HỌC*</span>
                <input
                  className="acm-input"
                  placeholder="Ví dụ: CS101"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                />
              </label>

              <label className="acm-field">
                <span>TÊN KHÓA HỌC*</span>
                <input
                  className="acm-input"
                  placeholder="Nhập tên đầy đủ của khóa học"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </label>

              <div className="acm-modal-fields-row">
                <label className="acm-field">
                  <span>THỨ TỰ HIỂN THỊ</span>
                  <input
                    type="number"
                    className="acm-input"
                    value={formData.orderIndex}
                    onChange={(e) => setFormData({ ...formData, orderIndex: parseInt(e.target.value, 10) || 0 })}
                  />
                </label>

                <label className="acm-field">
                  <span>MỨC ĐỘ</span>
                  <CustomSelect
                    value={formData.level}
                    onChange={(val) => setFormData({ ...formData, level: val })}
                    options={levelOptions}
                  />
                </label>
              </div>

              <div className="acm-field">
                <span>TRẠNG THÁI</span>
                <div className="acm-radio-group">
                  <label className="acm-radio-option">
                    <input
                      type="radio"
                      name="status"
                      checked={formData.status === 'PUBLISHED'}
                      onChange={() => setFormData({ ...formData, status: 'PUBLISHED' })}
                    />
                    Đang hoạt động
                  </label>
                  <label className="acm-radio-option">
                    <input
                      type="radio"
                      name="status"
                      checked={formData.status === 'DRAFT'}
                      onChange={() => setFormData({ ...formData, status: 'DRAFT' })}
                    />
                    Nháp
                  </label>
                </div>
              </div>
            </div>

            <div className="acm-thumbnail-upload">
              <span className="acm-upload-label">THUMBNAIL</span>
              <div 
                className="acm-upload-dropzone"
                onClick={() => document.getElementById('acm-file-input').click()}
              >
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="acm-upload-preview" />
                ) : (
                  <>
                    <ImagePlus size={40} className="acm-upload-icon" />
                    <div className="acm-upload-text">
                      <strong>Tải ảnh lên</strong>
                      <p>Kéo và thả hoặc click để chọn tệp (PNG, JPG, max 5MB)</p>
                    </div>
                  </>
                )}
                <input
                  id="acm-file-input"
                  type="file"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      setFormData({ ...formData, thumbnail: file });
                      setPreviewUrl(URL.createObjectURL(file));
                    }
                  }}
                />
              </div>
            </div>
          </div>

          <label className="acm-field">
            <span>MÔ TẢ</span>
            <textarea
              className="acm-textarea"
              placeholder="Viết mô tả ngắn gọn về mục tiêu và nội dung khóa học..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </label>
        </div>
      </AdminModal>
    </div>
  );
};

export default Courses;