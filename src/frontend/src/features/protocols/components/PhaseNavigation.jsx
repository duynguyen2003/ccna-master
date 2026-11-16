import React, { useLayoutEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import DropdownSelect from '../../../components/ui/DropdownSelect';

export default function PhaseNavigation({ phases, current, onSelect }) {
  const list = useRef(null);
  useLayoutEffect(() => {
    const container = list.current,
      active = container?.querySelector('[aria-current="step"]');
    if (!container || !active) return;
    const box = container.getBoundingClientRect(),
      item = active.getBoundingClientRect();
    if (item.top < box.top) container.scrollTop += item.top - box.top;
    else if (item.bottom > box.bottom) container.scrollTop += item.bottom - box.bottom;
  }, [current]);
  return (
    <aside className="protocol-phases">
      <div className="protocol-phases__heading">
        <h3>Giai đoạn</h3>
        <span>
          {current + 1}/{phases.length}
        </span>
      </div>
      <div className="protocol-phases__mobile">
        <DropdownSelect
          aria-label="Chọn giai đoạn"
          value={current}
          onChange={(e) => onSelect(Number(e.target.value))}
        >
          {phases.map((phase, i) => (
            <option key={i} value={i}>
              {i + 1}. {phase.title}
              {phase.seen === phase.total ? ' · Đã xem' : ''}
            </option>
          ))}
        </DropdownSelect>
      </div>
      <nav ref={list} className="protocol-phases__list" aria-label="Các giai đoạn mô phỏng">
        <ol>
          {phases.map((phase, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={i === current ? 'step' : undefined}
                data-seen={phase.seen === phase.total ? 'true' : undefined}
              >
                <span className="protocol-phases__number">
                  {phase.seen === phase.total ? <Check size={15} aria-label="Đã xem" /> : i + 1}
                </span>
                <span>
                  <strong>{phase.title}</strong>
                  <small>
                    {phase.seen
                      ? `Đã xem ${phase.seen}/${phase.total} sự kiện`
                      : `${phase.total} sự kiện`}
                  </small>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </nav>
    </aside>
  );
}
