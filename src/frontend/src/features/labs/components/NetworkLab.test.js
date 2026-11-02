import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import TopologyEditor from '../../admin/components/labs/TopologyEditor';
import CliLabWorkspace from './CliLabWorkspace';
import NetworkTopology from './NetworkTopology';
import { api } from '../../../services/Api';
import { useAuth } from '../../../context/AuthContext';
import { networkTemplate } from '../data/networkLabTemplates';
import { gsap } from '../utils/labMotion';
jest.mock('../../../components/common/MarkdownRenderer', () => ({
  __esModule: true,
  default: ({ content }) => <div>{content}</div>,
}));
jest.mock('../../../context/AuthContext', () => ({ useAuth: jest.fn(() => ({ token: 'test' })) }));
jest.mock('@ccna/agent-ui/loader', () => ({
  __esModule: true,
  default: ({ children }) => children(() => <div>Trợ lý đã mở</div>),
}));
jest.mock('../../../services/Api', () => ({
  api: {
    startCliLabAttempt: jest.fn(),
    restartCliLabAttempt: jest.fn(),
    cliAchievements: jest.fn(),
    cliReplay: jest.fn(),
    cliAction: jest.fn(),
    cliExplain: jest.fn(),
    getCliLabAttempt: jest.fn(),
    getCliLabCompletions: jest.fn(),
  },
}));
jest.mock('./CliTerminal', () => ({
  __esModule: true,
  default: ({ disabled, prompt, onCommand }) => (
    <button disabled={disabled} onClick={() => onCommand('enable')}>
      Terminal {prompt}
    </button>
  ),
}));
const example = () => ({
  id: 'test-attempt',
  labId: 1,
  isOwner: true,
  members: [],
  status: 'IN_PROGRESS',
  commands: [],
  state: {
    revision: 0,
    tick: 0,
    devices: {
      R1: { hostname: 'Router', deviceType: 'ROUTER', mode: 'USER_EXEC', interfaces: {} },
    },
    links: [],
    stp: {},
    ospfNeighbors: {},
  },
  lab: { title: 'Network lab', tasks: [], objective: 'Practice routing' },
});
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
  jest.clearAllMocks();
  useAuth.mockReturnValue({ token: 'test' });
  window.localStorage.removeItem('ccna.cli-lab.onboarding.v1');
  api.startCliLabAttempt.mockResolvedValue(example());
  api.cliAchievements.mockResolvedValue({ points: 0, completed: 0, badges: [], streak: 0 });
});

test('blocked ping identifies its prerequisite by title', async () => {
  api.startCliLabAttempt.mockResolvedValue({
    ...example(),
    lab: {
      title: 'EIGRP',
      tasks: [
        { id: 'ping', title: 'Ping qua EIGRP', points: 8, deviceId: 'R1' },
        { id: 'route', title: 'Học route EIGRP', points: 4, deviceId: 'R1' },
      ],
    },
    progress: {
      completed: 0,
      total: 2,
      nextTaskId: 'route',
      checks: [
        { id: 'ping', status: 'blocked', passed: false, blockedBy: ['route'] },
        { id: 'route', status: 'in_progress', passed: false },
      ],
    },
  });
  render(<CliLabWorkspace lab={{ id: 1 }} />);
  expect(await screen.findByText('Cần hoàn thành trước: Học route EIGRP.')).toBeInTheDocument();
  expect(screen.getByLabelText('Chờ nhiệm vụ trước')).toBeInTheDocument();
});

test('feedback explains with Gemini provenance and renders model text without HTML', async () => {
  api.startCliLabAttempt.mockResolvedValue({
    ...example(),
    score: 0,
    feedback: { checks: [{ passed: false, message: 'Missing route' }] },
  });
  const explanation = '<img src=x alt="model-injected" onerror=alert(1)> Kiểm tra đường về.';
  api.cliExplain.mockResolvedValue({
    explanation,
    provider: 'gemini',
    model: 'gemini-3.5-flash-lite',
  });
  render(<CliLabWorkspace lab={{ id: 1 }} />);
  fireEvent.click(await screen.findByText('Giải thích kết quả'));
  expect(await screen.findByText('Giải thích từ AI')).toBeInTheDocument();
  expect(screen.getByText(explanation)).toBeInTheDocument();
  expect(screen.queryByRole('img', { name: 'model-injected' })).not.toBeInTheDocument();
  expect(api.cliExplain).toHaveBeenCalledWith(
    'test',
    'test-attempt',
    expect.objectContaining({ signal: expect.anything() })
  );
});

test('feedback provider errors never produce a synthetic explanation', async () => {
  api.startCliLabAttempt.mockResolvedValue({
    ...example(),
    score: 0,
    feedback: { checks: [{ passed: false, message: 'Missing route' }] },
  });
  api.cliExplain.mockRejectedValue(new Error('Trợ lý AI chưa khả dụng. Hãy thử lại sau.'));
  render(<CliLabWorkspace lab={{ id: 1 }} />);
  fireEvent.click(await screen.findByText('Giải thích kết quả'));
  expect(
    await screen.findByText('Không kết nối được AI. Kiểm tra mạng rồi thử lại.')
  ).toBeInTheDocument();
  expect(screen.queryByText(/đang dùng gợi ý có sẵn/)).not.toBeInTheDocument();
  expect(screen.queryByText('Gemini · gemini-3.5-flash-lite')).not.toBeInTheDocument();
});
test('admin topology editor adds/removes nodes and synchronizes JSON', () => {
  let current;
  function Editor() {
    const [value, setValue] = useState(JSON.stringify(networkTemplate));
    current = JSON.parse(value);
    return <TopologyEditor value={value} onChange={setValue} />;
  }
  render(<Editor />);
  fireEvent.click(screen.getByText('Thêm thiết bị'));
  expect(current.devices).toHaveLength(5);
  fireEvent.click(screen.getByRole('button', { name: 'Chọn ROUTER1' }));
  fireEvent.click(screen.getByText('Xóa thiết bị đã chọn'));
  expect(current.devices).toHaveLength(4);
});

test('waiting for AI explanation does not lock the terminal', async () => {
  let resolve;
  const pending = new Promise((done) => {
    resolve = done;
  });
  api.startCliLabAttempt.mockResolvedValue({
    ...example(),
    feedback: { checks: [{ passed: false, message: 'Missing route' }] },
  });
  api.cliExplain.mockReturnValue(pending);
  render(<CliLabWorkspace lab={{ id: 1 }} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Giải thích kết quả' }));
  expect(screen.getByRole('button', { name: 'Đang giải thích…' })).toHaveAttribute(
    'aria-busy',
    'true'
  );
  expect(screen.getByRole('button', { name: /Terminal Router/ })).toBeEnabled();
  resolve({ provider: 'gemini', explanation: 'Kiểm tra đường về.' });
  await screen.findByText('Kiểm tra đường về.');
});
test('topology editor reports incomplete JSON instead of crashing', () => {
  render(
    <TopologyEditor
      value={JSON.stringify({ devices: [{ id: 'R1' }] })}
      onChange={jest.fn()}
      onTemplate={jest.fn()}
    />
  );
  expect(screen.getByRole('alert')).toHaveTextContent('interfaces');
});
test('topology supports keyboard device selection and shows disabled link', () => {
  const onSelect = jest.fn();
  const links = networkTemplate.links.map((l) => ({ ...l, enabled: false }));
  render(
    <NetworkTopology devices={networkTemplate.devices} links={links} onSelect={onSelect} disabled />
  );
  const node = screen.getByRole('button', { name: 'Chọn R1' });
  expect(node).toBeEnabled();
  fireEvent.keyDown(node, { key: 'Enter' });
  expect(onSelect).toHaveBeenCalledWith('R1');
  expect(screen.getAllByTestId('link-down')).toHaveLength(3);
});

test('fitted topology keeps device names unique and uses addressing from either cable endpoint', () => {
  render(
    <NetworkTopology
      fit
      devices={[
        { id: 'R1', hostname: 'R1', deviceType: 'ROUTER', interfaces: [] },
        {
          id: 'R2',
          hostname: 'Edge',
          deviceType: 'ROUTER',
          interfaces: [
            { name: 'GigabitEthernet1/12', ipAddress: '192.1.12.2', subnetMask: '255.255.255.0' },
          ],
        },
      ]}
      links={[
        {
          id: 'R1-R2',
          a: { deviceId: 'R1', interface: 'GigabitEthernet1/12' },
          b: { deviceId: 'R2', interface: 'GigabitEthernet1/12' },
        },
      ]}
      onSelect={jest.fn()}
    />
  );
  const diagram = within(screen.getByRole('group', { name: 'Sơ đồ mạng' }));
  expect(diagram.getAllByText('R1')).toHaveLength(1);
  expect(diagram.getByText('Edge')).toBeInTheDocument();
  expect(diagram.getByText('192.1.12.0/24')).toBeInTheDocument();
});

test('shutdown in array-shaped interfaces announces a disconnected cable without relying on color', () => {
  render(
    <NetworkTopology
      devices={[
        { id: 'R1', interfaces: [{ name: 'Gi0/0', shutdown: true }] },
        { id: 'R2', interfaces: [] },
      ]}
      links={[
        {
          id: 'L1',
          a: { deviceId: 'R1', interface: 'Gi0/0' },
          b: { deviceId: 'R2', interface: 'Gi0/0' },
        },
      ]}
      onLinkSelect={jest.fn()}
    />
  );
  expect(screen.getByTestId('link-down')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Chọn dây L1.*Đã ngắt/ })).toBeInTheDocument();
  expect(screen.getByText('Đã ngắt')).toBeInTheDocument();
});

test('reduced motion leaves device selection and packet feedback static', () => {
  const previous = window.matchMedia;
  window.matchMedia = jest.fn(() => ({ matches: true }));
  const tween = jest.spyOn(gsap, 'fromTo');
  const timeline = jest.spyOn(gsap, 'timeline');
  try {
    render(
      <NetworkTopology
        devices={networkTemplate.devices}
        links={networkTemplate.links}
        selected="R1"
        packet={{ events: [{ type: 'FRAME', from: { deviceId: 'PC1' }, to: { deviceId: 'R1' } }] }}
      />
    );
    expect(tween).not.toHaveBeenCalled();
    expect(timeline).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Chọn R1' })).toHaveAttribute('aria-pressed', 'true');
  } finally {
    window.matchMedia = previous;
    tween.mockRestore();
    timeline.mockRestore();
  }
});

test('terminal device shortcuts follow topology selection without executing configuration', async () => {
  const attempt = example();
  attempt.state.devices.R2 = {
    hostname: 'R2',
    deviceType: 'ROUTER',
    mode: 'USER_EXEC',
    interfaces: {},
  };
  api.startCliLabAttempt.mockResolvedValue(attempt);
  render(<CliLabWorkspace lab={{ id: 1 }} page />);
  fireEvent.click(await screen.findByRole('button', { name: 'Mở terminal R2' }));
  expect(screen.getByRole('button', { name: 'Mở terminal R2' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  expect(screen.getByRole('button', { name: 'Chọn R2' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'Terminal R2>' })).toBeEnabled();
  expect(api.cliAction).not.toHaveBeenCalled();
});
test('workspace commands include device and authoritative revision', async () => {
  const a = example();
  api.cliAction.mockResolvedValue({
    state: { ...a.state, revision: 1 },
    prompt: 'Router#',
    event: { sequence: 1, command: 'enable', action: { type: 'command', deviceId: 'R1' } },
  });
  render(
    <CliLabWorkspace
      lab={{ id: 1 }}
      onNotify={jest.fn()}
      onClose={jest.fn()}
      onPassed={jest.fn()}
    />
  );
  fireEvent.click(await screen.findByText('Terminal Router>'));
  await waitFor(() =>
    expect(api.cliAction).toHaveBeenCalledWith(
      'test',
      'test-attempt',
      { type: 'command', command: 'enable', deviceId: 'R1' },
      0
    )
  );
});

test('transient OSPF convergence records two server ticks and leaves the terminal usable', async () => {
  const a = example();
  ['INIT', 'EXCHANGE', 'FULL'].forEach((state, i) =>
    api.cliAction.mockResolvedValueOnce({
      state: {
        ...a.state,
        revision: i + 1,
        devices: { R1: { ...a.state.devices.R1, mode: 'PRIVILEGED_EXEC' } },
        ospfNeighbors: { peer: { state } },
      },
      prompt: 'Router#',
      event: {
        sequence: i + 1,
        command: i ? '[tick]' : 'enable',
        action: { type: i ? 'tick' : 'command', deviceId: 'R1' },
      },
    })
  );
  render(<CliLabWorkspace lab={{ id: 1 }} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Terminal Router>' }));
  await waitFor(() => expect(api.cliAction).toHaveBeenCalledTimes(3));
  expect(api.cliAction).toHaveBeenNthCalledWith(2, 'test', 'test-attempt', { type: 'tick' }, 1);
  expect(api.cliAction).toHaveBeenNthCalledWith(3, 'test', 'test-attempt', { type: 'tick' }, 2);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Terminal Router#' })).toBeEnabled()
  );
});

test('the practice page stays open on Escape and exposes Back instead of dialog Close', async () => {
  const close = jest.fn();
  render(<CliLabWorkspace page lab={{ id: 1 }} onClose={close} />);
  const page = await screen.findByRole('region', { name: 'Phòng thực hành mạng' });
  await screen.findByRole('button', { name: 'Terminal Router>' });
  fireEvent.keyDown(page, { key: 'Escape' });
  fireEvent.keyDown(page, { key: 'Escape' });
  expect(close).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Đóng', exact: true })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Danh sách lab' }));
  expect(close).toHaveBeenCalledTimes(1);
});
test('empty history has no inactive replay slider', async () => {
  render(<CliLabWorkspace lab={{ id: 1 }} />);
  await screen.findByRole('button', { name: 'Terminal Router>' });
  expect(screen.queryByText('Lịch sử thao tác')).not.toBeInTheDocument();
  expect(screen.queryByRole('slider', { name: 'Thao tác xem lại' })).not.toBeInTheDocument();
});

test('guide starts open, stays open with AI, and preserves a manual collapse across AI toggles', async () => {
  useAuth.mockReturnValue({ token: 'test', user: { id: 1 } });
  render(<CliLabWorkspace lab={{ id: 1 }} />);
  const guide = await screen.findByRole('group', { name: 'Yêu cầu bài thực hành' });
  expect(guide).toHaveAttribute('open');
  expect(within(guide).getByText('Practice routing')).toBeVisible();
  const assistant = screen.getByRole('button', { name: 'Trợ lý AI', exact: true });
  fireEvent.click(assistant);
  await screen.findByText('Trợ lý đã mở');
  expect(guide).toHaveAttribute('open');
  fireEvent.click(within(guide).getByText('Đề bài và hướng dẫn'));
  await waitFor(() => expect(guide).not.toHaveAttribute('open'));
  fireEvent.click(assistant);
  expect(guide).not.toHaveAttribute('open');
  fireEvent.click(assistant);
  await screen.findByText('Trợ lý đã mở');
  expect(guide).not.toHaveAttribute('open');
});

test('replay disables terminal writes and returning live restores controls', async () => {
  const current = example();
  current.state.devices.R1.mode = 'PRIVILEGED_EXEC';
  current.commands = [
    {
      sequence: 1,
      deviceId: 'R1',
      prompt: 'Router>',
      command: 'enable',
      output: '',
      isError: false,
    },
  ];
  api.startCliLabAttempt.mockResolvedValue(current);
  api.cliReplay.mockResolvedValue({ state: example().state, sequence: 0, readOnly: true });
  render(
    <CliLabWorkspace
      lab={{ id: 1 }}
      onNotify={jest.fn()}
      onClose={jest.fn()}
      onPassed={jest.fn()}
    />
  );
  fireEvent.click(await screen.findByText('Lịch sử thao tác'));
  fireEvent.click(screen.getByRole('button', { name: 'Xem trạng thái', exact: true }));
  await waitFor(() => expect(screen.getByText('Quay lại hiện tại')).toBeEnabled());
  expect(screen.getByText('Terminal Router>')).toBeDisabled();
  fireEvent.click(screen.getByText('Quay lại hiện tại'));
  expect(screen.getByText('Terminal Router#')).toBeEnabled();
});
test('owner can restart an in-progress workspace', async () => {
  api.restartCliLabAttempt.mockResolvedValue({ ...example(), id: 'new-attempt' });
  render(
    <CliLabWorkspace
      lab={{ id: 1 }}
      onNotify={jest.fn()}
      onClose={jest.fn()}
      onPassed={jest.fn()}
    />
  );
  await screen.findByText('Terminal Router>');
  fireEvent.click(screen.getByLabelText('Tùy chọn bài thực hành'));
  fireEvent.click(screen.getByText('Làm lại từ đầu'));
  expect(api.restartCliLabAttempt).not.toHaveBeenCalled();
  fireEvent.click(
    within(await screen.findByRole('dialog', { name: 'Làm lại từ đầu?' })).getByRole('button', {
      name: 'Làm lại từ đầu',
    })
  );
  await waitFor(() =>
    expect(api.restartCliLabAttempt).toHaveBeenCalledWith('test', 'test-attempt', 1)
  );
});
test('cancelling restart follows the lab theme and returns focus to the visible menu trigger', async () => {
  render(<CliLabWorkspace lab={{ id: 1 }} page />);
  await screen.findByText('Terminal Router>');
  expect(screen.getByRole('button', { name: 'Chuyển sang giao diện tối' })).toBeInTheDocument();
  const trigger = screen.getByLabelText('Tùy chọn bài thực hành');
  fireEvent.click(trigger);
  fireEvent.click(screen.getByText('Làm lại từ đầu'));
  const confirmation = await screen.findByRole('dialog', { name: 'Làm lại từ đầu?' });
  expect(confirmation).toHaveClass('cli-lab-restart-dialog--light');
  fireEvent.click(within(confirmation).getByRole('button', { name: 'Tiếp tục thực hành' }));
  await waitFor(() => expect(trigger).toHaveFocus());
  expect(api.restartCliLabAttempt).not.toHaveBeenCalled();
});
test('Escape dismisses onboarding first, then closes the workspace once', async () => {
  const close = jest.fn();
  render(
    <CliLabWorkspace lab={{ id: 1 }} onNotify={jest.fn()} onClose={close} onPassed={jest.fn()} />
  );
  await screen.findByRole('region', { name: 'Hướng dẫn bắt đầu' });
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(close).not.toHaveBeenCalled();
  expect(screen.queryByRole('region', { name: 'Hướng dẫn bắt đầu' })).not.toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(close).toHaveBeenCalledTimes(1);
});

test('topology cable click and keyboard activation share the link callback', () => {
  const onLinkSelect = jest.fn();
  render(
    <NetworkTopology
      devices={networkTemplate.devices}
      links={networkTemplate.links}
      onSelect={jest.fn()}
      onLinkSelect={onLinkSelect}
    />
  );
  const cable = screen.getByRole('button', { name: /Chọn dây LAN1/ });
  fireEvent.click(cable);
  fireEvent.keyDown(cable, { key: 'Enter' });
  expect(onLinkSelect).toHaveBeenNthCalledWith(1, networkTemplate.links[0]);
  expect(onLinkSelect).toHaveBeenNthCalledWith(2, networkTemplate.links[0]);
});

test('workspace selects a cable without toggling it until the explicit action button is used', async () => {
  const a = example();
  a.state.devices.R2 = {
    hostname: 'R2',
    deviceType: 'ROUTER',
    mode: 'USER_EXEC',
    interfaces: {},
  };
  a.state.links = [
    {
      id: 'L1',
      enabled: true,
      a: { deviceId: 'R1', interface: 'GigabitEthernet0/0' },
      b: { deviceId: 'R2', interface: 'GigabitEthernet0/0' },
    },
  ];
  api.startCliLabAttempt.mockResolvedValue(a);
  api.cliAction.mockResolvedValue({
    state: { ...a.state, revision: 1, links: [{ ...a.state.links[0], enabled: false }] },
    prompt: 'Router>',
    progress: { completed: 0, total: 0, checks: [] },
    event: { sequence: 1, command: 'link L1 down' },
  });
  render(
    <CliLabWorkspace
      lab={{ id: 1 }}
      onNotify={jest.fn()}
      onClose={jest.fn()}
      onPassed={jest.fn()}
    />
  );
  const cable = await screen.findByRole('button', { name: /Chọn dây L1/ });
  fireEvent.click(cable);
  expect(api.cliAction).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Ngắt dây' }));
  await waitFor(() =>
    expect(api.cliAction).toHaveBeenCalledWith(
      'test',
      'test-attempt',
      { type: 'link', linkId: 'L1', enabled: false },
      0
    )
  );
});

test('workspace offers retry when opening an attempt fails', async () => {
  api.startCliLabAttempt
    .mockRejectedValueOnce(new Error('Máy chủ Lab chưa sẵn sàng'))
    .mockResolvedValueOnce(example());
  render(
    <CliLabWorkspace
      lab={{ id: 1 }}
      onNotify={jest.fn()}
      onClose={jest.fn()}
      onPassed={jest.fn()}
    />
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Thử mở lại phiên' }));
  expect(await screen.findByText('Network lab')).toBeInTheDocument();
  expect(api.startCliLabAttempt).toHaveBeenCalledTimes(2);
});

test('student progress renders three states and keeps advanced tools collapsed', async () => {
  const a = {
    ...example(),
    progress: {
      completed: 1,
      total: 3,
      nextTaskId: 'task-2',
      checks: [
        { id: 'task-1', status: 'completed', passed: true },
        { id: 'task-2', status: 'in_progress', passed: false },
        { id: 'task-3', status: 'not_started', passed: false },
      ],
    },
    lab: {
      ...example().lab,
      tasks: [
        { id: 'task-1', title: 'Đã xong', points: 20 },
        { id: 'task-2', title: 'Đang làm', points: 30, deviceId: 'R1', type: 'interface_enabled' },
        { id: 'task-3', title: 'Chưa bắt đầu', points: 50 },
      ],
    },
  };
  api.startCliLabAttempt.mockResolvedValue(a);
  render(
    <CliLabWorkspace
      lab={{ id: 1 }}
      onNotify={jest.fn()}
      onClose={jest.fn()}
      onPassed={jest.fn()}
    />
  );
  expect(await screen.findByRole('progressbar', { name: 'Tiến độ bài thực hành' })).toHaveAttribute(
    'aria-valuenow',
    '1'
  );
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '3');
  expect(screen.getByText('Đã xong')).toBeInTheDocument();
  expect(screen.queryByLabelText('IP đích')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Ping thử' })).toHaveAttribute(
    'aria-expanded',
    'false'
  );
});

test('task device chips switch the terminal and overall progress appears once', async () => {
  const attempt = example();
  attempt.state.devices.R2 = {
    hostname: 'R2',
    deviceType: 'ROUTER',
    mode: 'USER_EXEC',
    interfaces: {},
  };
  attempt.lab.tasks = [
    {
      id: 'r2-as',
      title: 'Bật AS trên router thứ hai',
      type: 'eigrp_as_configured',
      deviceId: 'R2',
    },
  ];
  api.startCliLabAttempt.mockResolvedValue(attempt);
  render(<CliLabWorkspace lab={{ id: 1 }} />);
  const task = await screen.findByRole('button', {
    name: 'Chọn nhiệm vụ Bật AS trên router thứ hai',
  });
  expect(within(task).getByLabelText('Thiết bị R2')).toBeInTheDocument();
  fireEvent.click(task);
  expect(screen.getByRole('button', { name: 'Terminal R2>' })).toBeInTheDocument();
  expect(screen.getAllByRole('progressbar')).toHaveLength(1);
  expect(screen.getAllByRole('button', { name: 'Chấm bài' })).toHaveLength(1);
  expect(screen.getByRole('group', { name: 'Yêu cầu bài thực hành' })).toHaveAttribute('open');
});

test('preview uses the local simulator and never calls attempt APIs', async () => {
  render(
    <CliLabWorkspace
      lab={{ title: 'Preview lab', objective: 'Try locally' }}
      preview={{
        initialState: networkTemplate,
        gradingSpec: {
          passingScore: 100,
          checks: [
            {
              id: 'reachable',
              type: 'reachable',
              deviceId: 'PC1',
              destination: '192.168.2.10',
              points: 100,
            },
          ],
        },
      }}
      onNotify={jest.fn()}
      onClose={jest.fn()}
      onPassed={jest.fn()}
    />
  );
  expect(await screen.findByText('Preview lab')).toBeInTheDocument();
  expect(screen.getByText('Thay đổi chỉ dùng để xem trước')).toBeInTheDocument();
  expect(api.startCliLabAttempt).not.toHaveBeenCalled();
  expect(api.cliAchievements).not.toHaveBeenCalled();
  expect(api.cliAction).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Terminal PC1>'));
  await waitFor(() => expect(api.cliAction).not.toHaveBeenCalled());
});

test('mastered attempt stays editable, copies only CLI text and opens hints in order', async () => {
  const task = {
    id: 'metric',
    title: 'Bài metric',
    deviceId: 'R1',
    points: 20,
    hintCount: 3,
    hints: [],
  };
  const current = {
    ...example(),
    status: 'MASTERED',
    canPractice: true,
    features: { mastery: true },
    bestScore: 100,
    score: 100,
    feedback: { score: 80, passed: false, checks: [] },
    lab: {
      title: 'EIGRP',
      passingScore: 80,
      tasks: [task],
      steps: [{ title: 'Điều chỉnh delay', commands: [{ deviceId: 'R1', command: 'delay 11' }] }],
    },
  };
  api.startCliLabAttempt.mockResolvedValue(current);
  api.cliAction.mockResolvedValue({
    state: current.state,
    event: { output: 'Gợi ý đã mở' },
    tasks: [{ ...task, hints: ['Tính bandwidth nhỏ nhất.'] }],
  });
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: jest.fn().mockResolvedValue() },
  });
  render(<CliLabWorkspace lab={{ id: 1 }} />);
  expect(await screen.findByText('Thành thạo · Điểm cao nhất: 100/100')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Chấm bài' })).toBeEnabled();
  expect(screen.getByRole('button', { name: /Terminal/ })).toBeEnabled();
  fireEvent.click(screen.getByText('Các giai đoạn và lệnh mẫu'));
  fireEvent.click(screen.getByText('Điều chỉnh delay'));
  fireEvent.click(screen.getByRole('button', { name: 'Chép lệnh R1 delay 11' }));
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith('delay 11');
  fireEvent.click(screen.getByRole('button', { name: 'Xem gợi ý' }));
  fireEvent.click(screen.getByRole('button', { name: 'Mở gợi ý 1/3' }));
  await waitFor(() =>
    expect(api.cliAction).toHaveBeenCalledWith(
      'test',
      'test-attempt',
      { type: 'hint', checkId: 'metric', deviceId: 'R1', level: 1 },
      0
    )
  );
  expect(await screen.findByText('Tính bandwidth nhỏ nhất.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Mở gợi ý 2/3' })).toBeInTheDocument();
});

test('switching terminal clears a pinned task on the previous router', async () => {
  const a = example();
  a.state.devices.R2 = { ...a.state.devices.R1, hostname: 'R2' };
  a.lab.tasks = [
    { id: 'as-r1', title: 'R1: bật EIGRP AS 1', deviceId: 'R1', type: 'eigrp_as_configured' },
    { id: 'as-r2', title: 'R2: bật EIGRP AS 1', deviceId: 'R2', type: 'eigrp_as_configured' },
  ];
  a.progress = {
    completed: 0,
    total: 2,
    checks: a.lab.tasks.map((task) => ({ id: task.id, status: 'not_started' })),
  };
  api.startCliLabAttempt.mockResolvedValue(a);
  render(<CliLabWorkspace lab={{ id: 1 }} />);
  await screen.findByRole('button', { name: 'Mở terminal R2' });
  expect(screen.getByRole('button', { name: 'Chuyển đến R1' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Chuyển đến R1' }));
  fireEvent.click(screen.getByRole('button', { name: 'Mở terminal R2' }));
  expect(screen.getByRole('button', { name: 'Chuyển đến R2' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Chuyển đến R1' })).not.toBeInTheDocument();
});
