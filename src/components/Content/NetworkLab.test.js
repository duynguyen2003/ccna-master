
import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TopologyEditor from '../Admin/Views/TopologyEditor';
import CliLabWorkspace from './CliLabWorkspace';
import NetworkTopology from './NetworkTopology';
import { api } from '../../services/Api';
import { networkTemplate } from '../../data/networkLabTemplates';
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ token: 'test' }) }));
jest.mock('../../services/Api', () => ({ api: { startCliLabAttempt: jest.fn(), restartCliLabAttempt: jest.fn(), cliAchievements: jest.fn(), cliReplay: jest.fn(), cliAction: jest.fn(), getCliLabAttempt: jest.fn(), getCliLabCompletions: jest.fn() } }));
jest.mock('./CliTerminal', () => ({ __esModule: true, default: ({ disabled, prompt, onCommand }) => <button disabled={disabled} onClick={() => onCommand('enable')}>Terminal {prompt}</button> }));
const example = () => ({ id: 'test-attempt', labId: 1, isOwner: true, members: [], status: 'IN_PROGRESS', commands: [], state: { revision: 0, tick: 0, devices: { R1: { hostname: 'Router', deviceType: 'ROUTER', mode: 'USER_EXEC', interfaces: {} } }, links: [], stp: {}, ospfNeighbors: {} }, lab: { title: 'Network lab', tasks: [], objective: 'Practice routing' } });
beforeEach(() => {
  jest.clearAllMocks(); api.startCliLabAttempt.mockResolvedValue(example()); api.cliAchievements.mockResolvedValue({ points: 0, completed: 0, badges: [], streak: 0 });
});
test('admin topology editor adds/removes nodes and synchronizes JSON', () => {
  let current;
  function Editor() { const [value, setValue] = useState(JSON.stringify(networkTemplate)); current = JSON.parse(value); return <TopologyEditor value={value} onChange={setValue} />; }
  render(<Editor />); fireEvent.click(screen.getByText('Thêm thiết bị')); expect(current.devices).toHaveLength(5);
  fireEvent.click(screen.getByRole('button', { name: 'Chọn ROUTER1' })); fireEvent.click(screen.getByText('Xóa thiết bị đã chọn')); expect(current.devices).toHaveLength(4);
});
test('topology editor reports incomplete JSON instead of crashing', () => {
  render(<TopologyEditor value={JSON.stringify({ devices: [{ id: 'R1' }] })} onChange={jest.fn()} onTemplate={jest.fn()} />);
  expect(screen.getByRole('alert')).toHaveTextContent('interfaces');
});
test('topology supports keyboard device selection and shows disabled link', () => {
  const onSelect = jest.fn(); const links = networkTemplate.links.map((l) => ({ ...l, enabled: false }));
  const { container } = render(<NetworkTopology devices={networkTemplate.devices} links={links} onSelect={onSelect} />);
  fireEvent.keyDown(screen.getByRole('button', { name: 'Chọn R1' }), { key: 'Enter' }); expect(onSelect).toHaveBeenCalledWith('R1'); expect(container.querySelectorAll('.link-down')).toHaveLength(3);
});
test('workspace commands include device and authoritative revision', async () => {
  const a = example(); api.cliAction.mockResolvedValue({ state: { ...a.state, revision: 1 }, prompt: 'Router#', event: { sequence: 1, command: 'enable', action: { type: 'command', deviceId: 'R1' } } });
  render(<CliLabWorkspace lab={{ id: 1 }} onNotify={jest.fn()} onClose={jest.fn()} onPassed={jest.fn()} />);
  fireEvent.click(await screen.findByText('Terminal Router>'));
  await waitFor(() => expect(api.cliAction).toHaveBeenCalledWith('test', 'test-attempt', { type: 'command', command: 'enable', deviceId: 'R1' }, 0));
});
test('replay disables terminal writes and returning live restores controls', async () => {
  api.cliReplay.mockResolvedValue({ state: example().state, sequence: 0, readOnly: true });
  render(<CliLabWorkspace lab={{ id: 1 }} onNotify={jest.fn()} onClose={jest.fn()} onPassed={jest.fn()} />);
  fireEvent.click(await screen.findByText('Xem snapshot'));
  await waitFor(() => expect(screen.getByText('Về trực tiếp')).toBeEnabled());
  expect(screen.getByText('Terminal Router>')).toBeDisabled();
  fireEvent.click(screen.getByText('Về trực tiếp')); expect(screen.getByText('Terminal Router>')).toBeEnabled();
});
test('owner can restart an in-progress workspace', async () => {
  api.restartCliLabAttempt.mockResolvedValue({ ...example(), id: 'new-attempt' });
  render(<CliLabWorkspace lab={{ id: 1 }} onNotify={jest.fn()} onClose={jest.fn()} onPassed={jest.fn()} />);
  fireEvent.click(await screen.findByText('Bỏ phiên và làm lại'));
  await waitFor(() => expect(api.restartCliLabAttempt).toHaveBeenCalledWith('test', 'test-attempt', 1));
});
test('Escape closes the workspace', async () => {
  const close = jest.fn(); render(<CliLabWorkspace lab={{ id: 1 }} onNotify={jest.fn()} onClose={close} onPassed={jest.fn()} />);
  await screen.findByText('Network lab'); fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' }); expect(close).toHaveBeenCalledTimes(1);
});
