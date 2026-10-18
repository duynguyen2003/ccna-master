const CALLOUT_LABELS = {
  note: 'NOTE',
  tip: 'TIP',
  warning: 'WARNING',
};

const clamp = (value, length) => Math.max(0, Math.min(Number(value) || 0, length));

const formatLessonMarkdown = (source, selectionStart, selectionEnd, action) => {
  const content = String(source || '');
  const start = clamp(selectionStart, content.length);
  const end = Math.max(start, clamp(selectionEnd, content.length));
  const selected = content.slice(start, end);
  let replaceStart = start;
  let replaceEnd = end;
  let inserted = '';
  let selectedStartInInsert = 0;
  let selectedEndInInsert = 0;

  if (action === 'bold' || action === 'italic') {
    const marker = action === 'bold' ? '**' : '*';
    const body = selected || (action === 'bold' ? 'Nội dung in đậm' : 'Nội dung in nghiêng');
    inserted = `${marker}${body}${marker}`;
    selectedStartInInsert = marker.length;
    selectedEndInInsert = marker.length + body.length;
  } else if (action === 'link') {
    const label = selected || 'Tên liên kết';
    const url = 'https://example.com';
    inserted = `[${label}](${url})`;
    selectedStartInInsert = selected ? label.length + 3 : 1;
    selectedEndInInsert = selectedStartInInsert + (selected ? url.length : label.length);
  } else if (action === 'heading' || action === 'list') {
    replaceStart = start === 0 ? 0 : content.lastIndexOf('\n', start - 1) + 1;
    const nextLine = content.indexOf('\n', end);
    replaceEnd = nextLine === -1 ? content.length : nextLine;
    const currentLines = content.slice(replaceStart, replaceEnd);
    const body = currentLines || (action === 'heading' ? 'Tiêu đề mục' : 'Mục danh sách');
    const prefix = action === 'heading' ? '## ' : '- ';
    inserted = body.split('\n').map((line) => `${prefix}${line}`).join('\n');
    selectedStartInInsert = prefix.length;
    selectedEndInInsert = currentLines ? inserted.length : prefix.length + body.length;
  } else if (action === 'code' || CALLOUT_LABELS[action]) {
    const body = selected || (action === 'code' ? 'show running-config' : 'Nội dung cần ghi nhớ');
    const leading = content.slice(0, start).endsWith('\n\n') || start === 0
      ? ''
      : content.slice(0, start).endsWith('\n') ? '\n' : '\n\n';
    const trailing = content.slice(end).startsWith('\n\n') || end === content.length
      ? ''
      : content.slice(end).startsWith('\n') ? '\n' : '\n\n';
    const block = action === 'code'
      ? `\`\`\`cli\n${body}\n\`\`\``
      : `> [!${CALLOUT_LABELS[action]}]\n> ${body.split('\n').join('\n> ')}`;
    inserted = `${leading}${block}${trailing}`;
    selectedStartInInsert = leading.length + (action === 'code' ? 7 : `> [!${CALLOUT_LABELS[action]}]\n> `.length);
    selectedEndInInsert = selectedStartInInsert + (selected ? 0 : body.length);
  } else {
    return { value: content, selectionStart: start, selectionEnd: end };
  }

  return {
    value: content.slice(0, replaceStart) + inserted + content.slice(replaceEnd),
    selectionStart: replaceStart + selectedStartInInsert,
    selectionEnd: replaceStart + selectedEndInInsert,
  };
};

module.exports = { formatLessonMarkdown };
