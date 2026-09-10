import React, { useMemo, useState } from 'react';
import NetworkTopology from '../../Content/NetworkTopology';
import { networkTemplate, networkGradingTemplate } from '../../../data/networkLabTemplates';

/* Compatibility editor kept for callers that still use the topology-only tab.
 * Device deletion deliberately refuses to remove linked endpoints. */
export default function TopologyEditor({ value, onChange, onTemplate, onError }) {
  const [selected, setSelected] = useState('');
  const [type, setType] = useState('ROUTER');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const parsed = useMemo(() => {
    try {
      const next = JSON.parse(value);
      if (!Array.isArray(next.devices)) return { error: 'Topology phải có danh sách devices.' };
      if (
        next.devices.some(
          (device) =>
            !device || typeof device !== 'object' || !device.id || !Array.isArray(device.interfaces)
        )
      )
        return { error: 'Mỗi thiết bị phải có id và danh sách interfaces.' };
      if (next.links !== undefined && !Array.isArray(next.links))
        return { error: 'Topology.links phải là một danh sách.' };
      return { topology: { ...next, links: Array.isArray(next.links) ? next.links : [] } };
    } catch (error) {
      return { error: `JSON topology chưa hợp lệ: ${error.message}` };
    }
  }, [value]);
  const topology = parsed.topology;
  const save = (next) => onChange(JSON.stringify(next, null, 2));
  const report = (message) =>
    onError?.({ path: 'initialState', message, display: `initialState: ${message}` });
  const fresh = () =>
    onTemplate?.(
      JSON.stringify(networkTemplate, null, 2),
      JSON.stringify(networkGradingTemplate, null, 2)
    );

  if (!topology) {
    return (
      <div className="network-editor-error" role="alert">
        <p>{parsed.error}</p>
        <button type="button" className="acm-btn" onClick={fresh}>
          Dùng mẫu mạng 2 Router + 2 PC
        </button>
      </div>
    );
  }

  const ports = topology.devices.flatMap((device) =>
    device.interfaces.map((port) => `${device.id}:${typeof port === 'string' ? port : port.name}`)
  );
  const used = new Set(
    topology.links.flatMap((link) =>
      [link.a, link.b].map((endpoint) => `${endpoint.deviceId}:${endpoint.interface}`)
    )
  );
  const available = ports.filter((port) => !used.has(port));
  const addNode = () => {
    const ids = new Set(topology.devices.map((device) => device.id));
    let index = 1;
    while (ids.has(`${type}${index}`)) index += 1;
    const id = `${type}${index}`;
    save({
      ...topology,
      devices: [
        ...topology.devices,
        {
          id,
          hostname: id,
          deviceType: type,
          position: { x: 100 + (topology.devices.length % 5) * 180, y: 100 },
          interfaces: [
            'GigabitEthernet0/0',
            'GigabitEthernet0/1',
            'GigabitEthernet0/2',
            'GigabitEthernet0/3',
          ],
        },
      ],
    });
  };
  const connect = () => {
    const [fromDevice] = from.split(':');
    const [toDevice] = to.split(':');
    if (!available.includes(from) || !available.includes(to) || fromDevice === toDevice) {
      report('Chọn hai cổng trống trên hai thiết bị khác nhau để nối dây.');
      return;
    }
    const endpoint = (valueToParse) => {
      const [deviceId, ...rest] = valueToParse.split(':');
      return { deviceId, interface: rest.join(':') };
    };
    const ids = new Set(topology.links.map((link) => link.id));
    let index = 1;
    while (ids.has(`L${index}`)) index += 1;
    save({
      ...topology,
      links: [
        ...topology.links,
        { id: `L${index}`, a: endpoint(from), b: endpoint(to), enabled: true },
      ],
    });
    setFrom('');
    setTo('');
  };
  const deleteSelected = () => {
    const references = topology.links.filter(
      (link) => link.a.deviceId === selected || link.b.deviceId === selected
    );
    if (references.length) {
      report(
        `Không thể xóa ${selected}: còn ${references.length} dây đang tham chiếu. Hãy xóa dây trước.`
      );
      return;
    }
    save({ ...topology, devices: topology.devices.filter((device) => device.id !== selected) });
    setSelected('');
  };

  return (
    <section className="network-editor">
      <p>
        Kéo thiết bị để bố trí sơ đồ. Chọn hai cổng trống để nối dây; JSON bên dưới luôn được cập
        nhật cùng sơ đồ.
      </p>
      <div className="network-controls">
        <select
          aria-label="Loại thiết bị"
          value={type}
          onChange={(event) => setType(event.target.value)}
        >
          {['ROUTER', 'SWITCH', 'PC'].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <button type="button" onClick={addNode} disabled={topology.devices.length >= 24}>
          Thêm thiết bị
        </button>
        <button type="button" disabled={!selected} onClick={deleteSelected}>
          Xóa thiết bị đã chọn
        </button>
      </div>
      <NetworkTopology
        devices={topology.devices}
        links={topology.links}
        selected={selected}
        onSelect={setSelected}
        onMove={(id, position) =>
          save({
            ...topology,
            devices: topology.devices.map((device) =>
              device.id === id ? { ...device, position } : device
            ),
          })
        }
      />
      <div className="network-controls">
        <select
          aria-label="Cổng đầu"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        >
          <option value="">Cổng đầu</option>
          {available.map((port) => (
            <option key={port}>{port}</option>
          ))}
        </select>
        <select aria-label="Cổng cuối" value={to} onChange={(event) => setTo(event.target.value)}>
          <option value="">Cổng cuối</option>
          {available.map((port) => (
            <option key={port}>{port}</option>
          ))}
        </select>
        <button type="button" onClick={connect}>
          Nối cổng
        </button>
      </div>
      {topology.links.map((link) => (
        <div key={link.id} className="cli-editor-link-row">
          {link.id}: {link.a.deviceId}:{link.a.interface} ↔ {link.b.deviceId}:{link.b.interface}
          <button
            type="button"
            onClick={() =>
              save({ ...topology, links: topology.links.filter((item) => item.id !== link.id) })
            }
          >
            Xóa dây
          </button>
        </div>
      ))}
    </section>
  );
}
