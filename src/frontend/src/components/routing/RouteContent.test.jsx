import React, { lazy } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from '../../../scripts/test-text-encoding.cjs';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
// Jest 27 cannot resolve react-router/dom; these APIs are re-exported from the core package.
jest.mock('react-router-dom', () => jest.requireActual('react-router'));
const { Link, MemoryRouter, Route, Routes } = require('react-router-dom');
const RouteContent = require('./RouteContent').default;

test('keeps navigation visible while a route loads, then shows the page', async () => {
  let resolvePage;
  const Page = lazy(
    () =>
      new Promise((resolve) => {
        resolvePage = resolve;
      })
  );
  render(
    <MemoryRouter>
      <nav aria-label="Điều hướng">
        <Link to="/">Trang chủ</Link>
      </nav>
      <RouteContent>
        <Page />
      </RouteContent>
    </MemoryRouter>
  );
  const navigation = screen.getByRole('navigation');
  expect(screen.getByRole('status')).toHaveTextContent('Đang tải trang...');
  await act(async () => resolvePage({ default: () => <h1>Nội dung bài học</h1> }));
  expect(screen.getByRole('heading', { name: 'Nội dung bài học' })).toBeInTheDocument();
  expect(screen.getByRole('navigation')).toBe(navigation);
  expect(screen.queryByText('Đang tải trang...')).not.toBeInTheDocument();
});

test('shows recovery on a rejected chunk and clears the error when navigating away', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  const BrokenPage = lazy(() => Promise.reject(new Error('Synthetic chunk failure')));
  try {
    render(
      <MemoryRouter initialEntries={['/lesson']}>
        <RouteContent>
          <Routes>
            <Route path="/lesson" element={<BrokenPage />} />
            <Route path="/" element={<h1>Trang chủ</h1>} />
          </Routes>
        </RouteContent>
      </MemoryRouter>
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được trang');
    expect(screen.getByRole('button', { name: 'Tải lại trang' })).toBeEnabled();
    fireEvent.click(screen.getByRole('link', { name: 'Về trang chủ' }));
    expect(await screen.findByRole('heading', { name: 'Trang chủ' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  } finally {
    log.mockRestore();
  }
});
