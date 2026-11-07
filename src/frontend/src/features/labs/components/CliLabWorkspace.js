import { Sun, Moon, MoreHorizontal, ArrowLeft, Check, Network, Terminal } from 'lucide-react';
import { normalizeSteps } from '@ccna/shared/labDefinition';
import { COPY_ERROR } from '@ccna/agent-ui/clipboard';
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  History,
  Laptop,
  Lightbulb,
  Link2,
  LockKeyhole,
  Radio,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import { api } from '../../../services/Api';
import DropdownSelect from '../../../components/ui/DropdownSelect';
import SlidingTabs from '../../../components/ui/SlidingTabs';
import NetworkTopology from './NetworkTopology';
import { runThemeTransition } from '../../../components/ui/themeTransition';
import '../styles/LabWorkspace.css';
import AnimatedCopyButton from '../../../components/ui/AnimatedCopyButton';
import Dialog from '../../../components/ui/Dialog';
import AssistantLoader from '@ccna/agent-ui/loader';
import useTerminalHeight from '../hooks/useTerminalHeight';
import LabObjectives from './LabObjectives';
import LabDisclosure from './LabDisclosure';
import { needsConvergence } from '../utils/networkConvergence';
import { useAuth } from '../../../context/AuthContext';
import { gsap, prefersReducedMotion } from '../utils/labMotion';
import { storeTransitionEvent } from '../../courses/hooks/useLearningProgress';
import CliTerminal from './CliTerminal';
import MarkdownRenderer from '../../../components/common/MarkdownRenderer';
import {
  buildPreviewAttempt,
  gradePreview,
  loadPreviewRuntime,
  previewAction,
} from '../utils/cliLabPreview';
import {
  deriveActionHint,
  deviceEntries,
  firstDeviceId,
  nextTaskForDevice,
  noop,
  normalizeProgress,
  packetAnimationKey,
  readOnboardingState,
  writeOnboardingState,
} from '../utils/labWorkspaceHelpers';

const MODE_SUFFIX = {
  USER_EXEC: '>',
  PRIVILEGED_EXEC: '#',
  GLOBAL_CONFIG: '(config)#',
  INTERFACE_CONFIG: '(config-if)#',
  VLAN_CONFIG: '(config-vlan)#',
  ROUTER_CONFIG: '(config-router)#',
  ACL_CONFIG: '(config-ext-nacl)#',
};
const canPractice = (value) => value?.canPractice ?? value?.status === 'IN_PROGRESS';

const LabRestartConfirmation = lazy(() => import('./LabRestartConfirmation'));
const loadAssistant = () => import('./AiLabAssistant');
const AiFeedbackExplanation = lazy(() => import('./AiFeedbackExplanation'));

const ONBOARDING_STEPS = [
  {
    id: 'topology',
    title: 'Bắt đầu từ sơ đồ mạng',
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
    title: 'Thử nghiệm mạng',
    text: 'Dùng Ping thử để kiểm tra kết nối. Chọn dây rồi Ngắt/Nối để quan sát sự cố; cấu hình vẫn được lưu sau mỗi thao tác.',
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
  page = false,
  onClose = noop,
  onPassed = noop,
  onNotify = noop,
}) {
  const auth = useAuth() || {};
  const token = auth.token;
  const user = auth.user;
  const isPreview = Boolean(preview);
  const [attempt, setAttempt] = useState(null);
  const terminalSize = useTerminalHeight(Boolean(attempt));
  const latest = useRef(null);
  const runtime = useRef(null);
  const [deviceId, setDeviceId] = useState('');
  const selected = useRef('');
  const [selectedLink, setSelectedLink] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [startRetry, setStartRetry] = useState(0);
  const [replay, setReplay] = useState(null);
  const [sequence, setSequence] = useState(0);
  const [explanation, setExplanation] = useState('');
  useEffect(() => {
    setExplanation('');
  }, [token, attempt?.id]);
  const [achievements, setAchievements] = useState(null);
  const [destination, setDestination] = useState('');
  const [protocol, setProtocol] = useState('icmp');
  const [port, setPort] = useState(80);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [restartConfirm, setRestartConfirm] = useState(false);
  const [converging, setConverging] = useState(false);
  const sessionMenu = useRef(null);
  const sessionMenuTrigger = useRef(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [secondaryPanel, setSecondaryPanel] = useState(null);
  const [assistantWidth, setAssistantWidth] = useState(null);
  const assistantEnabled = Boolean(
    token && user?.id && !isPreview && !replay && canPractice(attempt)
  );
  const isReplay = Boolean(replay);
  useEffect(() => {
    setSecondaryPanel(null);
  }, [token, attempt?.id, isReplay]);
  const [pulseTaskId, setPulseTaskId] = useState('');
  const [focusedTaskId, setFocusedTaskId] = useState('');
  const drafts = useRef({});
  const [tasksCollapsed, setTasksCollapsed] = useState(false);
  const [terminalShakeKey, setTerminalShakeKey] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [theme, setTheme] = useState('light');
  const requestedTheme = useRef('light');
  const themeTransition = useRef(null);
  useEffect(() => () => themeTransition.current?.(), []);
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
  const selectedTask = useMemo(() => {
    const focused = tasks.find((task) => task.id === focusedTaskId);
    return focused &&
      displayedProgress.checks?.find((check) => check.id === focused.id)?.status !== 'completed'
      ? focused
      : nextTaskForDevice(tasks, displayedProgress, deviceId);
  }, [tasks, focusedTaskId, displayedProgress, deviceId]);
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
    if (latest.current?.id !== nextAttempt.id) drafts.current = {};
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
    startRetry,
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
      if (mounted.current) setConverging(false);
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const action = async (value) => {
    if (!latest.current || replay || !canPractice(latest.current)) return;
    await perform(async () => {
      const current = latest.current;
      if (isPreview) {
        const result = previewAction({ runtime: runtime.current, attempt: current, action: value });
        const gradingSpec = parseObject(preview?.gradingSpec, { checks: [] });
        let next =
          result.result.isError || result.result.help
            ? result.attempt
            : gradePreview({ runtime: runtime.current, attempt: result.attempt, gradingSpec });
        if (!result.result.isError && ['command', 'link'].includes(value.type)) {
          for (let i = 0; i < 2 && needsConvergence(next.state); i++) {
            setConverging(true);
            next = gradePreview({
              runtime: runtime.current,
              attempt: previewAction({
                runtime: runtime.current,
                attempt: next,
                action: { type: 'tick' },
              }).attempt,
              gradingSpec,
            });
          }
        }
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
          lab: result.tasks ? { ...current.lab, tasks: result.tasks } : current.lab,
          commands: result.event?.sequence ? [...current.commands, result.event] : current.commands,
        });
        if (!result.event?.isError && ['command', 'link'].includes(value.type)) {
          for (let i = 0; i < 2 && needsConvergence(latest.current.state); i++) {
            setConverging(true);
            const base = latest.current;
            const tick = await api.cliAction(token, base.id, { type: 'tick' }, base.state.revision);
            accept({
              ...base,
              state: tick.state,
              prompt: tick.prompt,
              progress: tick.progress || base.progress,
              lab: tick.tasks ? { ...base.lab, tasks: tick.tasks } : base.lab,
              commands: tick.event?.sequence ? [...base.commands, tick.event] : base.commands,
            });
          }
        }
      } catch (cause) {
        await refresh();
        throw cause;
      }
    });
  };

  const selectDevice = (id, clearLink = true) => {
    setFocusedTaskId('');
    selected.current = id;
    setDeviceId(id);
    if (clearLink) setSelectedLink('');
    setHintOpen(false);
  };

  const selectLink = (link) => {
    setSelectedLink(link.id);
    if (!selected.current) selectDevice(link.a.deviceId, false);
  };

  const focusTask = (task) => {
    if (task.deviceId && displayed?.devices?.[task.deviceId]) selectDevice(task.deviceId);
    setFocusedTaskId(task.id);
    setHintOpen(true);
  };

  const toggleSelectedLink = () => {
    const link = latest.current?.state?.links?.find((entry) => entry.id === selectedLink);
    if (!link || replay || !canPractice(latest.current) || busyRef.current) return;
    action({ type: 'link', linkId: link.id, enabled: link.enabled === false });
  };

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
    if (event.action && event.action.type !== 'command') return false;
    const eventDevice = event.action?.deviceId;
    const first = firstDeviceId(displayed?.devices);
    return (
      (!displayed?.devices || eventDevice === deviceId || (!eventDevice && deviceId === first)) &&
      (!replay || event.sequence <= replay.sequence)
    );
  });
  const editable = canPractice(attempt) && !replay && !busy;
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
    if (event.target.closest('.ui-dialog')) return;
    if (event.key === 'Escape') {
      event.stopPropagation();
      if (showOnboarding) {
        dismissOnboarding();
      } else if (secondaryPanel) {
        setSecondaryPanel(null);
      } else if (sessionMenu.current?.open) {
        sessionMenu.current.open = false;
      } else if (!page) {
        onClose();
      }
      return;
    }
    if ((page && !showOnboarding) || event.key !== 'Tab' || event.target.closest('.cli-xterm-host'))
      return;
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
        !node.closest('[inert]') &&
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
    if (
      event.target.closest(
        '[data-ai-panel], .ui-dialog, [role="combobox"][aria-expanded="true"], [role="listbox"]'
      )
    )
      return;
    if (event.key === 'Escape') closeOnEscape(event);
  };

  const sessionControls = attempt ? (
    <div className="cli-lab-header-tools">
      <span
        className={`cli-lab-save-state ${busy || converging ? 'is-busy' : error ? 'is-error' : ''}`}
        role="status"
      >
        <span className="cli-lab-save-indicator" aria-hidden="true" />
        {isPreview
          ? 'Bản xem trước'
          : converging
            ? 'Mạng đang hội tụ…'
            : busy
              ? 'Đang lưu…'
              : replay
                ? 'Đang xem lại · chỉ đọc'
                : error
                  ? 'Chưa đồng bộ'
                  : 'Đã lưu'}
      </span>
      {!isPreview && (
        <>
          <button
            type="button"
            className="cli-lab-session-button cli-lab-button cli-lab-button--tertiary"
            aria-label="Thành tích"
            onClick={openAchievements}
            aria-expanded={secondaryPanel === 'achievements'}
          >
            <Trophy size={15} aria-hidden="true" />
            <span className="cli-lab-action-label">Thành tích</span>
          </button>
          <button
            type="button"
            className="cli-lab-session-button cli-lab-button cli-lab-button--secondary"
            disabled={!assistantEnabled}
            onClick={() =>
              setSecondaryPanel((value) => (value === 'assistant' ? null : 'assistant'))
            }
            aria-expanded={secondaryPanel === 'assistant'}
          >
            <Sparkles size={14} aria-hidden="true" /> Trợ lý AI
          </button>
        </>
      )}
      <details className="cli-lab-menu" ref={sessionMenu}>
        <summary ref={sessionMenuTrigger} aria-label="Tùy chọn bài thực hành">
          <MoreHorizontal size={20} />
        </summary>
        <div className="cli-lab-menu-items">
          {!isPreview && (
            <>
              <small>Mã phiên khi báo lỗi</small>
              <div className="cli-lab-session-code">
                <code>{attempt.id}</code>
                <AnimatedCopyButton
                  value={attempt.id}
                  label="Chép mã phiên"
                  onError={setError}
                  onCopied={() => setError((current) => (current === COPY_ERROR ? '' : current))}
                />
              </div>
            </>
          )}
          <label>
            <input
              type="checkbox"
              checked={debugMode}
              onChange={(e) => setDebugMode(e.target.checked)}
            />{' '}
            Gỡ lỗi mô phỏng
          </label>
          {debugMode && (
            <button disabled={!editable} onClick={() => action({ type: 'tick' })}>
              Tiến một nhịp mô phỏng
            </button>
          )}
          {!isPreview && attempt.status === 'IN_PROGRESS' && attempt.isOwner && (
            <button
              className="cli-lab-menu-danger"
              disabled={busy}
              onClick={() => {
                sessionMenu.current.open = false;
                setRestartConfirm(true);
              }}
            >
              Làm lại từ đầu
            </button>
          )}
        </div>
      </details>
      {isPreview && (
        <span className="cli-lab-live-tag">
          <LockKeyhole size={13} /> Thay đổi chỉ dùng để xem trước
        </span>
      )}
    </div>
  ) : null;

  return (
    <div
      ref={dialog}
      tabIndex={-1}
      data-theme={theme}
      className={`cli-workspace-overlay cli-lab-theme cli-lab-stitch cli-lab-stitch--${theme} ${page ? 'cli-lab-page' : ''} ${isPreview ? 'cli-lab-preview-mode' : ''}`}
      role={page ? 'region' : 'dialog'}
      aria-modal={page ? undefined : true}
      aria-label="Phòng thực hành mạng"
      onKeyDownCapture={captureEscape}
      onKeyDown={closeOnEscape}
    >
      <div className="cli-mobile-fallback">
        <div className="cli-mobile-fallback-card">
          <div className="cli-mobile-fallback-icon">
            <Laptop size={36} />
          </div>
          <h3>Thực hành CLI trên máy tính</h3>
          <p>
            Môi trường thực hành mô phỏng mạng Cisco yêu cầu màn hình rộng và bàn phím máy tính.
          </p>
          {!isPreview && (
            <button
              className="cli-mobile-fallback-btn"
              disabled={!assistantEnabled}
              onClick={() => setSecondaryPanel('assistant')}
            >
              Mở trợ lý AI
            </button>
          )}
          <button className="cli-mobile-fallback-btn" onClick={onClose}>
            Về danh sách lab
          </button>
        </div>
      </div>

      <div className="cli-workspace network-workspace cli-lab-surface">
        <header className="cli-workspace-header cli-lab-header">
          {page && (
            <button className="cli-lab-back" onClick={onClose} aria-label="Danh sách lab">
              <ArrowLeft size={16} aria-hidden="true" /> <span>Danh sách lab</span>
            </button>
          )}
          <div className="cli-lab-heading">
            <span className="cli-workspace-kicker">PHÒNG THỰC HÀNH MẠNG</span>
            {page ? (
              <h1>{attempt?.lab.title || lab.title || 'Thực hành CLI'}</h1>
            ) : (
              <h2>{attempt?.lab.title || lab.title || 'Thực hành CLI'}</h2>
            )}
          </div>
          {sessionControls}
          {attempt && (
            <button
              className="cli-submit-lab-btn cli-lab-submit cli-lab-button cli-lab-button--primary"
              disabled={!editable || (!isPreview && !attempt.isOwner)}
              onClick={submit}
            >
              <Check size={16} aria-hidden="true" />
              {isPreview ? 'Chấm thử bản nháp' : 'Chấm bài'}
            </button>
          )}
          {isPreview && (
            <span className="cli-lab-preview-badge">
              <EyeIcon /> {previewLabel}
            </span>
          )}
          {!isPreview && (
            <button
              type="button"
              className="cli-lab-help-button"
              aria-label="Hướng dẫn thực hành"
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
            aria-pressed={theme === 'dark'}
            onClick={(event) => {
              const next = requestedTheme.current === 'dark' ? 'light' : 'dark';
              requestedTheme.current = next;
              themeTransition.current = runThemeTransition(() => setTheme(next), event, next);
            }}
            aria-label={
              theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'
            }
          >
            {theme === 'dark' ? (
              <Sun size={18} aria-hidden="true" />
            ) : (
              <Moon size={18} aria-hidden="true" />
            )}
          </button>
          {!page && (
            <button type="button" className="cli-lab-close" onClick={onClose} aria-label="Đóng">
              <X size={18} />
            </button>
          )}
        </header>

        {error && attempt && (
          <div role="alert" className="cli-workspace-error cli-lab-error">
            {error}
          </div>
        )}

        {!attempt ? (
          error ? (
            <div role="alert" className="cli-lab-loading">
              <p>{error}</p>
              <button
                type="button"
                className="cli-lab-session-button"
                onClick={() => {
                  setError('');
                  setStartRetry((value) => value + 1);
                }}
              >
                Thử mở lại phiên
              </button>
            </div>
          ) : (
            <p className="cli-lab-loading">
              {isPreview ? 'Đang tải mô phỏng xem trước…' : 'Đang mở phiên thực hành…'}
            </p>
          )
        ) : (
          <>
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

            <div
              className={`cli-workspace-body cli-lab-body${secondaryPanel === 'assistant' && assistantEnabled ? ' has-ai-assistant' : ''}`}
              style={assistantWidth ? { '--ai-lab-panel-width': `${assistantWidth}px` } : undefined}
            >
              {secondaryPanel === 'assistant' && assistantEnabled && (
                <AssistantLoader
                  load={loadAssistant}
                  Dialog={Dialog}
                  theme={theme}
                  onClose={() => setSecondaryPanel(null)}
                >
                  {(AiLabAssistant) => (
                    <AiLabAssistant
                      key={`${token}:${attempt.id}`}
                      token={token}
                      userId={user.id}
                      attemptId={attempt.id}
                      revision={attempt.state?.revision ?? 0}
                      theme={theme}
                      devices={deviceEntries(attempt.state?.devices).map(([id, device]) => ({
                        id,
                        name: device.hostname || id,
                      }))}
                      selectedDeviceId={deviceId}
                      onWidthChange={setAssistantWidth}
                      taskId={selectedTask?.id}
                      taskDeviceId={selectedTask?.deviceId}
                      taskTitle={selectedTask?.title}
                      onSelectDevice={(id) => {
                        if (Object.hasOwn(attempt.state?.devices || {}, id)) selectDevice(id);
                      }}
                      onClose={() => setSecondaryPanel(null)}
                    />
                  )}
                </AssistantLoader>
              )}
              <section
                className="cli-terminal-pane cli-lab-terminal-pane"
                ref={terminalSize.pane}
                style={{ '--cli-terminal-height': `${terminalSize.height}px` }}
              >
                {displayed?.devices && (
                  <>
                    <div className="cli-lab-topology-head">
                      <strong>
                        <Network size={15} aria-hidden="true" /> Sơ đồ mạng
                        <span className="cli-topology-meta">
                          {deviceEntries(displayed.devices).length} thiết bị
                        </span>
                      </strong>
                      <div
                        className="cli-lab-experiments"
                        data-tour-target="advanced"
                        data-testid="network-experiments"
                      >
                        <button
                          type="button"
                          className="cli-lab-button cli-lab-button--secondary"
                          aria-expanded={advancedOpen}
                          disabled={!editable}
                          onClick={() => setAdvancedOpen((v) => !v)}
                        >
                          <Radio size={14} aria-hidden="true" /> Ping thử
                        </button>
                        <button
                          type="button"
                          className="cli-lab-button cli-lab-button--secondary"
                          disabled={!editable || !selectedLink}
                          onClick={toggleSelectedLink}
                          title={
                            selectedLink
                              ? 'Ngắt hoặc nối lại dây đã chọn'
                              : 'Chọn một dây trên sơ đồ trước'
                          }
                        >
                          <Link2 size={14} aria-hidden="true" />
                          {displayed.links?.find((l) => l.id === selectedLink)?.enabled === false
                            ? 'Nối lại dây'
                            : 'Ngắt dây'}
                        </button>
                      </div>
                    </div>
                    <div
                      className={`cli-lab-topology-stage ${tourStepId === 'topology' ? 'is-tour-target' : ''}`}
                      data-tour-target="topology"
                      role="region"
                      aria-label="Thiết bị và liên kết mạng"
                      tabIndex={0}
                    >
                      <NetworkTopology
                        key={attempt.id}
                        fit
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
                    {advancedOpen && (
                      <form
                        className="cli-lab-ping-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          action({
                            type: 'probe',
                            deviceId,
                            destination,
                            protocol,
                            dstPort: protocol === 'icmp' ? 0 : port,
                          });
                        }}
                      >
                        <label>
                          IP đích
                          <input
                            required
                            aria-label="IP đích"
                            placeholder="192.168.1.1"
                            value={destination}
                            onChange={(e) => setDestination(e.target.value)}
                          />
                        </label>
                        <button disabled={!editable || !destination} type="submit">
                          {protocol === 'icmp' ? 'Ping' : `Kiểm tra ${protocol.toUpperCase()}`}
                        </button>
                        <details>
                          <summary>Tùy chọn TCP/UDP</summary>
                          <div className="cli-lab-probe-options">
                            <label>
                              Giao thức
                              <DropdownSelect
                                aria-label="Giao thức thử nghiệm"
                                value={protocol}
                                onChange={(e) => setProtocol(e.target.value)}
                              >
                                {['icmp', 'tcp', 'udp'].map((v) => (
                                  <option key={v} value={v}>
                                    {v.toUpperCase()}
                                  </option>
                                ))}
                              </DropdownSelect>
                            </label>
                            {protocol !== 'icmp' && (
                              <label>
                                Cổng đích
                                <input
                                  aria-label="Cổng đích"
                                  type="number"
                                  min="0"
                                  max="65535"
                                  value={port}
                                  onChange={(e) => setPort(Number(e.target.value))}
                                />
                              </label>
                            )}
                          </div>
                        </details>
                      </form>
                    )}
                  </>
                )}

                <div className="cli-terminal-resizer" {...terminalSize.separator}>
                  <span />
                </div>
                <div className="cli-lab-terminal-toolbar">
                  <span className="cli-lab-terminal-label">
                    <Terminal size={14} aria-hidden="true" /> Terminal
                  </span>
                  <SlidingTabs
                    value={deviceId}
                    className="cli-lab-device-tabs"
                    role="group"
                    aria-label="Chọn thiết bị terminal"
                  >
                    {deviceEntries(displayed?.devices).map(([id]) => (
                      <button
                        type="button"
                        key={id}
                        aria-label={`Mở terminal ${id}`}
                        aria-pressed={deviceId === id}
                        onClick={() => selectDevice(id)}
                      >
                        {id}
                      </button>
                    ))}
                  </SlidingTabs>
                  {replay && (
                    <span className="cli-lab-readonly">
                      <LockKeyhole size={12} aria-hidden="true" /> Chỉ đọc
                    </span>
                  )}
                </div>

                <div
                  className={`cli-lab-terminal-frame ${terminalShakeKey ? 'is-shaking' : ''} ${tourStepId === 'terminal' ? 'is-tour-target' : ''}`}
                  data-tour-target="terminal"
                >
                  <CliTerminal
                    theme={theme}
                    key={`${deviceId}-${attempt.id}-${Boolean(replay)}`}
                    prompt={devicePrompt}
                    history={history}
                    disabled={!editable}
                    initialDraft={drafts.current[deviceId] || ''}
                    onDraftChange={(value) => {
                      drafts.current[deviceId] = value;
                    }}
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

                {!isPreview && Boolean(attempt.commands?.length) && (
                  <details className="cli-lab-review">
                    <summary>
                      <History size={16} /> Lịch sử thao tác
                    </summary>
                    <div className="cli-lab-replay-bar">
                      <p className="cli-lab-replay-help">
                        Chọn mốc để xem trạng thái lab sau thao tác đó.
                      </p>
                      <label>
                        Mốc thao tác {sequence}/{attempt.commands?.length || 0}
                        <input
                          aria-label="Thao tác xem lại"
                          type="range"
                          min="0"
                          max={attempt.commands?.length || 0}
                          value={sequence}
                          disabled={busy || isPreview}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            setSequence(value);
                          }}
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
                        Xem trạng thái
                      </button>
                      <button disabled={!replay || busy} onClick={() => setReplay(null)}>
                        Quay lại hiện tại
                      </button>
                    </div>
                  </details>
                )}
              </section>

              <aside
                className={`cli-task-pane cli-lab-task-pane${tasksCollapsed && secondaryPanel === 'assistant' ? ' is-collapsed' : ''}`}
              >
                {secondaryPanel === 'assistant' && (
                  <button
                    type="button"
                    className="cli-task-collapse"
                    aria-expanded={!tasksCollapsed}
                    onClick={() => setTasksCollapsed((value) => !value)}
                  >
                    {tasksCollapsed ? 'Mở mục tiêu' : 'Thu gọn mục tiêu'}
                  </button>
                )}
                <div className="cli-task-scroll cli-lab-task-scroll">
                  <section className="cli-lab-objective">
                    <LabDisclosure
                      summary={<h3 className="cli-lab-section-title">Đề bài và hướng dẫn</h3>}
                      aria-label="Yêu cầu bài thực hành"
                      key={attempt.id}
                      defaultOpen
                    >
                      <p>{attempt.lab.objective || 'Hoàn thành các yêu cầu cấu hình.'}</p>
                      {attempt.lab.guideFormat === 'markdown' && (
                        <MarkdownRenderer content={attempt.lab.guideContent} />
                      )}
                    </LabDisclosure>
                  </section>
                  <div className="cli-lab-hint-bar" role="status">
                    <div className="cli-lab-hint-icon">
                      <Lightbulb size={16} />
                    </div>
                    <div className="cli-lab-hint-copy">
                      <span>
                        Việc tiếp theo{' '}
                        {selectedTask?.deviceId && (
                          <button
                            type="button"
                            className="cli-task-device-chip"
                            onClick={() => focusTask(selectedTask)}
                            aria-label={`Chuyển đến ${selectedTask.deviceId}`}
                          >
                            <Network size={12} aria-hidden="true" />
                            {selectedTask.deviceId}
                          </button>
                        )}
                      </span>
                      <strong>
                        {selectedTask?.title || 'Các mục tiêu hiện tại đã hoàn thành'}
                      </strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHintOpen((open) => !open)}
                      aria-expanded={hintOpen}
                    >
                      {hintOpen ? 'Ẩn gợi ý' : 'Xem gợi ý'}
                    </button>
                    {hintOpen && (
                      <div className="cli-lab-hint-expanded">
                        {selectedTask?.hintCount ? (
                          <>
                            {(selectedTask.hints || []).map((hint, i) => (
                              <p key={i}>{hint}</p>
                            ))}
                            {(selectedTask.hints?.length || 0) < selectedTask.hintCount && (
                              <button
                                type="button"
                                disabled={!editable}
                                onClick={() =>
                                  action({
                                    type: 'hint',
                                    checkId: selectedTask.id,
                                    deviceId: selectedTask.deviceId,
                                    level: (selectedTask.hints?.length || 0) + 1,
                                  })
                                }
                              >
                                Mở gợi ý {(selectedTask.hints?.length || 0) + 1}/
                                {selectedTask.hintCount}
                              </button>
                            )}
                          </>
                        ) : (
                          selectedTask?.hint || hintText
                        )}
                        {!isPreview && (
                          <button
                            type="button"
                            disabled={!assistantEnabled}
                            onClick={() => setSecondaryPanel('assistant')}
                          >
                            Hỏi trợ lý
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <section
                    className={`cli-lab-checklist-section ${tourStepId === 'tasks' ? 'is-tour-target' : ''}`}
                    data-tour-target="tasks"
                  >
                    <div className="cli-lab-section-heading">
                      <h3>Mục tiêu</h3>
                      <span>
                        {displayedProgress.completed}/{displayedProgress.total}
                      </span>
                    </div>
                    <div
                      className="cli-lab-checklist-progress"
                      role="progressbar"
                      aria-label="Tiến độ bài thực hành"
                      aria-valuemin={0}
                      aria-valuemax={displayedProgress.total || 1}
                      aria-valuenow={displayedProgress.completed}
                    >
                      <span
                        style={{
                          width: `${displayedProgress.total ? Math.min(100, (displayedProgress.completed / displayedProgress.total) * 100) : 0}%`,
                        }}
                      />
                    </div>
                    {attempt.lab.steps?.length > 0 && (
                      <details className="cli-lab-stages">
                        <summary>
                          <h3 className="cli-lab-section-title">Các giai đoạn và lệnh mẫu</h3>
                          <span className="cli-lab-stage-preview">
                            {normalizeSteps(attempt.lab.steps).length} giai đoạn ·{' '}
                            {normalizeSteps(attempt.lab.steps)[0]?.title}
                          </span>
                        </summary>
                        {normalizeSteps(attempt.lab.steps).map((stage, index) => (
                          <details key={stage.id || index}>
                            <summary>{stage.title}</summary>
                            {stage.note && <p>{stage.note}</p>}
                            {stage.commands.map((entry, i) => (
                              <div key={i} className="cli-lab-stage-command">
                                <span>{entry.deviceId || 'CLI'}</span> <code>{entry.command}</code>
                                <AnimatedCopyButton
                                  value={entry.command}
                                  label={`Chép lệnh ${entry.deviceId || ''} ${entry.command}`}
                                  onError={setError}
                                  onCopied={() =>
                                    setError((current) => (current === COPY_ERROR ? '' : current))
                                  }
                                />
                              </div>
                            ))}
                          </details>
                        ))}
                      </details>
                    )}
                    <LabObjectives
                      tasks={tasks}
                      progress={displayedProgress}
                      selectedTaskId={selectedTask?.id}
                      onSelect={focusTask}
                      graded={Boolean(attempt.feedback)}
                    />
                  </section>

                  {attempt.feedback && (
                    <section className="cli-lab-feedback">
                      <div className="cli-lab-section-heading">
                        <h3>{attempt.feedback.score ?? attempt.score}/100 điểm</h3>
                        <Sparkles size={16} />
                      </div>
                      <p>Điểm đạt: {attempt.lab.passingScore ?? 70}/100</p>
                      {attempt.features?.mastery && (
                        <p>
                          {attempt.status === 'MASTERED'
                            ? 'Thành thạo'
                            : attempt.status === 'PASSED'
                              ? 'Đã đạt'
                              : 'Đang thực hành'}{' '}
                          · Điểm cao nhất: {attempt.bestScore ?? attempt.score ?? 0}/100
                        </p>
                      )}
                      {attempt.feedback.skills && (
                        <ul>
                          {Object.entries(attempt.feedback.skills).map(([skill, value]) => (
                            <li key={skill}>
                              {{
                                configuration: 'Cấu hình',
                                verification: 'Kiểm chứng',
                                observation: 'Quan sát',
                                reasoning: 'Tính toán',
                              }[skill] || skill}
                              : {Math.round((value.awarded / value.points) * 100)}%
                            </li>
                          ))}
                        </ul>
                      )}
                      <Suspense fallback={<p role="status">Đang tải phần giải thích…</p>}>
                        <AiFeedbackExplanation
                          token={token}
                          attempt={attempt}
                          disabled={isPreview || Boolean(replay)}
                        />
                      </Suspense>
                      {isPreview && explanation && (
                        <p className="network-explanation">{explanation}</p>
                      )}
                    </section>
                  )}

                  {displayed?.lastPacket && (
                    <section className="cli-lab-packet">
                      <details>
                        <summary>
                          <Link2 size={14} /> Hành trình gói tin:{' '}
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
                  {debugMode && (
                    <section className="cli-lab-ospf">
                      <details>
                        <summary>
                          <Radio size={14} /> Trạng thái OSPF / STP
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
                  )}
                </div>
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

      {restartConfirm && (
        <Suspense fallback={<p role="status">Đang mở xác nhận…</p>}>
          <LabRestartConfirmation
            theme={theme}
            returnFocusRef={sessionMenuTrigger}
            onCancel={() => setRestartConfirm(false)}
            onConfirm={() => {
              setRestartConfirm(false);
              restart();
            }}
          />
        </Suspense>
      )}
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
