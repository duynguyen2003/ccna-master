import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TopologyEditor from '../Admin/Views/TopologyEditor';
import CliLabWorkspace from './CliLabWorkspace';
import NetworkTopology from './NetworkTopology';
import { api } from '../../services/Api';
import { networkTemplate } from '../../data/networkLabTemplates';
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ token: 'test' }) }));
jest.mock('../../services/Api', () => ({
  api: {
    startCliLabAttempt: jest.fn(),
    restartCliLabAttempt: jest.fn(),
    cliAchievements: jest.fn(),
    cliReplay: jest.fn(),
    cliAction: jest.fn(),
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
  jest.clearAllMocks();
  window.localStorage.removeItem('ccna.cli-lab.onboarding.v1');
  api.startCliLabAttempt.mockResolvedValue(example());
  api.cliAchievements.mockResolvedValue({ points: 0, completed: 0, badges: [], streak: 0 });
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
    <NetworkTopology
      devices={networkTemplate.devices}
      links={links}
      onSelect={onSelect}
      disabled
    />
  );
  const node = screen.getByRole('button', { name: 'Chọn R1' });
  expect(node).toBeEnabled();
  fireEvent.keyDown(node, { key: 'Enter' });
  expect(onSelect).toHaveBeenCalledWith('R1');
  expect(screen.getAllByTestId('link-down')).toHaveLength(3);
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
test('replay disables terminal writes and returning live restores controls', async () => {
  api.cliReplay.mockResolvedValue({ state: example().state, sequence: 0, readOnly: true });
  render(
    <CliLabWorkspace
      lab={{ id: 1 }}
      onNotify={jest.fn()}
      onClose={jest.fn()}
      onPassed={jest.fn()}
    />
  );
  fireEvent.click(await screen.findByText('Xem snapshot'));
  await waitFor(() => expect(screen.getByText('Về trực tiếp')).toBeEnabled());
  expect(screen.getByText('Terminal Router>')).toBeDisabled();
  fireEvent.click(screen.getByText('Về trực tiếp'));
  expect(screen.getByText('Terminal Router>')).toBeEnabled();
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
  fireEvent.click(await screen.findByText('Bỏ phiên và làm lại'));
  await waitFor(() =>
    expect(api.restartCliLabAttempt).toHaveBeenCalledWith('test', 'test-attempt', 1)
  );
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
  expect(await screen.findByText('1/3 nhiệm vụ')).toBeInTheDocument();
  expect(screen.getByText('Đã xong')).toBeInTheDocument();
  const advanced = screen.getByTestId('advanced-tools');
  expect(advanced).not.toHaveAttribute('open');
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
