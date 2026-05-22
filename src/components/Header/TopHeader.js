import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api, { API_URL } from '../../services/Api';

const TopHeader = () => {
    const { user, isAuthenticated, logout, token } = useAuth();
    const navigate = useNavigate();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Trạng thái tìm kiếm
    const [searchTerm, setSearchTerm] = useState('');
    const [searchItems, setSearchItems] = useState([]);
    const [isIndexed, setIsIndexed] = useState(false);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [isIndexingLoading, setIsIndexingLoading] = useState(false);
    const searchRef = useRef(null);

    // Đóng dropdown khi click bên ngoài
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsDropdownOpen(false);
            }
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setIsSearchFocused(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Xây dựng chỉ mục tìm kiếm khi focus ô nhập liệu lần đầu tiên (Lazy indexing)
    const handleSearchFocus = async () => {
        setIsSearchFocused(true);
        if (isIndexed || isIndexingLoading) return;
        
        try {
            setIsIndexingLoading(true);
            const [coursesData, labsData] = await Promise.all([
                api.getCourses(token),
                api.getLabs(token)
            ]);
            
            const items = [];
            
            // 1. Chỉ mục Khóa học
            if (Array.isArray(coursesData)) {
                coursesData.forEach(c => {
                    items.push({
                        id: c.id,
                        type: 'course',
                        title: c.title,
                        subtitle: `Khóa học • Code: ${c.code || ''}`,
                        url: `/course/${c.id}`
                    });
                    
                    // 2. Chỉ mục Chương & Bài học
                    if (Array.isArray(c.modules)) {
                        c.modules.forEach(m => {
                            if (Array.isArray(m.lessons)) {
                                m.lessons.forEach(l => {
                                    items.push({
                                        id: l.id,
                                        type: 'lesson',
                                        title: l.title,
                                        subtitle: `Bài học • Chương: ${m.title} (${c.title})`,
                                        url: `/lesson?course=${c.id}&lesson=${l.id}`
                                    });
                                });
                            }
                        });
                    }
                });
            }
            
            // 3. Chỉ mục Lab thực hành
            if (Array.isArray(labsData)) {
                labsData.forEach(l => {
                    items.push({
                        id: l.id,
                        type: 'lab',
                        title: l.title,
                        subtitle: `Lab • Phân loại: ${l.category || ''}`,
                        url: `/labs?labId=${l.id}`
                    });
                });
            }
            
            setSearchItems(items);
            setIsIndexed(true);
        } catch (err) {
            console.error("Failed to build search index:", err);
        } finally {
            setIsIndexingLoading(false);
        }
    };

    // Lọc danh sách theo từ khóa tìm kiếm
    const filteredResults = searchTerm.trim() 
        ? searchItems.filter(item => 
            item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.subtitle.toLowerCase().includes(searchTerm.toLowerCase())
          )
        : [];

    // Xử lý Đăng xuất
    const handleLogout = async () => {
        setIsDropdownOpen(false);
        await logout();
        navigate('/');
    };

    // Lấy chữ cái đầu tên để làm avatar mặc định
    const getInitials = (name) => {
        if (!name) return 'U';
        const parts = name.trim().split(' ');
        return parts[parts.length - 1].charAt(0).toUpperCase();
    };

    return (
        <header className="header">
            <Link to="/" className="header-left" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="logo-icon">
                    <span className="material-icons-round">router</span>
                </div>
                <div className="logo-text">
                    <span className="logo-title">NetMastery</span>
                    <span className="logo-subtitle">HỌC MẠNG ĐỂ ĐI LÀM</span>
                </div>
            </Link>

            <div className="header-center">
                <div className="search-box" ref={searchRef}>
                    <span className="material-icons-round search-icon">search</span>
                    <input
                        className="search-input"
                        placeholder="Tìm khóa học, bài học, lab..."
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onFocus={handleSearchFocus}
                    />
                    {searchTerm && (
                        <button 
                            type="button" 
                            className="search-clear-btn" 
                            onClick={() => setSearchTerm('')}
                            aria-label="Xóa tìm kiếm"
                        >
                            <span className="material-icons-round">close</span>
                        </button>
                    )}

                    {isSearchFocused && (
                        <div className="search-results-dropdown">
                            {isIndexingLoading ? (
                                <div className="search-dropdown-message">
                                    <span className="material-icons-round spin">sync</span>
                                    <span>Đang chuẩn bị dữ liệu tìm kiếm...</span>
                                </div>
                            ) : searchTerm.trim() === '' ? (
                                <div className="search-dropdown-message info">
                                    <span className="material-icons-round">search</span>
                                    <span>Tìm kiếm nhanh bài học, khóa học hoặc bài thực hành lab...</span>
                                </div>
                            ) : filteredResults.length > 0 ? (
                                <div className="search-results-list">
                                    {filteredResults.map(item => (
                                        <div 
                                            key={`${item.type}-${item.id}`} 
                                            className="search-result-item"
                                            onClick={() => {
                                                navigate(item.url);
                                                setSearchTerm('');
                                                setIsSearchFocused(false);
                                            }}
                                        >
                                            <div className={`search-result-icon-wrapper ${item.type}`}>
                                                <span className="material-icons-round">
                                                    {item.type === 'course' ? 'school' : item.type === 'lesson' ? 'play_circle_outline' : 'terminal'}
                                                </span>
                                            </div>
                                            <div className="search-result-info">
                                                <div className="search-result-item-title">{item.title}</div>
                                                <div className="search-result-item-subtitle">{item.subtitle}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="search-dropdown-message empty">
                                    <span className="material-icons-round">sentiment_dissatisfied</span>
                                    <span>Không tìm thấy kết quả cho "{searchTerm}"</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="header-right">
                {isAuthenticated ? (
                    <>
                        {/* Đã đăng nhập: Hiện link + notification + avatar */}
                        <a className="nav-link" href="#courses">Khóa học của tôi</a>
                        <button className="icon-btn">
                            <span className="material-icons-round">notifications</span>
                            <span className="badge"></span>
                        </button>

                        {/* Avatar + Dropdown */}
                        <div className="user-menu" ref={dropdownRef}>
                            <button
                                className="user-menu-trigger"
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                aria-label="Menu người dùng"
                            >
                                {user?.avatarUrl ? (
                                    <img
                                        alt="User avatar"
                                        className="avatar"
                                        src={user.avatarUrl.startsWith('http') 
                                            ? user.avatarUrl 
                                            : `${API_URL.replace('/api', '')}${user.avatarUrl.startsWith('/') ? '' : '/'}${user.avatarUrl}`
                                        }
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                            const fallback = document.createElement('div');
                                            fallback.className = 'avatar avatar-initials';
                                            fallback.innerText = getInitials(user?.fullName);
                                            e.target.parentElement.appendChild(fallback);
                                        }}
                                    />
                                ) : (
                                    <div className="avatar avatar-initials">
                                        {getInitials(user?.fullName)}
                                    </div>
                                )}
                            </button>

                            {/* Dropdown Menu */}
                            {isDropdownOpen && (
                                <div className="user-dropdown">
                                    <div className="user-dropdown-header">
                                        <div className="user-dropdown-name">{user?.fullName || 'Người dùng'}</div>
                                        <div className="user-dropdown-email">{user?.email}</div>
                                    </div>
                                    <div className="user-dropdown-divider"></div>
                                    <Link
                                        to="/profile"
                                        className="user-dropdown-item"
                                        onClick={() => setIsDropdownOpen(false)}
                                    >
                                        <span className="material-icons-round">person</span>
                                        Hồ sơ cá nhân
                                    </Link>
                                    <button
                                        className="user-dropdown-item user-dropdown-logout"
                                        onClick={handleLogout}
                                    >
                                        <span className="material-icons-round">logout</span>
                                        Đăng xuất
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        {/* Chưa đăng nhập: Hiện nút Đăng nhập & Đăng ký */}
                        <Link to="/login" className="header-login-btn">
                            <span className="material-icons-round" style={{ fontSize: 18 }}>login</span>
                            Đăng nhập
                        </Link>
                        <Link to="/register" className="header-register-btn">
                            Đăng ký
                        </Link>
                    </>
                )}
            </div>
        </header>
    );
};

export default TopHeader;
