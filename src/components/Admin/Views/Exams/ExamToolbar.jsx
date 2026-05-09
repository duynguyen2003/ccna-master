import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronsUpDown, CheckCircle2, LayoutGrid, List } from 'lucide-react';
import { STATUS_FILTER_OPTIONS } from './constants';

const ExamToolbar = ({
  searchKeyword,
  onSearchChange,
  statusFilter,
  onStatusChange,
  viewMode,
  onViewModeChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const currentOption = STATUS_FILTER_OPTIONS.find((o) => o.value === statusFilter)
    ?? STATUS_FILTER_OPTIONS[0];

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="exam-hub-toolbar-shell">
      <div className="exam-hub-toolbar">

        {/* Search */}
        <div className="exam-hub-search-wrap">
          <Search size={18} />
          <input
            type="text"
            placeholder="Tìm kiếm tên kỳ thi..."
            value={searchKeyword}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <div className="exam-hub-toolbar-right">

          {/* Status filter dropdown */}
          <div
            className={`exam-hub-select-wrap ${isOpen ? 'is-open' : ''}`}
            ref={dropdownRef}
          >
            <span className="exam-hub-select-label">Trạng thái:</span>
            <button
              type="button"
              className="exam-hub-select-trigger"
              onClick={() => setIsOpen((p) => !p)}
              aria-haspopup="listbox"
              aria-expanded={isOpen}
            >
              <span className="exam-hub-select-value">{currentOption.label}</span>
              <ChevronsUpDown size={14} className="exam-hub-select-caret" />
            </button>

            {isOpen && (
              <div className="exam-hub-select-menu" role="listbox" aria-label="Trạng thái">
                {STATUS_FILTER_OPTIONS.map((opt) => {
                  const selected = opt.value === statusFilter;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      className={`exam-hub-select-option ${selected ? 'is-selected' : ''}`}
                      onClick={() => { onStatusChange(opt.value); setIsOpen(false); }}
                    >
                      <span>{opt.label}</span>
                      {selected && <CheckCircle2 size={14} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* View mode toggle */}
          <div className="exam-hub-view-toggle">
            {[
              { mode: 'grid', Icon: LayoutGrid, label: 'Chế độ lưới' },
              { mode: 'list', Icon: List, label: 'Chế độ danh sách' },
            ].map(({ mode, Icon, label }) => (
              <button
                key={mode}
                type="button"
                className={viewMode === mode ? 'active' : ''}
                onClick={() => onViewModeChange(mode)}
                aria-label={label}
              >
                <Icon size={20} />
              </button>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
};


export default ExamToolbar;
