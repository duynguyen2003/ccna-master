import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import Dialog from '../../../components/ui/Dialog';
import useReducedMotion from '../../../hooks/useReducedMotion';
import { calendarDays, shiftDay } from '../utils/activityCalendar';
import '../styles/ActivityDatePicker.css';

const shortDate = (date) => date.split('-').reverse().join('/');
const monthStart = (month) => `${month}-01`;
const monthEnd = (month) => {
  const [year, index] = month.split('-').map(Number);
  return new Date(Date.UTC(year, index, 0)).toISOString().slice(0, 10);
};
const shiftMonth = (month, amount) => {
  const [year, index] = month.split('-').map(Number);
  return new Date(Date.UTC(year, index - 1 + amount, 1)).toISOString().slice(0, 7);
};

export default function ActivityDatePicker({ value, min, max, onChange }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState('opening');
  const [month, setMonth] = useState(value.slice(0, 7));
  const [view, setView] = useState('days');
  const [focusDate, setFocusDate] = useState(value);
  const content = useRef(null);
  const dayButtons = useRef(new Map());
  const closing = useRef(false);
  const reducedMotion = useReducedMotion();
  const clamp = (date) => (date < min ? min : date > max ? max : date);
  const year = Number(month.slice(0, 4));
  const days = calendarDays({ from: monthStart(month), to: monthEnd(month), days: [] });

  const dismiss = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    if (reducedMotion) setOpen(false);
    else setPhase('closing');
  }, [reducedMotion]);

  useEffect(() => {
    if (!open || phase !== 'opening') return;
    const frame = requestAnimationFrame(() => setPhase('open'));
    return () => cancelAnimationFrame(frame);
  }, [open, phase]);

  useEffect(() => {
    if (!open || phase !== 'closing') return;
    if (reducedMotion) {
      setOpen(false);
      return;
    }
    const modal = content.current?.closest('dialog');
    const css = modal ? getComputedStyle(modal).getPropertyValue('--modal-close-dur').trim() : '';
    const parsed = parseFloat(css) * (css.endsWith('ms') ? 1 : 1000);
    const duration = Number.isFinite(parsed) ? parsed : 150;
    const timer = setTimeout(() => setOpen(false), duration + 40);
    return () => clearTimeout(timer);
  }, [open, phase, reducedMotion]);

  useEffect(() => {
    if (open && view === 'days') dayButtons.current.get(focusDate)?.focus();
  }, [open, month, focusDate, view]);

  const showMonth = (next) => {
    if (next < min.slice(0, 7) || next > max.slice(0, 7)) return;
    setMonth(next);
    setFocusDate(clamp(monthStart(next)));
    setView('days');
  };

  const choose = (date) => {
    if (phase === 'closing' || date < min || date > max) return;
    onChange(date);
    dismiss();
  };

  const move = (event, date) => {
    const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let next;
    if (event.key in offsets) next = shiftDay(date, offsets[event.key]);
    else if (event.key === 'Home')
      next = shiftDay(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));
    else if (event.key === 'End')
      next = shiftDay(date, 6 - ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));
    else if (event.key === 'PageUp' || event.key === 'PageDown') {
      const target = shiftMonth(date.slice(0, 7), event.key === 'PageUp' ? -1 : 1);
      next = `${target}-${date.slice(-2)}`;
      if (next > monthEnd(target)) next = monthEnd(target);
    } else return;
    event.preventDefault();
    next = clamp(next);
    setFocusDate(next);
    setMonth(next.slice(0, 7));
    dayButtons.current.get(next)?.focus();
  };

  return (
    <div className="activity-date-picker">
      <span>Chọn ngày</span>
      <button
        type="button"
        className="activity-date-picker__trigger"
        aria-label="Chọn ngày hoạt động"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(event) => {
          event.currentTarget.focus();
          closing.current = false;
          setMonth(value.slice(0, 7));
          setFocusDate(value);
          setView('days');
          setPhase('opening');
          setOpen(true);
        }}
      >
        <CalendarDays size={16} aria-hidden="true" />
        {shortDate(value)}
      </button>
      {open && (
        <Dialog
          title="Chọn ngày hoạt động"
          onClose={dismiss}
          className={`activity-date-dialog t-modal ${phase === 'open' ? 'is-open' : phase === 'closing' ? 'is-closing' : ''}`}
        >
          <div ref={content} inert={phase === 'closing' ? '' : undefined}>
            <div className="activity-date-picker__navigation">
              <button
                type="button"
                aria-label={view === 'days' ? 'Tháng trước' : 'Năm trước'}
                disabled={
                  view === 'days' ? month <= min.slice(0, 7) : year <= Number(min.slice(0, 4))
                }
                onClick={() =>
                  view === 'days'
                    ? showMonth(shiftMonth(month, -1))
                    : setMonth(clamp(`${year - 1}-01-01`).slice(0, 7))
                }
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="activity-date-picker__month-label"
                aria-label="Chọn tháng và năm"
                onClick={() => (view === 'days' ? setView('months') : showMonth(month))}
              >
                {view === 'days' ? `Tháng ${Number(month.slice(5))}, ${year}` : year}
              </button>
              <button
                type="button"
                aria-label={view === 'days' ? 'Tháng sau' : 'Năm sau'}
                disabled={
                  view === 'days' ? month >= max.slice(0, 7) : year >= Number(max.slice(0, 4))
                }
                onClick={() =>
                  view === 'days'
                    ? showMonth(shiftMonth(month, 1))
                    : setMonth(clamp(`${year + 1}-01-01`).slice(0, 7))
                }
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
            {view === 'days' ? (
              <>
                <div className="activity-date-picker__weekdays" aria-hidden="true">
                  {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
                <div
                  className="activity-date-picker__days"
                  role="group"
                  aria-label={`Ngày trong tháng ${Number(month.slice(5))} năm ${year}`}
                >
                  {days.map((day) =>
                    day.outside ? (
                      <span key={day.date} />
                    ) : (
                      <button
                        key={day.date}
                        type="button"
                        disabled={day.date < min || day.date > max}
                        aria-label={`Chọn ngày ${shortDate(day.date)}`}
                        aria-pressed={day.date === value}
                        tabIndex={day.date === focusDate ? 0 : -1}
                        ref={(node) => {
                          if (node) dayButtons.current.set(day.date, node);
                          else dayButtons.current.delete(day.date);
                        }}
                        onFocus={() => setFocusDate(day.date)}
                        onKeyDown={(event) => move(event, day.date)}
                        onClick={() => choose(day.date)}
                      >
                        {Number(day.date.slice(-2))}
                      </button>
                    )
                  )}
                </div>
              </>
            ) : (
              <div
                className="activity-date-picker__months"
                role="group"
                aria-label={`Tháng trong năm ${year}`}
              >
                {Array.from(
                  { length: 12 },
                  (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`
                ).map((item) => (
                  <button
                    key={item}
                    type="button"
                    disabled={item < min.slice(0, 7) || item > max.slice(0, 7)}
                    onClick={() => showMonth(item)}
                  >
                    Tháng {Number(item.slice(5))}
                  </button>
                ))}
              </div>
            )}
            <div className="activity-date-picker__actions">
              <button
                type="button"
                onClick={() => {
                  setMonth(value.slice(0, 7));
                  setFocusDate(value);
                  setView('days');
                }}
              >
                Về ngày đã chọn
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
