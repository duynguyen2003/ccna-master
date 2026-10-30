import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminLabAi from '@ccna/agent-ui/admin';

const data = {
  configured: true,
  editable: true,
  available: true,
  enabled: true,
  version: 3,
  requests: 12,
  costMicros: '1274',
  unresolved: 1,
  helpful: 4,
  unhelpful: 2,
};
const response = (body, ok = true, status = 200) => ({ ok, status, json: async () => body });
const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

test('admin reads real metrics and saves a versioned lab switch only on explicit save', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce(response({ data }))
    .mockResolvedValueOnce(response({ data: { enabled: false, version: 4 } }));
  render(<AdminLabAi baseUrl="/api" token="synthetic" labId={1} />);
  const checkbox = await screen.findByRole('checkbox', { name: 'Bật trợ lý AI cho lab này' });
  expect(screen.getByText('12')).toBeInTheDocument();
  expect(screen.getByText('4 / 2')).toBeInTheDocument();
  fireEvent.click(checkbox);
  expect(global.fetch).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Lưu cấu hình AI' }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  expect(JSON.parse(global.fetch.mock.calls[1][1].body)).toEqual({ enabled: false, version: 3 });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Lưu cấu hình AI' })).toBeDisabled()
  );
});

test('new labs do not show a nonfunctional toggle and configuration errors allow reload', async () => {
  global.fetch = jest.fn().mockResolvedValue(response({}, false, 403));
  const view = render(<AdminLabAi baseUrl="/api" token="x" labId={null} />);
  expect(screen.getByText(/Lưu bài lab trước/)).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
  view.rerender(<AdminLabAi baseUrl="/api" token="x" labId={2} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('không có quyền');
  expect(screen.getByRole('button', { name: 'Tải lại' })).toBeEnabled();
});
