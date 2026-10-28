import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import DropdownSelect from '../../../components/ui/DropdownSelect';
import StatusAlert from '../../../components/ui/StatusAlert';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import ActivityDatePicker from './ActivityDatePicker';
import useActivityCalendar from '../hooks/useActivityCalendar';
import { calendarDays, describeDay, intensity, shiftDay } from '../utils/activityCalendar';
import '../styles/ActivityCalendar.css';

export default function ActivityCalendar() {
  const [period, setPeriod] = useState('last365');
  const [type, setType] = useState('all');
  const [activeDate, setActiveDate] = useState(null);
  const [hoverDate, setHoverDate] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [listPage, setListPage] = useState({ key: '', index: 0 });
  const { data, loading, error, retry, availableYears } = useActivityCalendar(period, type);
  const cells = useMemo(() => (data ? calendarDays(data) : []), [data]);
  const validDays = useMemo(() => cells.filter((day) => !day.outside), [cells]);
  const buttons = useRef(new Map());
  const viewport = useRef(null);
  const titleId = useId();
  const helpId = useId();
  const detailsId = useId();
  const selectedDate =
    data && activeDate >= data.from && activeDate <= data.to ? activeDate : data?.to;
  const selected = validDays.find((day) => day.date === (hoverDate || selectedDate));
  const weeks = cells.length / 7;
  const months = [];
  cells.forEach((day, index) => {
    if (day.outside || (day.date.slice(-2) !== '01' && day.date !== data.from)) return;
    const week = Math.floor(index / 7);
    if (months.length && week - months[months.length - 1].week < 3) months.pop();
    months.push({ week, month: Number(day.date.slice(5, 7)) });
  });
  const currentYear = Number(
    new Intl.DateTimeFormat('en', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric' }).format(
      new Date()
    )
  );
  const years = availableYears || data?.availableYears || [currentYear];
  const options = [...new Set([...years, ...(period !== 'last365' ? [Number(period)] : [])])];
  const listKey = `${period}:${type}`;
  const pageCount = Math.ceil((data?.days.length || 0) / 5);
  const pageIndex = Math.max(
    0,
    Math.min(listPage.key === listKey ? listPage.index : 0, pageCount - 1)
  );
  const listedDays = data ? [...data.days].reverse().slice(pageIndex * 5, pageIndex * 5 + 5) : [];

  useEffect(() => {
    const scroller = viewport.current;
    const button = buttons.current.get(selectedDate);
    if (!scroller || !button) return;
    // Reveal the selected (initially most recent) day inside the chart only.
    // Loading or changing filters must not scroll the whole page or steal focus.
    const reveal = () => {
      const bounds = scroller.getBoundingClientRect();
      const cell = button.getBoundingClientRect();
      if (cell.right > bounds.right - 4) scroller.scrollLeft += cell.right - bounds.right + 4;
      else if (cell.left < bounds.left + 4) scroller.scrollLeft += cell.left - bounds.left - 4;
    };
    reveal();
    window.addEventListener('resize', reveal);
    return () => window.removeEventListener('resize', reveal);
  }, [data, selectedDate]);

  const moveDay = (event, day) => {
    let date;
    const offsets = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 };
    if (event.key in offsets) date = shiftDay(day.date, offsets[event.key]);
    else if (event.key === 'Home') date = data.from;
    else if (event.key === 'End') date = data.to;
    else return;
    event.preventDefault();
    date = date < data.from ? data.from : date > data.to ? data.to : date;
    setActiveDate(date);
    buttons.current.get(date)?.focus();
  };

  return (
    <section className="activity-calendar" aria-labelledby={titleId}>
      <div className="activity-calendar__header">
        <div>
          <h1 id={titleId}>Hoạt động học tập</h1>
          <p className="activity-calendar__summary" role="status" aria-live="polite">
            {loading ? (
              'Đang tải hoạt động…'
            ) : error ? (
              'Chưa tải được hoạt động.'
            ) : (
              <>
                <strong>{data.total}</strong> lượt hoàn thành · <strong>{data.activeDays}</strong>{' '}
                ngày hoạt động
              </>
            )}
          </p>
        </div>
        <div className="activity-calendar__filters">
          <DropdownSelect
            aria-label="Loại hoạt động"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="all">Bài học và lab</option>
            <option value="lesson">Bài học</option>
            <option value="lab">Lab thực hành</option>
          </DropdownSelect>
          <DropdownSelect
            aria-label="Khoảng thời gian hoạt động"
            value={period}
            onChange={(event) => {
              setPeriod(event.target.value);
              setHoverDate(null);
            }}
          >
            <option value="last365">365 ngày qua</option>
            {options.map((year) => (
              <option key={year} value={String(year)}>
                Năm {year}
              </option>
            ))}
          </DropdownSelect>
        </div>
      </div>

      {loading ? (
        <div className="activity-calendar__placeholder" aria-hidden="true" />
      ) : error ? (
        <div className="activity-calendar__error">
          <StatusAlert variant="error" message="Không tải được lịch hoạt động. Vui lòng thử lại." />
          <button className="ui-button" type="button" onClick={retry}>
            Thử lại lịch hoạt động
          </button>
        </div>
      ) : (
        <>
          <p id={helpId} className="sr-only">
            Dùng các phím mũi tên để di chuyển giữa ngày, Home và End để đến đầu và cuối khoảng.
            Hoặc mở Xem theo ngày để chọn ngày trực tiếp.
          </p>
          <div className="activity-calendar__scroll" ref={viewport}>
            <div className="activity-calendar__canvas" style={{ '--activity-weeks': weeks }}>
              <div className="activity-calendar__months" aria-hidden="true">
                {months.map(({ week, month }) => (
                  <span
                    key={`${week}-${month}`}
                    style={{ gridColumn: `${week + 2} / span ${Math.min(3, weeks - week)}` }}
                  >
                    Th{month}
                  </span>
                ))}
              </div>
              <div className="activity-calendar__body">
                <div className="activity-calendar__weekdays" aria-hidden="true">
                  {['T2', '', 'T4', '', 'T6', '', ''].map((label, i) => (
                    <span key={i}>{label}</span>
                  ))}
                </div>
                <div
                  className="activity-calendar__grid"
                  role="group"
                  aria-label="Lịch hoạt động theo ngày"
                  aria-describedby={helpId}
                >
                  {cells.map((day) =>
                    day.outside ? (
                      <span key={day.date} aria-hidden="true" />
                    ) : (
                      <button
                        key={day.date}
                        type="button"
                        className="activity-calendar__day"
                        data-level={intensity(day.count, data.levels)}
                        data-date={day.date}
                        ref={(node) => {
                          if (node) buttons.current.set(day.date, node);
                          else buttons.current.delete(day.date);
                        }}
                        tabIndex={day.date === selectedDate ? 0 : -1}
                        title={describeDay(day)}
                        aria-label={describeDay(day)}
                        onFocus={() => {
                          setActiveDate(day.date);
                          setHoverDate(null);
                        }}
                        onClick={() => setActiveDate(day.date)}
                        onMouseEnter={() => setHoverDate(day.date)}
                        onMouseLeave={() => setHoverDate(null)}
                        onKeyDown={(event) => moveDay(event, day)}
                      />
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="activity-calendar__footer">
            <p className="activity-calendar__day-detail" aria-live="polite">
              {selected ? describeDay(selected) : ''}
            </p>
            <div
              className="activity-calendar__legend"
              aria-label="Mức hoạt động: chưa ghi nhận, 1 đến 2, 3 đến 4, 5 đến 7, từ 8 lượt hoàn thành"
            >
              <span>Ít</span>
              {['unknown', 1, 2, 3, 4].map((level) => (
                <span
                  key={level}
                  className="activity-calendar__swatch"
                  data-level={level}
                  aria-hidden="true"
                />
              ))}
              <span>Nhiều</span>
            </div>
          </div>
          {!data.total && (
            <p className="activity-calendar__empty">
              Chưa có lượt hoàn thành được ghi nhận trong khoảng này.
            </p>
          )}
          <div
            className="activity-calendar__details t-acc"
            data-open={detailsOpen ? 'true' : 'false'}
          >
            <button
              className="activity-calendar__details-trigger t-acc-head"
              type="button"
              aria-expanded={detailsOpen}
              aria-controls={detailsId}
              onClick={() => setDetailsOpen((value) => !value)}
            >
              <span className="t-acc-chevron">
                <ChevronDown size={15} aria-hidden="true" />
              </span>
              Xem theo ngày
            </button>
            <div
              className="t-acc-panel"
              id={detailsId}
              aria-hidden={!detailsOpen}
              inert={!detailsOpen ? '' : undefined}
            >
              <div className="t-acc-panel-inner">
                <div className="activity-calendar__details-content">
                  <ActivityDatePicker
                    value={selectedDate}
                    min={data.from}
                    max={data.to}
                    onChange={(date) => {
                      setActiveDate(date);
                      setHoverDate(null);
                    }}
                  />
                  <p className="activity-calendar__selected-detail">
                    {selected ? describeDay(selected) : ''}
                  </p>
                  {listedDays.length > 0 && (
                    <ul className="activity-calendar__day-list" key={`${listKey}-${pageIndex}`}>
                      {listedDays.map((day) => (
                        <li key={day.date}>
                          <time dateTime={day.date}>{day.date.split('-').reverse().join('/')}</time>
                          <strong>{day.count} lượt</strong>
                          <span>
                            {day.lesson} bài học · {day.lab} lab
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {pageCount > 1 && (
                    <nav
                      className="activity-calendar__pagination"
                      aria-label="Phân trang hoạt động"
                    >
                      <button
                        type="button"
                        aria-label="Trang hoạt động trước"
                        disabled={pageIndex === 0}
                        onClick={() => setListPage({ key: listKey, index: pageIndex - 1 })}
                      >
                        <ChevronLeft size={16} aria-hidden="true" />
                      </button>
                      <span aria-live="polite">
                        Trang {pageIndex + 1} / {pageCount}
                      </span>
                      <button
                        type="button"
                        aria-label="Trang hoạt động sau"
                        disabled={pageIndex + 1 >= pageCount}
                        onClick={() => setListPage({ key: listKey, index: pageIndex + 1 })}
                      >
                        <ChevronRight size={16} aria-hidden="true" />
                      </button>
                    </nav>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
