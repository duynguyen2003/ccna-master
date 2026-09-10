import React, { useEffect, useMemo, useState } from 'react';
import { Code2, Eye, Moon, Sun } from 'lucide-react';
import GradingSpecBuilder from './GradingSpecBuilder';
import InitialStateBuilder from './InitialStateBuilder';
import {
  PROFILE_OPTIONS,
  getDevices,
  parseJsonText,
  stringifyJson,
  validateCliLabConfig,
  validateInitialState,
  validateGradingSpec,
  isTopology,
} from './adminLabConfig';
import '../../../css/Admin/CliLabEditor.css';

const errorText = (error) =>
  error?.display || error?.message || String(error || 'Dữ liệu chưa hợp lệ.');

const JsonError = ({ error }) =>
  error ? (
    <div className="cli-editor-json-error" role="alert">
      {errorText(error)}
    </div>
  ) : null;

const isRenderablePort = (port) =>
  typeof port === 'string' ||
  (port && typeof port === 'object' && typeof port.name === 'string');

const isRenderableDevice = (device) =>
  device &&
  typeof device === 'object' &&
  Array.isArray(device.interfaces) &&
  device.interfaces.length > 0 &&
  device.interfaces.every(isRenderablePort);

const isRenderableEndpoint = (endpoint) =>
  endpoint &&
  typeof endpoint === 'object' &&
  typeof endpoint.deviceId === 'string' &&
  typeof endpoint.interface === 'string';

const isRenderableInitialState = (state) => {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return false;
  if (Object.prototype.hasOwnProperty.call(state, 'devices')) {
    return (
      Array.isArray(state.devices) &&
      state.devices.length > 0 &&
      Array.isArray(state.links) &&
      state.devices.every(
        (device) => typeof device?.id === 'string' && isRenderableDevice(device)
      ) &&
      state.links.every(
        (link) =>
          link &&
          typeof link === 'object' &&
          isRenderableEndpoint(link.a) &&
          isRenderableEndpoint(link.b)
      )
    );
  }
  return Array.isArray(state.interfaces) && state.interfaces.length > 0 && state.interfaces.every(isRenderablePort);
};

const isRenderableGradingSpec = (spec) =>
  spec &&
  typeof spec === 'object' &&
  !Array.isArray(spec) &&
  Array.isArray(spec.checks) &&
  spec.checks.every((check) => check && typeof check === 'object' && !Array.isArray(check));

const JsonEditor = ({ label, value, onChange, parseResult, disabled }) => (
  <div className="cli-editor-json-panel">
    <label className="cli-editor-field">
      <span>{label}</span>
      <textarea
        aria-label={label}
        className="acm-textarea cli-editor-code-area"
        rows="22"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        spellCheck="false"
      />
    </label>
    <JsonError error={parseResult?.error} />
  </div>
);

export default function CliLabConfigEditor({
  initialStateText,
  gradingSpecText,
  commandProfile,
  onChange,
  onValidityChange,
  onPreview,
  disabled = false,
}) {
  const [advancedInitial, setAdvancedInitial] = useState(false);
  const [advancedGrading, setAdvancedGrading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [localIssue, setLocalIssue] = useState('');

  const initialResult = useMemo(
    () => parseJsonText(initialStateText || '', 'Initial State'),
    [initialStateText]
  );
  const gradingResult = useMemo(
    () => parseJsonText(gradingSpecText || '', 'Grading Spec'),
    [gradingSpecText]
  );
  const validation = useMemo(
    () => validateCliLabConfig({ initialStateText, gradingSpecText, commandProfile }),
    [initialStateText, gradingSpecText, commandProfile]
  );
  const initialSchemaInvalid =
    !initialResult.ok || !isRenderableInitialState(initialResult.value);
  const gradingSchemaInvalid = !gradingResult.ok || !isRenderableGradingSpec(gradingResult.value);
  const showAdvancedInitial = advancedInitial || initialSchemaInvalid;
  const showAdvancedGrading = advancedGrading || gradingSchemaInvalid || initialSchemaInvalid;

  useEffect(() => {
    if (initialSchemaInvalid) setAdvancedInitial(true);
  }, [initialSchemaInvalid]);

  useEffect(() => {
    if (gradingSchemaInvalid) setAdvancedGrading(true);
  }, [gradingSchemaInvalid]);

  useEffect(() => {
    onValidityChange?.(validation);
  }, [onValidityChange, validation]);

  const update = (patch) => {
    setLocalIssue('');
    onChange?.(patch);
  };

  const disableAdvanced = (kind) => {
    const result = kind === 'initial' ? initialResult : gradingResult;
    if (!result.ok) {
      setLocalIssue(`Không thể rời chế độ JSON nâng cao: ${errorText(result.error)}`);
      return;
    }
    const schemaErrors =
      kind === 'initial'
        ? validateInitialState(result.value)
        : validateGradingSpec(result.value, initialResult.value);
    if (schemaErrors.length) {
      setLocalIssue(`Không thể rời chế độ JSON nâng cao: ${schemaErrors.map(errorText).join(' ')}`);
      return;
    }
    if (kind === 'initial') setAdvancedInitial(false);
    else setAdvancedGrading(false);
  };

  const handlePreview = () => {
    if (!validation.valid) {
      setLocalIssue(validation.errors.map(errorText).join(' '));
      return;
    }
    onPreview?.({ initialState: initialResult.value, gradingSpec: gradingResult.value });
  };

  const profile = PROFILE_OPTIONS.find((item) => item.value === commandProfile);
  const topology = isTopology(initialResult.value);
  const devices = getDevices(initialResult.value);

  return (
    <div className={`cli-lab-editor ${darkMode ? 'is-dark' : ''}`}>
      <div className="cli-editor-toolbar">
        <div className="cli-editor-profile">
          <label className="cli-editor-field">
            <span>Command profile</span>
            <select
              aria-label="Command profile"
              className="acm-input cli-editor-native-select"
              value={commandProfile || ''}
              onChange={(event) => update({ commandProfile: event.target.value })}
              disabled={disabled}
            >
              <option value="">-- Chọn profile --</option>
              {PROFILE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <p className="cli-editor-profile-description">
            {profile?.description || 'Chọn profile được backend hỗ trợ.'}
          </p>
          {profile ? (
            <span
              className={`cli-editor-compatibility ${profile.shape === (topology ? 'topology' : 'device') ? 'compatible' : 'warning'}`}
            >
              <Code2 size={13} /> Hình dạng:{' '}
              {profile.shape === 'topology' ? 'nhiều thiết bị' : 'một thiết bị'}
            </span>
          ) : null}
        </div>
        <div className="cli-editor-toolbar-actions">
          <button
            type="button"
            className="cli-editor-theme-toggle"
            aria-pressed={darkMode}
            onClick={() => setDarkMode((value) => !value)}
          >
            <span>{darkMode ? <Sun size={14} /> : <Moon size={14} />}</span>
            {darkMode ? 'Giao diện sáng' : 'Giao diện tối'}
          </button>
          <button
            type="button"
            className="acm-secondary-btn"
            onClick={handlePreview}
            disabled={disabled || !validation.valid}
          >
            <Eye size={15} /> Xem trước như học viên
          </button>
        </div>
      </div>

      {localIssue ? (
        <div className="cli-editor-inline-error" role="alert">
          {localIssue}
        </div>
      ) : null}
      {!validation.valid && !localIssue ? (
        <div className="cli-editor-validation-summary" role="alert">
          <strong>Chưa thể lưu cấu hình</strong>
          <ul>
            {validation.errors.slice(0, 8).map((error, index) => (
              <li key={`${error.path}-${index}`}>{errorText(error)}</li>
            ))}
          </ul>
          {validation.errors.length > 8 ? (
            <small>Còn {validation.errors.length - 8} lỗi khác.</small>
          ) : null}
        </div>
      ) : null}

      <div className="cli-editor-mode-row">
        <div>
          <strong>Trình dựng biểu mẫu</strong>
          <span>Chế độ mặc định, phù hợp khi không cần sửa JSON.</span>
        </div>
        <span className="cli-editor-mode-badge">
          {showAdvancedInitial || showAdvancedGrading ? 'Có JSON nâng cao' : 'Đang dùng form'}
        </span>
      </div>

      {showAdvancedInitial ? (
        <section className="cli-editor-section cli-editor-advanced-section">
          <div className="cli-editor-section-heading">
            <div>
              <span className="cli-editor-eyebrow">ADVANCED JSON</span>
              <h3>Initial State JSON</h3>
              <p>Sửa nhanh cho người đã quen schema. Văn bản sai được giữ nguyên để sửa tiếp.</p>
            </div>
            <button
              type="button"
              className="acm-secondary-btn"
              onClick={() => disableAdvanced('initial')}
            >
              Quay lại form
            </button>
          </div>
          <JsonEditor
            label="Initial State JSON"
            value={initialStateText || ''}
            onChange={(value) => update({ initialStateText: value })}
            parseResult={initialResult}
            disabled={disabled}
          />
        </section>
      ) : (
        <>
          <InitialStateBuilder
            value={initialResult.value}
            gradingSpec={gradingResult.value}
            onChange={(value) => update({ initialStateText: stringifyJson(value) })}
            onApplyTemplate={(template) =>
              update({
                initialStateText: stringifyJson(template.initialState),
                gradingSpecText: stringifyJson(template.gradingSpec),
                commandProfile: template.commandProfile,
              })
            }
            onIssue={(issue) => setLocalIssue(issue.display || issue.message)}
            disabled={disabled || !initialResult.ok}
          />
          <div className="cli-editor-advanced-toggle">
            <label>
              <input
                type="checkbox"
                checked={showAdvancedInitial}
                onChange={(event) =>
                  event.target.checked ? setAdvancedInitial(true) : disableAdvanced('initial')
                }
                disabled={disabled}
              />{' '}
              <span>Chỉnh sửa Initial State JSON nâng cao</span>
            </label>
            <small>
              Validate cú pháp tức thì, có dòng/cột khi trình phân tích cung cấp vị trí.
            </small>
          </div>
        </>
      )}

      {showAdvancedGrading ? (
        <section className="cli-editor-section cli-editor-advanced-section">
          <div className="cli-editor-section-heading">
            <div>
              <span className="cli-editor-eyebrow">ADVANCED JSON</span>
              <h3>Grading Spec JSON</h3>
              <p>
                Giữ nguyên id, điểm, message, successMessage, hint và mọi field được backend hỗ trợ.
              </p>
            </div>
            <button
              type="button"
              className="acm-secondary-btn"
              onClick={() => disableAdvanced('grading')}
            >
              Quay lại form
            </button>
          </div>
          <JsonEditor
            label="Grading Spec JSON"
            value={gradingSpecText || ''}
            onChange={(value) => update({ gradingSpecText: value })}
            parseResult={gradingResult}
            disabled={disabled}
          />
        </section>
      ) : (
        <>
          <GradingSpecBuilder
            value={gradingResult.value}
            initialState={initialResult.value}
            onChange={(value) => update({ gradingSpecText: stringifyJson(value) })}
            disabled={disabled || !gradingResult.ok}
          />
          <div className="cli-editor-advanced-toggle">
            <label>
              <input
                type="checkbox"
                checked={showAdvancedGrading}
                onChange={(event) =>
                  event.target.checked ? setAdvancedGrading(true) : disableAdvanced('grading')
                }
                disabled={disabled}
              />{' '}
              <span>Chỉnh sửa Grading Spec JSON nâng cao</span>
            </label>
            <small>
              Validate cú pháp và schema path ngay khi nhập; không thể lưu hoặc xem trước khi còn
              lỗi.
            </small>
          </div>
        </>
      )}

      <div className="cli-editor-integrity-note">
        <Code2 size={15} />
        <span>
          {devices.length || 0} thiết bị ·{' '}
          {Array.isArray(gradingResult.value?.checks) ? gradingResult.value.checks.length : 0} tiêu
          chí · {validation.valid ? 'Cấu hình hợp lệ' : 'Cần xử lý lỗi trước khi lưu'}
        </span>
      </div>
    </div>
  );
}

export { JsonEditor, JsonError };
