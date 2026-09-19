import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Lesson from './Lesson';
import api from '../../services/Api';

let mockVideoProps;

jest.mock('react-router-dom', () => {
  const params = new URLSearchParams('course=1&lesson=11');
  const navigate = jest.fn();
  return { useNavigate: () => navigate, useSearchParams: () => [params] };
});

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ token: 'token', user: { id: 1, role: 'STUDENT' } }),
}));
jest.mock('../Toast', () => ({
  useToast: () => ({ showToast: jest.fn(), ToastComponent: null }),
}));
jest.mock('../../hooks/useLearningProgress', () => ({ storeTransitionEvent: jest.fn() }));
jest.mock('./VideoProgressPlayer', () => {
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
jest.mock('../Common/MarkdownRenderer', () => ({
  __esModule: true,
  default: ({ content }) => <div>{content}</div>,
}));
jest.mock('../../services/Api', () => ({
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
  api.updateUserProgress.mockReturnValue(new Promise((resolve) => {
    confirmCompletion = resolve;
  }));

  render(<Lesson />);
  const confirmButton = await screen.findByRole('button', { name: 'Đã đọc xong' });
  const nextButton = screen.getByRole('button', { name: /Tiếp theo/ });
  expect(nextButton).toBeDisabled();
  expect(screen.queryByText('Bài học chưa có video.')).not.toBeInTheDocument();

  fireEvent.click(confirmButton);
  expect(api.updateUserProgress).toHaveBeenCalledWith('token', expect.objectContaining({
    lessonId: 11,
    progressPercent: 100,
    status: 'COMPLETED',
  }));
  expect(nextButton).toBeDisabled();

  confirmCompletion({ data: { status: 'COMPLETED', progressPercent: 100 }, transition: { changed: false } });
  await waitFor(() => expect(nextButton).toBeEnabled());
  expect(screen.getByText('Hoàn thành')).toBeInTheDocument();
});

test('notes remain locked after a failed load and retry restores the saved content', async () => {
  let finishLoad;
  api.getCourses.mockResolvedValue([{ id: '1', code: 'CCNA' }]);
  api.getModulesByCourse.mockResolvedValue([
    { id: 2, title: 'Chương 1', lessons: [{ id: 11 }] },
  ]);
  api.getLessonsByModule.mockResolvedValue([
    { id: 11, title: 'Bài đọc', contentHtml: '', videoUrl: '' },
  ]);
  api.getUserProgress.mockResolvedValue({ _raw: [] });
  api.getUserNote.mockReturnValueOnce(new Promise((resolve, reject) => {
    finishLoad = reject;
  })).mockResolvedValue('Ghi chú đã lưu trước đó');
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
  api.getModulesByCourse.mockResolvedValue([
    { id: 2, title: 'Chương 1', lessons: [{ id: 11 }] },
  ]);
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
  expect(screen.getByText('0/1 bài')).toBeInTheDocument();
  expect(screen.queryByText('Ghi chú từ giảng viên')).not.toBeInTheDocument();
  expect(await screen.findByRole('button', { name: 'Tiếp tục từ 1:30' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Mở hoặc đóng ghi chú bài học' }));
  const timestamp = await screen.findByRole('button', { name: '1:30' });
  fireEvent.click(timestamp);
  await waitFor(() => expect(mockVideoProps.seekRequest).toEqual(expect.objectContaining({ seconds: 90 })));

  const note = screen.getByRole('textbox', { name: 'Ghi chú cá nhân cho bài học' });
  fireEvent.click(screen.getByRole('button', { name: 'Gắn mốc 1:35' }));
  await waitFor(() => expect(note).toHaveValue('[1:30] show ip route\n[1:35] '));
  expect(screen.getByText('28 / 10.000 ký tự')).toBeInTheDocument();
});
