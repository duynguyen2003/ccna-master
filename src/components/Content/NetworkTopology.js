import React, { useRef } from 'react';

export default function NetworkTopology({ devices, links = [], selected, onSelect, onMove, packet, stp = {} }) {
  const svgRef = useRef(null);
  const drag = useRef(null);
  const list = Array.isArray(devices) ? devices : Object.entries(devices || {}).map(([id, d]) => ({ ...d, id }));
  const byId = Object.fromEntries(list.map((d) => [d.id, d]));
  const position = (id) => byId[id]?.position || { x: 100, y: 100 };
  const frames = (packet?.events || []).filter((e) => e.type === 'FRAME');
  const move = (e) => {
    if (!drag.current || !onMove) return;
    const rect = svgRef.current.getBoundingClientRect();
    onMove(drag.current, { x: Math.max(40, Math.min(960, (e.clientX - rect.left) * 1000 / rect.width)), y: Math.max(40, Math.min(560, (e.clientY - rect.top) * 600 / rect.height)) });
  };
  return <svg ref={svgRef} viewBox="0 0 1000 600" className="network-topology" aria-label="Sơ đồ mạng" onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
    {links.map((l) => {
      const a = position(l.a.deviceId); const b = position(l.b.deviceId);
      const blocked = Object.values(stp).some((v) => [l.a, l.b].some((p) => v.ports?.[`${p.deviceId}:${p.interface}`] === 'BLOCKING'));
      const shutdown = [l.a, l.b].some((p) => byId[p.deviceId]?.interfaces?.[p.interface]?.shutdown);
      return <g key={l.id}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={l.enabled === false || shutdown ? 'link-down' : blocked ? 'link-blocked' : 'link-up'} /><text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 10}>{l.id}{blocked ? ' · STP' : ''}</text><title>{`${l.a.deviceId}:${l.a.interface} ↔ ${l.b.deviceId}:${l.b.interface}`}</title></g>;
    })}
    {frames.map((f, i) => {
      const a = position(f.from.deviceId); const b = position(f.to.deviceId);
      return <circle key={`${i}-${packet.events.length}`} r="7" fill="#facc15" className="network-packet"><animateMotion path={`M ${a.x} ${a.y} L ${b.x} ${b.y}`} dur="0.7s" begin={`${i * 0.7}s`} fill="freeze" /><title>{f.detail}</title></circle>;
    })}
    {list.map((d) => {
      const p = position(d.id);
      return <g key={d.id} role="button" tabIndex={0} aria-label={`Chọn ${d.id}`} transform={`translate(${p.x},${p.y})`} className={`network-node ${selected === d.id ? 'selected' : ''}`} onClick={() => onSelect?.(d.id)} onKeyDown={(e) => { if (['Enter', ' '].includes(e.key)) { e.preventDefault(); onSelect?.(d.id); } }} onPointerDown={(e) => { if (onMove) { drag.current = d.id; e.currentTarget.setPointerCapture(e.pointerId); } }}>
        <rect x="-44" y="-27" width="88" height="54" rx={d.deviceType === 'ROUTER' ? 27 : 8} />
        <text textAnchor="middle" y="5">{d.deviceType}</text><text textAnchor="middle" y="48">{d.hostname || d.id} ({d.id})</text>
      </g>;
    })}
  </svg>;
}
