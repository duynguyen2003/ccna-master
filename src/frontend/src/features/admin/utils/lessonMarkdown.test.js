import { formatLessonMarkdown } from './lessonMarkdown';

test('toolbar converts a selected multiline note into a Markdown callout', () => {
  const source = 'Trước\nHai dòng\nCần nhớ\nSau';
  const start = source.indexOf('Hai dòng');
  const end = source.indexOf('\nSau');
  const result = formatLessonMarkdown(source, start, end, 'note');

  expect(result.value).toBe('Trước\n\n> [!NOTE]\n> Hai dòng\n> Cần nhớ\n\nSau');
  expect(result.selectionStart).toBe(result.selectionEnd);
});

test('toolbar wraps selected text and targets link URL for replacement', () => {
  const bold = formatLessonMarkdown('Cấu hình mạng', 0, 'Cấu hình'.length, 'bold');
  expect(bold.value).toBe('**Cấu hình** mạng');
  expect(bold.value.slice(bold.selectionStart, bold.selectionEnd)).toBe('Cấu hình');

  const link = formatLessonMarkdown('Xem tài liệu', 4, 12, 'link');
  expect(link.value).toBe('Xem [tài liệu](https://example.com)');
  expect(link.value.slice(link.selectionStart, link.selectionEnd)).toBe('https://example.com');
});
