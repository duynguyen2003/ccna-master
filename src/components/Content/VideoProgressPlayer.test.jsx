import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import VideoProgressPlayer from './VideoProgressPlayer';
import api from '../../services/Api';

let mockYoutubeProps;
jest.mock('react-youtube', () => ({
  __esModule: true,
  default: (props) => {
    mockYoutubeProps = props;
    return <div data-testid="youtube-player" />;
  },
}));
jest.mock('../../services/Api', () => ({
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

test('waits for saved bookmark before mounting player, then resumes the correct lesson', async () => {
  let resolveProgress;
  api.getVideoProgress.mockReturnValue(new Promise((resolve) => {
    resolveProgress = resolve;
  }));
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
  expect(api.updateVideoProgress).toHaveBeenCalledWith('token', expect.objectContaining({
    lastPosition: 42,
  }));
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
  expect(payloads.some((payload) =>
    payload.lastPosition === 8 && payload.sessionWatchedSeconds === 4
  )).toBe(true);
  expect(payloads.every((payload) => payload.sessionStartedAt && payload.sessionStartedAt <= payload.capturedAt))
    .toBe(true);
  expect(onProgressChange).toHaveBeenCalledWith(expect.objectContaining({
    playedSeconds: 8,
    eligibleCompletion: false,
  }));
  jest.useRealTimers();
});

test('ignores a late bookmark response after switching lessons', async () => {
  const resolvers = {};
  api.getVideoProgress.mockImplementation((token, lessonId) =>
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
