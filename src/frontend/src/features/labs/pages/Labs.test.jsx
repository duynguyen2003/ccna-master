import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import Labs, { LabCard } from './Labs';
import { api } from '../../../services/Api';
import { AuthContext } from '../../../context/AuthContext';
jest.mock('../../../components/common/MarkdownRenderer', () => ({
  __esModule: true,
  default: ({ content }) => <div>{content}</div>,
}));
// CRA's Jest resolver cannot load react-router/dom from React Router7.
// Keep actual URLSearchParams/state semantics for these page navigation tests.
jest.mock('react-router-dom', () => {
  const React = require('react');
  const Context = React.createContext(null);
  return {
    MemoryRouter: ({ children, initialEntries = ['/labs'] }) => {
      const [location, setLocation] = React.useState(initialEntries[0]);
      const params = new URLSearchParams(location.split('?')[1]);
      const navigate = React.useCallback((next) => setLocation(next), []);
      return (
        <Context.Provider
          value={{
            params,
            setParams: (next) =>
              setLocation(location.split('?')[0] + '?' + new URLSearchParams(next)),
            navigate,
            id: location.match(/^\/labs\/([^/?]+)/)?.[1],
          }}
        >
          {children}
        </Context.Provider>
      );
    },
    useSearchParams: () => {
      const c = React.useContext(Context);
      return [c.params, c.setParams];
    },
    useParams: () => ({ id: React.useContext(Context).id }),
    useNavigate: () => React.useContext(Context).navigate,
    Link: ({ to, children, ...props }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});
jest.mock('../../../services/Api', () => ({
  api: { getLabs: jest.fn(), getLab: jest.fn(), getUserProgress: jest.fn() },
  BACKEND_URL: 'http://synthetic.invalid',
}));
jest.mock('../components/CliLabWorkspace', () => ({
  __esModule: true,
  default: ({ lab, page, onClose }) => (
    <div role={page ? 'region' : 'dialog'}>
      Workspace {lab.title}
      <button onClick={onClose}>Danh sách lab</button>
    </div>
  ),
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
  api.getLab.mockResolvedValue({ ...locked, access: { canAccess: true } });
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/labs?labId=1']}>
        <Labs />
      </MemoryRouter>
    </AuthContext.Provider>
  );
  await waitFor(() => expect(screen.getByRole('region')).toHaveTextContent('Workspace Lab IPv4'));
});

test('direct lab URLs fetch the exact lab and enforce access before mounting the workspace', async () => {
  api.getLab.mockResolvedValue(locked);
  const auth = { token: 'synthetic', user: { id: 1 }, isAuthenticated: true };
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/labs/1']}>
        <Labs />
      </MemoryRouter>
    </AuthContext.Provider>
  );
  expect(
    await screen.findByRole('heading', { name: 'Bài thực hành chưa mở khóa' })
  ).toBeInTheDocument();
  expect(api.getLab).toHaveBeenCalledWith('synthetic', '1');
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
});
