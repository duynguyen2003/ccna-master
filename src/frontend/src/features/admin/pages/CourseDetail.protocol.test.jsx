import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CourseDetail from './CourseDetail';
import { AuthContext } from '../../../context/AuthContext';
import { adminApi } from '../../../services/api/adminApi';

jest.mock('react-router-dom', () => ({
  useParams: () => ({ courseId: '1' }),
  useNavigate: () => jest.fn(),
}));
jest.mock('../../../context/AuthContext', () => ({
  AuthContext: require('react').createContext({ token: 'test' }),
}));
jest.mock('../../../services/api/adminApi', () => ({
  adminApi: {
    getCourses: jest.fn(),
    getModules: jest.fn(),
    getTopics: jest.fn(),
    updateLesson: jest.fn(),
  },
}));
jest.mock('../../../components/common/MarkdownRenderer', () => ({
  __esModule: true,
  default: ({ content }) => <div>{content}</div>,
}));

test('admin selects a protocol, edits content without exposing metadata, previews and saves association', async () => {
  adminApi.getCourses.mockResolvedValue({ data: [{ id: '1', title: 'CCNA' }] });
  adminApi.getModules.mockResolvedValue({
    data: [
      {
        id: '2',
        title: 'Networking',
        lessons: [{ id: '3', title: 'Network fundamentals', contentHtml: 'Draft' }],
      },
    ],
  });
  adminApi.getTopics.mockResolvedValue({ data: [] });
  adminApi.updateLesson.mockResolvedValue({});
  render(
    <AuthContext.Provider value={{ token: 'test' }}>
      <CourseDetail />
    </AuthContext.Provider>
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Network fundamentals' }));
  fireEvent.click(screen.getByRole('button', { name: /Tiếp theo/ }));
  fireEvent.click(screen.getByRole('combobox', { name: 'Mô phỏng giao thức' }));
  fireEvent.click(screen.getByRole('option', { name: 'DNS', exact: true }));
  const editor = screen.getByRole('textbox', { name: 'Nội dung bài học' });
  expect(editor).toHaveValue('Draft');
  fireEvent.change(editor, { target: { value: 'Draft\n\n' } });
  expect(editor).toHaveValue('Draft\n\n');
  fireEvent.click(screen.getByRole('button', { name: /Tiếp theo/ }));
  expect(await screen.findByRole('region', { name: 'Mô phỏng DNS' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Lưu cập nhật' }));
  await waitFor(() =>
    expect(adminApi.updateLesson).toHaveBeenCalledWith(
      'test',
      '3',
      expect.objectContaining({ contentHtml: 'Draft\n\n\n\n<!-- netmaster-protocol:dns -->' })
    )
  );
});
