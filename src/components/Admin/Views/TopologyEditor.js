import React, { useState } from 'react';
import NetworkTopology from '../../Content/NetworkTopology';
import { networkTemplate, networkGradingTemplate } from '../../../data/networkLabTemplates';

export default function TopologyEditor({ value, onChange, onTemplate }) {
  const [selected, setSelected] = useState(''); const [type, setType] = useState('ROUTER');
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  let topology; let validationError = '';
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed.devices)) validationError = 'Topology phải có danh sách devices.';
    else if (parsed.devices.some((device) => !device || typeof device !== 'object' || !device.id || !Array.isArray(device.interfaces))) validationError = 'Mỗi thiết bị phải có id và danh sách interfaces.';
    else if (parsed.links !== undefined && !Array.isArray(parsed.links)) validationError = 'Topology.links phải là một danh sách.';
    else topology = { ...parsed, links: Array.isArray(parsed.links) ? parsed.links : [] };
  } catch { validationError = 'JSON topology chưa hợp lệ.'; }
  const save = (next) => onChange(JSON.stringify(next, null, 2));
  const fresh = () => onTemplate(JSON.stringify(networkTemplate, null, 2), JSON.stringify(networkGradingTemplate, null, 2));
  if (!topology) return <div className="network-editor-error" role="alert"><p>{validationError}</p><button type="button" className="acm-btn" onClick={fresh}>Dùng mẫu mạng 2 Router + 2 PC</button></div>;
  const ports = topology.devices.flatMap((d) => d.interfaces.map((p) => `${d.id}:${typeof p === 'string' ? p : p.name}`));
  const used = new Set((topology.links || []).flatMap((l) => [l.a, l.b].map((e) => `${e.deviceId}:${e.interface}`)));
  const available = ports.filter((p) => !used.has(p));
  const addNode = () => {
    const ids = new Set(topology.devices.map((d) => d.id));
    let index = 1; while (ids.has(`${type}${index}`)) index++;
    const id = `${type}${index}`;
    save({ ...topology, devices: [...topology.devices, { id, hostname: id, deviceType: type, position: { x: 100 + (topology.devices.length % 5) * 180, y: 100 }, interfaces: ['GigabitEthernet0/0', 'GigabitEthernet0/1', 'GigabitEthernet0/2', 'GigabitEthernet0/3'] }] });
  };
  const connect = () => {
    if (!available.includes(from) || !available.includes(to) || from.split(':')[0] === to.split(':')[0]) return;
    const end = (s) => { const [deviceId, name] = s.split(':'); return { deviceId, interface: name }; };
    const ids = new Set((topology.links || []).map((l) => l.id));
    let index = 1; while (ids.has(`L${index}`)) index++;
    save({ ...topology, links: [...(topology.links || []), { id: `L${index}`, a: end(from), b: end(to), enabled: true }] }); setFrom(''); setTo('');
  };
  return <section className="network-editor">
    <p>Kéo thiết bị để bố trí sơ đồ. Chọn hai cổng trống để nối dây. JSON bên dưới cập nhật cùng sơ đồ.</p>
    <div className="network-controls"><select aria-label="Loại thiết bị" value={type} onChange={(e) => setType(e.target.value)}>{['ROUTER', 'SWITCH', 'PC'].map((t) => <option key={t}>{t}</option>)}</select><button type="button" onClick={addNode} disabled={topology.devices.length >= 24}>Thêm thiết bị</button><button type="button" disabled={!selected} onClick={() => { save({ ...topology, devices: topology.devices.filter((d) => d.id !== selected), links: topology.links.filter((l) => l.a.deviceId !== selected && l.b.deviceId !== selected) }); setSelected(''); }}>Xóa thiết bị đã chọn</button></div>
    <NetworkTopology devices={topology.devices} links={topology.links} selected={selected} onSelect={setSelected} onMove={(id, position) => save({ ...topology, devices: topology.devices.map((d) => d.id === id ? { ...d, position } : d) })} />
    <div className="network-controls">{[[from, setFrom, 'Cổng đầu'], [to, setTo, 'Cổng cuối']].map(([val, setter, label]) => <select key={label} aria-label={label} value={val} onChange={(e) => setter(e.target.value)}><option value="">{label}</option>{available.map((p) => <option key={p}>{p}</option>)}</select>)}<button type="button" onClick={connect}>Nối cổng</button></div>
    {(topology.links || []).map((l) => <div key={l.id}>{l.id}: {l.a.deviceId}:{l.a.interface} ↔ {l.b.deviceId}:{l.b.interface} <button type="button" onClick={() => save({ ...topology, links: topology.links.filter((item) => item.id !== l.id) })}>Xóa dây</button></div>)}
  </section>;
}
