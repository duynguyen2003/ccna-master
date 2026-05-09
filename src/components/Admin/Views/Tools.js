import React, { useState, useEffect, useContext } from 'react';
import { Plus, Trash2, ToggleLeft, ToggleRight, Wrench } from 'lucide-react';
import { adminApi } from '../../../services/api/adminApi';
import { AuthContext } from '../../../context/AuthContext';
import AdminModal from '../Components/AdminModal';
import '../../../css/Admin/AdminViews.css';

const Tools = () => {
  const { token } = useContext(AuthContext);
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', iconName: '', linkUrl: '', orderIndex: 0 });
  const [error, setError] = useState('');

  useEffect(() => { fetchTools(); }, []);

  const fetchTools = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getTools(token);
      setTools(res.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    try {
      setError('');
      if (!formData.title) throw new Error('Vui lòng nhập tên công cụ');
      await adminApi.createTool(token, formData);
      setIsModalOpen(false);
      setFormData({ title: '', description: '', iconName: '', linkUrl: '', orderIndex: 0 });
      fetchTools();
    } catch (err) { setError(err.message); }
  };

  const handleToggle = async (id) => {
    try { await adminApi.toggleTool(token, id); fetchTools(); }
    catch (err) { alert(err.message); }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Xóa công cụ này?')) {
      try { await adminApi.deleteTool(token, id); fetchTools(); }
      catch (err) { alert(err.message); }
    }
  };

  return (
    <div className="users-wrapper">
      <div className="admin-table-header" style={{ padding: '0 0 20px 0', border: 'none' }}>
        <h3>Quản lý Công cụ (Tools)</h3>
        <button className="admin-btn-primary" onClick={() => { setError(''); setIsModalOpen(true); }}>
          <Plus size={18} /> Thêm Công cụ
        </button>
      </div>

      <div className="admin-datatable-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Công cụ</th>
              <th>Đường dẫn</th>
              <th>Icon</th>
              <th>Thứ tự</th>
              <th>Trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan="7" style={{textAlign: 'center'}}>Đang tải...</td></tr> :
             tools.length > 0 ? tools.map(t => (
              <tr key={t.id}>
                <td>{t.id}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'rgba(42,133,255,0.1)', color: 'var(--admin-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                      <Wrench size={18} />
                    </div>
                    <div>
                      <div style={{fontWeight: 500}}>{t.title}</div>
                      {t.description && <div style={{fontSize: '12px', color: 'var(--admin-text-secondary)'}}>{t.description.substring(0, 50)}</div>}
                    </div>
                  </div>
                </td>
                <td style={{fontSize: '13px'}}>{t.linkUrl || '—'}</td>
                <td>{t.iconName || '—'}</td>
                <td>{t.orderIndex}</td>
                <td>
                  <span className={`admin-badge ${t.isActive ? 'active' : 'inactive'}`}>{t.isActive ? 'Bật' : 'Tắt'}</span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button className="admin-action-btn" title={t.isActive ? 'Tắt' : 'Bật'} onClick={() => handleToggle(t.id)}>
                      {t.isActive ? <ToggleRight size={18} color="var(--admin-success)" /> : <ToggleLeft size={18} />}
                    </button>
                    <button className="admin-action-btn delete" title="Xóa" onClick={() => handleDelete(t.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan="7" style={{textAlign: 'center'}}>Chưa có công cụ nào</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <AdminModal title="Thêm Công cụ Mới" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onConfirm={handleCreate}>
        {error && <p style={{ color: 'var(--admin-danger)', marginBottom: '10px' }}>{error}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: 'var(--admin-text-secondary)' }}>Tên công cụ *</label>
            <input className="admin-search-input" style={{ width: '100%', boxSizing: 'border-box' }} placeholder="VD: Subnet Calculator" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: 'var(--admin-text-secondary)' }}>Mô tả</label>
            <textarea className="admin-search-input" style={{ width: '100%', boxSizing: 'border-box', height: '60px', resize: 'vertical' }} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', color: 'var(--admin-text-secondary)' }}>Icon name</label>
              <input className="admin-search-input" style={{ width: '100%', boxSizing: 'border-box' }} placeholder="VD: Calculator" value={formData.iconName} onChange={e => setFormData({...formData, iconName: e.target.value})} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', color: 'var(--admin-text-secondary)' }}>Đường dẫn (URL)</label>
              <input className="admin-search-input" style={{ width: '100%', boxSizing: 'border-box' }} placeholder="/tools/subnet" value={formData.linkUrl} onChange={e => setFormData({...formData, linkUrl: e.target.value})} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', color: 'var(--admin-text-secondary)' }}>Thứ tự</label>
              <input type="number" className="admin-search-input" style={{ width: '100%', boxSizing: 'border-box' }} value={formData.orderIndex} onChange={e => setFormData({...formData, orderIndex: parseInt(e.target.value) || 0})} />
            </div>
          </div>
        </div>
      </AdminModal>
    </div>
  );
};

export default Tools;
