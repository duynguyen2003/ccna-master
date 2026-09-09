import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Unplug } from 'lucide-react';
import NetworkTopology from '../../Content/NetworkTopology';
import { networkLabTemplates } from '../../../data/networkLabTemplates';
import {
  getDevices,
  interfaceName,
  toInterfaceObject,
  isTopology,
} from './adminLabConfig';

const DEVICE_TYPES = ['ROUTER', 'SWITCH', 'PC'];

const emptyPort = (index = 0, deviceType = 'ROUTER') => ({
  name: `GigabitEthernet0/${index}`,
  shutdown: deviceType === 'ROUTER',
  ipAddress: null,
  subnetMask: null,
  description: '',
  switchportMode: deviceType === 'SWITCH' ? 'access' : null,
  accessVlan: deviceType === 'SWITCH' ? 1 : null,
});

const defaultDevice = (id, deviceType = 'ROUTER', index = 0) => ({
  id,
  hostname: id,
  deviceType,
  position: { x: 140 + (index % 4) * 220, y: 220 + Math.floor(index / 4) * 120 },
  interfaces: [emptyPort(0, deviceType), emptyPort(1, deviceType)],
});

const endpointKey = (endpoint) => `${endpoint?.deviceId || ''}:${endpoint?.interface || ''}`;
const portInUse = (links, deviceId, name) =>
  (links || []).some((link) =>
    [link.a, link.b].some(
      (endpoint) => endpoint.deviceId === deviceId && endpoint.interface === name
    )
  );

const readPort = (device, index) =>
  toInterfaceObject(
    device?.interfaces?.[index] || emptyPort(index, device?.deviceType),
    device?.deviceType
  );

const Field = ({ label, children, hint }) => (
  <label className="cli-editor-field">
    <span>{label}</span>
    {children}
    {hint ? <small>{hint}</small> : null}
  </label>
);

const DeviceForm = ({
  device,
  onChange,
  onRemovePort,
  onAddPort,
  canRemoveDevice,
  onRemoveDevice,
  readOnlyId = false,
}) => {
  const update = (patch) => onChange({ ...device, ...patch });
  const updatePort = (index, patch) => {
    const ports = (device.interfaces || []).map((port, portIndex) =>
      portIndex === index ? { ...readPort(device, index), ...patch } : port
    );
    update({ interfaces: ports });
  };
  const ports = device.interfaces || [];

  return (
    <div className="cli-editor-device-card">
      <div className="cli-editor-device-heading">
        <div>
          <span className="cli-editor-eyebrow">DEVICE STATE</span>
          <h4>{device.id || 'Thiết bị'}</h4>
        </div>
        {onRemoveDevice ? (
          <button
            type="button"
            className="cli-editor-icon-button danger"
            aria-label={`Xóa thiết bị ${device.id}`}
            title={canRemoveDevice ? 'Xóa thiết bị' : 'Thiết bị đang được tham chiếu'}
            onClick={onRemoveDevice}
          >
            <Trash2 size={16} />
          </button>
        ) : null}
      </div>

      <div className="cli-editor-device-meta">
        <Field label="Device ID">
          <input
            aria-label="Device ID"
            className="acm-input"
            value={device.id || ''}
            readOnly={readOnlyId}
            onChange={(event) => update({ id: event.target.value })}
          />
        </Field>
        <Field label="Loại thiết bị">
          <select
            aria-label="Loại thiết bị"
            className="acm-input cli-editor-native-select"
            value={device.deviceType || 'ROUTER'}
            onChange={(event) => update({ deviceType: event.target.value })}
          >
            {DEVICE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Hostname">
          <input
            aria-label="Hostname"
            className="acm-input"
            value={device.hostname || ''}
            onChange={(event) => update({ hostname: event.target.value })}
          />
        </Field>
      </div>

      <div className="cli-editor-ports-heading">
        <div>
          <strong>Cổng và trạng thái ban đầu</strong>
          <small>Để trống IP/mask nếu cổng chưa được gán địa chỉ.</small>
        </div>
        <button
          type="button"
          className="acm-secondary-btn"
          onClick={onAddPort}
          disabled={ports.length >= 24}
        >
          <Plus size={14} /> Thêm cổng
        </button>
      </div>

      <div className="cli-editor-port-list">
        {ports.map((port, index) => {
          const normalized = readPort(device, index);
          return (
            <article className="cli-editor-port-card" key={`${normalized.name}-${index}`}>
              <div className="cli-editor-port-card-header">
                <strong>Cổng {index + 1}</strong>
                <button
                  type="button"
                  className="cli-editor-icon-button danger"
                  aria-label={`Xóa cổng ${index + 1}`}
                  title="Xóa cổng"
                  onClick={() => onRemovePort(index)}
                  disabled={ports.length <= 1}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="cli-editor-port-grid">
                <Field label="Tên interface">
                  <input
                    aria-label={`Tên interface ${index + 1}`}
                    className="acm-input"
                    value={normalized.name}
                    onChange={(event) => updatePort(index, { name: event.target.value })}
                  />
                </Field>
                <Field label="IP address">
                  <input
                    aria-label={`IP address ${index + 1}`}
                    className="acm-input"
                    value={normalized.ipAddress ?? ''}
                    placeholder="192.168.1.1"
                    onChange={(event) =>
                      updatePort(index, { ipAddress: event.target.value || null })
                    }
                  />
                </Field>
                <Field label="Subnet mask">
                  <input
                    aria-label={`Subnet mask ${index + 1}`}
                    className="acm-input"
                    value={normalized.subnetMask ?? ''}
                    placeholder="255.255.255.0"
                    onChange={(event) =>
                      updatePort(index, { subnetMask: event.target.value || null })
                    }
                  />
                </Field>
                <Field label="Admin state">
                  <label className="cli-editor-checkbox-row">
                    <input
                      type="checkbox"
                      checked={!normalized.shutdown}
                      onChange={(event) => updatePort(index, { shutdown: !event.target.checked })}
                    />{' '}
                    <span>
                      {normalized.shutdown ? 'Administratively down' : 'Administratively up'}
                    </span>
                  </label>
                </Field>
                <Field label="Description">
                  <input
                    aria-label={`Description ${index + 1}`}
                    className="acm-input"
                    value={normalized.description ?? ''}
                    placeholder="Mô tả tùy chọn"
                    onChange={(event) => updatePort(index, { description: event.target.value })}
                  />
                </Field>
                {device.deviceType === 'SWITCH' ? (
                  <>
                <Field label="Switchport mode">
                  <select
                    aria-label={`Switchport mode ${index + 1}`}
                    className="acm-input cli-editor-native-select"
                    value={normalized.switchportMode ?? ''}
                    onChange={(event) =>
                      updatePort(index, { switchportMode: event.target.value || null })
                    }
                  >
                    <option value="">-- Không đặt --</option>
                    <option value="access">Access</option>
                    <option value="trunk">Trunk</option>
                  </select>
                </Field>
                <Field label="Access VLAN">
                  <input
                    aria-label={`Access VLAN ${index + 1}`}
                    className="acm-input"
                    type="number"
                    min="1"
                    max="4094"
                    value={normalized.accessVlan ?? ''}
                    placeholder="10"
                    onChange={(event) =>
                      updatePort(index, {
                        accessVlan: event.target.value === '' ? null : Number(event.target.value),
                      })
                    }
                  />
                </Field>
                  </>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};

export default function InitialStateBuilder({
  value,
  onChange,
  gradingSpec,
  onIssue,
  onApplyTemplate,
  disabled = false,
}) {
  const topology = isTopology(value);
  // Keep the malformed raw draft in the parent, but guard the visual builder
  // until the admin switches to the JSON editor to repair it.
  const devices = getDevices(value).filter((device) => device && typeof device === 'object');
  const links = topology && Array.isArray(value.links) ? value.links : [];
  const [selectedId, setSelectedId] = useState(devices[0]?.id || '');
  const [newType, setNewType] = useState('ROUTER');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [localIssue, setLocalIssue] = useState('');
  const selectedDevice = devices.find((device) => device.id === selectedId) || devices[0];
  const allEndpoints = useMemo(
    () =>
      devices.flatMap((device) =>
        (device.interfaces || []).map((port) => ({
          value: `${device.id}::${interfaceName(port)}`,
          label: `${device.id} · ${interfaceName(port)}`,
        }))
      ),
    [devices]
  );
  const availableEndpoints = allEndpoints.filter(
    (endpoint) =>
      !links.some((link) =>
        [link.a, link.b].some((port) => endpoint.value === `${port.deviceId}::${port.interface}`)
      )
  );

  const report = (message) => {
    setLocalIssue(message);
    onIssue?.({ path: 'initialState', message, display: `initialState: ${message}` });
  };
  const updateState = (next) => {
    setLocalIssue('');
    onChange(next);
  };
  const updateSelected = (nextDevice) => {
    if (!selectedDevice) return;
    if (!topology) updateState(nextDevice);
    else
      updateState({
        ...value,
        devices: devices.map((device) => (device.id === selectedDevice.id ? nextDevice : device)),
      });
  };
  const addDevice = () => {
    const ids = new Set(devices.map((device) => device.id));
    let index = 1;
    while (ids.has(`${newType}${index}`)) index += 1;
    const nextDevice = defaultDevice(`${newType}${index}`, newType, devices.length);
    updateState({ devices: [...devices, nextDevice], links });
    setSelectedId(nextDevice.id);
  };
  const removeDevice = () => {
    if (!selectedDevice || !topology) return;
    if (devices.length <= 1) {
      report('Topology cần ít nhất một thiết bị; không thể xóa thiết bị cuối cùng.');
      return;
    }
    const relatedLinks = links.filter(
      (link) => link.a.deviceId === selectedDevice.id || link.b.deviceId === selectedDevice.id
    );
    const relatedChecks = (gradingSpec?.checks || []).filter(
      (check) => check && (check.deviceId === selectedDevice.id || check.neighborId === selectedDevice.id)
    );
    if (relatedLinks.length || relatedChecks.length) {
      report(
        `Không thể xóa ${selectedDevice.id}: còn ${relatedLinks.length} dây và ${relatedChecks.length} tiêu chí đang tham chiếu. Hãy xử lý các tham chiếu trước.`
      );
      return;
    }
    const nextDevices = devices.filter((device) => device.id !== selectedDevice.id);
    updateState({ ...value, devices: nextDevices, links });
    setSelectedId(nextDevices[0]?.id || '');
  };
  const addPort = () => {
    if (!selectedDevice) return;
    const names = new Set((selectedDevice.interfaces || []).map(interfaceName));
    let index = 0;
    while (names.has(`GigabitEthernet0/${index}`)) index += 1;
    updateSelected({
      ...selectedDevice,
      interfaces: [
        ...(selectedDevice.interfaces || []),
        emptyPort(index, selectedDevice.deviceType),
      ],
    });
  };
  const removePort = (index) => {
    if (!selectedDevice || (selectedDevice.interfaces || []).length <= 1) return;
    const port = interfaceName(selectedDevice.interfaces[index]);
    const key = `${selectedDevice.id}:${port}`;
    const link = links.find((candidate) =>
      [candidate.a, candidate.b].some((endpoint) => endpointKey(endpoint) === key)
    );
    const check = (gradingSpec?.checks || []).find(
      (candidate) => candidate.deviceId === selectedDevice.id && candidate.interface === port
    );
    if (link || check) {
      report(
        `Không thể xóa ${key}: ${link ? 'cổng đang nối dây' : 'cổng đang được tiêu chí tham chiếu'}.`
      );
      return;
    }
    updateSelected({
      ...selectedDevice,
      interfaces: selectedDevice.interfaces.filter((_, portIndex) => portIndex !== index),
    });
  };
  const connect = () => {
    const [fromDevice, fromPort] = String(from).split('::');
    const [toDevice, toPort] = String(to).split('::');
    if (
      !fromDevice ||
      !fromPort ||
      !toDevice ||
      !toPort ||
      fromDevice === toDevice ||
      from === to ||
      portInUse(links, fromDevice, fromPort) ||
      portInUse(links, toDevice, toPort)
    ) {
      report('Chọn hai cổng trống trên hai thiết bị khác nhau để nối dây.');
      return;
    }
    const ids = new Set(links.map((link) => link.id));
    let index = 1;
    while (ids.has(`L${index}`)) index += 1;
    updateState({
      ...value,
      devices,
      links: [
        ...links,
        {
          id: `L${index}`,
          a: { deviceId: fromDevice, interface: fromPort },
          b: { deviceId: toDevice, interface: toPort },
          enabled: true,
        },
      ],
    });
    setFrom('');
    setTo('');
  };
  const removeLink = (linkId) =>
    updateState({ ...value, devices, links: links.filter((link) => link.id !== linkId) });
  const moveDevice = (id, position) =>
    updateState({
      ...value,
      devices: devices.map((device) => (device.id === id ? { ...device, position } : device)),
      links,
    });
  const applyTemplate = () => {
    const template = networkLabTemplates.find((item) => item.id === templateId);
    if (!template) {
      report('Chọn một template trước khi áp dụng.');
      return;
    }
    onApplyTemplate?.(template);
  };

  if (!selectedDevice) {
    return (
      <div className="cli-editor-empty-state">
        <p>Initial State chưa có thiết bị.</p>
        <button
          type="button"
          className="acm-secondary-btn"
          onClick={() => updateState(defaultDevice('R1'))}
          disabled={disabled}
        >
          <Plus size={14} /> Thêm thiết bị đầu tiên
        </button>
      </div>
    );
  }

  return (
    <section
      className="cli-editor-section initial-state-builder"
      aria-label="Initial State builder"
    >
      <div className="cli-editor-section-heading">
        <div>
          <span className="cli-editor-eyebrow">INITIAL STATE</span>
          <h3>Trạng thái ban đầu</h3>
                    <p>
            Nhập hostname, cổng, IP/mask và trạng thái bật/tắt theo từng thiết bị. Để trống IP/mask
            cho các cổng chưa cấu hình.
          </p>
        </div>
        <div className="cli-editor-template-actions">
          <select
            aria-label="Template lab mạng"
            className="acm-input cli-editor-native-select"
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
            disabled={disabled}
          >
            <option value="">-- Chọn template có sẵn --</option>
            {networkLabTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="acm-secondary-btn"
            onClick={applyTemplate}
            disabled={disabled || !templateId}
          >
            Áp dụng template
          </button>
        </div>
        {topology ? (
          <div className="cli-editor-add-device">
            <select
              aria-label="Loại thiết bị mới"
              className="acm-input cli-editor-native-select"
              value={newType}
              onChange={(event) => setNewType(event.target.value)}
              disabled={disabled}
            >
              {DEVICE_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
            <button
              type="button"
              className="acm-secondary-btn"
              onClick={addDevice}
              disabled={disabled || devices.length >= 24}
            >
              <Plus size={14} /> Thêm thiết bị
            </button>
          </div>
        ) : null}
      </div>

      {localIssue ? (
        <div className="cli-editor-inline-error" role="alert">
          {localIssue}
        </div>
      ) : null}

      {topology ? (
        <>
          <div className="cli-editor-topology-layout">
            <div className="cli-editor-topology-preview">
              <NetworkTopology
                devices={devices}
                links={links}
                selected={selectedDevice.id}
                onSelect={setSelectedId}
                onMove={disabled ? undefined : moveDevice}
              />
            </div>
            <div className="cli-editor-device-picker">
              <label className="cli-editor-field">
                <span>Thiết bị đang sửa</span>
                <select
                  aria-label="Thiết bị đang sửa"
                  className="acm-input cli-editor-native-select"
                  value={selectedDevice.id}
                  onChange={(event) => setSelectedId(event.target.value)}
                  disabled={disabled}
                >
                  {devices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.id} · {device.hostname || device.deviceType}
                    </option>
                  ))}
                </select>
              </label>
              <p className="cli-editor-field-hint">
                Bấm node trên sơ đồ hoặc chọn trong danh sách để đồng bộ phần cấu hình bên dưới.
              </p>
            </div>
          </div>
          <DeviceForm
            device={selectedDevice}
            onChange={disabled ? () => {} : updateSelected}
            onRemovePort={disabled ? () => {} : removePort}
            onAddPort={disabled ? () => {} : addPort}
            canRemoveDevice={
              devices.length > 1 &&
              !links.some(
                (link) =>
                  link.a.deviceId === selectedDevice.id || link.b.deviceId === selectedDevice.id
              ) &&
              !(gradingSpec?.checks || []).some(
                (check) =>
                  check &&
                  (check.deviceId === selectedDevice.id || check.neighborId === selectedDevice.id)
              )
            }
            onRemoveDevice={disabled ? undefined : removeDevice}
            readOnlyId
          />
          <div className="cli-editor-links">
            <div className="cli-editor-links-heading">
              <div>
                <strong>Liên kết giữa các thiết bị</strong>
                <small>Giữ thao tác “Nối cổng” và “Xóa dây” rõ ràng trên từng dòng.</small>
              </div>
            </div>
            <div className="cli-editor-link-controls">
              <select
                aria-label="Cổng đầu"
                className="acm-input cli-editor-native-select"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                disabled={disabled}
              >
                <option value="">Cổng đầu</option>
                {availableEndpoints.map((endpoint) => (
                  <option key={endpoint.value} value={endpoint.value}>
                    {endpoint.label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Cổng cuối"
                className="acm-input cli-editor-native-select"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                disabled={disabled}
              >
                <option value="">Cổng cuối</option>
                {availableEndpoints.map((endpoint) => (
                  <option key={endpoint.value} value={endpoint.value}>
                    {endpoint.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="acm-secondary-btn"
                onClick={connect}
                disabled={disabled || !from || !to}
              >
                <Plus size={14} /> Nối cổng
              </button>
            </div>
            <div className="cli-editor-link-list">
              {links.length ? (
                links.map((link) => (
                  <div className="cli-editor-link-row" key={link.id}>
                    <span>
                      <code>{link.id}</code> {link.a.deviceId}:{link.a.interface}{' '}
                      <span aria-hidden="true">↔</span> {link.b.deviceId}:{link.b.interface}
                    </span>
                    <button
                      type="button"
                      className="cli-editor-link-delete"
                      onClick={() => removeLink(link.id)}
                      disabled={disabled}
                    >
                      <Unplug size={14} /> Xóa dây
                    </button>
                  </div>
                ))
              ) : (
                <span className="cli-editor-muted">Chưa có dây nối.</span>
              )}
            </div>
          </div>
        </>
      ) : (
        <DeviceForm
          device={selectedDevice}
          onChange={disabled ? () => {} : updateSelected}
          onRemovePort={disabled ? () => {} : removePort}
          onAddPort={disabled ? () => {} : addPort}
          readOnlyId={false}
        />
      )}
    </section>
  );
}

export { DeviceForm, defaultDevice, emptyPort };
