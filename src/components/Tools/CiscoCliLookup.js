import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import ciscoCommands from '../../json/cisco-commands.json';

// --- 1. COPY BUTTON COMPONENT (Isolated State) ---
const CopyButton = ({ textToCopy }) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        setIsCopied(true);
        setTimeout(() => {
          setIsCopied(false);
        }, 2000); // Reset after 2s
      })
      .catch(err => console.error("Failed to copy:", err));
  };

  return (
    <button 
      className={`cli-copy-btn ${isCopied ? 'copied' : ''}`} 
      onClick={handleCopy}
      title="Sao chép lệnh"
    >
      <span className="material-icons-round" style={{ fontSize: 14 }}>
        {isCopied ? 'check' : 'content_copy'}
      </span>
      {isCopied ? 'Đã sao chép' : 'Sao chép'}
    </button>
  );
};

// --- 2. COMMAND CARD COMPONENT ---
const CommandCard = ({ commandData, allCommands, onSearchCommand }) => {
  // Memoize getting 2 related commands to avoid re-calculating on every render
  const relatedCommands = useMemo(() => {
    // Find commands in the same category, excluding the current one
    const sameCat = allCommands.filter(
      cmd => cmd.category === commandData.category && cmd.id !== commandData.id
    );
    // Return up to 2 items
    return sameCat.slice(0, 2);
  }, [commandData, allCommands]);

  return (
    <div className="cli-card">
      <div className="cli-card-header">
        <h3 className="cli-command-title">{commandData.command}</h3>
        <span className="cli-card-badge">{commandData.category}</span>
      </div>
      
      <p className="cli-command-desc">{commandData.description}</p>
      
      <div className="cli-terminal">
        <CopyButton textToCopy={commandData.example} />
        <pre>{commandData.example}</pre>
      </div>

      {relatedCommands.length > 0 && (
        <div className="cli-related">
          Có thể bạn cần xem thêm:
          {relatedCommands.map((cmd, idx) => (
            <React.Fragment key={cmd.id}>
              <span 
                className="cli-related-link" 
                onClick={() => onSearchCommand(cmd.command.split(' ')[0])} // Search the base command
              >
                {cmd.command.split(' ')[0]}
              </span>
              {idx < relatedCommands.length - 1 && ', '}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

// --- 3. MAIN COMPONENT ---
const CiscoCliLookup = () => {
  // States
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('Tất cả');
  const [visibleCount, setVisibleCount] = useState(10);
  const searchInputRef = useRef(null);

  // Extract unique categories from JSON
  const categories = useMemo(() => {
    const cats = new Set(ciscoCommands.map(cmd => cmd.category));
    return ['Tất cả', ...Array.from(cats)];
  }, []);

  // Filter commands
  const filteredCommands = useMemo(() => {
    return ciscoCommands.filter(cmd => {
      // Category Match
      if (activeCategory !== 'Tất cả' && cmd.category !== activeCategory) {
        return false;
      }
      
      // Search Match
      if (searchTerm.trim() !== '') {
        const lowerSearch = searchTerm.toLowerCase().trim();
        const matchCommand = cmd.command.toLowerCase().includes(lowerSearch);
        const matchDesc = cmd.description.toLowerCase().includes(lowerSearch);
        if (!matchCommand && !matchDesc) {
          return false;
        }
      }
      
      return true;
    });
  }, [searchTerm, activeCategory]);

  // Bug Fix: Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(10);
  }, [searchTerm, activeCategory]);

  // Derived state for display
  const displayedCommands = filteredCommands.slice(0, visibleCount);

  // Handlers
  const handleClearSearch = () => {
    setSearchTerm('');
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleRelatedClick = useCallback((cmdText) => {
    setSearchTerm(cmdText);
    setActiveCategory('Tất cả');
    // Scroll to top smoothly so user sees the new search results
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + 10);
  };

  return (
    <div className="cli-lookup-wrapper">
      {/* ─── Breadcrumb ─── */}
      <nav className="cli-breadcrumb">
        <Link to="/" className="cli-breadcrumb-link">
          <span className="material-icons-round" style={{ fontSize: 18 }}>home</span>
          Trang chủ
        </Link>
        <span className="material-icons-round cli-breadcrumb-sep">chevron_right</span>
        <span className="cli-breadcrumb-current">Tra cứu Cisco CLI</span>
      </nav>

      {/* ─── Header ─── */}
      <header className="cli-header">
        <div className="cli-header-icon">
          <span className="material-icons-round">terminal</span>
        </div>
        <h1 className="cli-title">Tra cứu câu lệnh Cisco CLI</h1>
        <p className="cli-desc">
          Công cụ tra cứu từ điển lệnh IOS cho Router và Switch dành cho cộng đồng học CCNA miễn phí.
        </p>
      </header>

      {/* ─── Controls ─── */}
      <div className="cli-controls">
        {/* Category Pills */}
        <div className="cli-categories">
          {categories.map(cat => (
            <button
              key={cat}
              className={`cli-category-pill ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Box */}
        <div className="cli-search-box">
          <span className="material-icons-round cli-search-icon">search</span>
          <input
            ref={searchInputRef}
            type="text"
            className="cli-search-input"
            placeholder="Tìm kiếm lệnh (vd: ip route, vlan...) hoặc mô tả..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm.length > 0 && (
            <button 
              className="cli-search-clear" 
              onClick={handleClearSearch}
              title="Xóa tìm kiếm"
            >
              <span className="material-icons-round">close</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── Command List ─── */}
      <div className="cli-list">
        {displayedCommands.length > 0 ? (
          displayedCommands.map((command) => (
            <CommandCard 
              key={command.id} 
              commandData={command} 
              allCommands={ciscoCommands}
              onSearchCommand={handleRelatedClick}
            />
          ))
        ) : (
          /* Empty State */
          <div className="cli-empty-state">
            <span className="material-icons-round cli-empty-icon">search_off</span>
            <h3 className="cli-empty-title">Không tìm thấy lệnh nào</h3>
            <p className="cli-empty-desc">
              Thử tìm kiếm với một từ khóa khác hoặc xóa bộ lọc để xem toàn bộ danh sách.
            </p>
          </div>
        )}
      </div>

      {/* ─── Load More Button ─── */}
      {visibleCount < filteredCommands.length && displayedCommands.length > 0 && (
        <div className="cli-load-more">
          <button className="btn-load-more" onClick={handleLoadMore}>
            Xem thêm lệnh
          </button>
        </div>
      )}
    </div>
  );
};

export default CiscoCliLookup;
