import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import HomeProtocolDemo from './HomeProtocolDemo';
import http from '../../protocols/data/lessons/http.json';

let mockReduced = true;
jest.mock('../../../hooks/useReducedMotion', () => ({
  __esModule: true,
  default: () => mockReduced,
}));
beforeEach(() => {
  mockReduced = true;
  localStorage.clear();
});

test('HTTP runs through all real events, phases and replay without writing learning progress', () => {
  render(<HomeProtocolDemo lesson={http} />);
  expect(screen.getByRole('button', { name: 'Phát demo' })).toBeDisabled();
  expect(screen.getByLabelText('Vị trí sự kiện demo')).toHaveTextContent('1/13');
  for (let i = 1; i < 13; i++)
    fireEvent.click(screen.getByRole('button', { name: 'Sự kiện tiếp theo trong demo' }));
  expect(screen.getByLabelText('Vị trí sự kiện demo')).toHaveTextContent('13/13');
  expect(screen.getByRole('button', { name: 'Sự kiện tiếp theo trong demo' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Về đầu demo' }));
  expect(screen.getByLabelText('Vị trí sự kiện demo')).toHaveTextContent('1/13');
  const phases = screen.getByRole('navigation', { name: 'Giai đoạn trong demo HTTP' });
  fireEvent.click(within(phases).getAllByRole('button')[1]);
  expect(screen.getByLabelText('Vị trí sự kiện demo')).toHaveTextContent('3/13');
  fireEvent.click(screen.getByRole('button', { name: 'Sự kiện tiếp theo trong demo' }));
  expect(screen.getByLabelText('HTTP: DNS QUERY')).toBeInTheDocument();
  expect(localStorage.length).toBe(0);
});

test('autoplay starts once while visible, pauses on hiding and respects motion changes', async () => {
  mockReduced = false;
  const view = render(<HomeProtocolDemo lesson={http} visible={false} />);
  expect(screen.getByRole('button', { name: 'Phát demo' })).toBeEnabled();
  view.rerender(<HomeProtocolDemo lesson={http} visible />);
  fireEvent.click(await screen.findByRole('button', { name: 'Tạm dừng demo' }));
  fireEvent.click(screen.getByRole('button', { name: 'Sự kiện tiếp theo trong demo' }));
  fireEvent.click(screen.getByRole('button', { name: 'Phát demo' }));
  view.rerender(<HomeProtocolDemo lesson={http} visible={false} />);
  expect(screen.getByRole('button', { name: 'Phát demo' })).toBeEnabled();
  const position = screen.getByLabelText('Vị trí sự kiện demo').textContent;
  view.rerender(<HomeProtocolDemo lesson={http} visible />);
  expect(screen.getByRole('button', { name: 'Phát demo' })).toBeEnabled();
  expect(screen.getByLabelText('Vị trí sự kiện demo')).toHaveTextContent(position);
  mockReduced = true;
  view.rerender(<HomeProtocolDemo lesson={http} visible />);
  expect(screen.getByRole('button', { name: 'Phát demo' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Sự kiện tiếp theo trong demo' })).toBeEnabled();
});

test('StrictMode keeps the surviving playback timeline running instead of losing the first autoplay', async () => {
  mockReduced = false;
  render(
    <React.StrictMode>
      <HomeProtocolDemo lesson={http} visible />
    </React.StrictMode>
  );
  expect(await screen.findByRole('button', { name: 'Tạm dừng demo' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Sự kiện tiếp theo trong demo' }));
  expect(screen.getByRole('button', { name: 'Phát demo' })).toBeEnabled();
  expect(screen.getByLabelText('Vị trí sự kiện demo')).toHaveTextContent('2/13');
});
