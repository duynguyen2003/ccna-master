import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import Lesson from './Lesson';
import api from '../../../services/Api';

let mockVideoProps;
let mockAuth;
let mockSearchParams;
const mockNavigate = jest.fn();

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [mockSearchParams],
}));

jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));
jest.mock('../../../components/ui/Toast', () => ({
  useToast: () => ({ showToast: jest.fn(), ToastComponent: null }),
}));
jest.mock('../../courses/hooks/useLearningProgress', () => ({ storeTransitionEvent: jest.fn() }));
jest.mock('../components/VideoProgressPlayer', () => {
  const React = require('react');
  const MockVideoProgressPlayer = (props) => {
    mockVideoProps = props;
    React.useEffect(() => {
      props.onMetricsChange(props.lessonId, {
        playedSeconds: 95,
        durationSeconds: 120,
        lastPosition: 90,
        saveStatus: 'saved',
      });
      // The real player reports metrics when the lesson player is ready.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.lessonId]);
    return <div data-testid="video-player" />;
  };
  return {
    __esModule: true,
    formatVideoTime: (seconds = 0) => {
      const safeSeconds = Math.max(0, Math.floor(seconds));
      const minutes = Math.floor(safeSeconds / 60);
      return `${minutes}:${String(safeSeconds % 60).padStart(2, '0')}`;
    },
    default: MockVideoProgressPlayer,
  };
});
jest.mock('../../../components/common/MarkdownRenderer', () => ({
  __esModule: true,
  default: ({ content }) => <div>{content}</div>,
}));
jest.mock('../../../services/Api', () => ({
  __esModule: true,
  default: {
    getCourses: jest.fn(),
    getModulesByCourse: jest.fn(),
    getLessonsByModule: jest.fn(),
    getUserProgress: jest.fn(),
    getUserNote: jest.fn(),
    updateUserNote: jest.fn(),
    updateUserProgress: jest.fn(),
  },
}));

beforeEach(() => {
  jest.resetAllMocks();
  mockVideoProps = null;
  mockAuth = { token: 'token', user: { id: 1, role: 'STUDENT' } };
  mockSearchParams = new URLSearchParams('course=1&lesson=11');
  api.getCourses.mockResolvedValue([{ id: '1', code: 'CCNA' }]);
  api.getUserProgress.mockResolvedValue({ _raw: [] });
  api.getUserNote.mockResolvedValue('');
});

const deferred = () => {
  let resolve;
  const promise = new Promise((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
};

const gatedLessons = () => [
  {
    id: 11,
    title: 'Video mở đầu',
    hasVideo: true,
    videoUrl: 'https://youtu.be/example',
    contentHtml: '',
    canAccess: true,
  },
  {
    id: 12,
    title: 'Bài đọc thứ hai',
    hasVideo: false,
    videoUrl: null,
    contentHtml: null,
    canAccess: false,
    lockedReason: 'Xem ít nhất 70% video mở đầu.',
  },
  {
    id: 13,
    title: 'Bài thứ ba',
    hasVideo: false,
    videoUrl: null,
    contentHtml: null,
    canAccess: false,
    lockedReason: 'Xem ít nhất 70% video mở đầu.',
  },
];

test('sidebar and Next remain locked through 69.99%, pending save and pending permission refresh', async () => {
  const lessons = gatedLessons();
  const save = deferred();
  const access = deferred();
  api.getModulesByCourse.mockResolvedValue([
    { id: 2, title: 'Chương 1', canAccess: true, lessons },
  ]);
  api.updateUserProgress
    .mockResolvedValueOnce({ data: { progressPercent: 69, status: 'ACTIVE' } })
    .mockReturnValueOnce(save.promise);
  api.getLessonsByModule.mockReturnValue(access.promise);
  render(<Lesson />);
  await screen.findByTestId('video-player');
  fireEvent.click(screen.getByRole('button', { name: 'Mở hoặc đóng nội dung chương' }));
  const second = screen.getByRole('button', { name: /Bài đọc thứ hai/ });
  const third = screen.getByRole('button', { name: /Bài thứ ba/ });
  expect(second).toHaveAttribute('aria-disabled', 'true');
  fireEvent.click(second);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Video mở đầu');
  await act(async () =>
    mockVideoProps.onProgressChange({ played: 0.6999, playedSeconds: 83, loadedSeconds: 120 })
  );
  expect(api.updateUserProgress).toHaveBeenLastCalledWith(
    'token',
    expect.objectContaining({ progressPercent: 69 })
  );
  await act(async () =>
    mockVideoProps.onProgressChange({ played: 0.7, playedSeconds: 84, loadedSeconds: 120 })
  );
  expect(api.updateUserProgress).toHaveBeenCalledTimes(2); // Threshold bypasses the 10%/5s throttle.
  expect(second).toHaveAttribute('aria-disabled', 'true');
  await act(async () => save.resolve({ data: { progressPercent: 70, status: 'ACTIVE' } }));
  expect(second).toHaveAttribute('aria-disabled', 'true');
  const updated = lessons.map((l) =>
    l.id === 12 ? { ...l, canAccess: true, contentHtml: 'Nội dung bài đọc', lockedReason: null } : l
  );
  await act(async () => access.resolve(updated));
  expect(second).toHaveAttribute('aria-disabled', 'false');
  expect(third).toHaveAttribute('aria-disabled', 'true');
  fireEvent.click(third);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Video mở đầu');
  fireEvent.click(second);
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Bài đọc thứ hai' })
  ).toBeInTheDocument();
});

test('locked lesson deep link never mounts the player or loads a private note', async () => {
  mockSearchParams = new URLSearchParams('course=1&lesson=12');
  api.getModulesByCourse.mockResolvedValue([
    { id: 2, title: 'Chương 1', canAccess: true, lessons: gatedLessons() },
  ]);
  render(<Lesson />);
  expect(
    await screen.findByRole('heading', { name: 'Bài học chưa được mở khóa' })
  ).toBeInTheDocument();
  expect(screen.getByText('Xem ít nhất 70% video mở đầu.')).toBeInTheDocument();
  expect(screen.queryByTestId('video-player')).not.toBeInTheDocument();
  expect(api.getUserNote).not.toHaveBeenCalled();
});

test('changing the URL to a locked lesson closes the current lesson', async () => {
  api.getModulesByCourse.mockResolvedValue([
    { id: 2, title: 'Chương 1', canAccess: true, lessons: gatedLessons() },
  ]);
  const view = render(<Lesson />);
  await screen.findByTestId('video-player');
  mockSearchParams = new URLSearchParams('course=1&lesson=12');
  view.rerender(<Lesson />);
  expect(
    await screen.findByRole('heading', { name: 'Bài học chưa được mở khóa' })
  ).toBeInTheDocument();
  expect(screen.queryByTestId('video-player')).not.toBeInTheDocument();
});

test('cross-module URL revalidates a stale locked module with the server', async () => {
  api.getModulesByCourse.mockResolvedValue([
    { id: 2, title: 'Chương 1', canAccess: true, lessons: gatedLessons() },
    {
      id: 3,
      title: 'Chương 2',
      canAccess: false,
      lessons: [{ id: 21, title: 'Bài mới', canAccess: false }],
    },
  ]);
  api.getLessonsByModule.mockResolvedValue([
    { id: 21, title: 'Bài vừa mở', contentHtml: 'Nội dung mới', videoUrl: '', canAccess: true },
  ]);
  const view = render(<Lesson />);
  await screen.findByTestId('video-player');
  mockSearchParams = new URLSearchParams('course=1&lesson=21');
  view.rerender(<Lesson />);
  expect(await screen.findByRole('heading', { level: 1, name: 'Bài vừa mở' })).toBeInTheDocument();
  expect(api.getLessonsByModule).toHaveBeenCalledWith('token', 3);
});

test('permission refresh failure stays locked and can be retried without another progress write', async () => {
  const lessons = gatedLessons();
  api.getModulesByCourse.mockResolvedValue([
    { id: 2, title: 'Chương 1', canAccess: true, lessons },
  ]);
  api.updateUserProgress.mockResolvedValue({ data: { progressPercent: 70, status: 'ACTIVE' } });
  api.getLessonsByModule
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(
      lessons.map((l) => (l.id === 12 ? { ...l, canAccess: true, contentHtml: 'Bài đọc' } : l))
    );
  render(<Lesson />);
  await screen.findByTestId('video-player');
  await act(async () =>
    mockVideoProps.onProgressChange({ played: 0.7, playedSeconds: 84, loadedSeconds: 120 })
  );
  expect(screen.getByRole('button', { name: 'Tiếp theo', exact: true })).toBeDisabled();
  fireEvent.click(await screen.findByRole('button', { name: 'Thử lại', exact: true }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Tiếp theo', exact: true })).toBeEnabled()
  );
  expect(api.updateUserProgress).toHaveBeenCalledTimes(1);
});

test('text-only lesson waits for server confirmation before enabling the next lesson', async () => {
  let confirmCompletion;
  api.getCourses.mockResolvedValue([{ id: '1', code: 'CCNA' }]);
  api.getModulesByCourse.mockResolvedValue([
    { id: 2, title: 'Chương 1', lessons: [{ id: 11 }, { id: 12 }] },
  ]);
  api.getLessonsByModule.mockResolvedValue([
    { id: 11, title: 'Bài đọc', contentHtml: 'Nội dung từ giảng viên', videoUrl: '' },
    { id: 12, title: 'Bài tiếp theo', contentHtml: '', videoUrl: '' },
  ]);
  api.getUserProgress.mockResolvedValue({ _raw: [] });
  api.getUserNote.mockResolvedValue('');
  api.updateUserProgress.mockReturnValue(
    new Promise((resolve) => {
      confirmCompletion = resolve;
    })
  );

  render(<Lesson />);
  const confirmButton = await screen.findByRole('button', { name: 'Đã đọc xong' });
  const nextButton = screen.getByRole('button', { name: /Tiếp theo/ });
  expect(nextButton).toBeDisabled();
  expect(screen.queryByText('Bài học chưa có video.')).not.toBeInTheDocument();

  fireEvent.click(confirmButton);
  expect(api.updateUserProgress).toHaveBeenCalledWith(
    'token',
    expect.objectContaining({
      lessonId: 11,
      progressPercent: 100,
      status: 'COMPLETED',
    })
  );
  expect(nextButton).toBeDisabled();

  confirmCompletion({
    data: { status: 'COMPLETED', progressPercent: 100 },
    transition: { changed: false },
  });
  await waitFor(() => expect(nextButton).toBeEnabled());
  expect(screen.getByText('Hoàn thành')).toBeInTheDocument();
});

test('notes remain locked after a failed load and retry restores the saved content', async () => {
  let finishLoad;
  api.getCourses.mockResolvedValue([{ id: '1', code: 'CCNA' }]);
  api.getModulesByCourse.mockResolvedValue([{ id: 2, title: 'Chương 1', lessons: [{ id: 11 }] }]);
  api.getLessonsByModule.mockResolvedValue([
    { id: 11, title: 'Bài đọc', contentHtml: '', videoUrl: '' },
  ]);
  api.getUserProgress.mockResolvedValue({ _raw: [] });
  api.getUserNote
    .mockReturnValueOnce(
      new Promise((resolve, reject) => {
        finishLoad = reject;
      })
    )
    .mockResolvedValue('Ghi chú đã lưu trước đó');
  api.updateUserNote.mockClear();
  const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    render(<Lesson />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mở hoặc đóng ghi chú bài học' }));
    const note = await screen.findByRole('textbox', { name: 'Ghi chú cá nhân cho bài học' });
    await waitFor(() => expect(finishLoad).toBeDefined());
    expect(note).toBeDisabled();
    fireEvent.change(note, { target: { value: 'Nội dung ghi đè' } });
    expect(api.updateUserNote).not.toHaveBeenCalled();
    finishLoad(new Error('503'));
    const retry = await screen.findByRole('button', { name: 'Thử tải lại' });
    expect(note).toBeDisabled();
    expect(screen.getByText(/Nội dung đã lưu vẫn được giữ nguyên/)).toBeInTheDocument();
    fireEvent.click(retry);
    await waitFor(() => expect(note).toHaveValue('Ghi chú đã lưu trước đó'));
    expect(note).toBeEnabled();
    expect(api.updateUserNote).not.toHaveBeenCalled();
  } finally {
    errorLog.mockRestore();
  }
});

test('video lesson normalizes the learning UI and timestamp notes seek the player', async () => {
  api.getCourses.mockResolvedValue([{ id: '1', code: 'CCNA' }]);
  api.getModulesByCourse.mockResolvedValue([{ id: 2, title: 'Chương 1', lessons: [{ id: 11 }] }]);
  api.getLessonsByModule.mockResolvedValue([
    {
      id: 11,
      title: 'service',
      sectionNumber: '1.1.1',
      contentHtml: '',
      videoUrl: 'https://www.youtube.com/watch?v=example',
      videoDuration: '2:01',
    },
  ]);
  api.getUserProgress.mockResolvedValue({ _raw: [] });
  api.getUserNote.mockResolvedValue('[1:30] show ip route');

  render(<Lesson />);

  expect(await screen.findByRole('heading', { level: 1, name: 'Service' })).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'Đường dẫn bài học' })).toHaveTextContent(
    'Khóa học›CCNA›Chương 1›Bài 1.1.1'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Mở hoặc đóng nội dung chương' }));
  expect(screen.getByText('0/1 bài')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Đóng hộp thoại' }));
  expect(screen.queryByText('Ghi chú từ giảng viên')).not.toBeInTheDocument();
  expect(await screen.findByRole('button', { name: 'Tiếp tục từ 1:30' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Mở hoặc đóng ghi chú bài học' }));
  const timestamp = await screen.findByRole('button', { name: '1:30' });
  fireEvent.click(timestamp);
  await waitFor(() =>
    expect(mockVideoProps.seekRequest).toEqual(expect.objectContaining({ seconds: 90 }))
  );

  const note = screen.getByRole('textbox', { name: 'Ghi chú cá nhân cho bài học' });
  fireEvent.click(screen.getByRole('button', { name: 'Gắn mốc 1:35' }));
  await waitFor(() => expect(note).toHaveValue('[1:30] show ip route\n[1:35] '));
  expect(screen.getByText('28 / 10.000 ký tự')).toBeInTheDocument();
});

test('opens embedded lesson content while catalog and progress are still pending', async () => {
  const catalog = deferred();
  const progress = deferred();
  api.getCourses.mockReturnValue(catalog.promise);
  api.getUserProgress.mockReturnValue(progress.promise);
  api.getModulesByCourse.mockResolvedValue([
    {
      id: 2,
      title: 'Chương 1',
      lessons: [{ id: 11, title: 'Nội dung sẵn có', contentHtml: 'Bài đọc', videoUrl: '' }],
    },
  ]);

  render(<Lesson />);

  expect(screen.getByRole('status')).toHaveTextContent('Đang tải nội dung bài học...');
  expect(api.getModulesByCourse).toHaveBeenCalledWith('token', '1');
  expect(api.getUserProgress).toHaveBeenCalledWith('token');
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Nội dung sẵn có' })
  ).toBeInTheDocument();
  expect(api.getLessonsByModule).not.toHaveBeenCalled();
  expect(screen.queryByText('Đang tải nội dung bài học...')).not.toBeInTheDocument();
});

test('late aggregate progress cannot remove completion already confirmed by the player', async () => {
  const progress = deferred();
  api.getUserProgress.mockReturnValue(progress.promise);
  api.getModulesByCourse.mockResolvedValue([
    {
      id: 2,
      title: 'Chương 1',
      lessons: [
        { id: 11, title: 'Video', contentHtml: '', videoUrl: 'https://youtu.be/example' },
        { id: 12, title: 'Bài tiếp theo', contentHtml: '', videoUrl: '' },
      ],
    },
  ]);
  render(<Lesson />);
  await screen.findByTestId('video-player');
  const next = screen.getByRole('button', { name: /Tiếp theo/ });
  expect(next).toBeDisabled();

  act(() => mockVideoProps.onMetricsChange(11, { serverCompleted: true }));
  expect(next).toBeEnabled();
  await act(async () => {
    progress.resolve({ _raw: [{ lessonId: 11, status: 'ACTIVE', progressPercent: 10 }] });
  });

  expect(next).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Mở hoặc đóng nội dung chương' }));
  expect(screen.getByText('1/2 bài')).toBeInTheDocument();
});

test('late responses from the previous account and course cannot replace the current lesson', async () => {
  const oldCatalog = deferred();
  const oldModules = deferred();
  const oldProgress = deferred();
  api.getCourses.mockReturnValueOnce(oldCatalog.promise);
  api.getModulesByCourse.mockReturnValueOnce(oldModules.promise);
  api.getUserProgress.mockReturnValueOnce(oldProgress.promise);
  const view = render(<Lesson />);

  mockAuth = { token: 'token-b', user: { id: 2, role: 'STUDENT' } };
  mockSearchParams = new URLSearchParams('course=2&lesson=21');
  api.getCourses.mockResolvedValue([{ id: '2', code: 'NEW', title: 'Khóa học mới' }]);
  api.getModulesByCourse.mockResolvedValue([
    {
      id: 3,
      title: 'Chương mới',
      lessons: [{ id: 21, title: 'Bài mới', contentHtml: '', videoUrl: '' }],
    },
  ]);
  view.rerender(<Lesson />);
  await screen.findByRole('heading', { level: 1, name: 'Bài mới' });

  await act(async () => {
    oldCatalog.resolve([{ id: '1', code: 'OLD', title: 'Khóa học cũ' }]);
    oldModules.resolve([
      {
        id: 2,
        title: 'Chương cũ',
        lessons: [{ id: 11, title: 'Bài cũ', contentHtml: '', videoUrl: '' }],
      },
    ]);
    oldProgress.resolve({ _raw: [{ lessonId: 21, status: 'COMPLETED', progressPercent: 100 }] });
  });

  expect(screen.getByRole('heading', { level: 1, name: 'Bài mới' })).toBeInTheDocument();
  expect(screen.queryByText('Bài cũ')).not.toBeInTheDocument();
  expect(screen.queryByText('Khóa học cũ')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Mở hoặc đóng nội dung chương' }));
  expect(screen.getByText('0/1 bài')).toBeInTheDocument();
  expect(api.getModulesByCourse).toHaveBeenLastCalledWith('token-b', '2');
});

test('a URL without a course still selects the first available course', async () => {
  const catalog = deferred();
  mockSearchParams = new URLSearchParams();
  api.getCourses.mockReturnValue(catalog.promise);
  api.getModulesByCourse.mockResolvedValue([
    {
      id: 2,
      title: 'Chương 1',
      lessons: [{ id: 11, title: 'Bài đầu tiên', contentHtml: '', videoUrl: '' }],
    },
  ]);
  render(<Lesson />);
  expect(api.getModulesByCourse).not.toHaveBeenCalled();

  await act(async () => catalog.resolve([{ id: '1', code: 'CCNA' }]));

  expect(
    await screen.findByRole('heading', { level: 1, name: 'Bài đầu tiên' })
  ).toBeInTheDocument();
  expect(api.getModulesByCourse).toHaveBeenCalledWith('token', '1');
  expect(api.getLessonsByModule).not.toHaveBeenCalled();
});

test('bottom navigation preserves the video threshold and first/last lesson boundaries', async () => {
  api.getModulesByCourse.mockResolvedValue([
    {
      id: 2,
      title: 'Chương 1',
      lessons: [
        { id: 11, title: 'Video đầu tiên', contentHtml: '', videoUrl: 'https://youtu.be/example' },
        { id: 12, title: 'Bài cuối', contentHtml: 'Nội dung cuối', videoUrl: '' },
      ],
    },
  ]);
  api.updateUserProgress.mockResolvedValue({ data: { status: 'ACTIVE', progressPercent: 70 } });
  render(<Lesson />);
  await screen.findByTestId('video-player');
  const previous = screen.getByRole('button', { name: 'Trước', exact: true });
  const next = screen.getByRole('button', { name: 'Tiếp theo', exact: true });
  expect(previous).toBeDisabled();
  expect(next).toBeDisabled();
  expect(next).toHaveAccessibleDescription('Xem ít nhất 70% video để mở bài tiếp theo.');

  act(() =>
    mockVideoProps.onProgressChange({ played: 0.69, playedSeconds: 82, loadedSeconds: 120 })
  );
  expect(next).toBeDisabled();
  await act(async () =>
    mockVideoProps.onProgressChange({ played: 0.7, playedSeconds: 84, loadedSeconds: 120 })
  );
  expect(next).toBeEnabled();
  fireEvent.click(next);
  expect(await screen.findByRole('heading', { level: 1, name: 'Bài cuối' })).toBeInTheDocument();
  expect(previous).toBeEnabled();
  expect(next).toBeDisabled();
  expect(next).toHaveAccessibleDescription('Đây là bài cuối cùng trong chương.');
  fireEvent.click(previous);
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Video đầu tiên' })
  ).toBeInTheDocument();
  expect(previous).toBeDisabled();
});

test('notes open on demand, preserve the player and restore focus when dismissed', async () => {
  api.getModulesByCourse.mockResolvedValue([
    {
      id: 2,
      title: 'Chương 1',
      lessons: [
        { id: 11, title: 'Video bài học', contentHtml: '', videoUrl: 'https://youtu.be/example' },
      ],
    },
  ]);
  api.getUserNote.mockResolvedValue('Nội dung đã lưu');
  render(<Lesson />);
  const player = await screen.findByTestId('video-player');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  const trigger = screen.getByRole('button', { name: 'Mở hoặc đóng ghi chú bài học' });
  trigger.focus();
  fireEvent.click(trigger);
  const drawer = screen.getByRole('dialog', { name: 'Ghi chú bài học' });
  expect(await screen.findByRole('textbox', { name: 'Ghi chú cá nhân cho bài học' })).toHaveValue(
    'Nội dung đã lưu'
  );
  expect(screen.getByRole('button', { name: 'Đóng hộp thoại' })).toHaveFocus();
  fireEvent(drawer, new Event('cancel', { bubbles: true, cancelable: true }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  expect(screen.getByTestId('video-player')).toBe(player);
  fireEvent.click(trigger);
  expect(screen.getByRole('textbox', { name: 'Ghi chú cá nhân cho bài học' })).toHaveValue(
    'Nội dung đã lưu'
  );
  expect(api.updateUserNote).not.toHaveBeenCalled();
});

test('desktop curriculum toggles after notes, stays mounted and returns focus on collapse', async () => {
  const previousWidth = window.innerWidth;
  Object.defineProperty(window, 'innerWidth', { value: 1440, writable: true });
  try {
    api.getModulesByCourse.mockResolvedValue([
      {
        id: 2,
        title: 'Chương 1',
        lessons: [{ id: 11, title: 'Bài đọc', videoUrl: '', contentHtml: 'Nội dung bài' }],
      },
    ]);
    render(<Lesson />);
    await screen.findByRole('heading', { level: 1, name: 'Bài đọc' });
    const notes = screen.getByRole('button', { name: 'Mở hoặc đóng ghi chú bài học' });
    const toggle = screen.getByRole('button', { name: 'Mở hoặc đóng nội dung chương' });
    notes.focus();
    userEvent.tab();
    expect(toggle).toHaveFocus();
    const panel = screen.getByRole('complementary', { name: 'Nội dung chương' });
    fireEvent.click(screen.getByRole('button', { name: 'Thu gọn nội dung chương' }));
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(panel).toHaveAttribute('inert');
    expect(panel).toHaveAttribute('aria-hidden', 'true');
    expect(
      screen.queryByRole('complementary', { name: 'Nội dung chương' })
    ).not.toBeInTheDocument();
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(screen.getByRole('complementary', { name: 'Nội dung chương' })).toBe(panel);
    expect(panel).not.toHaveAttribute('inert');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  } finally {
    window.innerWidth = previousWidth;
  }
});
