import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import Labs, { LabCard } from './Labs';
import { api } from '../../../services/Api';
import { AuthContext } from '../../../context/AuthContext';
// CRA's Jest resolver cannot load react-router/dom from React Router7.
// Keep actual URLSearchParams/state semantics for these page navigation tests.
jest.mock('react-router-dom', () => {
  const React = require('react');
  const Context = React.createContext(null);
  return {
    MemoryRouter: ({ children, initialEntries = ['/labs'] }) => {
      const [params, setParams] = React.useState(
        () => new URLSearchParams(initialEntries[0].split('?')[1])
      );
      return (
        <Context.Provider value={[params, (next) => setParams(new URLSearchParams(next))]}>
          {children}
        </Context.Provider>
      );
    },
    useSearchParams: () => React.useContext(Context),
    Link: ({ to, children, ...props }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});
jest.mock('../../../services/Api', () => ({
  api: { getLabs: jest.fn(), getUserProgress: jest.fn() },
  BACKEND_URL: 'http://synthetic.invalid',
}));
jest.mock('../components/CliLabWorkspace', () => ({
  __esModule: true,
  default: ({ lab }) => <div role="dialog">Workspace {lab.title}</div>,
}));
const locked = {
  id: 1,
  title: 'Lab IPv4',
  category: 'Routing',
  difficulty: 'Easy',
  tools: [],
  labType: 'CLI_SIMULATION',
  access: {
    canAccess: false,
    lockedReason: 'Học bài tiên quyết.',
    unmetLessons: [{ id: 14, title: 'Địa chỉ mạng', courseId: 'ITN', requiredPercent: 70 }],
  },
};
test('locked card disables entry and links to the actual prerequisite', () => {
  const open = jest.fn();
  render(
    <MemoryRouter>
      <LabCard lab={locked} onStartCli={open} />
    </MemoryRouter>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Chưa mở khóa' }));
  expect(open).not.toHaveBeenCalled();
  expect(screen.getByRole('link', { name: /Học bài.*Địa chỉ mạng/ })).toHaveAttribute(
    'href',
    '/lesson?course=ITN&lesson=14'
  );
});
test('a locked deep link never mounts a workspace; an unlocked one survives initial loading', async () => {
  api.getLabs.mockResolvedValue([locked]);
  api.getUserProgress.mockResolvedValue({});
  const auth = { token: 'synthetic', user: { id: 1 }, isAuthenticated: true };
  const view = render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/labs?labId=1']}>
        <Labs />
      </MemoryRouter>
    </AuthContext.Provider>
  );
  await screen.findByRole('button', { name: 'Chưa mở khóa' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  view.unmount();
  api.getLabs.mockResolvedValue([{ ...locked, access: { canAccess: true } }]);
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/labs?labId=1']}>
        <Labs />
      </MemoryRouter>
    </AuthContext.Provider>
  );
  await waitFor(() => expect(screen.getByRole('dialog')).toHaveTextContent('Workspace Lab IPv4'));
});
