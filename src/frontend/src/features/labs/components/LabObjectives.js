import React, { useEffect, useRef } from 'react';
import { Check, ChevronRight, Circle, LockKeyhole } from 'lucide-react';
import LabDisclosure from './LabDisclosure';
import { taskStatus } from '../utils/labWorkspaceHelpers';

const groupOf = (task) => {
  const key = `${task.objective || ''} ${task.type || ''}`;
  if (/metric/.test(key)) return ['metric', 'Tính và điều chỉnh metric'];
  if (/passive|observ/.test(key)) return ['observe', 'Quan sát hoạt động giao thức'];
  if (/save|startup|persistence/.test(key)) return ['save', 'Lưu cấu hình'];
  if (/neighbor_up|neighbor_full|adjacency|routing|route_exists|reachable|reachability/.test(key))
    return ['verify', 'Kiểm tra kết nối và định tuyến'];
  return ['configure', 'Cấu hình thiết bị'];
};
function Objective({ group, progress, selectedTaskId, onSelect, graded, defaultOpen }) {
  const complete = group.tasks.every((t) => taskStatus(t, progress) === 'completed');
  const completed = group.tasks.filter((t) => taskStatus(t, progress) === 'completed').length;
  const disclosure = useRef(null);
  useEffect(() => {
    if (complete && disclosure.current) {
      if (disclosure.current.contains(document.activeElement))
        disclosure.current.querySelector('summary')?.focus();
    }
  }, [complete]);
  return (
    <LabDisclosure
      className={`cli-objective-group${complete ? ' is-complete' : ''}`}
      aria-label={group.title}
      ref={disclosure}
      collapse={complete}
      defaultOpen={defaultOpen}
      summary={
        <>
          <ChevronRight className="cli-objective-chevron" size={14} aria-hidden="true" />
          <h4>{group.title}</h4>
          <small aria-label={`${completed} trên ${group.tasks.length} nhiệm vụ hoàn thành`}>
            {complete ? (
              <Check size={13} aria-hidden="true" />
            ) : (
              <Circle size={12} aria-hidden="true" />
            )}
            {completed}/{group.tasks.length}
          </small>
          <span className="cli-objective-progress" aria-hidden="true">
            <span style={{ width: `${(completed / group.tasks.length) * 100}%` }} />
          </span>
        </>
      }
    >
      <div className="cli-objective-tasks">
        {group.tasks.map((task) => {
          const status = taskStatus(task, progress);
          const check = progress.checks?.find((c) => c.id === task.id);
          return (
            <div key={task.id}>
              <button
                type="button"
                data-task-id={task.id}
                className={`cli-lab-task-card status-${status}`}
                aria-label={`Chọn nhiệm vụ ${task.title}`}
                aria-current={task.id === selectedTaskId ? 'step' : undefined}
                onClick={() => onSelect(task)}
              >
                {status === 'completed' ? (
                  <Check size={16} aria-label="Đã hoàn thành" />
                ) : status === 'blocked' ? (
                  <LockKeyhole size={16} aria-label="Chờ nhiệm vụ trước" />
                ) : (
                  <Circle size={16} aria-label="Chưa hoàn thành" />
                )}
                <span className="cli-task-copy">
                  <span className="cli-task-title">{task.title}</span>
                  {graded && (
                    <small>
                      {task.points} điểm{task.required ? ' · Bắt buộc' : ''}
                    </small>
                  )}
                </span>
                {task.deviceId && (
                  <span className="cli-task-device" aria-label={`Thiết bị ${task.deviceId}`}>
                    {task.deviceId}
                  </span>
                )}
              </button>
              {status === 'blocked' && (
                <p className="cli-objective-blocked">
                  Cần hoàn thành trước:{' '}
                  {(check?.blockedBy || [])
                    .map((id) => progress.tasks?.find((t) => t.id === id)?.title || id)
                    .join('; ')}
                  .
                </p>
              )}
            </div>
          );
        })}
      </div>
    </LabDisclosure>
  );
}
export default function LabObjectives({ tasks, progress, selectedTaskId, onSelect, graded }) {
  const groups = new Map();
  tasks.forEach((task) => {
    const [id, title] = groupOf(task);
    if (!groups.has(id)) groups.set(id, { id, title, tasks: [] });
    groups.get(id).tasks.push(task);
  });
  const firstIncomplete = [...groups.values()].find((group) =>
    group.tasks.some((task) => taskStatus(task, progress) !== 'completed')
  )?.id;
  return (
    <div className="cli-lab-checklist" aria-label="Danh sách mục tiêu">
      {[...groups.values()].map((group) => (
        <Objective
          key={group.id}
          group={group}
          progress={{ ...progress, tasks }}
          selectedTaskId={selectedTaskId}
          onSelect={onSelect}
          graded={graded}
          defaultOpen={group.id === firstIncomplete}
        />
      ))}
    </div>
  );
}
