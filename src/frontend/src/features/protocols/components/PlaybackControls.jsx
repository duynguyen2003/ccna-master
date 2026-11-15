import React from 'react';
import DropdownSelect from '../../../components/ui/DropdownSelect';
import { ArrowLeft, ArrowRight, Pause, Play, RotateCcw } from 'lucide-react';

export default function PlaybackControls({ playback, detailed = false }) {
  const { index, status, speed, model, play, pause, step, reset, setSpeed, select } = playback;
  const count = model.events.length;
  return (
    <div
      className={`packet-observer__controls ${detailed ? 'protocol-playback' : ''}`}
      role="group"
      aria-label="Điều khiển hành trình"
    >
      <button
        type="button"
        className={detailed ? 'protocol-playback__primary' : undefined}
        disabled={!count}
        onClick={status === 'playing' ? pause : play}
      >
        {detailed &&
          (status === 'playing' ? (
            <Pause size={16} aria-hidden="true" />
          ) : (
            <Play size={16} aria-hidden="true" />
          ))}
        {status === 'playing'
          ? 'Tạm dừng'
          : status === 'complete'
            ? 'Phát lại'
            : detailed && status === 'paused'
              ? 'Tiếp tục'
              : 'Phát'}
      </button>
      <button
        type="button"
        disabled={!count || index === 0}
        onClick={() => step(-1)}
        aria-label="Sự kiện trước"
      >
        {detailed ? <ArrowLeft size={17} aria-hidden="true" /> : '←'}
      </button>
      <button
        type="button"
        disabled={!count || index >= count - 1}
        onClick={() => step(1)}
        aria-label="Sự kiện tiếp theo"
      >
        {detailed ? <ArrowRight size={17} aria-hidden="true" /> : '→'}
      </button>
      <button type="button" disabled={!count} onClick={reset}>
        {detailed && <RotateCcw size={15} aria-hidden="true" />}
        Về đầu
      </button>
      <DropdownSelect
        aria-label="Tốc độ phát"
        style={{ '--app-select-menu-min-width': '112px' }}
        value={speed}
        onChange={(event) => setSpeed(event.target.value)}
      >
        {[0.5, 1, 1.5, 2].map((value) => (
          <option key={value} value={value}>
            {value}×
          </option>
        ))}
      </DropdownSelect>
      {model.firstFailure >= 0 && (
        <button
          type="button"
          onClick={() => select(model.firstFailure)}
          className="packet-observer__failure"
        >
          Tới lỗi
        </button>
      )}
      <span className="packet-observer__count" aria-label="Vị trí sự kiện">
        {detailed && 'Sự kiện '}
        {count ? index + 1 : 0}/{count}
      </span>
    </div>
  );
}
