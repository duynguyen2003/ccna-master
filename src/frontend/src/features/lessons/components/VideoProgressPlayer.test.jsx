import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import VideoProgressPlayer from './VideoProgressPlayer';
import api from '../../../services/Api';

let mockYoutubeProps;
jest.mock('react-youtube', () => ({
  __esModule: true,
  default: (props) => {
    mockYoutubeProps = props;
    return <div data-testid="youtube-player" />;
  },
}));
jest.mock('../../../services/Api', () => ({
  __esModule: true,
  default: {
    getVideoProgress: jest.fn(),
    updateVideoProgress: jest.fn(),
  },
}));

const makePlayer = () => {
  let position = 0;
  return {
    getCurrentTime: jest.fn(() => position),
    getDuration: jest.fn(() => 100),
    getPlaybackRate: jest.fn(() => 2),
    seekTo: jest.fn((seconds) => {
      position = seconds;
    }),
    setPosition: (seconds) => {
      position = seconds;
    },
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  api.updateVideoProgress.mockImplementation((token, payload) =>
    Promise.resolve({
      data: { lastPosition: payload.lastPosition, watchedSeconds: payload.sessionWatchedSeconds },
    })
  );
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  delete document.visibilityState;
});

test('waits for saved bookmark before mounting player, then resumes the correct lesson', async () => {
  let resolveProgress;
  api.getVideoProgress.mockReturnValue(
    new Promise((resolve) => {
      resolveProgress = resolve;
    })
  );
  render(
    <VideoProgressPlayer
      url="https://www.youtube.com/watch?v=abc123"
      lessonId={7}
      token="token"
      user={{ role: 'STUDENT' }}
      onProgressChange={jest.fn()}
      onMetricsChange={jest.fn()}
    />
  );
  expect(screen.queryByTestId('youtube-player')).not.toBeInTheDocument();
  expect(screen.getByText(/Đang tải vị trí xem tiếp/)).toBeInTheDocument();

  await act(async () => {
    resolveProgress({ data: { lastPosition: 42, watchedSeconds: 18 } });
  });
  expect(screen.getByTestId('youtube-player')).toBeInTheDocument();
  const player = makePlayer();
  act(() => mockYoutubeProps.onReady({ target: player }));
  expect(player.seekTo).toHaveBeenCalledWith(42, true);
});

test('keeps playback blocked after bookmark load fails until retry succeeds', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  api.getVideoProgress
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ data: { lastPosition: 31, watchedSeconds: 12 } });
  render(
    <VideoProgressPlayer
      url="https://www.youtube.com/watch?v=abc123"
      lessonId={7}
      token="token"
      user={{ role: 'STUDENT' }}
      onProgressChange={jest.fn()}
      onMetricsChange={jest.fn()}
    />
  );
  await act(async () => Promise.resolve());
  expect(screen.getByText('Chưa tải được vị trí xem tiếp.')).toBeInTheDocument();
  expect(screen.queryByTestId('youtube-player')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  await act(async () => Promise.resolve());
  const player = makePlayer();
  act(() => mockYoutubeProps.onReady({ target: player }));
  expect(player.seekTo).toHaveBeenCalledWith(31, true);
  log.mockRestore();
});

test('does not overwrite the bookmark while the resume seek is still pending', async () => {
  api.getVideoProgress.mockResolvedValue({ data: { lastPosition: 42, watchedSeconds: 18 } });
  render(
    <VideoProgressPlayer
      url="https://www.youtube.com/watch?v=abc123"
      lessonId={9}
      token="token"
      user={{ role: 'STUDENT' }}
      onProgressChange={jest.fn()}
      onMetricsChange={jest.fn()}
    />
  );
  await act(async () => Promise.resolve());
  const player = makePlayer();
  player.seekTo.mockImplementation(() => {});
  act(() => {
    mockYoutubeProps.onReady({ target: player });
    mockYoutubeProps.onStateChange({ data: 1, target: player });
    mockYoutubeProps.onStateChange({ data: 2, target: player });
  });
  expect(api.updateVideoProgress).not.toHaveBeenCalled();

  player.setPosition(42);
  act(() => {
    mockYoutubeProps.onStateChange({ data: 1, target: player });
    mockYoutubeProps.onStateChange({ data: 2, target: player });
  });
  expect(api.updateVideoProgress).toHaveBeenCalledWith(
    'token',
    expect.objectContaining({
      lastPosition: 42,
    })
  );
});

test('flushes short playback on pause and counts real elapsed time at 2x speed', async () => {
  jest.useFakeTimers();
  api.getVideoProgress.mockResolvedValue({ data: { lastPosition: 0, watchedSeconds: 0 } });
  const onProgressChange = jest.fn();
  render(
    <VideoProgressPlayer
      url="https://www.youtube.com/watch?v=abc123"
      lessonId={8}
      token="token"
      user={{ role: 'ADMIN' }}
      onProgressChange={onProgressChange}
      onMetricsChange={jest.fn()}
    />
  );
  await act(async () => Promise.resolve());
  const player = makePlayer();
  act(() => {
    mockYoutubeProps.onReady({ target: player });
    mockYoutubeProps.onStateChange({ data: 1, target: player });
  });
  for (let second = 1; second <= 4; second += 1) {
    player.setPosition(second * 2);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
  }
  act(() => mockYoutubeProps.onStateChange({ data: 2, target: player }));
  await act(async () => Promise.resolve());
  const payloads = api.updateVideoProgress.mock.calls.map((call) => call[1]);
  expect(
    payloads.some((payload) => payload.lastPosition === 8 && payload.sessionWatchedSeconds === 4)
  ).toBe(true);
  expect(
    payloads.every(
      (payload) => payload.sessionStartedAt && payload.sessionStartedAt <= payload.capturedAt
    )
  ).toBe(true);
  expect(onProgressChange).toHaveBeenCalledWith(
    expect.objectContaining({
      playedSeconds: 8,
      eligibleCompletion: false,
    })
  );
  jest.useRealTimers();
});

test('ignores a late bookmark response after switching lessons', async () => {
  const resolvers = {};
  api.getVideoProgress.mockImplementation(
    (token, lessonId) =>
      new Promise((resolve) => {
        resolvers[lessonId] = resolve;
      })
  );
  const metrics = jest.fn();
  const props = {
    url: 'https://www.youtube.com/watch?v=abc123',
    token: 'token',
    user: { role: 'STUDENT' },
    onProgressChange: jest.fn(),
    onMetricsChange: metrics,
  };
  const { rerender } = render(<VideoProgressPlayer key={1} lessonId={1} {...props} />);
  rerender(<VideoProgressPlayer key={2} lessonId={2} {...props} />);
  await act(async () => {
    resolvers[2]({ data: { lastPosition: 12, watchedSeconds: 6 } });
    resolvers[1]({ data: { lastPosition: 80, watchedSeconds: 70 } });
  });
  const player = makePlayer();
  act(() => mockYoutubeProps.onReady({ target: player }));
  expect(player.seekTo).toHaveBeenCalledWith(12, true);
  expect(metrics).not.toHaveBeenCalledWith(1, expect.objectContaining({ lastPosition: 80 }));
});

const openPlayingVideo = async () => {
  api.getVideoProgress.mockResolvedValue({ data: { lastPosition: 0, watchedSeconds: 0 } });
  const view = render(
    <VideoProgressPlayer
      url="https://www.youtube.com/watch?v=abc123"
      lessonId={12}
      token="token"
      user={{ role: 'ADMIN' }}
      onProgressChange={jest.fn()}
      onMetricsChange={jest.fn()}
    />
  );
  await act(async () => Promise.resolve());
  const player = makePlayer();
  act(() => {
    mockYoutubeProps.onReady({ target: player });
    mockYoutubeProps.onStateChange({ data: 1, target: player });
  });
  return { ...view, player };
};

test('batches regular playback for at least 30 seconds and flushes a short tail on pause', async () => {
  jest.useFakeTimers();
  jest.spyOn(Math, 'random').mockReturnValue(0.4);
  const { player } = await openPlayingVideo();
  for (let second = 1; second <= 31; second += 1) {
    player.setPosition(second);
    await act(async () => jest.advanceTimersByTime(1000));
  }
  expect(api.updateVideoProgress).not.toHaveBeenCalled();
  player.setPosition(32);
  await act(async () => jest.advanceTimersByTime(1000));
  expect(api.updateVideoProgress).toHaveBeenCalledTimes(1);
  expect(api.updateVideoProgress.mock.calls[0][1]).toMatchObject({
    lastPosition: 32,
    sessionWatchedSeconds: 32,
    sequence: 1,
  });
  player.setPosition(33);
  await act(async () => jest.advanceTimersByTime(1000));
  await act(async () => mockYoutubeProps.onStateChange({ data: 2, target: player }));
  expect(api.updateVideoProgress).toHaveBeenCalledTimes(2);
  expect(api.updateVideoProgress.mock.calls[1][1]).toMatchObject({
    lastPosition: 33,
    sessionWatchedSeconds: 33,
    sequence: 2,
  });
});

test('hiding the page sends one keepalive snapshot and stops accumulating hidden watch time', async () => {
  jest.useFakeTimers();
  const { player } = await openPlayingVideo();
  player.setPosition(4);
  await act(async () => jest.advanceTimersByTime(4000));
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  await act(async () => document.dispatchEvent(new Event('visibilitychange')));
  expect(api.updateVideoProgress).toHaveBeenCalledTimes(1);
  expect(api.updateVideoProgress.mock.calls[0]).toEqual([
    'token',
    expect.objectContaining({ lastPosition: 4, sessionWatchedSeconds: 4 }),
    { keepalive: true },
  ]);
  player.setPosition(24);
  await act(async () => jest.advanceTimersByTime(20000));
  expect(api.updateVideoProgress).toHaveBeenCalledTimes(1);
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  await act(async () => document.dispatchEvent(new Event('visibilitychange')));
  player.setPosition(25);
  await act(async () => jest.advanceTimersByTime(1000));
  await act(async () => mockYoutubeProps.onStateChange({ data: 2, target: player }));
  expect(api.updateVideoProgress.mock.calls.at(-1)[1].sessionWatchedSeconds).toBe(5);
});

test('retries an unacknowledged batch with the same identity and later saves cumulative time', async () => {
  jest.useFakeTimers();
  jest.spyOn(Math, 'random').mockReturnValue(0);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  api.updateVideoProgress.mockRejectedValueOnce(new Error('offline'));
  const { player } = await openPlayingVideo();
  for (let second = 1; second <= 30; second += 1) {
    player.setPosition(second);
    await act(async () => jest.advanceTimersByTime(1000));
  }
  expect(api.updateVideoProgress).toHaveBeenCalledTimes(1);
  const first = api.updateVideoProgress.mock.calls[0][1];
  await act(async () => jest.advanceTimersByTime(2500));
  expect(api.updateVideoProgress).toHaveBeenCalledTimes(2);
  expect(api.updateVideoProgress.mock.calls[1][1]).toEqual(first);
  player.setPosition(34);
  await act(async () => mockYoutubeProps.onStateChange({ data: 2, target: player }));
  const tail = api.updateVideoProgress.mock.calls.at(-1)[1];
  expect(tail.sessionId).toBe(first.sessionId);
  expect(tail.sequence).toBeGreaterThan(first.sequence);
  expect(tail.sessionWatchedSeconds).toBeGreaterThan(first.sessionWatchedSeconds);
});

test('leaving the lesson before its first scheduled save persists the current position', async () => {
  jest.useFakeTimers();
  const { player, unmount } = await openPlayingVideo();
  player.setPosition(8);
  await act(async () => jest.advanceTimersByTime(4000));
  await act(async () => unmount());
  expect(api.updateVideoProgress).toHaveBeenCalledTimes(1);
  expect(api.updateVideoProgress.mock.calls[0]).toEqual([
    'token',
    expect.objectContaining({ lastPosition: 8, sessionWatchedSeconds: 4 }),
    { keepalive: true },
  ]);
});

test('keeps backoff when a newer cumulative snapshot replaces an offline batch', async () => {
  jest.useFakeTimers();
  jest.spyOn(Math, 'random').mockReturnValue(0);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  api.updateVideoProgress
    .mockRejectedValueOnce(new Error('offline'))
    .mockRejectedValueOnce(new Error('offline'));
  const { player } = await openPlayingVideo();
  for (let second = 1; second <= 30; second += 1) {
    player.setPosition(second);
    await act(async () => jest.advanceTimersByTime(1000));
  }
  await act(async () => jest.advanceTimersByTime(2500));
  expect(api.updateVideoProgress).toHaveBeenCalledTimes(2);
  const original = api.updateVideoProgress.mock.calls[0][1];
  player.setPosition(33);
  await act(async () => jest.advanceTimersByTime(500));
  await act(async () => mockYoutubeProps.onStateChange({ data: 2, target: player }));
  expect(api.updateVideoProgress).toHaveBeenCalledTimes(2);
  await act(async () => jest.advanceTimersByTime(4500));
  expect(api.updateVideoProgress).toHaveBeenCalledTimes(3);
  const saved = api.updateVideoProgress.mock.calls[2][1];
  expect(saved.sessionId).toBe(original.sessionId);
  expect(saved.sequence).toBeGreaterThan(original.sequence);
  expect(saved.sessionWatchedSeconds).toBe(33);
  expect(saved.lastPosition).toBe(33);
});
