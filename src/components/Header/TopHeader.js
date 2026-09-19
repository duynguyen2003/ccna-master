import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api, { API_URL } from '../../services/Api';

const NOTCH_NAV_ITEMS = [
  { id: 'home-how-it-works', label: 'Cách học' },
  { id: 'home-courses', label: 'Lộ trình' },
  { id: 'home-tools', label: 'Công cụ' },
  { id: 'home-faq', label: 'Câu hỏi thường gặp', shortLabel: 'FAQ' },
];

const TopHeader = () => {
  const { user, isAuthenticated, logout, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isHomePage = location.pathname === '/';
  const [activeSection, setActiveSection] = useState('');
  const [isScrolledPastHero, setIsScrolledPastHero] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Chỉ hiển thị trên trang chủ và khi đã cuộn qua banner hero
  useEffect(() => {
    if (location.pathname !== '/') {
      setIsScrolledPastHero(false);
      setActiveSection('');
      return;
    }

    const handleScroll = () => {
      // 1. Kiểm tra vị trí để hiện/ẩn tai thỏ khi qua banner
      const heroEl = document.querySelector('.landing-hero');
      if (heroEl) {
        const rect = heroEl.getBoundingClientRect();
        setIsScrolledPastHero((prev) => {
          if (!prev && rect.bottom <= 100) return true;
          if (prev && rect.bottom > 140) return false;
          return prev;
        });
      } else {
        setIsScrolledPastHero((prev) => {
          if (!prev && window.scrollY > 320) return true;
          if (prev && window.scrollY <= 280) return false;
          return prev;
        });
      }

      // 2. Theo dõi mục đang hiển thị trên trang chủ để cập nhật aria-current="page"
      const sectionIds = ['home-how-it-works', 'home-courses', 'home-tools', 'home-faq'];
      let current = '';
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 260 && rect.bottom >= 120) {
            current = id;
          }
        }
      }
      setActiveSection(current);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [location.pathname]);

  const handleNotchNavClick = (e, sectionId) => {
    e.preventDefault();
    setActiveSection(sectionId);
    if (location.pathname === '/') {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.history.replaceState(null, '', `#${sectionId}`);
      }
    } else {
      navigate(`/#${sectionId}`);
      setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    }
  };

  // Trạng thái tìm kiếm
  const [searchTerm, setSearchTerm] = useState('');
  const [searchItems, setSearchItems] = useState([]);
  const [isIndexed, setIsIndexed] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isIndexingLoading, setIsIndexingLoading] = useState(false);
  const searchRef = useRef(null);

  // Trạng thái tìm kiếm trong tai thỏ (notch)
  const [isOpen, setIsOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [contentWidth, setContentWidth] = useState(null);

  const rowRef = useRef(null);
  const notchContentRef = useRef(null);
  const searchTriggerBtnRef = useRef(null);
  const notchSearchInputRef = useRef(null);
  const notchContainerRef = useRef(null);

  // Đo kích thước: Thu lại = row.offsetWidth + padding. Mở = min(560px, window.innerWidth - capWidth - margin)
  const getCollapsedWidth = () => {
    if (!rowRef.current) return null;
    const isMobile = window.innerWidth <= 640;
    const padding = isMobile ? 8 : 30;
    const capWidth = isMobile ? 48 : 88;
    const maxAvailable = window.innerWidth - capWidth - (isMobile ? 12 : 32);
    const measured = Math.round(rowRef.current.offsetWidth + padding);
    return Math.min(measured, Math.max(80, maxAvailable));
  };

  const getExpandedWidth = () => {
    const isMobile = window.innerWidth <= 640;
    const capWidth = isMobile ? 48 : 88;
    const screenMargin = isMobile ? 16 : 40;
    return Math.min(560, window.innerWidth - capWidth - screenMargin);
  };

  // Mở tìm kiếm: thêm class open, đo mở rộng width, delay 0.12s focus vào input
  const handleOpenSearch = () => {
    setIsOpen(true);
    setContentWidth(getExpandedWidth());
    handleSearchFocus();
    setTimeout(() => {
      notchSearchInputRef.current?.focus({ preventScroll: true });
    }, 120);
  };

  // Đóng: nhấn Esc, bấm ra ngoài khối, hoặc bấm nút Esc
  const handleCloseSearch = () => {
    setIsOpen(false);
    setIsSearchFocused(false);
    setSearchTerm('');
    const collapsed = getCollapsedWidth();
    if (collapsed) setContentWidth(collapsed);
    // Trả focus về nút kính lúp (không scroll)
    setTimeout(() => {
      searchTriggerBtnRef.current?.focus({ preventScroll: true });
    }, 50);
  };

  // Thiết lập ban đầu và lắng nghe resize, document.fonts.ready
  useEffect(() => {
    // 1. Đo width ban đầu
    const initialWidth = getCollapsedWidth();
    if (initialWidth) {
      setContentWidth(initialWidth);
    }

    // 2. Thêm class ready sau 2 frame để tránh nhảy lúc load ban đầu
    const frame1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsReady(true);
      });
    });

    // 3. Đo lại khi window resize
    const handleResize = () => {
      if (isOpen) {
        setContentWidth(getExpandedWidth());
      } else {
        const w = getCollapsedWidth();
        if (w) setContentWidth(w);
      }
    };
    window.addEventListener('resize', handleResize);

    // 4. Đo lại khi document.fonts.ready
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        handleResize();
      });
    }

    return () => {
      cancelAnimationFrame(frame1);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen]);

  // Cập nhật lại width khi tai thỏ vừa xuất hiện sau khi cuộn qua hero, hoặc đóng lại khi cuộn lên đầu trang
  useEffect(() => {
    if (isScrolledPastHero) {
      const w = isOpen ? getExpandedWidth() : getCollapsedWidth();
      if (w) setContentWidth(w);
    } else if (isOpen) {
      handleCloseSearch();
    }
  }, [isScrolledPastHero, isOpen]);

  // Đóng khi click ngoài hoặc nhấn Esc
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        if (!notchContainerRef.current?.contains(e.target)) {
          setIsSearchFocused(false);
        }
      }
      if (notchContainerRef.current && !notchContainerRef.current.contains(e.target)) {
        if (isOpen) {
          handleCloseSearch();
        }
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleCloseSearch();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Xây dựng chỉ mục tìm kiếm khi focus ô nhập liệu lần đầu tiên (Lazy indexing)
  const handleSearchFocus = async () => {
    setIsSearchFocused(true);
    if (isIndexed || isIndexingLoading) return;

    try {
      setIsIndexingLoading(true);
      const [coursesData, labsData] = await Promise.all([
        api.getCourses(token),
        api.getLabs(token),
      ]);

      const items = [];

      // 1. Chỉ mục Khóa học
      if (Array.isArray(coursesData)) {
        coursesData.forEach((c) => {
          items.push({
            id: c.id,
            type: 'course',
            title: c.title,
            subtitle: `Khóa học • Code: ${c.code || ''}`,
            url: `/course/${c.id}`,
          });

          // 2. Chỉ mục Chương & Bài học
          if (Array.isArray(c.modules)) {
            c.modules.forEach((m) => {
              if (Array.isArray(m.lessons)) {
                m.lessons.forEach((l) => {
                  items.push({
                    id: l.id,
                    type: 'lesson',
                    title: l.title,
                    subtitle: `Bài học • Chương: ${m.title} (${c.title})`,
                    url: `/lesson?course=${c.id}&lesson=${l.id}`,
                  });
                });
              }
            });
          }
        });
      }

      // 3. Chỉ mục Lab thực hành
      if (Array.isArray(labsData)) {
        labsData.forEach((l) => {
          items.push({
            id: l.id,
            type: 'lab',
            title: l.title,
            subtitle: `Lab • Phân loại: ${l.category || ''}`,
            url: `/labs?labId=${l.id}`,
          });
        });
      }

      setSearchItems(items);
      setIsIndexed(true);
    } catch (err) {
      console.error('Failed to build search index:', err);
    } finally {
      setIsIndexingLoading(false);
    }
  };

  // Lọc danh sách theo từ khóa tìm kiếm
  const filteredResults = searchTerm.trim()
    ? searchItems.filter(
        (item) =>
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

      <div
        className={`header-center ${isHomePage && !isAuthenticated && isScrolledPastHero ? 'is-hidden' : ''}`}
      >
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
                  {filteredResults.map((item) => (
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
                          {item.type === 'course'
                            ? 'school'
                            : item.type === 'lesson'
                              ? 'play_circle_outline'
                              : 'terminal'}
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
            <Link className="nav-link" to="/roadmap">
              Khóa học của tôi
            </Link>
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
                    src={
                      user.avatarUrl.startsWith('http')
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
                  <div className="avatar avatar-initials">{getInitials(user?.fullName)}</div>
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
              <span className="material-icons-round" style={{ fontSize: 18 }}>
                login
              </span>
              Đăng nhập
            </Link>
            <Link to="/register" className="header-register-btn">
              Đăng ký
            </Link>
          </>
        )}
      </div>

      {isHomePage && !isAuthenticated && (
        <nav
          ref={notchContainerRef}
          className={`header-notch-nav landing-section-nav ${isScrolledPastHero ? 'is-visible' : 'is-hidden'}`}
          aria-label="Điều hướng trang chủ"
        >
          {/* Cánh cong S-curve bên trái: lượn xuống từ mép header rồi cong vào đáy tai thỏ */}
          <svg
            className="notch-cap notch-cap--left"
            width="44"
            height="44"
            viewBox="0 0 44 44"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M 0 0 A 20 20 0 0 1 20 20 A 24 24 0 0 0 44 44 L 44 0 Z"
              fill="var(--notch-bg, #ffffff)"
            />
            <path
              d="M 0 0.5 A 19.5 19.5 0 0 1 19.5 20 A 23.5 23.5 0 0 0 43 43.5 L 44 43.5"
              stroke="var(--notch-border, #94a3b8)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              fill="none"
            />
          </svg>

          {/* Dải bridge che hoàn toàn viền dưới 1px của header, tạo 1 khối liền mạch */}
          <span className="notch-bridge" aria-hidden="true" />

          {/* Khối nội dung: độ rộng do JS tính, thêm class ready sau 2 frame, class open khi mở */}
          <div
            ref={notchContentRef}
            className={`notch-content ${isReady ? 'ready' : ''} ${isOpen ? 'open' : ''}`}
            style={contentWidth ? { width: `${contentWidth}px` } : undefined}
          >
            {/* .row: Chứa menu điều hướng + nút kính lúp (mờ dần và ẩn khi mở tìm kiếm) */}
            <div className="row" ref={rowRef}>
              <div className="notch-nav-links">
                {NOTCH_NAV_ITEMS.map((item) => {
                  const isCurrent = activeSection === item.id;
                  return (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className={`header-notch-link${isCurrent ? ' active' : ''}`}
                      aria-current={isCurrent ? 'page' : undefined}
                      onClick={(e) => handleNotchNavClick(e, item.id)}
                    >
                      {item.shortLabel ? (
                        <>
                          <span className="notch-text-full">{item.label}</span>
                          <span className="notch-text-short">{item.shortLabel}</span>
                        </>
                      ) : (
                        item.label
                      )}
                    </a>
                  );
                })}
              </div>

              <span className="notch-divider" aria-hidden="true" />

              <button
                ref={searchTriggerBtnRef}
                type="button"
                className="notch-search-btn"
                onClick={handleOpenSearch}
                aria-label="Mở tìm kiếm"
                title="Tìm kiếm"
              >
                <span className="material-icons-round">search</span>
              </button>
            </div>

            {/* .field: Ô tìm kiếm trượt hiện ra (delay 0.12s khi mở) */}
            <div className="field">
              <span className="material-icons-round field-icon" aria-hidden="true">
                search
              </span>
              <input
                ref={notchSearchInputRef}
                type="text"
                className="field-input"
                placeholder="Tìm khóa học, bài học, lab..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={handleSearchFocus}
              />
              {searchTerm && (
                <button
                  type="button"
                  className="field-clear-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchTerm('');
                    notchSearchInputRef.current?.focus({ preventScroll: true });
                  }}
                  aria-label="Xóa từ khóa"
                >
                  <span className="material-icons-round">close</span>
                </button>
              )}
              <button
                type="button"
                className="field-esc-btn"
                onClick={handleCloseSearch}
                title="Đóng tìm kiếm (Esc)"
                aria-label="Đóng tìm kiếm (Esc)"
              >
                <span className="esc-badge">Esc</span>
              </button>
            </div>

            {/* Dropdown kết quả tìm kiếm thả xuống từ tai thỏ */}
            {isOpen && isSearchFocused && (
              <div className="notch-search-results-dropdown">
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
                    {filteredResults.map((item) => (
                      <div
                        key={`notch-${item.type}-${item.id}`}
                        className="search-result-item"
                        onClick={() => {
                          navigate(item.url);
                          handleCloseSearch();
                        }}
                      >
                        <div className={`search-result-icon-wrapper ${item.type}`}>
                          <span className="material-icons-round">
                            {item.type === 'course'
                              ? 'school'
                              : item.type === 'lesson'
                                ? 'play_circle_outline'
                                : 'terminal'}
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

          {/* Cánh cong S-curve bên phải: lượn lên từ đáy tai thỏ rồi nối mượt vào mép header */}
          <svg
            className="notch-cap notch-cap--right"
            width="44"
            height="44"
            viewBox="0 0 44 44"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M 0 44 A 24 24 0 0 0 24 20 A 20 20 0 0 1 44 0 L 0 0 Z"
              fill="var(--notch-bg, #ffffff)"
            />
            <path
              d="M 0 43.5 L 1 43.5 A 23.5 23.5 0 0 0 24.5 20 A 19.5 19.5 0 0 1 44 0.5"
              stroke="var(--notch-border, #94a3b8)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              fill="none"
            />
          </svg>
        </nav>
      )}
    </header>
  );
};

export default TopHeader;
