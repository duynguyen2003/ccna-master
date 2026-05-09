import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../services/Api';

const TopHeader = () => {
    const { user, isAuthenticated, logout } = useAuth();
    const navigate = useNavigate();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Đóng dropdown khi click bên ngoài
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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
                <div className="search-box">
                    <span className="material-icons-round search-icon">search</span>
                    <input
                        className="search-input"
                        placeholder="Tìm kiếm khóa học..."
                        type="text"
                    />
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
