import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Laptop, Radio, Send, History, Share2 } from 'lucide-react';
import { api } from '../../services/Api';
import { useAuth } from '../../context/AuthContext';
import CliTerminal from './CliTerminal';
import NetworkTopology from './NetworkTopology';

export default function CliLabWorkspace({ lab, onClose, onPassed, onNotify }) {
  const { token } = useAuth();
  const [attempt, setAttempt] = useState(null); const latest = useRef(null);
  const [deviceId, setDeviceId] = useState(''); const selected = useRef('');
  const [busy, setBusy] = useState(false); const busyRef = useRef(false);
  const [error, setError] = useState(''); const [replay, setReplay] = useState(null);
  const [sequence, setSequence] = useState(0); const [joinId, setJoinId] = useState('');
  const [memberId, setMemberId] = useState(''); const [explanation, setExplanation] = useState('');
  const [achievements, setAchievements] = useState(null);
  const [destination, setDestination] = useState(''); const [protocol, setProtocol] = useState('icmp'); const [port, setPort] = useState(80);
  const mounted = useRef(true);
  const dialog = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.focus();
    return () => previous?.focus?.();
  }, []);

  const accept = useCallback((a) => {
    if (!mounted.current) return;
    latest.current = a; setAttempt(a);
    if (a.state.devices && !a.state.devices[selected.current]) {
      selected.current = Object.keys(a.state.devices)[0]; setDeviceId(selected.current);
    }
  }, []);

  const refresh = useCallback(async () => {
    const a = latest.current; if (!a) return;
    const last = a.commands?.at(-1)?.sequence || 0;
    const next = await api.getCliLabAttempt(token, a.id, selected.current || undefined, last);
    if (latest.current?.id !== a.id) return;
    const commands = new Map((latest.current.commands || []).map((e) => [e.sequence, e]));
    next.commands.forEach((e) => commands.set(e.sequence, e));
    if (next.state.revision < latest.current.state.revision) return;
    accept({ ...next, commands: [...commands.values()].sort((a, b) => a.sequence - b.sequence) });
  }, [accept, token]);

  useEffect(() => {
    mounted.current = true; let active = true;
    api.startCliLabAttempt(token, lab.id).then((a) => { if (active) accept(a); }).catch((e) => { if (active) setError(e.message); });
    api.cliAchievements(token).then((a) => { if (active) setAchievements(a); }).catch(() => {});
    const previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { active = false; mounted.current = false; document.body.style.overflow = previousOverflow; };
  }, [accept, lab.id, token]);

  useEffect(() => {
    let running = false;
    const timer = setInterval(async () => {
      if (running || busyRef.current || document.hidden || !latest.current) return;
      running = true;
      try { await refresh(); } catch (e) { setError(e.message); } finally { running = false; }
    }, 3000);
    return () => clearInterval(timer);
  }, [refresh]);

  const perform = async (fn) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(e.message); onNotify(e.message, 'error'); } finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  };

  const action = async (value) => {
    if (replay || latest.current?.status !== 'IN_PROGRESS') return;
    await perform(async () => {
      const a = latest.current;
      try {
        const result = await api.cliAction(token, a.id, value, a.state.revision);
        accept({ ...a, state: result.state, prompt: result.prompt, commands: result.event.sequence ? [...a.commands, result.event] : a.commands });
      } catch (e) { await refresh(); throw e; }
    });
  };

  const selectDevice = (id) => { selected.current = id; setDeviceId(id); };

  const join = () => perform(async () => {
    const a = await api.getCliLabAttempt(token, joinId.trim());
    selected.current = ''; setReplay(null); setExplanation(''); accept(a);
  });

  const submit = () => perform(async () => {
    const a = latest.current;
    const result = await api.submitCliLabAttempt(token, a.id);
    accept({ ...result.attempt, commands: a.commands }); setExplanation('');
    if (result.result.passed) { onPassed(String(a.labId)); onNotify('Cấu hình đã đạt yêu cầu.', 'success'); setAchievements(await api.cliAchievements(token)); }
  });

  const restart = () => perform(async () => {
    const a = latest.current;
    const next = await api.restartCliLabAttempt(token, a.id, a.labId);
    setReplay(null); setSequence(0); setExplanation(''); accept(next);
    onNotify('Đã mở phiên mới; lịch sử phiên cũ vẫn được giữ lại.', 'success');
  });

  const displayed = replay?.state || attempt?.state;
  const active = displayed?.devices?.[deviceId] || displayed;
  const devicePrompt = active ? active.hostname + ({ USER_EXEC: '>', PRIVILEGED_EXEC: '#', GLOBAL_CONFIG: '(config)#', INTERFACE_CONFIG: '(config-if)#', VLAN_CONFIG: '(config-vlan)#', ROUTER_CONFIG: '(config-router)#', ACL_CONFIG: '(config-ext-nacl)#' }[active.mode] || '>') : '>';
  const history = (attempt?.commands || []).filter((e) => (!displayed?.devices || e.action?.deviceId === deviceId || (!e.action?.deviceId && deviceId === Object.keys(displayed.devices)[0])) && (!replay || e.sequence <= replay.sequence));
  const editable = attempt?.status === 'IN_PROGRESS' && !replay && !busy;

  return (
    <div ref={dialog} tabIndex={-1} className="cli-workspace-overlay" role="dialog" aria-modal="true" aria-label="Phòng thực hành mạng" onKeyDown={(e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab' && !e.target.closest('.cli-xterm-host')) {
        const items = [...dialog.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')];
        if (e.shiftKey && (document.activeElement === items[0] || document.activeElement === dialog.current)) { e.preventDefault(); items.at(-1)?.focus(); }
        else if (!e.shiftKey && document.activeElement === items.at(-1)) { e.preventDefault(); items[0]?.focus(); }
      }
    }}>
      {/* Thông báo responsive trên điện thoại */}
      <div className="cli-mobile-fallback">
        <div className="cli-mobile-fallback-card">
          <div className="cli-mobile-fallback-icon">
            <Laptop size={36} />
          </div>
          <h3>Chức năng này cần dùng trên Laptop</h3>
          <p>
            Môi trường thực hành mô phỏng mạng Cisco (Topology tương tác, Terminal CLI, Packet trace) yêu cầu màn hình rộng và bàn phím máy tính để thao tác tốt nhất.
          </p>
          <button className="cli-mobile-fallback-btn" onClick={onClose}>
            Quay lại danh sách bài học
          </button>
        </div>
      </div>

      <div className="cli-workspace network-workspace">
        <header className="cli-workspace-header">
          <div>
            <span className="cli-workspace-kicker">PHÒNG THỰC HÀNH MẠNG</span>
            <h2>{attempt?.lab.title || lab.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
        </header>

        {error && <div role="alert" className="cli-workspace-error">{error}</div>}

        {!attempt ? <p style={{ padding: '24px', color: '#94a3b8' }}>Đang mở phiên thực hành…</p> : <>
          {/* Cụm 1: Quản lý phiên làm việc & chia sẻ */}
          <div className="network-controls">
            <span className="network-control-group-title"><Share2 size={13} /> Phiên: <code>{attempt.id}</code></span>
            <input aria-label="Mã phiên được chia sẻ" placeholder="Dán mã phiên được chia sẻ" value={joinId} onChange={(e) => setJoinId(e.target.value)} />
            <button disabled={busy || !joinId} onClick={join}>Vào phiên</button>
            <span className="network-control-tag">{replay ? 'Xem lại · chỉ đọc' : 'Trực tiếp'} · revision {displayed.revision}</span>
          </div>

          <div className="cli-workspace-body">
            <section className="cli-terminal-pane">
              {displayed.devices && <>
                <NetworkTopology key={displayed.revision} devices={displayed.devices} links={displayed.links} selected={deviceId} onSelect={selectDevice} packet={displayed.lastPacket} stp={displayed.stp} />

                {/* Cụm 2: Điều khiển thiết bị & Topology */}
                <div className="network-controls">
                  <span className="network-control-group-title"><Radio size={13} /> Thiết bị:</span>
                  <select value={deviceId} onChange={(e) => selectDevice(e.target.value)}>
                    {Object.entries(displayed.devices).map(([id, d]) => <option key={id} value={id}>{id} · {d.hostname}</option>)}
                  </select>
                  <button disabled={!editable} onClick={() => action({ type: 'tick' })}>Tiến 1 tick ({displayed.tick})</button>
                  {displayed.links.map((l) => (
                    <button key={l.id} disabled={!editable} onClick={() => action({ type: 'link', linkId: l.id, enabled: l.enabled === false })}>
                      {l.id}: {l.enabled === false ? 'nối lại' : 'ngắt dây'}
                    </button>
                  ))}
                </div>

                {/* Cụm 3: Thử nghiệm gói tin (Probe) */}
                <div className="network-controls">
                  <span className="network-control-group-title"><Send size={13} /> Gói tin:</span>
                  <input aria-label="IP đích" placeholder="IP đích" value={destination} onChange={(e) => setDestination(e.target.value)} />
                  <select aria-label="Giao thức probe" value={protocol} onChange={(e) => setProtocol(e.target.value)}>
                    {['icmp', 'tcp', 'udp'].map((p) => <option key={p}>{p}</option>)}
                  </select>
                  {protocol !== 'icmp' && (
                    <input aria-label="Cổng đích" type="number" min="0" max="65535" value={port} onChange={(e) => setPort(Number(e.target.value))} />
                  )}
                  <button disabled={!editable || !destination} onClick={() => action({ type: 'probe', deviceId, destination, protocol, dstPort: protocol === 'icmp' ? 0 : port })}>
                    Gửi gói tin
                  </button>
                </div>
              </>}

              <CliTerminal
                key={deviceId + attempt.id + Boolean(replay)}
                prompt={devicePrompt}
                history={history}
                disabled={!editable}
                onCommand={(command) => action({ type: 'command', command, ...(deviceId ? { deviceId } : {}) })}
                onComplete={(input) => api.getCliLabCompletions(token, attempt.id, input, deviceId || undefined)}
              />

              {/* Cụm 4: Replay timeline */}
              <div className="network-controls">
                <span className="network-control-group-title"><History size={13} /> Lịch sử:</span>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  Bước: <input type="number" min="0" max={attempt.commands.length} value={sequence} onChange={(e) => setSequence(Number(e.target.value))} />
                </label>
                <button disabled={busy} onClick={() => perform(async () => setReplay(await api.cliReplay(token, attempt.id, sequence)))}>
                  Xem snapshot
                </button>
                <button disabled={!replay || busy} onClick={() => setReplay(null)}>
                  Về trực tiếp
                </button>
              </div>
            </section>

            <aside className="cli-task-pane">
              <div className="cli-task-scroll">
                <h3>Mục tiêu</h3>
                <p>{attempt.lab.objective || 'Hoàn thành các yêu cầu cấu hình.'}</p>

                <h3>Nhiệm vụ</h3>
                {attempt.lab.tasks.map((t) => {
                  const c = attempt.feedback?.checks.find((check) => check.id === t.id);
                  return (
                    <div className="cli-task-item" key={t.id}>
                      <span style={{ fontWeight: 'bold', color: c?.passed ? '#4ade80' : c ? '#f87171' : '#94a3b8' }}>
                        {c ? (c.passed ? '✓' : '✗') : '○'}
                      </span>
                      <div>
                        <strong>{t.title} · {t.points} điểm</strong>
                        {c && !c.passed && <p style={{ margin: '4px 0 0 0', color: '#fca5a5' }}>{c.message} {c.hint}</p>}
                      </div>
                    </div>
                  );
                })}

                {attempt.feedback && <>
                  <h3>{attempt.score}/100 điểm</h3>
                  <button disabled={busy} onClick={() => perform(async () => { const result = await api.cliExplain(token, attempt.id); setExplanation(result.explanation); })}>
                    Giải thích kết quả
                  </button>
                  <p className="network-explanation">{explanation}</p>
                </>}

                {achievements && (
                  <section>
                    <h3>Thành tích của bạn</h3>
                    <p>{achievements.points} điểm · {achievements.completed} bài · streak {achievements.streak} ngày</p>
                    <p style={{ color: '#fbbf24' }}>{achievements.badges.join(' · ')}</p>
                  </section>
                )}

                {attempt.isOwner && (
                  <section>
                    <h3>Cùng thực hành</h3>
                    <p>Thêm ID tài khoản, rồi gửi mã phiên cho bạn học. Chỉ chủ phiên được nộp bài; điểm thuộc chủ phiên.</p>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                      <input aria-label="ID tài khoản bạn học" type="number" min="1" placeholder="ID bạn học" value={memberId} onChange={(e) => setMemberId(e.target.value)} />
                      <button disabled={!editable || !memberId} onClick={() => perform(async () => { await api.cliMembers(token, attempt.id, Number(memberId)); await refresh(); })}>
                        Thêm
                      </button>
                    </div>
                    {attempt.members.map((id) => (
                      <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                        <span>User {id}</span>
                        <button disabled={!editable} onClick={() => perform(async () => { await api.cliMembers(token, attempt.id, id, true); await refresh(); })}>
                          Gỡ quyền
                        </button>
                      </div>
                    ))}
                  </section>
                )}

                {displayed.devices && (
                  <details style={{ marginTop: '12px' }}>
                    <summary style={{ cursor: 'pointer', color: '#94a3b8' }}>OSPF / STP State</summary>
                    <pre>{JSON.stringify({ neighbors: displayed.ospfNeighbors, spanningTree: displayed.stp }, null, 2)}</pre>
                  </details>
                )}

                {displayed.lastPacket && (
                  <details open style={{ marginTop: '12px' }}>
                    <summary style={{ cursor: 'pointer', color: '#94a3b8' }}>Packet trace: {displayed.lastPacket.success ? 'Thành công' : 'Bị chặn'}</summary>
                    <p style={{ color: displayed.lastPacket.success ? '#4ade80' : '#f87171', margin: '6px 0' }}>{displayed.lastPacket.reason}</p>
                    <ol>{displayed.lastPacket.events.map((e, i) => (
                      <li key={i}>
                        <strong>{e.type} · {e.deviceId}</strong>
                        <div>{e.detail}</div>
                        <small>{e.packet.src} → {e.packet.dst} · TTL {e.packet.ttl}</small>
                      </li>
                    ))}</ol>
                  </details>
                )}
              </div>

              <button className="cli-submit-lab-btn" disabled={!editable || !attempt.isOwner} onClick={submit}>
                {attempt.status === 'PASSED' ? 'Đã hoàn thành' : 'Nộp cấu hình để chấm'}
              </button>
              {attempt.status === 'IN_PROGRESS' && attempt.isOwner && (
                <button type="button" className="cli-restart-lab-btn" disabled={busy} onClick={restart}>
                  Bỏ phiên và làm lại
                </button>
              )}
            </aside>
          </div>
        </>}
      </div>
    </div>
  );
}
