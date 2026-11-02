import React, { useId, useMemo, useState } from 'react';
import DropdownSelect from '../../../../components/ui/DropdownSelect';
import './LabAccessPolicyEditor.css';

export default function LabAccessPolicyEditor({
  value,
  onChange,
  courseId,
  moduleId,
  modules,
  loading,
  error,
  onRetry,
}) {
  const id = useId();
  const [search, setSearch] = useState('');
  const lessons = useMemo(
    () =>
      modules
        .filter((m) => !moduleId || m.id === moduleId)
        .flatMap((m) => (m.lessons || []).map((l) => ({ ...l, moduleTitle: m.title }))),
    [modules, moduleId]
  );
  const selected = value?.lessonIds || [];
  const missing = selected.filter((lessonId) => !lessons.some((l) => l.id === lessonId));
  return (
    <section className="lab-access-editor" aria-label="Điều kiện mở lab">
      <label id={`${id}-mode`}>Điều kiện mở lab</label>
      <DropdownSelect
        value={value?.mode || 'LEGACY'}
        aria-labelledby={`${id}-mode`}
        onChange={(event) => {
          const mode = event.target.value;
          onChange(
            mode === 'LEGACY'
              ? null
              : { mode, lessonIds: [], requiredForCompletion: mode !== 'OPEN' }
          );
        }}
      >
        {!value && <option value="LEGACY">Theo lộ trình hiện tại</option>}
        <option value="OPEN">Tự luyện</option>
        <option value="LESSONS">Theo bài tiên quyết</option>
        <option value="CAPSTONE">Tổng hợp</option>
      </DropdownSelect>
      {value?.mode === 'OPEN' && <p className="acm-field-hint">Mở sau khi đăng nhập.</p>}
      {value?.mode === 'LESSONS' && (
        <>
          <p className="acm-field-hint">
            Video cần đạt 70% tiến độ đã lưu; bài đọc cần hoàn thành.
          </p>
          {!courseId ? (
            <p>Chọn khóa học để chọn bài tiên quyết.</p>
          ) : loading ? (
            <p role="status">Đang tải bài học…</p>
          ) : error ? (
            <div role="alert">
              {error}{' '}
              <button type="button" onClick={onRetry}>
                Thử lại
              </button>
            </div>
          ) : (
            <>
              <label htmlFor={`${id}-search`}>Tìm bài tiên quyết</label>
              <input
                id={`${id}-search`}
                type="search"
                className="acm-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <fieldset className="lab-access-lessons">
                <legend>{selected.length} bài đã chọn</legend>
                {lessons
                  .filter((l) => l.title.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
                  .map((lesson) => (
                    <label key={lesson.id}>
                      <input
                        type="checkbox"
                        checked={selected.includes(lesson.id)}
                        onChange={(e) =>
                          onChange({
                            ...value,
                            lessonIds: e.target.checked
                              ? [...selected, lesson.id]
                              : selected.filter((n) => n !== lesson.id),
                          })
                        }
                      />
                      <span>
                        {lesson.title}
                        <small>{lesson.moduleTitle}</small>
                      </span>
                    </label>
                  ))}
                {!lessons.length && <p>Chưa có bài học trong phạm vi này.</p>}
              </fieldset>
              {missing.length > 0 && (
                <p role="alert">
                  Có bài đã thay đổi hoặc bị xóa.{' '}
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...value,
                        lessonIds: selected.filter((n) => !missing.includes(n)),
                      })
                    }
                  >
                    Bỏ bài không còn hợp lệ
                  </button>
                </p>
              )}
            </>
          )}
        </>
      )}
      {value?.mode === 'CAPSTONE' && (
        <p className="acm-field-hint">
          Yêu cầu hoàn thành lý thuyết của {moduleId ? 'chương' : 'khóa học'} đã chọn; không yêu cầu
          hoàn thành các lab.
        </p>
      )}
      {value && (
        <label className="lab-access-required">
          <input
            type="checkbox"
            disabled={!courseId}
            checked={value.requiredForCompletion}
            onChange={(e) => onChange({ ...value, requiredForCompletion: e.target.checked })}
          />{' '}
          Tính vào hoàn thành chương/khóa học
        </label>
      )}
    </section>
  );
}
