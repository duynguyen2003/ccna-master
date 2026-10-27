import AppIcon from '../../../components/ui/AppIcon';
import React, { useState, useMemo, useEffect } from 'react';
import '../styles/PortLookup.css';
import { Link } from 'react-router-dom';
import DropdownSelect from '../../../components/ui/DropdownSelect';

const PortLookup = () => {
  const [portsData, setPortsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [transportFilter, setTransportFilter] = useState('All');
  const [isQuizMode, setIsQuizMode] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Load lookup data from frontend/src/data.
  useEffect(() => {
    import('../../../data/ports.json')
      .then((module) => {
        const data = module.default || module;
        const grouped = new Map();
        data.forEach((item) => {
          const portNum = Number(item['Port Number']);
          if (!portNum) return;
          const serviceName = item['Service Name'];
          // Optional: Exclude empty service names
          if (!serviceName) return;

          const desc = item['Description'] || '';
          const proto = (item['Transport Protocol'] || '').toUpperCase();

          const key = portNum + '_' + serviceName;
          if (!grouped.has(key)) {
            grouped.set(key, {
              id: key,
              port: portNum,
              name: String(serviceName).toUpperCase(),
              description: String(desc),
              transport: proto ? [String(proto)] : [],
            });
          } else {
            const existing = grouped.get(key);
            if (proto && !existing.transport.includes(proto)) {
              existing.transport.push(proto);
            }
          }
        });

        let arr = Array.from(grouped.values());

        // Cấu hình các port phổ biến theo chuẩn CCNA
        const commonPorts = [20, 21, 22, 23, 25, 53, 67, 68, 69, 80, 110, 123, 143, 161, 443, 3389];

        // Sắp xếp: Ưu tiên port phổ biến lên đầu, sau đó sắp xếp theo số port tăng dần
        arr.sort((a, b) => {
          const aIsCommon = commonPorts.includes(a.port);
          const bIsCommon = commonPorts.includes(b.port);

          if (aIsCommon && !bIsCommon) return -1;
          if (!aIsCommon && bIsCommon) return 1;

          // Nếu cả 2 cùng là nhóm phổ biến hoặc không phổ biến, sắp xếp theo thứ tự số
          return a.port - b.port;
        });

        setPortsData(arr);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load ports.json via API', err);
        setLoading(false);
      });
  }, []);

  // State for quiz mode { [portId]: { status: 'unanswered' | 'correct' | 'wrong' | 'skipped', value: string } }
  const [quizState, setQuizState] = useState({});

  // Reset quiz
  const handleReset = () => {
    setQuizState({});
  };

  // Toggle quiz mode
  const toggleQuizMode = () => {
    setIsQuizMode(!isQuizMode);
    if (!isQuizMode) {
      handleReset(); // clear state when turning ON
    }
  };

  // Calculate scores
  const scoreStats = useMemo(() => {
    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    Object.values(quizState).forEach((state) => {
      if (state.status === 'correct') correct++;
      else if (state.status === 'wrong') wrong++;
      else if (state.status === 'skipped') skipped++;
    });
    return { correct, wrong, skipped };
  }, [quizState]);

  // Filter ports based on search and transport toggle
  const filteredPorts = useMemo(() => {
    const results = portsData.filter((portItem) => {
      // Filter by Transport
      if (transportFilter !== 'All' && !portItem.transport.includes(transportFilter)) {
        return false;
      }

      // Filter by Search
      if (searchTerm.trim() !== '') {
        const lowerSearch = searchTerm.toLowerCase();
        const matchName = String(portItem.name).toLowerCase().includes(lowerSearch);
        const matchPort = portItem.port.toString().includes(lowerSearch);
        const matchDesc = String(portItem.description).toLowerCase().includes(lowerSearch);
        if (!matchName && !matchPort && !matchDesc) {
          return false;
        }
      } else {
        // If no search term and quiz is ON, just return predefined set so the user isn't bogged down
        // Or if normal mode, return first few
        // Let's defer to the limit below
      }
      return true;
    });

    return results;
  }, [searchTerm, transportFilter, portsData]);

  // Pagination logic
  const totalPages = Math.ceil(filteredPorts.length / itemsPerPage);

  const currentPorts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredPorts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredPorts, currentPage]);

  useEffect(() => {
    // Reset to page 1 when filter or search changes
    setCurrentPage(1);
  }, [searchTerm, transportFilter]);

  const getPageNumbers = () => {
    const pages = [];
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };

  // Handle Input Change for Quiz Mode
  const handleQuizInputChange = (portId, targetPortVal, event) => {
    const val = event.target.value.replace(/[^0-9]/g, ''); // only digits

    // Check correctness immediately if value matches exactly?
    // Or wait for blur/enter? The prompt says "Nhập đúng -> ô chuyển sang nền xanh lá cây + khóa. Gõ sai -> nền đỏ vẫn cho chỉnh sửa".
    // Better to check as they type

    let nextStatus = 'unanswered';
    if (val === '') {
      nextStatus = 'unanswered';
    } else if (val === targetPortVal.toString()) {
      nextStatus = 'correct';
    } else {
      nextStatus = 'wrong';
    }

    setQuizState((prev) => ({
      ...prev,
      [portId]: { status: nextStatus, value: val },
    }));
  };

  const handleReveal = (portId, targetPortVal) => {
    setQuizState((prev) => ({
      ...prev,
      [portId]: { status: 'skipped', value: targetPortVal.toString() },
    }));
  };

  return (
    <div className="port-lookup-wrapper">
      {/* ─── Breadcrumb ─── */}
      <nav className="port-breadcrumb">
        <Link to="/" className="port-breadcrumb-link">
          <AppIcon name={'home'} className="app-icon" style={{ fontSize: 18 }} />
          Trang chủ
        </Link>
        <AppIcon name={'chevron_right'} className="app-icon port-breadcrumb-sep" />
        <span className="port-breadcrumb-current">Tra cứu Port & Giao thức</span>
      </nav>

      {/* Header */}
      <header className="port-header">
        <div className="port-header-icon">
          <AppIcon name={'format_list_bulleted'} className="app-icon" />
        </div>
        <h1 className="port-title">Tra cứu Port & Giao thức mạng</h1>
        <p className="port-desc">Tra cứu nhanh danh sách các cổng dịch vụ và giao thức hệ thống.</p>
      </header>

      {/* Scoreboard block - only visible in Quiz Mode */}
      {isQuizMode && (
        <div className="port-scoreboard">
          <div className="scoreboard-left">
            <span className="scoreboard-title">
              <AppIcon name={'school'} className="app-icon" /> SCOREBOARD
            </span>
            <div className="score-pill correct">
              <AppIcon name={'check_circle'} className="app-icon" /> Đúng: {scoreStats.correct}
            </div>
            <div className="score-pill wrong">
              <AppIcon name={'cancel'} className="app-icon" /> Sai: {scoreStats.wrong}
            </div>
            <div className="score-pill skipped">
              <AppIcon name={'visibility_off'} className="app-icon" /> Bỏ qua: {scoreStats.skipped}
            </div>
          </div>
          <button className="reset-btn" onClick={handleReset}>
            <AppIcon name={'refresh'} className="app-icon" /> LÀM LẠI
          </button>
        </div>
      )}

      {/* Control Bar (Search, Filter, Toggle) */}
      <div className="port-control-bar">
        <div className="port-search-wrapper">
          <AppIcon name={'search'} className="app-icon search-icon" />
          <input
            aria-label="Tìm port hoặc giao thức"
            type="text"
            className="port-search-input"
            placeholder="Nhập số port hoặc tên giao thức..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="port-filter-wrapper">
          <DropdownSelect
            aria-label="Lọc giao thức"
            className="port-filter-select"
            value={transportFilter}
            onChange={(e) => setTransportFilter(e.target.value)}
          >
            <option value="All">Tất cả</option>
            <option value="TCP">TCP</option>
            <option value="UDP">UDP</option>
          </DropdownSelect>
        </div>

        <div className="port-toggle-wrapper">
          <label className="toggle-switch">
            <input
              id="port-study-mode"
              type="checkbox"
              aria-label="Chế độ học tập"
              checked={isQuizMode}
              onChange={toggleQuizMode}
            />
            <span className="slider round"></span>
          </label>
          <label htmlFor="port-study-mode" className="toggle-label">
            Chế độ học tập
          </label>
        </div>
      </div>

      {/* Table Section */}
      <div className="port-table-container">
        <table className="port-table">
          <thead>
            <tr>
              <th className="col-port">Port Number</th>
              <th className="col-name">Service Name</th>
              <th className="col-transport">Transport</th>
              <th className="col-desc">Description</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="4" className="empty-state">
                  Đang tải dữ liệu từ API...
                </td>
              </tr>
            ) : currentPorts.length > 0 ? (
              currentPorts.map((item) => {
                const state = quizState[item.id] || { status: 'unanswered', value: '' };

                // Determine input class
                let inputClass = 'quiz-input';
                if (state.status === 'correct') inputClass += ' is-correct';
                if (state.status === 'wrong') inputClass += ' is-wrong';
                if (state.status === 'skipped') inputClass += ' is-skipped';

                return (
                  <tr key={item.id} className="port-row">
                    <td className="col-port">
                      {isQuizMode ? (
                        <div className="quiz-cell">
                          <div className={`input-wrapper ${state.status}`}>
                            <input
                              type="text"
                              className={inputClass}
                              value={state.value}
                              placeholder="?"
                              onChange={(e) => handleQuizInputChange(item.id, item.port, e)}
                              disabled={state.status === 'correct' || state.status === 'skipped'}
                            />
                            {/* Icons inside the input for gamification */}
                            {state.status === 'correct' && (
                              <AppIcon
                                name={'check_circle'}
                                className="app-icon status-icon correct-icon"
                              />
                            )}
                            {state.status === 'wrong' && (
                              <AppIcon
                                name={'cancel'}
                                className="app-icon status-icon wrong-icon"
                              />
                            )}
                          </div>
                          {/* Reveal button */}
                          {state.status !== 'correct' && state.status !== 'skipped' && (
                            <button
                              className="reveal-btn"
                              title="Xem đáp án"
                              onClick={() => handleReveal(item.id, item.port)}
                            >
                              <AppIcon name={'visibility'} className="app-icon" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="port-number-text">{item.port}</span>
                      )}
                    </td>
                    <td className="col-name">
                      <span className="protocol-name">{item.name}</span>
                    </td>
                    <td className="col-transport">
                      <div className="transport-tags">
                        {item.transport.map((typ) => (
                          <span key={typ} className={`tag tag-${typ.toLowerCase()}`}>
                            {typ}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="col-desc">{item.description}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="4" className="empty-state">
                  Không tìm thấy kết quả nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination component */}
      {!loading && totalPages > 1 && (
        <div className="port-pagination">
          <button
            className="page-btn round-btn"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            <AppIcon name={'chevron_left'} className="app-icon" />
          </button>

          {getPageNumbers().map((p) => (
            <button
              key={p}
              className={`page-btn ${p === currentPage ? 'active' : ''}`}
              onClick={() => setCurrentPage(p)}
            >
              {p}
            </button>
          ))}

          {currentPage + 2 < totalPages && <span className="page-dots">...</span>}
          {currentPage + 2 < totalPages && (
            <button className="page-btn" onClick={() => setCurrentPage(totalPages)}>
              {totalPages}
            </button>
          )}

          <button
            className="page-btn round-btn"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            <AppIcon name={'chevron_right'} className="app-icon" />
          </button>
        </div>
      )}
    </div>
  );
};

export default PortLookup;
