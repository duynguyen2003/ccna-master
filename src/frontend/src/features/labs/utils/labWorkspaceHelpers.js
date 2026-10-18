const STORAGE_KEY = 'ccna.cli-lab.onboarding.v1';

export const noop = () => {};

export const deviceEntries = (devices) => {
  if (Array.isArray(devices)) return devices.map((device) => [device.id, device]);
  return Object.entries(devices || {});
};

export const firstDeviceId = (devices) => deviceEntries(devices)[0]?.[0] || '';

const safeStatus = (value) => {
  if (value === 'completed' || value === 'in_progress' || value === 'not_started') return value;
  return null;
};

const safePassed = (check) => check?.passed === true || check?.status === 'completed';

/**
 * The API deliberately exposes only progress metadata. Older attempts contain
 * feedback checks instead, so this adapter keeps the student UI compatible with
 * both response shapes without ever requiring expected/actual values.
 */
export const normalizeProgress = (attempt) => {
  const tasks = attempt?.lab?.tasks || [];
  const source = attempt?.progress || {};
  const rawChecks = Array.isArray(source.checks)
    ? source.checks
    : Array.isArray(attempt?.feedback?.checks)
      ? attempt.feedback.checks
      : [];
  const byId = new Map(rawChecks.map((check) => [check.id, check]));
  const checks = tasks.map((task) => {
    const check = byId.get(task.id);
    const status = safeStatus(check?.status) || (safePassed(check) ? 'completed' : 'not_started');
    return { id: task.id, status, passed: safePassed(check) };
  });
  rawChecks.forEach((check) => {
    if (!checks.some((item) => item.id === check.id)) {
      checks.push({
        id: check.id,
        status: safeStatus(check.status) || (safePassed(check) ? 'completed' : 'not_started'),
        passed: safePassed(check),
      });
    }
  });
  const total =
    Number.isFinite(Number(source.total)) && Number(source.total) >= 0
      ? Number(source.total)
      : Math.max(tasks.length, checks.length);
  const completed = Number.isFinite(Number(source.completed))
    ? Number(source.completed)
    : checks.filter((check) => check.status === 'completed' || check.passed).length;
  const nextTaskId =
    source.nextTaskId ||
    checks.find((check) => check.status !== 'completed' && !check.passed)?.id ||
    null;
  const withCurrent = checks.map((check) =>
    check.id === nextTaskId && check.status !== 'completed'
      ? { ...check, status: 'in_progress' }
      : check
  );
  return { completed, total, checks: withCurrent, nextTaskId };
};

export const progressForTasks = (tasks, checks = []) => {
  const byId = new Map(checks.map((check) => [check.id, check]));
  const normalized = tasks.map((task) => {
    const check = byId.get(task.id);
    return {
      ...task,
      status: safeStatus(check?.status) || (safePassed(check) ? 'completed' : 'not_started'),
      passed: safePassed(check),
    };
  });
  const completed = normalized.filter((task) => task.status === 'completed' || task.passed).length;
  const firstUnfinished = normalized.find((task) => task.status !== 'completed' && !task.passed);
  const withCurrent = normalized.map((task) =>
    task.id === firstUnfinished?.id && task.status !== 'completed'
      ? { ...task, status: 'in_progress' }
      : task
  );
  return {
    completed,
    total: withCurrent.length,
    checks: withCurrent.map(({ id, status, passed }) => ({ id, status, passed })),
    nextTaskId: firstUnfinished?.id || null,
  };
};

export const taskStatus = (task, progress) => {
  const check = progress?.checks?.find((item) => item.id === task.id);
  if (progress?.nextTaskId === task.id) return 'in_progress';
  if (check?.status) return check.status;
  if (check?.passed) return 'completed';
  return 'not_started';
};

export const nextTaskForDevice = (tasks, progress, selectedDeviceId) => {
  const unfinished = tasks.filter((task) => taskStatus(task, progress) !== 'completed');
  return (
    unfinished.find((task) => task.deviceId && task.deviceId === selectedDeviceId) ||
    unfinished.find((task) => taskStatus(task, progress) === 'in_progress') ||
    unfinished[0] ||
    null
  );
};

export const deriveActionHint = (task, device, state) => {
  if (!task) return 'Chọn một nhiệm vụ để xem bước tiếp theo.';
  if (task.deviceId && task.deviceId !== device?.id && task.deviceId !== device?.deviceId) {
    return `Chọn ${task.deviceId} trên topology để tiếp tục nhiệm vụ này.`;
  }
  const interfaceName = task.interface || 'cổng được yêu cầu';
  const currentInterface = task.interface && device?.interfaces?.[task.interface];
  const mode = device?.mode
    ? ` (đang ở chế độ ${String(device.mode).replace(/_/g, ' ').toLowerCase()})`
    : '';
  switch (task.type) {
    case 'interface_ip_equals':
      return `Gán địa chỉ IP cho ${interfaceName} trên ${device?.hostname || task.deviceId || 'thiết bị'}${mode} rồi kiểm tra lại cấu hình.`;
    case 'interface_enabled':
      return `Mở ${interfaceName} trên ${device?.hostname || task.deviceId || 'thiết bị'}${mode} bằng lệnh no shutdown.`;
    case 'interface_exists':
      return `Chuyển tới ${interfaceName} trên ${device?.hostname || task.deviceId || 'thiết bị'} để xác nhận cổng tồn tại.`;
    case 'reachable':
    case 'route_exists':
      return `Kiểm tra interface đang hoạt động và bảng định tuyến trên ${device?.hostname || task.deviceId || 'thiết bị'}, sau đó thử kiểm tra kết nối.`;
    case 'ospf_neighbor_full':
      return `Kiểm tra cấu hình OSPF trên ${device?.hostname || task.deviceId || 'thiết bị'} và chờ láng giềng hội tụ.`;
    case 'stp_root':
      return 'Kiểm tra VLAN và thứ tự ưu tiên STP trên các switch trong topology.';
    case 'hostname_equals':
      return `Đặt hostname cho ${device?.hostname || task.deviceId || 'thiết bị'} theo yêu cầu của bài lab.`;
    case 'startup_config_saved':
      return 'Lưu cấu hình đang chạy vào startup-config trước khi chuyển sang nhiệm vụ tiếp theo.';
    default:
      return currentInterface?.shutdown
        ? `Cổng ${interfaceName} đang tắt; kiểm tra trạng thái trước khi tiếp tục.`
        : `Thực hiện nhiệm vụ “${task.title || task.id}” trên ${device?.hostname || task.deviceId || 'thiết bị'}.`;
  }
};

export const readOnboardingState = () => {
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return { dismissed: false };
    const parsed = JSON.parse(raw);
    return { dismissed: parsed?.dismissed === true };
  } catch {
    return { dismissed: false };
  }
};

export const writeOnboardingState = (dismissed) => {
  try {
    window.localStorage?.setItem(
      STORAGE_KEY,
      JSON.stringify({ dismissed: Boolean(dismissed), updatedAt: Date.now() })
    );
  } catch {
    // Storage can be disabled in private browsing or test environments.
  }
};

export const packetAnimationKey = (packet, command) => {
  if (!packet) return '';
  const eventKey = (packet.events || [])
    .map((event) =>
      [
        event.type,
        event.deviceId,
        event.from?.deviceId,
        event.to?.deviceId,
        event.packet?.ttl,
      ].join(':')
    )
    .join('|');
  return `${command?.sequence || ''}:${command?.action?.type || ''}:${command?.command || ''}:${eventKey}`;
};

export const safeTaskFromCheck = (check, index) => ({
  id: check?.id || `check-${index + 1}`,
  title: check?.title || check?.id || `Nhiệm vụ ${index + 1}`,
  points: Number(check?.points) || 0,
  hint: check?.hint || '',
  deviceId: check?.deviceId || '',
  type: check?.type || '',
  interface: check?.interface || '',
});

export const stripGradeCheck = (check) => ({
  id: check.id,
  status: check.passed ? 'completed' : 'not_started',
  passed: Boolean(check.passed),
});
