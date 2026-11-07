import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import DropdownSelect from '../../../../components/ui/DropdownSelect';
import {
  CHECK_TYPE_MAP,
  SUPPORTED_CHECK_TYPES,
  createDefaultCheck,
  getDevices,
  interfaceName,
  checkField,
  updateOptionalField,
  nextCheckId,
} from '../../utils/adminLabConfig';

const inputValue = (value) => (value === null || value === undefined ? '' : value);

const Field = ({ label, children, hint, className = '' }) => (
  <label className={`cli-editor-field ${className}`}>
    <span>{label}</span>
    {children}
    {hint ? <small>{hint}</small> : null}
  </label>
);

const textInput = (label, value, onChange, options = {}) => (
  <Field label={label} hint={options.hint} className={options.className}>
    <input
      aria-label={label}
      className="acm-input"
      type={options.type || 'text'}
      min={options.min}
      max={options.max}
      step={options.step}
      value={inputValue(value)}
      placeholder={options.placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  </Field>
);

const selectInput = (label, value, options, onChange, disabled = false) => (
  <Field label={label}>
    <DropdownSelect
      aria-label={label}
      className="acm-input cli-editor-native-select"
      value={inputValue(value)}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
    >
      <option value="">-- Chọn --</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </DropdownSelect>
  </Field>
);

const devicesForSelect = (state) =>
  Array.isArray(state?.devices)
    ? getDevices(state)
        .filter((device) => device && typeof device === 'object')
        .map((device, index) => ({
          value: device.id || `DEVICE${index + 1}`,
          label: `${device.id || `DEVICE${index + 1}`} · ${device.hostname || device.deviceType || 'Thiết bị'}`,
        }))
    : [];

const interfacesForDevice = (state, deviceId) => {
  const devices = getDevices(state).filter((device) => device && typeof device === 'object');
  const device =
    devices.find((item) => item.id === deviceId) ||
    (Array.isArray(state?.devices) ? null : devices[0]);
  return (device?.interfaces || []).map((port) => ({
    value: interfaceName(port),
    label: interfaceName(port),
  }));
};

const copyCommonFields = (check, type, index) => {
  const next = createDefaultCheck(type, index);
  [
    'id',
    'title',
    'points',
    'hint',
    'hints',
    'objective',
    'skill',
    'required',
    'message',
    'successMessage',
    'dependsOn',
  ].forEach((field) => {
    if (check[field] !== undefined) next[field] = check[field];
  });
  return next;
};

const CheckFields = ({ check, state, onFieldChange }) => {
  const definition = CHECK_TYPE_MAP[check.type] || CHECK_TYPE_MAP.hostname_equals;
  const deviceOptions = devicesForSelect(state);
  const interfaceOptions = interfacesForDevice(state, check.deviceId);
  const neighborOptions = deviceOptions.filter((option) => option.value !== check.deviceId);
  const hasDevice = definition.fields.includes('deviceId') && Array.isArray(state?.devices);
  const hasInterface = definition.fields.includes('interface');
  return (
    <div className="cli-editor-check-fields">
      {hasDevice
        ? selectInput('Thiết bị nguồn', check.deviceId, deviceOptions, (value) =>
            onFieldChange('deviceId', value)
          )
        : null}
      {hasInterface
        ? selectInput(
            'Interface',
            check.interface,
            interfaceOptions,
            (value) => onFieldChange('interface', value),
            !check.deviceId && deviceOptions.length > 1
          )
        : null}
      {check.type === 'hostname_equals'
        ? textInput(
            'Hostname mong đợi',
            check.expected,
            (value) => onFieldChange('expected', value),
            { placeholder: 'R1' }
          )
        : null}
      {check.type === 'interface_ip_equals' ? (
        <>
          {textInput(
            'IP mong đợi',
            check.expectedIp,
            (value) => onFieldChange('expectedIp', value),
            { placeholder: '192.168.1.1' }
          )}
          {textInput(
            'Subnet mask mong đợi',
            check.expectedMask,
            (value) => onFieldChange('expectedMask', value),
            { placeholder: '255.255.255.0' }
          )}
        </>
      ) : null}
      {check.type === 'interface_description_equals'
        ? textInput(
            'Description mong đợi',
            check.expected,
            (value) => onFieldChange('expected', value),
            { placeholder: 'Uplink to R2' }
          )
        : null}
      {check.type === 'vlan_exists' ||
      check.type === 'vlan_name_equals' ||
      check.type === 'stp_root'
        ? textInput('VLAN ID', check.vlanId, (value) => onFieldChange('vlanId', value), {
            type: 'number',
            min: 1,
            max: 4094,
          })
        : null}
      {check.type === 'vlan_name_equals'
        ? textInput(
            'Tên VLAN mong đợi',
            check.expected,
            (value) => onFieldChange('expected', value),
            { placeholder: 'USERS' }
          )
        : null}
      {check.type === 'switchport_mode_equals'
        ? selectInput(
            'Mode mong đợi',
            check.expected,
            [
              { value: 'access', label: 'Access' },
              { value: 'trunk', label: 'Trunk' },
            ],
            (value) => onFieldChange('expected', value)
          )
        : null}
      {check.type === 'switchport_access_vlan_equals'
        ? textInput(
            'Access VLAN mong đợi',
            check.expected,
            (value) => onFieldChange('expected', value === '' ? '' : Number(value)),
            { type: 'number', min: 1, max: 4094 }
          )
        : null}
      {['reachable', 'route_exists', 'eigrp_metric_exercise'].includes(check.type)
        ? textInput(
            'Destination IPv4',
            check.destination,
            (value) => onFieldChange('destination', value),
            { placeholder: '192.168.2.10' }
          )
        : null}
      {check.type === 'eigrp_metric_exercise' && (
        <>
          {textInput(
            'FD mục tiêu',
            check.expectedMetric,
            (value) => onFieldChange('expectedMetric', Number(value)),
            { type: 'number', min: 1 }
          )}
          {textInput(
            'Delay mục tiêu (µs)',
            check.expectedDelayMicroseconds,
            (value) => onFieldChange('expectedDelayMicroseconds', Number(value)),
            { type: 'number', min: 1 }
          )}
        </>
      )}
      {['route_exists', 'reachable'].includes(check.type) &&
        selectInput(
          'Giao thức yêu cầu (để trống nếu bất kỳ)',
          check.protocol,
          (check.type === 'reachable' ? ['D', 'O'] : ['C', 'S', 'D', 'O']).map((value) => ({
            value,
            label: value,
          })),
          (value) => onFieldChange('protocol', value)
        )}
      {check.type === 'route_exists' &&
        selectInput(
          'Nguồn route',
          check.source || 'available',
          [
            { value: 'available', label: 'Mọi route hiện có' },
            { value: 'learned', label: 'Route học qua EIGRP/OSPF' },
            { value: 'selected', label: 'Route được chọn tại thiết bị nguồn' },
          ],
          (value) => onFieldChange('source', value)
        )}
      {check.type === 'startup_config_saved' && (
        <Field label="Bản lưu phải khớp cấu hình hiện tại">
          <input
            type="checkbox"
            checked={check.matchesRunning === true}
            onChange={(event) => onFieldChange('matchesRunning', event.target.checked)}
          />
        </Field>
      )}
      {['ospf_neighbor_full', 'eigrp_neighbor_up'].includes(check.type)
        ? selectInput('Thiết bị láng giềng', check.neighborId, neighborOptions, (value) =>
            onFieldChange('neighborId', value)
          )
        : null}
      {check.type === 'eigrp_as_configured'
        ? textInput(
            'EIGRP AS number',
            check.asNumber,
            (value) => onFieldChange('asNumber', value),
            {
              type: 'number',
              min: 1,
              max: 65535,
            }
          )
        : null}
      {check.type === 'eigrp_static_neighbor'
        ? textInput(
            'IPv4 của static neighbor',
            check.neighborIp,
            (value) => onFieldChange('neighborIp', value),
            { placeholder: '192.1.12.2' }
          )
        : null}
      {check.type === 'acl_exists'
        ? textInput('Tên ACL', check.name, (value) => onFieldChange('name', value), {
            placeholder: 'EDGE-FILTER',
          })
        : null}
      {check.type === 'nat_static_exists' ? (
        <>
          {textInput(
            'Local IPv4',
            check.expectedIp,
            (value) => onFieldChange('expectedIp', value),
            { placeholder: '192.168.1.10' }
          )}
          {textInput(
            'Global IPv4',
            check.destination,
            (value) => onFieldChange('destination', value),
            { placeholder: '203.0.113.10' }
          )}
        </>
      ) : null}
    </div>
  );
};

export default function GradingSpecBuilder({ value, initialState, onChange, disabled = false }) {
  const spec = value && typeof value === 'object' ? value : { passingScore: 70, checks: [] };
  const checks = Array.isArray(spec.checks) ? spec.checks : [];
  const total = checks.reduce((sum, check) => sum + (Number(check.points) || 0), 0);

  const updateSpec = (next) => onChange({ ...spec, ...next });
  const updateCheckField = (index, field, value) => {
    const check = checks[index] || {};
    const nextCheck = [
      'points',
      'vlanId',
      'asNumber',
      'expectedMetric',
      'expectedDelayMicroseconds',
    ].includes(field)
      ? checkField(check, field, value)
      : updateOptionalField(check, field, value);
    updateSpec({
      checks: checks.map((item, checkIndex) => (checkIndex === index ? nextCheck : item)),
    });
  };
  const addCheck = () => {
    const next = createDefaultCheck('hostname_equals', checks.length);
    next.id = nextCheckId(checks);
    updateSpec({ checks: [...checks, next] });
  };
  const removeCheck = (index) =>
    updateSpec({ checks: checks.filter((_, checkIndex) => checkIndex !== index) });
  const changeType = (index, type) =>
    updateSpec({
      checks: checks.map((check, checkIndex) =>
        checkIndex === index ? copyCommonFields(check, type, index) : check
      ),
    });

  return (
    <section className="cli-editor-section grading-spec-builder" aria-label="Grading Spec builder">
      <div className="cli-editor-section-heading">
        <div>
          <span className="cli-editor-eyebrow">GRADING SPEC</span>
          <h3>Tiêu chí chấm điểm</h3>
          <p>Chọn đúng loại kiểm tra để form chỉ hiện những trường mà engine hỗ trợ.</p>
        </div>
        <label className="cli-editor-inline-field">
          <span>Passing score</span>
          <input
            aria-label="Passing score"
            className="acm-input cli-editor-score-input"
            type="number"
            min="0"
            max="100"
            value={inputValue(spec.passingScore ?? 70)}
            onChange={(event) => updateSpec({ passingScore: Number(event.target.value) })}
            disabled={disabled}
          />
        </label>
        <Field label="Điểm thành thạo (tùy chọn)">
          <input
            aria-label="Điểm thành thạo"
            className="acm-input"
            type="number"
            min={spec.passingScore ?? 70}
            max="100"
            value={inputValue(spec.masteryScore)}
            disabled={disabled}
            onChange={(event) =>
              onChange(
                updateOptionalField(
                  spec,
                  'masteryScore',
                  event.target.value === '' ? undefined : Number(event.target.value)
                )
              )
            }
          />
        </Field>
        <Field label="Phiên bản chính sách">
          <input
            aria-label="Phiên bản chính sách"
            className="acm-input"
            type="number"
            min="1"
            value={inputValue(spec.policyVersion)}
            disabled={disabled}
            onChange={(event) =>
              onChange(
                updateOptionalField(
                  spec,
                  'policyVersion',
                  event.target.value === '' ? undefined : Number(event.target.value)
                )
              )
            }
          />
        </Field>
      </div>

      <div className="cli-editor-check-list">
        {checks.map((check, index) => {
          if (!check || typeof check !== 'object') {
            return (
              <article
                key={`invalid-check-${index}`}
                className="cli-editor-check-card cli-editor-invalid-card"
                role="alert"
              >
                <strong>Tiêu chí {index + 1} không phải object.</strong>
                <p>Chuyển sang JSON nâng cao để sửa nguyên văn dữ liệu này.</p>
              </article>
            );
          }
          const definition = CHECK_TYPE_MAP[check.type] || CHECK_TYPE_MAP.hostname_equals;
          return (
            <article key={`${check.id || 'check'}-${index}`} className="cli-editor-check-card">
              <div className="cli-editor-check-header">
                <span className="cli-editor-check-index">{index + 1}</span>
                <div className="cli-editor-check-type">
                  <label>
                    <span>Loại kiểm tra</span>
                    <DropdownSelect
                      aria-label={`Loại kiểm tra ${index + 1}`}
                      className="acm-input cli-editor-native-select"
                      value={check.type || ''}
                      onChange={(event) => changeType(index, event.target.value)}
                      disabled={disabled}
                    >
                      {SUPPORTED_CHECK_TYPES.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </DropdownSelect>
                  </label>
                  <small>{definition.description}</small>
                </div>
                <button
                  type="button"
                  className="cli-editor-icon-button danger"
                  aria-label={`Xóa tiêu chí ${index + 1}`}
                  title="Xóa tiêu chí"
                  onClick={() => removeCheck(index)}
                  disabled={disabled}
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="cli-editor-check-meta">
                <Field label="Bắt buộc để đạt">
                  <input
                    type="checkbox"
                    checked={check.required === true}
                    onChange={(e) => updateCheckField(index, 'required', e.target.checked)}
                  />
                </Field>
                {textInput('Mục tiêu học', check.objective, (value) =>
                  updateCheckField(index, 'objective', value)
                )}
                {textInput('Kỹ năng', check.skill, (value) =>
                  updateCheckField(index, 'skill', value)
                )}
                {textInput(
                  'Tiêu đề',
                  check.title,
                  (valueText) => updateCheckField(index, 'title', valueText),
                  { placeholder: 'Mô tả yêu cầu', className: 'cli-editor-field-wide' }
                )}
                {textInput(
                  'Điểm',
                  check.points,
                  (valueNumber) => updateCheckField(index, 'points', valueNumber),
                  { type: 'number', min: 0.1, step: 0.1, max: 1000 }
                )}
              </div>

              <CheckFields
                check={check}
                state={initialState}
                onFieldChange={(field, fieldValue) => updateCheckField(index, field, fieldValue)}
              />
              <details className="cli-editor-feedback-details">
                <summary>Điều kiện tiên quyết ({check.dependsOn?.length || 0})</summary>
                <fieldset className="cli-editor-field">
                  <legend>Nhiệm vụ phải hoàn thành trước</legend>
                  {checks
                    .filter((item) => item?.id && item.id !== check.id)
                    .map((dependency) => (
                      <label key={dependency.id}>
                        <input
                          type="checkbox"
                          aria-label={`${check.title || check.id}: cần ${dependency.title || dependency.id}`}
                          disabled={disabled}
                          checked={(check.dependsOn || []).includes(dependency.id)}
                          onChange={(event) =>
                            updateCheckField(
                              index,
                              'dependsOn',
                              event.target.checked
                                ? [...(check.dependsOn || []), dependency.id]
                                : (check.dependsOn || []).filter((id) => id !== dependency.id)
                            )
                          }
                        />
                        {dependency.title || dependency.id}
                      </label>
                    ))}
                </fieldset>
              </details>

              <details className="cli-editor-feedback-details">
                <summary>Gợi ý và phản hồi cho học viên</summary>
                <div className="cli-editor-feedback-grid">
                  {[0, 1, 2].map((level) => (
                    <React.Fragment key={level}>
                      {textInput(
                        `Gợi ý mức ${level + 1}`,
                        check.hints?.[level] || '',
                        (value) => {
                          const hints = Array.from(
                            { length: Math.max(level + 1, check.hints?.length || 0) },
                            (_, i) => check.hints?.[i] || ''
                          );
                          hints[level] = value;
                          while (hints.length && !hints.at(-1).trim()) hints.pop();
                          updateCheckField(index, 'hints', hints.length ? hints : undefined);
                        },
                        { className: `hint-level-${level}` }
                      )}
                    </React.Fragment>
                  ))}
                  {textInput(
                    'Hint',
                    check.hint,
                    (valueText) => updateCheckField(index, 'hint', valueText),
                    { placeholder: 'Gợi ý khi chưa đạt' }
                  )}
                  {textInput(
                    'Message',
                    check.message,
                    (valueText) => updateCheckField(index, 'message', valueText),
                    { placeholder: 'Thông báo khi chưa đạt' }
                  )}
                  {textInput(
                    'Success message',
                    check.successMessage,
                    (valueText) => updateCheckField(index, 'successMessage', valueText),
                    { placeholder: 'Thông báo khi hoàn thành' }
                  )}
                </div>
              </details>

              <div className="cli-editor-check-id">
                <span>ID giữ nguyên khi lưu:</span> <code>{check.id || '(chưa có ID)'}</code>
              </div>
            </article>
          );
        })}
      </div>

      <div className="cli-editor-section-footer">
        <button
          type="button"
          className="acm-secondary-btn"
          onClick={addCheck}
          disabled={disabled || checks.length >= 50}
        >
          <Plus size={15} /> Thêm tiêu chí chấm điểm
        </button>
        <strong>Tổng điểm: {total}</strong>
      </div>
    </section>
  );
}

export { CheckFields, devicesForSelect, interfacesForDevice };
