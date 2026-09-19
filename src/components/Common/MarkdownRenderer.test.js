// CRA's Jest resolver cannot execute marked's ESM entry; the shipped UMD build
// is the same parser and keeps this rendering test focused on real output.
jest.mock('marked', () => require('../../../node_modules/marked/lib/marked.umd.js'));
import { parseMarkdown } from './MarkdownRenderer';

test('renders lesson callouts and CLI blocks while removing executable HTML', () => {
  const html = parseMarkdown([
    '> [!NOTE]',
    '> Nhớ **kiểm tra** cấu hình.',
    '',
    '```cli',
    '<img src=x onerror=alert(1)>',
    '```',
    '',
    '[Liên kết](javascript:alert(1))',
    '<script>alert(2)</script>',
  ].join('\n'));

  expect(html).toContain('lc-alert-box note');
  expect(html).toContain('<strong>kiểm tra</strong>');
  expect(html).toContain('lc-code-block');
  expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  expect(html).not.toMatch(/<script|href="javascript:|<img\s+src=x/i);
});

test('keeps safe lesson links and images', () => {
  const html = parseMarkdown('[Cisco](https://www.cisco.com) ![Sơ đồ](/diagram.png)');
  expect(html).toContain('href="https://www.cisco.com"');
  expect(html).toContain('src="/diagram.png"');
});

test('rejects encoded script URLs and HTML event handlers', () => {
  const html = parseMarkdown('<a href="jav&#x61;script:alert(1)" onclick="alert(2)">Mở</a><img src="/diagram.png" onerror="alert(3)">');
  expect(html).toContain('>Mở</a>');
  expect(html).toContain('src="/diagram.png"');
  expect(html).not.toMatch(/javascript:|onclick=|onerror=/i);
});
