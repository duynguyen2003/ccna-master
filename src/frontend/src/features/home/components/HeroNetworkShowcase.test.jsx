import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import HeroNetworkShowcase from './HeroNetworkShowcase';
import { loadProtocolLesson } from '../../protocols/data/lessonCatalog';
import http from '../../protocols/data/lessons/http.json';

jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
jest.mock('../../protocols/data/lessonCatalog', () => ({ loadProtocolLesson: jest.fn() }));
jest.mock('./HomeProtocolDemo', () => ({
  __esModule: true,
  default: ({ visible }) => (
    <section aria-label="Demo đã tải">
      <span>{visible ? 'Demo hiển thị' : 'Demo đã tạm ẩn'}</span>
    </section>
  ),
}));
beforeEach(() => {
  jest.clearAllMocks();
  loadProtocolLesson.mockResolvedValue(http);
});

test('switching demo/CLI keeps the CLI draft and loads the lesson once', async () => {
  const open = jest.fn();
  render(
    <HeroNetworkShowcase onCliOpen={open}>
      <input aria-label="Bản nháp CLI" defaultValue="show ip " />
    </HeroNetworkShowcase>
  );
  await screen.findByRole('region', { name: 'Demo đã tải' });
  fireEvent.click(screen.getByRole('button', { name: 'Thử CLI', exact: true }));
  const draft = screen.getByRole('textbox', { name: 'Bản nháp CLI' });
  fireEvent.change(draft, { target: { value: 'show version' } });
  fireEvent.click(screen.getByRole('button', { name: 'Mô phỏng', exact: true }));
  expect(draft).not.toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Thử CLI', exact: true }));
  expect(draft).toHaveValue('show version');
  expect(loadProtocolLesson).toHaveBeenCalledTimes(1);
  expect(open).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('link', { name: 'Mở một bài lab thực hành' })).toHaveAttribute(
    'href',
    '/labs'
  );
});

test('failed loading can retry without removing the CLI or library navigation', async () => {
  loadProtocolLesson.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(http);
  render(
    <HeroNetworkShowcase>
      <span>CLI vẫn còn</span>
    </HeroNetworkShowcase>
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Thử lại mô phỏng' }));
  expect(await screen.findByRole('region', { name: 'Demo đã tải' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Tự khám phá từng sự kiện' })).toHaveAttribute(
    'href',
    '/protocols?protocol=http'
  );
  expect(loadProtocolLesson).toHaveBeenCalledTimes(2);
});

test('a sliver behind the fixed header does not keep an offscreen demo playing', async () => {
  const original = window.IntersectionObserver;
  let update;
  window.IntersectionObserver = class {
    constructor(callback) {
      update = callback;
    }
    observe() {}
    disconnect() {}
  };
  let view;
  try {
    view = render(
      <HeroNetworkShowcase>
        <span>CLI</span>
      </HeroNetworkShowcase>
    );
    expect(loadProtocolLesson).not.toHaveBeenCalled();
    act(() => update([{ isIntersecting: true, intersectionRatio: 1 }]));
    await screen.findByText('Demo hiển thị');
    act(() => update([{ isIntersecting: true, intersectionRatio: 0.03 }]));
    expect(screen.getByText('Demo đã tạm ẩn')).toBeInTheDocument();
    act(() => update([{ isIntersecting: true, intersectionRatio: 0.8 }]));
    expect(screen.getByText('Demo hiển thị')).toBeInTheDocument();
    expect(loadProtocolLesson).toHaveBeenCalledTimes(1);
  } finally {
    view?.unmount();
    window.IntersectionObserver = original;
  }
});
