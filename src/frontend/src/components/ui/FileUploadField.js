import React, { useId, useRef, useState } from 'react';
import { FileText, Image as ImageIcon, Upload, X } from 'lucide-react';
import './styles/FileUpload.css';

const formatSize = (size) => {
  if (!Number.isFinite(size)) return '';
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const acceptsFile = (file, accept) => {
  if (!accept) return true;
  return accept.split(',').some((entry) => {
    const rule = entry.trim().toLowerCase();
    if (!rule) return false;
    if (rule.startsWith('.')) return file.name.toLowerCase().endsWith(rule);
    if (rule.endsWith('/*')) return file.type.startsWith(rule.slice(0, -1));
    return file.type.toLowerCase() === rule;
  });
};

export default function FileUploadField({
  accept,
  busy = false,
  description,
  disabled = false,
  label = 'Chọn tệp',
  onClear,
  onFileSelect,
  preview,
  value,
  className = '',
}) {
  const inputId = useId();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [localFile, setLocalFile] = useState(null);
  const file = typeof File !== 'undefined' && value instanceof File ? value : null;
  const selectedFile = value === undefined ? localFile : file;

  const selectFile = (nextFile) => {
    if (!nextFile) return;
    if (!acceptsFile(nextFile, accept)) {
      setError(`Định dạng tệp không được hỗ trợ${accept ? ` (${accept})` : ''}.`);
      return;
    }
    setError('');
    setLocalFile(nextFile);
    onFileSelect?.(nextFile);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    selectFile(event.dataTransfer.files?.[0]);
  };

  return (
    <div className={`file-upload ${className}`.trim()}>
      <input
        ref={inputRef}
        id={inputId}
        className="file-upload__input"
        type="file"
        tabIndex={-1}
        aria-hidden="true"
        accept={accept}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => {
          selectFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <button
        type="button"
        className={`file-upload__dropzone${dragging ? ' is-dragging' : ''}`}
        disabled={disabled}
        aria-describedby={`${inputId}-description`}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) event.dataTransfer.dropEffect = 'copy';
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false);
        }}
        onDrop={handleDrop}
      >
        <span className="file-upload__icon" aria-hidden="true">
          <Upload size={20} />
        </span>
        <span className="file-upload__title">{dragging ? 'Thả tệp vào đây' : label}</span>
        <span id={`${inputId}-description`} className="file-upload__description">
          {description || 'Kéo thả tệp vào đây hoặc nhấn để chọn'}
        </span>
      </button>

      {error ? (
        <p className="file-upload__error" role="alert">
          {error}
        </p>
      ) : null}

      {selectedFile || preview ? (
        <div className="file-upload__item" aria-live="polite">
          {preview ? (
            <img
              className="file-upload__preview"
              src={preview}
              alt="Xem trước tệp đã chọn"
              width={640}
              height={360}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span className="file-upload__file-icon" aria-hidden="true">
              {selectedFile?.type.startsWith('image/') ? (
                <ImageIcon size={18} />
              ) : (
                <FileText size={18} />
              )}
            </span>
          )}
          <span className="file-upload__file-info">
            <span className="file-upload__file-name" title={selectedFile?.name || label}>
              {selectedFile?.name || label}
            </span>
            <span className="file-upload__file-meta">
              {busy
                ? 'Đang tải lên...'
                : selectedFile
                  ? formatSize(selectedFile.size)
                  : 'Tệp hiện tại'}
            </span>
            {busy ? <span className="file-upload__progress" aria-hidden="true" /> : null}
          </span>
          {selectedFile && !disabled && !busy ? (
            <button
              type="button"
              className="file-upload__remove"
              aria-label={`Xóa ${selectedFile.name}`}
              onClick={() => {
                setError('');
                setLocalFile(null);
                onClear?.();
              }}
            >
              <X size={16} />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
