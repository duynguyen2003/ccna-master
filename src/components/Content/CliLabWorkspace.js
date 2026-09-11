import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Circle,
  CircleDashed,
  History,
  Laptop,
  Lightbulb,
  Link2,
  LockKeyhole,
  Radio,
  RotateCcw,
  Send,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { api } from '../../services/Api';
import { useAuth } from '../../context/AuthContext';
import '../../css/LabWorkspace.css';
import { gsap, prefersReducedMotion } from '../../utils/labMotion';
import { storeTransitionEvent } from '../../hooks/useLearningProgress';
import CliTerminal from './CliTerminal';
import NetworkTopology from './NetworkTopology';
import {
  buildPreviewAttempt,
  gradePreview,
  loadPreviewRuntime,
  previewAction,
} from './cliLabPreview';
import {
  deriveActionHint,
  deviceEntries,
  firstDeviceId,
  nextTaskForDevice,
  noop,
  normalizeProgress,
  packetAnimationKey,
  readOnboardingState,
  taskStatus,
  writeOnboardingState,
} from './labWorkspaceHelpers';

const MODE_SUFFIX = {
  USER_EXEC: '>',
  PRIVILEGED_EXEC: '#',
  GLOBAL_CONFIG: '(config)#',
  INTERFACE_CONFIG: '(config-if)#',
  VLAN_CONFIG: '(config-vlan)#',
  ROUTER_CONFIG: '(config-router)#',
  ACL_CONFIG: '(config-ext-nacl)#',
};

const ONBOARDING_STEPS = [
  {
    id: 'topology',
    title: 'Bắt đầu từ sơ đồ topology',
    text: 'Bấm vào router, switch hoặc PC trên sơ đồ để chuyển ngữ cảnh terminal. Bạn cũng có thể dùng Tab rồi Enter hoặc Space.',
  },
  {
    id: 'terminal',
    title: 'Thực hành trong terminal',
    text: 'Gõ lệnh Cisco CLI ở terminal. Lịch sử lệnh, hostname và prompt luôn đi theo thiết bị đang được chọn.',
  },
  {
    id: 'tasks',
    title: 'Theo dõi nhiệm vụ',
    text: 'Danh sách nhiệm vụ có ba trạng thái: chưa bắt đầu, đang thực hiện và đã hoàn thành. Thanh tiến độ lấy từ trạng thái hiện tại của bài.',
  },
  {
    id: 'advanced',
    title: 'Công cụ nâng cao',
    text: 'Tick mô phỏng và ping tùy chọn nằm trong accordion này để màn hình chính luôn gọn. Bạn có thể mở lại hướng dẫn bất cứ lúc nào.',
  },
];

const parseObject = (value, fallback) => {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

export default function CliLabWorkspace({
  lab = {},
  preview = null,
  onClose = noop,
  onPassed = noop,
  onNotify = noop,
}) {
  const auth = useAuth() || {};
  const token = auth.token;
  const user = auth.user;
  const isPreview = Boolean(preview);
  const [attempt, setAttempt] = useState(null);
  const latest = useRef(null);
  const runtime = useRef(null);
  const [deviceId, setDeviceId] = useState('');
  const selected = useRef('');
  const [selectedLink, setSelectedLink] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [replay, setReplay] = useState(null);
  const [sequence, setSequence] = useState(0);
  const [joinId, setJoinId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [explanation, setExplanation] = useState('');
  const [achievements, setAchievements] = useState(null);
  const [destination, setDestination] = useState('');
  const [protocol, setProtocol] = useState('icmp');
  const [port, setPort] = useState(80);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [secondaryPanel, setSecondaryPanel] = useState(null);
  const [pulseTaskId, setPulseTaskId] = useState('');
  const [terminalShakeKey, setTerminalShakeKey] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [theme, setTheme] = useState('dark');
  const mounted = useRef(true);
  const dialog = useRef(null);
  const onboardingFocusRestore = useRef(null);
  const previousProgress = useRef(null);
  const pulseTimer = useRef(null);
  const shakeTimer = useRef(null);

  const tasks = useMemo(() => attempt?.lab?.tasks || [], [attempt?.lab?.tasks]);
  const hasAttempt = Boolean(attempt?.id);
  const progress = useMemo(() => normalizeProgress(attempt), [attempt]);
  const displayedProgress = replay?.progress || progress;
  const displayed = replay?.state || attempt?.state;
  const active = displayed?.devices
    ? displayed.devices[deviceId]
      ? { ...displayed.devices[deviceId], id: deviceId }
      : null
    : displayed;
  const selectedTask = useMemo(
    () => nextTaskForDevice(tasks, displayedProgress, deviceId),
    [tasks, displayedProgress, deviceId]
  );
  const hintText = deriveActionHint(selectedTask, active, displayed);
  const previewLabel = preview?.badge || 'Xem trước bản nháp';
  const labId = lab?.id;
  const labTitle = lab?.title;
  const labObjective = lab?.objective;
  const previewInitialState = preview?.initialState;
  const previewGradingSpec = preview?.gradingSpec;
  const previewLab = preview?.lab;
  const tourStepId = showOnboarding ? ONBOARDING_STEPS[onboardingStep]?.id : '';

  const triggerError = useCallback(() => {
    setTerminalShakeKey((key) => key + 1);
    if (shakeTimer.current) window.clearTimeout(shakeTimer.current);
    shakeTimer.current = window.setTimeout(() => setTerminalShakeKey(0), 480);
  }, []);

  const accept = useCallback((nextAttempt) => {
    if (!mounted.current || !nextAttempt) return;
    const nextProgress = normalizeProgress(nextAttempt);
    const oldProgress =
      previousProgress.current?.attemptId === nextAttempt.id
        ? previousProgress.current.progress
        : null;
    const completedTask =
      oldProgress &&
      nextProgress.checks.find(
        (check) =>
          check.status === 'completed' &&
          oldProgress.checks?.find((old) => old.id === check.id)?.status !== 'completed'
      );
    if (completedTask) {
      setPulseTaskId(completedTask.id);
      if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
      pulseTimer.current = window.setTimeout(() => setPulseTaskId(''), 900);
    }
    previousProgress.current = { attemptId: nextAttempt.id, progress: nextProgress };
    latest.current = nextAttempt;
    setAttempt(nextAttempt);
    const ids = deviceEntries(nextAttempt.state?.devices).map(([id]) => id);
    if (ids.length && !ids.includes(selected.current)) {
      selected.current = ids[0];
      setDeviceId(ids[0]);
    } else if (!ids.length && selected.current) {
      selected.current = '';
      setDeviceId('');
    }
  }, []);

  const refresh = useCallback(async () => {
    if (isPreview) return;
    const current = latest.current;
    if (!current) return;
    const last = current.commands?.at(-1)?.sequence || 0;
    const next = await api.getCliLabAttempt(token, current.id, selected.current || undefined, last);
    if (latest.current?.id !== current.id) return;
    const commandMap = new Map(
      (latest.current.commands || []).map((event) => [event.sequence, event])
    );
    (next.commands || []).forEach((event) => commandMap.set(event.sequence, event));
    if (next.state?.revision < latest.current.state?.revision) return;
    accept({ ...next, commands: [...commandMap.values()].sort((a, b) => a.sequence - b.sequence) });
  }, [accept, isPreview, token]);

  useEffect(() => {
    mounted.current = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    let activeEffect = true;
    if (isPreview) {
      const initialState = parseObject(previewInitialState, {});
      const gradingSpec = parseObject(previewGradingSpec, { checks: [] });
      loadPreviewRuntime()
        .then((loaded) => {
          if (!activeEffect) return;
          runtime.current = loaded;
          accept(
            buildPreviewAttempt({
              runtime: loaded,
              initialState,
              gradingSpec,
              lab: { id: labId, title: labTitle, objective: labObjective, ...(previewLab || {}) },
            })
          );
        })
        .catch((cause) => {
          if (activeEffect) setError(cause.message || 'Không thể tải mô phỏng xem trước.');
        });
    } else {
      api
        .startCliLabAttempt(token, labId)
        .then((nextAttempt) => {
          if (activeEffect) accept(nextAttempt);
        })
        .catch((cause) => {
          if (activeEffect) setError(cause.message);
        });
      api
        .cliAchievements(token)
        .then((value) => {
          if (activeEffect) setAchievements(value);
        })
        .catch(() => {});
    }
    return () => {
      activeEffect = false;
      mounted.current = false;
      document.body.style.overflow = previousOverflow;
      if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
      if (shakeTimer.current) window.clearTimeout(shakeTimer.current);
    };
  }, [
    accept,
    isPreview,
    labId,
    labTitle,
    labObjective,
    previewInitialState,
    previewGradingSpec,
    previewLab,
    token,
  ]);

  useEffect(() => {
    if (isPreview || !attempt) return undefined;
    let running = false;
    const timer = window.setInterval(async () => {
      if (running || busyRef.current || document.hidden || !latest.current) return;
      running = true;
      try {
        await refresh();
      } catch (cause) {
        setError(cause.message);
      } finally {
        running = false;
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [attempt, isPreview, refresh]);

  useEffect(() => {
    if (hasAttempt && !isPreview && !readOnboardingState().dismissed) {
      setShowOnboarding(true);
    }
  }, [hasAttempt, isPreview]);

  useEffect(() => {
    if (!showOnboarding || !tourStepId) return;
    const target = dialog.current?.querySelector(`[data-tour-target="${tourStepId}"]`);
    target?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [showOnboarding, tourStepId]);

  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.focus();
    return () => {
      if (previous && previous.isConnected !== false) previous.focus?.();
    };
  }, []);

  useEffect(() => {
    if (showOnboarding) {
      const current = document.activeElement;
      if (current && current !== document.body) onboardingFocusRestore.current = current;
      dialog.current?.querySelector('.cli-lab-onboarding button:not(:disabled)')?.focus();
      return undefined;
    }
    const previous = onboardingFocusRestore.current;
    onboardingFocusRestore.current = null;
    if (previous && previous.isConnected !== false) previous.focus?.();
    return undefined;
  }, [showOnboarding]);

  useEffect(() => {
    if (!terminalShakeKey || prefersReducedMotion()) return undefined;
    const target = dialog.current?.querySelector('.cli-lab-terminal-frame');
    if (!target) return undefined;
    const tween = gsap.fromTo(
      target,
      { x: -5 },
      { x: 0, duration: 0.1, repeat: 3, yoyo: true, ease: 'power1.inOut', clearProps: 'transform' }
    );
    return () => {
      tween.kill();
      gsap.set(target, { clearProps: 'transform' });
    };
  }, [terminalShakeKey]);

  useEffect(() => {
    if (!pulseTaskId || prefersReducedMotion()) return undefined;
    const target = [...(dialog.current?.querySelectorAll('.cli-lab-task-card') || [])].find(
      (node) => node.dataset.taskId === pulseTaskId
    );
    if (!target) return undefined;
    const tween = gsap.fromTo(
      target,
      { scale: 0.98, boxShadow: '0 0 0 0 rgba(74, 222, 128, 0)' },
      {
        scale: 1,
        boxShadow: '0 0 0 5px rgba(74, 222, 128, 0.15)',
        duration: 0.32,
        yoyo: true,
        repeat: 1,
        clearProps: 'transform,boxShadow',
        ease: 'power1.out',
      }
    );
    return () => {
      tween.kill();
      gsap.set(target, { clearProps: 'transform,boxShadow' });
    };
  }, [pulseTaskId]);

  const perform = async (fn) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (cause) {
      if (mounted.current) {
        setError(cause.message || 'Thao tác không thành công.');
        triggerError();
        if (!isPreview) onNotify(cause.message || 'Thao tác không thành công.', 'error');
      }
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const action = async (value) => {
    if (!latest.current || replay || latest.current.status !== 'IN_PROGRESS') return;
    await perform(async () => {
      const current = latest.current;
      if (isPreview) {
        const result = previewAction({ runtime: runtime.current, attempt: current, action: value });
        const gradingSpec = parseObject(preview?.gradingSpec, { checks: [] });
        const next =
          result.result.isError || result.result.help
            ? result.attempt
            : gradePreview({ runtime: runtime.current, attempt: result.attempt, gradingSpec });
        accept(next);
        if (result.result.isError) {
          triggerError();
          throw new Error(result.result.output || 'Lệnh không hợp lệ.');
        }
        return;
      }
      try {
        const result = await api.cliAction(token, current.id, value, current.state.revision);
        if (result.event?.isError) triggerError();
        accept({
          ...current,
          state: result.state,
          prompt: result.prompt,
          progress: result.progress || current.progress,
          commands: result.event?.sequence ? [...current.commands, result.event] : current.commands,
        });
      } catch (cause) {
        await refresh();
        throw cause;
      }
    });
  };

  const selectDevice = (id, clearLink = true) => {
    selected.current = id;
    setDeviceId(id);
    if (clearLink) setSelectedLink('');
    setHintOpen(false);
  };

  const selectLink = (link) => {
    setSelectedLink(link.id);
    if (!selected.current) selectDevice(link.a.deviceId, false);
    if (!replay && latest.current?.status === 'IN_PROGRESS' && !busyRef.current) {
      action({ type: 'link', linkId: link.id, enabled: link.enabled === false });
    }
  };

  const join = () =>
    perform(async () => {
      if (isPreview) return;
      const nextAttempt = await api.getCliLabAttempt(token, joinId.trim());
      selected.current = '';
      setReplay(null);
      setExplanation('');
      accept(nextAttempt);
    });

  const submit = () =>
    perform(async () => {
      const current = latest.current;
      if (!current) return;
      if (isPreview) {
        const gradingSpec = parseObject(preview?.gradingSpec, { checks: [] });
        accept(gradePreview({ runtime: runtime.current, attempt: current, gradingSpec }));
        setExplanation(
          'Bản xem trước chỉ chấm cục bộ để bạn kiểm tra rubric. Kết quả chưa được gửi hoặc lưu.'
        );
        return;
      }
      const result = await api.submitCliLabAttempt(token, current.id);
      accept({ ...result.attempt, commands: current.commands });
      setExplanation('');
      if (result.result.passed) {
        onPassed(String(current.labId));
        onNotify('Cấu hình đã đạt yêu cầu.', 'success');
        if (result.transition?.changed) {
          storeTransitionEvent(result.transition, user?.id);
        }
        setAchievements(await api.cliAchievements(token));
      }
    });

  const restart = () =>
    perform(async () => {
      if (isPreview) {
        const initialState = parseObject(preview?.initialState, {});
        const gradingSpec = parseObject(preview?.gradingSpec, { checks: [] });
        accept(
          buildPreviewAttempt({
            runtime: runtime.current,
            initialState,
            gradingSpec,
            lab: { ...lab, ...(preview?.lab || {}) },
          })
        );
        setReplay(null);
        setSequence(0);
        setExplanation('');
        return;
      }
      const current = latest.current;
      const nextAttempt = await api.restartCliLabAttempt(token, current.id, current.labId);
      setReplay(null);
      setSequence(0);
      setExplanation('');
      accept(nextAttempt);
      onNotify('Đã mở phiên mới; lịch sử phiên cũ vẫn được giữ lại.', 'success');
    });

  const openAchievements = () => {
    setSecondaryPanel((current) => (current === 'achievements' ? null : 'achievements'));
    if (!isPreview && !achievements)
      api
        .cliAchievements(token)
        .then(setAchievements)
        .catch(() => {});
  };

  const devicePrompt = active ? `${active.hostname}${MODE_SUFFIX[active.mode] || '>'}` : '>';
  const history = (attempt?.commands || []).filter((event) => {
    const eventDevice = event.action?.deviceId;
    const first = firstDeviceId(displayed?.devices);
    return (
      (!displayed?.devices || eventDevice === deviceId || (!eventDevice && deviceId === first)) &&
      (!replay || event.sequence <= replay.sequence)
    );
  });
  const editable = attempt?.status === 'IN_PROGRESS' && !replay && !busy;
  const packetCommand = [...(attempt?.commands || [])]
    .filter((event) => !replay || event.sequence <= replay.sequence)
    .reverse()
    .find(
      (event) =>
        event.action?.type === 'probe' || /(^|\s)(ping|traceroute)(\s|$)/i.test(event.command || '')
    );
  // Replay is a historical snapshot: keep its trace text, but do not replay
  // an animation merely because the user selected a different device.
  const packet =
    !replay && displayed?.lastPacket
      ? {
          ...displayed.lastPacket,
          animationKey: packetAnimationKey(displayed.lastPacket, packetCommand),
        }
      : null;

  const closeOnEscape = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      if (showOnboarding) {
        dismissOnboarding();
      } else if (secondaryPanel) {
        setSecondaryPanel(null);
      } else {
        onClose();
      }
      return;
    }
    if (event.key !== 'Tab' || event.target.closest('.cli-xterm-host')) return;
    const scope = showOnboarding
      ? dialog.current.querySelector('.cli-lab-onboarding')
      : dialog.current;
    if (!scope) return;
    const focusable = [
      ...scope.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary, [tabindex]:not([tabindex="-1"])'
      ),
    ].filter((node) => {
      const style = window.getComputedStyle(node);
      return (
        node.getClientRects().length > 0 &&
        style.visibility !== 'hidden' &&
        !node.closest('details:not([open])') &&
        node.getAttribute('aria-hidden') !== 'true'
      );
    });
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (
      event.shiftKey &&
      (document.activeElement === first || document.activeElement === dialog.current)
    ) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    writeOnboardingState(true);
  };

  const captureEscape = (event) => {
    if (event.key === 'Escape') closeOnEscape(event);
  };

  return (
    <div
      ref={dialog}
      tabIndex={-1}
      data-theme={theme}
      className={`cli-workspace-overlay cli-lab-theme ${isPreview ? 'cli-lab-preview-mode' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Phòng thực hành mạng"
      onKeyDownCapture={captureEscape}
      onKeyDown={closeOnEscape}
    >
      <div className="cli-mobile-fallback">
        <div className="cli-mobile-fallback-card">
          <div className="cli-mobile-fallback-icon">
            <Laptop size={36} />
          </div>
          <h3>Chức năng này cần dùng trên Laptop</h3>
          <p>
            Môi trường thực hành mô phỏng mạng Cisco yêu cầu màn hình rộng và bàn phím máy tính.
          </p>
          <button className="cli-mobile-fallback-btn" onClick={onClose}>
            Quay lại danh sách bài học
          </button>
        </div>
      </div>

      <div className="cli-workspace network-workspace cli-lab-surface">
        <header className="cli-workspace-header cli-lab-header">
          <div className="cli-lab-heading">
            <span className="cli-workspace-kicker">PHÒNG THỰC HÀNH MẠNG</span>
            <h2>{attempt?.lab.title || lab.title || 'Cisco CLI Lab'}</h2>
          </div>
          <div
            className="cli-lab-header-progress"
            aria-label={`Tiến độ ${displayedProgress.completed} trên ${displayedProgress.total} nhiệm vụ`}
          >
            <span>
              {displayedProgress.completed}/{displayedProgress.total} nhiệm vụ
            </span>
            <div className="cli-lab-progress-track">
              <span
                style={{
                  width: `${displayedProgress.total ? Math.min(100, (displayedProgress.completed / displayedProgress.total) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
          {isPreview && (
            <span className="cli-lab-preview-badge">
              <EyeIcon /> {previewLabel}
            </span>
          )}
          {!isPreview && (
            <button
              type="button"
              className="cli-lab-help-button"
              onClick={() => {
                setOnboardingStep(0);
                setShowOnboarding(true);
                writeOnboardingState(false);
              }}
              title="Mở lại hướng dẫn"
            >
              ?
            </button>
          )}
          <button
            type="button"
            className="cli-lab-theme-toggle"
            onClick={() => setTheme((value) => (value === 'dark' ? 'light' : 'dark'))}
            aria-label={
              theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'
            }
          >
            {theme === 'dark' ? '☼' : '☾'}
          </button>
          <button type="button" className="cli-lab-close" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </header>

        {error && (
          <div role="alert" className="cli-workspace-error cli-lab-error">
            {error}
          </div>
        )}

        {!attempt ? (
          <p className="cli-lab-loading">
            {isPreview ? 'Đang tải mô phỏng xem trước…' : 'Đang mở phiên thực hành…'}
          </p>
        ) : (
          <>
            <div className="cli-lab-session-strip">
              <span className="cli-lab-session-id">
                <Share2 size={14} />{' '}
                {isPreview ? (
                  'Phiên cục bộ'
                ) : (
                  <>
                    Phiên <code>{attempt.id}</code>
                  </>
                )}
              </span>
              {!isPreview && (
                <>
                  <span className="cli-lab-live-tag">
                    <span className="cli-lab-live-dot" />{' '}
                    {replay ? 'Xem lại · chỉ đọc' : 'Trực tiếp'} · revision{' '}
                    {displayed?.revision ?? 0}
                  </span>
                  <button
                    type="button"
                    className="cli-lab-session-button"
                    onClick={() =>
                      setSecondaryPanel((current) => (current === 'session' ? null : 'session'))
                    }
                    aria-expanded={secondaryPanel === 'session'}
                  >
                    <Users size={14} /> Cùng thực hành
                  </button>
                  <button
                    type="button"
                    className="cli-lab-session-button"
                    onClick={openAchievements}
                    aria-expanded={secondaryPanel === 'achievements'}
                  >
                    <Trophy size={14} /> Thành tích
                  </button>
                </>
              )}
              {isPreview && (
                <span className="cli-lab-live-tag">
                  <LockKeyhole size={13} /> Thay đổi chỉ dùng để xem trước
                </span>
              )}
            </div>

            {secondaryPanel === 'session' && !isPreview && (
              <section className="cli-lab-secondary-panel" aria-label="Cùng thực hành">
                <div>
                  <strong>Mời bạn học vào phiên</strong>
                  <p>Chỉ chủ phiên có thể mời, gỡ quyền và nộp bài.</p>
                </div>
                <div className="cli-lab-inline-form">
                  <input
                    aria-label="ID tài khoản bạn học"
                    type="number"
                    min="1"
                    placeholder="ID bạn học"
                    value={memberId}
                    onChange={(event) => setMemberId(event.target.value)}
                  />
                  <button
                    disabled={!editable || !attempt.isOwner || !memberId}
                    onClick={() =>
                      perform(async () => {
                        await api.cliMembers(token, attempt.id, Number(memberId));
                        await refresh();
                      })
                    }
                  >
                    Thêm
                  </button>
                </div>
                {attempt.isOwner &&
                  attempt.members?.map((id) => (
                    <div className="cli-lab-member-row" key={id}>
                      <span>User {id}</span>
                      <button
                        disabled={!editable}
                        onClick={() =>
                          perform(async () => {
                            await api.cliMembers(token, attempt.id, id, true);
                            await refresh();
                          })
                        }
                      >
                        Gỡ quyền
                      </button>
                    </div>
                  ))}
                <div className="cli-lab-inline-form cli-lab-join-form">
                  <input
                    aria-label="Mã phiên được chia sẻ"
                    placeholder="Dán mã phiên được chia sẻ"
                    value={joinId}
                    onChange={(event) => setJoinId(event.target.value)}
                  />
                  <button disabled={busy || !joinId} onClick={join}>
                    Vào phiên
                  </button>
                </div>
              </section>
            )}
            {secondaryPanel === 'achievements' && !isPreview && (
              <section className="cli-lab-secondary-panel" aria-label="Thành tích của bạn">
                <strong>Thành tích của bạn</strong>
                {achievements ? (
                  <p>
                    {achievements.points} điểm · {achievements.completed} bài · streak{' '}
                    {achievements.streak} ngày
                    <br />
                    <span className="cli-lab-badge-list">{achievements.badges.join(' · ')}</span>
                  </p>
                ) : (
                  <p>Đang tải thành tích…</p>
                )}
              </section>
            )}

            <div className="cli-workspace-body cli-lab-body">
              <section className="cli-terminal-pane cli-lab-terminal-pane">
                {displayed?.devices && (
                  <>
                    <div className="cli-lab-topology-head">
                      <div>
                        <span className="cli-lab-eyebrow">
                          <Radio size={13} /> TOPOLOGY TƯƠNG TÁC
                        </span>
                        <strong>{active?.hostname || deviceId || 'Thiết bị'}</strong>
                        <span>
                          {selectedLink
                            ? ` · Dây ${selectedLink} đang được chọn`
                            : ' · Bấm vào thiết bị để cấu hình'}
                        </span>
                      </div>
                      <span className="cli-lab-topology-legend">
                        <i className="is-up" /> Kết nối <i className="is-down" /> Ngắt dây
                      </span>
                    </div>
                    <div
                      className={`cli-lab-topology-stage ${tourStepId === 'topology' ? 'is-tour-target' : ''}`}
                      data-tour-target="topology"
                    >
                      <NetworkTopology
                        key={attempt.id}
                        devices={displayed.devices}
                        links={displayed.links}
                        selected={deviceId}
                        selectedLink={selectedLink}
                        onSelect={selectDevice}
                        onLinkSelect={selectLink}
                        packet={packet}
                        stp={displayed.stp}
                        disabled={!editable}
                      />
                    </div>
                    <div className="cli-lab-selected-device">
                      <Radio size={14} />
                      <span>
                        Đang cấu hình <strong>{active?.hostname || deviceId}</strong>
                      </span>
                      <span className="cli-lab-selected-prompt">{devicePrompt}</span>
                    </div>
                    <details
                      className={`cli-lab-advanced ${tourStepId === 'advanced' ? 'is-tour-target' : ''}`}
                      data-tour-target="advanced"
                      data-testid="advanced-tools"
                      open={advancedOpen}
                      onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
                    >
                      <summary>
                        <SlidersHorizontal size={15} />
                        <span>Công cụ nâng cao</span>
                        <small>Tick mô phỏng · ping tùy chọn</small>
                        <ChevronDown size={15} className="cli-lab-summary-chevron" />
                      </summary>
                      <div className="cli-lab-advanced-content">
                        <button disabled={!editable} onClick={() => action({ type: 'tick' })}>
                          Tiến 1 tick <span>{displayed.tick}</span>
                        </button>
                        <div className="cli-lab-probe-form">
                          <input
                            aria-label="IP đích"
                            placeholder="IP đích"
                            value={destination}
                            onChange={(event) => setDestination(event.target.value)}
                          />
                          <select
                            aria-label="Giao thức probe"
                            value={protocol}
                            onChange={(event) => setProtocol(event.target.value)}
                          >
                            {['icmp', 'tcp', 'udp'].map((value) => (
                              <option key={value}>{value}</option>
                            ))}
                          </select>
                          {protocol !== 'icmp' && (
                            <input
                              aria-label="Cổng đích"
                              type="number"
                              min="0"
                              max="65535"
                              value={port}
                              onChange={(event) => setPort(Number(event.target.value))}
                            />
                          )}
                          <button
                            disabled={!editable || !destination}
                            onClick={() =>
                              action({
                                type: 'probe',
                                deviceId,
                                destination,
                                protocol,
                                dstPort: protocol === 'icmp' ? 0 : port,
                              })
                            }
                          >
                            <Send size={14} /> Gửi gói tin
                          </button>
                        </div>
                        <p
                          className="cli-lab-term-tip"
                          title="Probe mô phỏng đường đi của gói tin qua từng hop trong topology"
                        >
                          Bấm vào dây để mô phỏng ngắt/nối đường truyền; marker gói tin sẽ đi qua
                          các hop thực tế khi có kết quả.
                        </p>
                      </div>
                    </details>
                  </>
                )}

                <div className="cli-lab-hint-bar" role="status">
                  <div className="cli-lab-hint-icon">
                    <Lightbulb size={16} />
                  </div>
                  <div className="cli-lab-hint-copy">
                    <span>Thiết bị đang cấu hình</span>
                    <strong>{active?.hostname || deviceId || 'Chưa chọn thiết bị'}</strong>
                    <p>Bước tiếp theo: {hintText}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHintOpen((open) => !open)}
                    aria-expanded={hintOpen}
                  >
                    {hintOpen ? 'Ẩn gợi ý' : 'Xem gợi ý'}
                  </button>
                  {hintOpen && (
                    <div className="cli-lab-hint-expanded">{selectedTask?.hint || hintText}</div>
                  )}
                </div>
                <div
                  className={`cli-lab-terminal-frame ${terminalShakeKey ? 'is-shaking' : ''} ${tourStepId === 'terminal' ? 'is-tour-target' : ''}`}
                  data-tour-target="terminal"
                >
                  <CliTerminal
                    key={`${deviceId}-${attempt.id}-${Boolean(replay)}`}
                    prompt={devicePrompt}
                    history={history}
                    disabled={!editable}
                    shakeKey={terminalShakeKey}
                    onCommand={(command) =>
                      action({ type: 'command', command, ...(deviceId ? { deviceId } : {}) })
                    }
                    onComplete={async (input) => {
                      if (isPreview)
                        return runtime.current?.engine.completions(
                          latest.current.state,
                          input,
                          deviceId
                        );
                      return api.getCliLabCompletions(
                        token,
                        attempt.id,
                        input,
                        deviceId || undefined
                      );
                    }}
                  />
                </div>

                <div className="cli-lab-replay-bar">
                  <span>
                    <History size={14} /> Lịch sử
                  </span>
                  <label>
                    Bước{' '}
                    <input
                      type="number"
                      min="0"
                      max={attempt.commands?.length || 0}
                      value={sequence}
                      onChange={(event) => setSequence(Number(event.target.value))}
                    />
                  </label>
                  <button
                    disabled={busy || isPreview}
                    onClick={() =>
                      perform(async () =>
                        setReplay(await api.cliReplay(token, attempt.id, sequence))
                      )
                    }
                  >
                    Xem snapshot
                  </button>
                  <button disabled={!replay || busy} onClick={() => setReplay(null)}>
                    Về trực tiếp
                  </button>
                </div>
              </section>

              <aside className="cli-task-pane cli-lab-task-pane">
                <div className="cli-task-scroll cli-lab-task-scroll">
                  <section className="cli-lab-objective">
                    <span className="cli-lab-eyebrow">MỤC TIÊU</span>
                    <p>{attempt.lab.objective || 'Hoàn thành các yêu cầu cấu hình.'}</p>
                  </section>
                  <section
                    className={`cli-lab-checklist-section ${tourStepId === 'tasks' ? 'is-tour-target' : ''}`}
                    data-tour-target="tasks"
                  >
                    <div className="cli-lab-section-heading">
                      <h3>Nhiệm vụ</h3>
                      <span>
                        {displayedProgress.completed}/{displayedProgress.total}
                      </span>
                    </div>
                    <div className="cli-lab-checklist-progress">
                      <span
                        style={{
                          width: `${displayedProgress.total ? Math.min(100, (displayedProgress.completed / displayedProgress.total) * 100) : 0}%`,
                        }}
                      />
                    </div>
                    <div className="cli-lab-checklist" aria-label="Danh sách nhiệm vụ">
                      {tasks.map((task) => {
                        const status = taskStatus(task, displayedProgress);
                        const check = displayedProgress.checks?.find((item) => item.id === task.id);
                        const feedback = attempt.feedback?.checks?.find(
                          (item) => item.id === task.id
                        );
                        const pulse = pulseTaskId === task.id;
                        return (
                          <div
                            data-task-id={task.id}
                            className={`cli-lab-task-card status-${status} ${pulse ? 'is-pulsing' : ''}`}
                            key={task.id}
                          >
                            <span
                              className="cli-lab-task-status"
                              aria-label={
                                status === 'completed'
                                  ? 'Đã hoàn thành'
                                  : status === 'in_progress'
                                    ? 'Đang thực hiện'
                                    : 'Chưa bắt đầu'
                              }
                            >
                              {status === 'completed' ? (
                                <Check size={16} />
                              ) : status === 'in_progress' ? (
                                <CircleDashed size={16} />
                              ) : (
                                <Circle size={16} />
                              )}
                            </span>
                            <div>
                              <strong>{task.title}</strong>
                              <small>
                                {task.points || 0} điểm {task.deviceId ? `· ${task.deviceId}` : ''}
                              </small>
                              {status !== 'completed' &&
                                (check?.passed === false || feedback?.passed === false) && (
                                  <p>Chưa hoàn thành. Mở “Xem gợi ý” để xem bước phù hợp.</p>
                                )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {attempt.feedback && (
                    <section className="cli-lab-feedback">
                      <div className="cli-lab-section-heading">
                        <h3>{attempt.score}/100 điểm</h3>
                        <Sparkles size={16} />
                      </div>
                      <button
                        disabled={busy || isPreview}
                        onClick={() =>
                          perform(async () => {
                            const result = await api.cliExplain(token, attempt.id);
                            setExplanation(result.explanation);
                          })
                        }
                      >
                        Giải thích kết quả
                      </button>
                      {explanation && <p className="network-explanation">{explanation}</p>}
                    </section>
                  )}

                  {displayed?.lastPacket && (
                    <section className="cli-lab-packet">
                      <details>
                        <summary>
                          <Link2 size={14} /> Packet trace:{' '}
                          {displayed.lastPacket.success ? 'Thành công' : 'Bị chặn'}
                        </summary>
                        <p className={displayed.lastPacket.success ? 'is-success' : 'is-danger'}>
                          {displayed.lastPacket.reason}
                        </p>
                        <ol>
                          {displayed.lastPacket.events.map((event, index) => (
                            <li key={`${event.type}-${event.deviceId}-${index}`}>
                              <strong>
                                {event.type} · {event.deviceId}
                              </strong>
                              <div>{event.detail}</div>
                              <small>
                                {event.packet?.src} → {event.packet?.dst} · TTL {event.packet?.ttl}
                              </small>
                            </li>
                          ))}
                        </ol>
                      </details>
                    </section>
                  )}
                  <section className="cli-lab-ospf">
                    <details>
                      <summary>
                        <Radio size={14} /> OSPF / STP State
                      </summary>
                      <pre>
                        {JSON.stringify(
                          { neighbors: displayed?.ospfNeighbors, spanningTree: displayed?.stp },
                          null,
                          2
                        )}
                      </pre>
                    </details>
                  </section>
                </div>
                <button
                  className="cli-submit-lab-btn cli-lab-submit"
                  disabled={!editable || (!isPreview && !attempt.isOwner)}
                  onClick={submit}
                >
                  {isPreview
                    ? 'Chấm thử bản nháp'
                    : attempt.status === 'PASSED'
                      ? 'Đã hoàn thành'
                      : 'Nộp cấu hình để chấm'}
                </button>
                {!isPreview && attempt.status === 'IN_PROGRESS' && attempt.isOwner && (
                  <button
                    type="button"
                    className="cli-restart-lab-btn cli-lab-restart"
                    disabled={busy}
                    onClick={restart}
                  >
                    <RotateCcw size={14} /> Bỏ phiên và làm lại
                  </button>
                )}
                {isPreview && (
                  <span className="cli-lab-preview-note">
                    <LockKeyhole size={13} /> Bản xem trước không lưu điểm hoặc trạng thái.
                  </span>
                )}
              </aside>
            </div>
          </>
        )}
      </div>

      {showOnboarding && !isPreview && attempt && (
        <div
          className="cli-lab-onboarding"
          data-step={tourStepId}
          role="region"
          aria-label="Hướng dẫn bắt đầu"
        >
          <div className="cli-lab-onboarding-card">
            <div className="cli-lab-onboarding-step">
              <span>0{onboardingStep + 1}</span>
              <small>/ 04</small>
            </div>
            <h3>{ONBOARDING_STEPS[onboardingStep].title}</h3>
            <p>{ONBOARDING_STEPS[onboardingStep].text}</p>
            <div className="cli-lab-onboarding-dots">
              {ONBOARDING_STEPS.map((step, index) => (
                <i key={step.id} className={index === onboardingStep ? 'active' : ''} />
              ))}
            </div>
            <div className="cli-lab-onboarding-actions">
              <button type="button" onClick={dismissOnboarding}>
                Bỏ qua
              </button>
              {onboardingStep < ONBOARDING_STEPS.length - 1 ? (
                <button
                  type="button"
                  className="is-primary"
                  onClick={() => setOnboardingStep((step) => step + 1)}
                >
                  Tiếp theo
                </button>
              ) : (
                <button type="button" className="is-primary" onClick={dismissOnboarding}>
                  Đã hiểu
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const EyeIcon = () => (
  <span className="cli-lab-preview-eye" aria-hidden="true">
    ◉
  </span>
);
