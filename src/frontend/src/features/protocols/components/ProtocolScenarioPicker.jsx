import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, Search, X } from 'lucide-react';
import Dialog from '../../../components/ui/Dialog';
import { protocolGroups } from '../data/lessonCatalog';

const fold = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();

export default function ProtocolScenarioPicker({
  scenarios,
  currentId,
  onSelect,
  onClose,
  returnFocusRef,
}) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('all');
  const search = useRef(null);
  useEffect(() => {
    search.current?.focus();
  }, []);
  const available = [...new Set(scenarios.map((item) => item.group))];
  const groups = [
    ...Object.keys(protocolGroups).filter((id) => available.includes(id)),
    ...available.filter((id) => !protocolGroups[id]),
  ];
  const filtered = useMemo(
    () =>
      scenarios.filter(
        (item) =>
          (group === 'all' || item.group === group) &&
          fold([item.protocolName, item.title, item.summary].join(' ')).includes(fold(query).trim())
      ),
    [scenarios, group, query]
  );
  const protocols = [...new Set(filtered.map((item) => item.protocolId))];
  return (
    <Dialog
      title="Chọn mô phỏng"
      onClose={onClose}
      returnFocusRef={returnFocusRef}
      className="protocol-picker"
      animateExit
    >
      <div className="protocol-picker__search">
        <Search size={18} aria-hidden="true" />
        <input
          ref={search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Tìm mô phỏng"
          placeholder="Tìm giao thức hoặc kịch bản…"
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              search.current?.focus();
            }}
            aria-label="Xóa tìm kiếm"
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="protocol-picker__filters" role="group" aria-label="Lọc nhóm mô phỏng">
        {['all', ...groups].map((id) => (
          <button type="button" key={id} aria-pressed={group === id} onClick={() => setGroup(id)}>
            {id === 'all' ? 'Tất cả' : protocolGroups[id] || id}
            <span>
              {id === 'all'
                ? scenarios.length
                : scenarios.filter((item) => item.group === id).length}
            </span>
          </button>
        ))}
      </div>
      <p className="protocol-picker__count" role="status">
        {filtered.length} kịch bản · {protocols.length} giao thức
      </p>
      <div className="protocol-picker__results">
        {protocols.map((id) => {
          const items = filtered.filter((item) => item.protocolId === id);
          return (
            <section key={id} aria-label={'Giao thức ' + items[0].protocolName}>
              <header>
                <h3>{items[0].protocolName}</h3>
                <span>
                  {protocolGroups[items[0].group] || items[0].group} · {items.length} kịch bản
                </span>
              </header>
              {items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className="protocol-picker__item"
                  aria-pressed={currentId === item.id}
                  onClick={() => {
                    onSelect(item.id);
                    onClose();
                  }}
                >
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.summary}</span>
                  </div>
                  {currentId === item.id ? (
                    <Check size={19} aria-label="Đang xem" />
                  ) : (
                    <ChevronRight size={18} aria-hidden="true" />
                  )}
                </button>
              ))}
            </section>
          );
        })}
        {!filtered.length && (
          <div className="protocol-picker__empty">
            <Search size={28} aria-hidden="true" />
            <h3>Không tìm thấy mô phỏng</h3>
            <p>Thử tên giao thức khác hoặc bỏ bộ lọc nhóm.</p>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setGroup('all');
                search.current?.focus();
              }}
            >
              Xóa bộ lọc
            </button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
