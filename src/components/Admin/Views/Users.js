import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import {
  Search,
  Plus,
  Shield,
  SlidersHorizontal,
  UserX,
  UserCheck,
  Trash2,
  MoreHorizontal,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { adminApi } from '../../../services/api/adminApi';
import { AuthContext } from '../../../context/AuthContext';
import AdminModal from '../Components/AdminModal';
import UserProfileModal from './Components/UserProfileModal';
import '../../../css/Admin/AdminViews.css';
import '../../../css/Admin/AdminUsers.css';

const PAGE_SIZE = 10;

const roleLabel = {
  ADMIN: 'Admin',
  STUDENT: 'Student'
};

const statusLabel = {
  active: 'Hoạt động',
  inactive: 'Đã khóa'
};

const roleOptions = [
  { value: 'ALL', label: 'T\u1ea5t c\u1ea3 vai tr\u00f2', tone: 'all' },
  { value: 'ADMIN', label: 'Admin', tone: 'admin' },
  { value: 'STUDENT', label: 'Student', tone: 'student' }
];

const statusOptions = [
  { value: 'ALL', label: 'T\u1ea5t c\u1ea3 tr\u1ea1ng th\u00e1i', tone: 'all' },
  { value: 'active', label: 'Ho\u1ea1t \u0111\u1ed9ng', tone: 'active' },
  { value: 'inactive', label: '\u0110\u00e3 kh\u00f3a', tone: 'inactive' }
];

const Users = () => {
  const { token } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: PAGE_SIZE });
  const [selectedIds, setSelectedIds] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ fullName: '', email: '', password: '', role: 'STUDENT' });
  const [error, setError] = useState('');
  const [openFilter, setOpenFilter] = useState(null);
  const [selectedUserProfile, setSelectedUserProfile] = useState(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const filterMenuRef = useRef(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter, statusFilter, currentPage]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target)) {
        setOpenFilter(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getUsers(token, currentPage, search, {
        role: roleFilter,
        status: statusFilter,
        limit: PAGE_SIZE
      });

      const matchesRole = (user) => roleFilter === 'ALL' || user.role === roleFilter;
      const matchesStatus = (user) =>
        statusFilter === 'ALL' || (statusFilter === 'active' ? user.isActive : !user.isActive);

      const rawUsers = res.data || [];
      const nextUsers = rawUsers.filter((user) => matchesRole(user) && matchesStatus(user));
      const serverAppliedFilters = rawUsers.every((user) => matchesRole(user) && matchesStatus(user));
      const nextPagination = res.pagination || {
        page: currentPage,
        totalPages: 1,
        total: nextUsers.length,
        limit: PAGE_SIZE
      };

      setUsers(nextUsers);
      setPagination(
        serverAppliedFilters
          ? nextPagination
          : {
              ...nextPagination,
              page: 1,
              total: nextUsers.length,
              totalPages: nextUsers.length > 0 ? 1 : 0
            }
      );
      setSelectedIds([]);

      if (nextPagination.totalPages > 0 && currentPage > nextPagination.totalPages) {
        setCurrentPage(nextPagination.totalPages);
      }
    } catch (fetchError) {
      console.error(fetchError);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    try {
      setError('');
      await adminApi.createUser(token, formData);
      setIsModalOpen(false);
      setFormData({ fullName: '', email: '', password: '', role: 'STUDENT' });
      fetchUsers();
    } catch (err) {
      setError(err.message);
    }
  };
  const openUserProfile = async (userId) => {
    try {
      const userDetail = await adminApi.getUser(token, userId);
      setSelectedUserProfile(userDetail);
      setIsProfileModalOpen(true);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleRole = async (user) => {
    try {
      const newRole = user.role === 'ADMIN' ? 'STUDENT' : 'ADMIN';
      if (window.confirm(`Bạn có chắc muốn đổi quyền của ${user.fullName} thành ${newRole}?`)) {
        await adminApi.updateUserRole(token, user.id, newRole);
        fetchUsers();
      }
    } catch (toggleError) {
      alert(toggleError.message);
    }
  };

  const handleToggleActive = async (user) => {
    try {
      await adminApi.toggleUserActive(token, user.id);
      fetchUsers();
    } catch (toggleError) {
      alert(toggleError.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      if (window.confirm('Bạn có chắc muốn xóa tài khoản này? Hành động này không thể hoàn tác.')) {
        await adminApi.deleteUser(token, id);
        fetchUsers();
      }
    } catch (deleteError) {
      alert(deleteError.message);
    }
  };

  const handleBulkLock = async () => {
    if (!selectedIds.length) return;

    const selectedUsers = users.filter((user) => selectedIds.includes(user.id));
    const activeUsers = selectedUsers.filter((user) => user.isActive);

    if (!activeUsers.length) {
      alert('Các tài khoản đã chọn đều đang ở trạng thái đã khóa.');
      return;
    }

    if (!window.confirm(`Khóa ${activeUsers.length} tài khoản đã chọn?`)) {
      return;
    }

    try {
      await Promise.all(activeUsers.map((user) => adminApi.toggleUserActive(token, user.id)));
      fetchUsers();
    } catch (bulkError) {
      alert(bulkError.message);
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;

    if (!window.confirm(`Xóa ${selectedIds.length} tài khoản đã chọn? Hành động này không thể hoàn tác.`)) {
      return;
    }

    try {
      await Promise.all(selectedIds.map((id) => adminApi.deleteUser(token, id)));
      fetchUsers();
    } catch (bulkError) {
      alert(bulkError.message);
    }
  };

  const toggleUserSelection = (userId) => {
    setSelectedIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  };

  const allSelectedInPage = useMemo(
    () => users.length > 0 && users.every((user) => selectedIds.includes(user.id)),
    [users, selectedIds]
  );

  const toggleSelectAllCurrentPage = () => {
    if (allSelectedInPage) {
      setSelectedIds((prev) => prev.filter((id) => !users.some((user) => user.id === id)));
      return;
    }

    const currentPageIds = users.map((user) => user.id);
    setSelectedIds((prev) => Array.from(new Set([...prev, ...currentPageIds])));
  };

  const getInitials = (fullName) => {
    if (!fullName) return '?';
    return fullName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('');
  };

  const paginationItems = useMemo(() => {
    const totalPages = pagination.totalPages || 1;
    const page = pagination.page || 1;

    if (totalPages <= 1) return [];

    const pages = new Set([1, totalPages, page - 1, page, page + 1]);
    return Array.from(pages)
      .filter((p) => p >= 1 && p <= totalPages)
      .sort((a, b) => a - b);
  }, [pagination]);

  const renderFilterDropdown = ({ id, label, value, onChange, options, icon: Icon, menuTitle }) => {
    const selectedOption = options.find((option) => option.value === value) || options[0];
    const isOpen = openFilter === id;

    return (
      <div className="admin-users-filter-group">
        <div className="admin-users-filter" ref={isOpen ? filterMenuRef : null}>
          <button
            type="button"
            className={`admin-users-filter-button ${isOpen ? 'is-open' : ''}`}
            onClick={() => setOpenFilter((prev) => (prev === id ? null : id))}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-label={label}
          >
            <span className="admin-users-filter-button-main">
              <Icon size={16} className="admin-users-filter-button-icon" />
              <span>{selectedOption.label}</span>
            </span>
            {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          {isOpen && (
            <div className="admin-users-filter-menu" role="listbox" aria-label={label}>
              <div className="admin-users-filter-menu-title">{menuTitle}</div>
              <div className="admin-users-filter-options">
                {options.map((option) => {
                  const isSelected = option.value === value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`admin-users-filter-option ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => {
                        onChange(option.value);
                        setOpenFilter(null);
                      }}
                    >
                      <span className={`admin-users-filter-dot ${option.tone}`} />
                      <span className="admin-users-filter-option-label">{option.label}</span>
                      {isSelected && <Check size={18} className="admin-users-filter-option-check" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="users-wrapper">
      <div className="admin-table-header" style={{ padding: '0 0 20px 0', border: 'none' }}>
        <h3>Quản lý người dùng</h3>
        <div className="admin-users-toolbar">
          <div className="admin-users-toolbar-controls">
          <div className="admin-users-search-wrap">
            <Search size={16} className="admin-users-search-icon" />
            <input
              type="text"
              placeholder="Tìm kiếm email, tên..."
              className="admin-search-input"
              style={{ paddingLeft: '35px', minWidth: '260px' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {renderFilterDropdown({
            id: 'role',
            label: 'L\u1eccC THEO',
            value: roleFilter,
            onChange: setRoleFilter,
            options: roleOptions,
            icon: Shield,
            menuTitle: 'L\u1ef0A CH\u1eccN VAI TR\u00d2'
          })}

          {renderFilterDropdown({
            id: 'status',
            label: 'L\u1eccC THEO',
            value: statusFilter,
            onChange: setStatusFilter,
            options: statusOptions,
            icon: SlidersHorizontal,
            menuTitle: 'L\u1ef0A CH\u1eccN TR\u1ea0NG TH\u00c1I'
          })}

          <button className="admin-btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} /> Thêm mới
          </button>
          </div>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="admin-users-bulkbar">
          <span className="admin-users-bulkbar-count">Đã chọn {selectedIds.length} tài khoản</span>
          <div className="admin-users-bulkbar-actions">
            <button className="admin-btn-primary admin-users-bulk-btn lock" onClick={handleBulkLock}>
              <UserX size={16} />
              Khóa nhiều tài khoản
            </button>
            <button className="admin-btn-primary admin-users-bulk-btn delete" onClick={handleBulkDelete}>
              <Trash2 size={16} />
              Xóa nhiều tài khoản
            </button>
          </div>
        </div>
      )}

      <div className="admin-datatable-container">
        <table className="admin-table admin-users-table">
          <thead>
            <tr>
              <th className="admin-users-col-checkbox">
                <input
                  type="checkbox"
                  checked={allSelectedInPage}
                  onChange={toggleSelectAllCurrentPage}
                  aria-label="Chọn tất cả người dùng trang hiện tại"
                />
              </th>
              <th className="admin-users-col-id">ID</th>
              <th className="admin-users-col-user">Người dùng</th>
              <th className="admin-users-col-role">Vai trò</th>
              <th className="admin-users-col-status">Trạng thái</th>
              <th className="admin-users-col-actions">Hành động</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center' }}>Đang tải...</td>
              </tr>
            ) : users.length > 0 ? (
              users.map((user) => (
                <tr key={user.id}>
                  <td className="admin-users-col-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(user.id)}
                      onChange={() => toggleUserSelection(user.id)}
                      aria-label={`Chọn tài khoản ${user.fullName}`}
                    />
                  </td>

                  <td className="admin-users-id-cell">{user.id}</td>

                  <td>
                    <div className="admin-users-user" onClick={() => openUserProfile(user.id)} style={{ cursor: 'pointer' }}>
                      <div className="admin-users-avatar">{getInitials(user.fullName)}</div>
                      <div className="admin-users-user-meta">
                        <div className="admin-users-user-name">{user.fullName || 'Chưa có tên'}</div>
                        <div className="admin-users-user-email">{user.email}</div>
                      </div>
                    </div>
                  </td>

                  <td className="admin-users-align-center">
                    <span className={`admin-badge ${user.role === 'ADMIN' ? 'admin' : 'student'}`}>
                      {roleLabel[user.role] || user.role}
                    </span>
                  </td>

                  <td className="admin-users-align-center">
                    <span className={`admin-badge ${user.isActive ? 'active' : 'inactive'}`}>
                      {user.isActive ? statusLabel.active : statusLabel.inactive}
                    </span>
                  </td>

                  <td>
                    <div className="admin-users-actions">
                      <button
                        className="admin-action-btn admin-users-tooltip-trigger"
                        aria-label="Đổi quyền"
                        onClick={() => handleToggleRole(user)}
                      >
                        <span className="admin-users-tooltip">Đổi quyền</span>
                        <Shield
                          size={16}
                          color={user.role === 'ADMIN' ? 'var(--admin-primary)' : 'var(--admin-text-secondary)'}
                        />
                      </button>

                      <div className="admin-users-action-menu-wrap">
                        <button
                          className="admin-action-btn admin-users-tooltip-trigger"
                          aria-label="Thao tác khác"
                        >
                          <span className="admin-users-tooltip">Thao tác khác</span>
                          <MoreHorizontal size={16} />
                        </button>

                        <div className="admin-users-action-menu">
                          <button
                            className="admin-users-action-menu-item"
                            onClick={() => handleToggleActive(user)}
                          >
                            {user.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                            {user.isActive ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                          </button>
                        </div>
                      </div>

                      <button
                        className="admin-action-btn delete admin-users-tooltip-trigger"
                        aria-label="Xóa tài khoản"
                        onClick={() => handleDelete(user.id)}
                      >
                        <span className="admin-users-tooltip">Xóa tài khoản</span>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center' }}>Không tìm thấy tài khoản nào</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-users-pagination">
        <div className="admin-users-pagination-summary">Tổng {pagination.total || 0} tài khoản</div>

        <div className="admin-users-pagination-controls">
          <button
            className="admin-users-page-btn"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            aria-label="Trang trước"
          >
            <ChevronLeft size={16} />
          </button>

          {paginationItems.map((pageNumber, index) => (
            <React.Fragment key={pageNumber}>
              {index > 0 && pageNumber - paginationItems[index - 1] > 1 && (
                <span className="admin-users-page-dots">...</span>
              )}
              <button
                className={`admin-users-page-btn ${currentPage === pageNumber ? 'active' : ''}`}
                onClick={() => setCurrentPage(pageNumber)}
              >
                {pageNumber}
              </button>
            </React.Fragment>
          ))}

          <button
            className="admin-users-page-btn"
            disabled={currentPage >= (pagination.totalPages || 1)}
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, pagination.totalPages || 1))}
            aria-label="Trang sau"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <AdminModal
        title="Tạo tài khoản mới"
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleCreateUser}
      >
        {error && <p style={{ color: 'var(--admin-danger)', marginBottom: '10px' }}>{error}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: 'var(--admin-text-secondary)' }}>Họ và tên</label>
            <input
              className="admin-search-input"
              style={{ width: '100%', boxSizing: 'border-box' }}
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: 'var(--admin-text-secondary)' }}>Email</label>
            <input
              type="email"
              className="admin-search-input"
              style={{ width: '100%', boxSizing: 'border-box' }}
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: 'var(--admin-text-secondary)' }}>Mật khẩu tạm</label>
            <input
              type="password"
              className="admin-search-input"
              style={{ width: '100%', boxSizing: 'border-box' }}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: 'var(--admin-text-secondary)' }}>Vai trò</label>
            <select
              className="admin-search-input"
              style={{ width: '100%', boxSizing: 'border-box' }}
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            >
              <option value="STUDENT">Học viên</option>
              <option value="ADMIN">Quản trị viên</option>
            </select>
          </div>
        </div>
      </AdminModal>
      <UserProfileModal 
        isOpen={isProfileModalOpen} 
        onClose={() => setIsProfileModalOpen(false)} 
        user={selectedUserProfile}
        onArchive={handleToggleActive}
        onEdit={(u) => alert('Chức năng chỉnh sửa thông tin đang được cập nhật')}
      />
    </div>
  );
};

export default Users;
