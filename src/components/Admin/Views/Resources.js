import React, { useState, useEffect, useContext } from 'react';
import { Plus, Trash2, FileDown, File } from 'lucide-react';
import { adminApi } from '../../../services/api/adminApi';
import { AuthContext } from '../../../context/AuthContext';
import AdminModal from '../Components/AdminModal';
import AdminPagination from '../Components/AdminPagination';
import '../../../css/Admin/AdminViews.css';

const Resources = () => {
  const { token } = useContext(AuthContext);
  const [resources, setResources] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 20;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ title: '', type: '', courseId: '', file: null });
  const [error, setError] = useState('');

  const fetchResources = async (page = currentPage) => {
    try {
      setLoading(true);
      const res = await adminApi.getResources(token, '', page); // Note: empty string for courseId filter
      setResources(res.data || []);
      if (res.pagination) {
        setTotalPages(res.pagination.totalPages || 1);
        setTotalItems(res.pagination.total || 0);
        setCurrentPage(res.pagination.page || 1);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchResources(currentPage); fetchCourses(); }, [currentPage]);

  const fetchCourses = async () => {
    try {
      const res = await adminApi.getCourses(token, 1);
      setCourses(res.data || []);
    } catch (err) { console.error(err); }
  };

  const handleCreate = async () => {
    try {
      setError('');
      if (!formData.title || !formData.file) throw new Error('Vui lòng nhập tên và chọn file');
      const payload = new FormData();
      payload.append('title', formData.title);
      payload.append('type', formData.type || formData.file.name.split('.').pop());
      if (formData.courseId) payload.append('courseId', formData.courseId);
      payload.append('file', formData.file);

      await adminApi.createResource(token, payload);
      setIsModalOpen(false);
      setFormData({ title: '', type: '', courseId: '', file: null });
      fetchResources();
    } catch (err) { setError(err.message); }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Xóa tài liệu này?')) {
      try { await adminApi.deleteResource(token, id); fetchResources(); }
      catch (err) { alert(err.message); }
    }
  };

  const typeColors = { pdf: '#EA4335', doc: '#4285F4', docx: '#4285F4', pptx: '#FBBC04', xlsx: '#34A853', png: '#9C27B0', jpg: '#9C27B0' };

  return (
    <div className="users-wrapper">
      <div className="admin-table-header" style={{ padding: '0 0 20px 0', border: 'none' }}>
        <h3>Quản lý Tài liệu (Resources)</h3>
        <button className="admin-btn-primary" onClick={() => { setError(''); setIsModalOpen(true); }}>
          <Plus size={18} /> Tải lên
        </button>
      </div>

      <div className="admin-datatable-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Tài liệu</th>
              <th>Loại</th>
              <th>Kích thước</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan="5" style={{textAlign: 'center'}}>Đang tải...</td></tr> :
             resources.length > 0 ? resources.map(r => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{width: '36px', height: '36px', borderRadius: '6px', backgroundColor: `${typeColors[r.type] || '#666'}20`, color: typeColors[r.type] || '#666', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                      <File size={18} />
                    </div>
                    <div>
                      <div style={{fontWeight: 500}}>{r.title}</div>
                      <div style={{fontSize: '12px', color: 'var(--admin-text-secondary)'}}>{r.fileUrl?.split('/').pop()}</div>
                    </div>
                  </div>
                </td>
                <td><span className="admin-badge student" style={{textTransform: 'uppercase'}}>{r.type}</span></td>
                <td>{r.size || '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <a href={r.fileUrl?.startsWith('http') ? r.fileUrl : `http://localhost:5000${r.fileUrl}`} target="_blank" rel="noreferrer" className="admin-action-btn" title="Tải xuống" style={{color: 'var(--admin-primary)'}}>
                      <FileDown size={16} />
                    </a>
                    <button className="admin-action-btn delete" title="Xóa" onClick={() => handleDelete(r.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan="5" style={{textAlign: 'center'}}>Chưa có tài liệu nào</td></tr>
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

      <AdminModal title="Tải Lên Tài Liệu" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onConfirm={handleCreate}>
        {error && <p style={{ color: 'var(--admin-danger)', marginBottom: '10px' }}>{error}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: 'var(--admin-text-secondary)' }}>Tên tài liệu *</label>
            <input className="admin-search-input" style={{ width: '100%', boxSizing: 'border-box' }} placeholder="VD: Slide Bài giảng Chương 1" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: 'var(--admin-text-secondary)' }}>Loại file</label>
            <select className="admin-search-input" style={{ width: '100%', boxSizing: 'border-box' }} value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
              <option value="">Tự nhận diện</option>
              <option value="pdf">PDF</option>
              <option value="Packet Tracer">Packet Tracer (.pkt)</option>
              <option value="Slides">Slides (.pptx, .ppt)</option>
              <option value="Video">Video (.mp4)</option>
              <option value="doc">Word (.doc, .docx)</option>
              <option value="xlsx">Excel (.xlsx)</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: 'var(--admin-text-secondary)' }}>Chọn file *</label>
            <input type="file" className="admin-search-input" style={{ width: '100%', boxSizing: 'border-box' }} onChange={e => setFormData({...formData, file: e.target.files[0]})} />
          </div>
        </div>
      </AdminModal>
    </div>
  );
};

export default Resources;
