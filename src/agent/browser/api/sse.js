// Incremental SSE framing. A network chunk is neither a UTF-8 character nor an event.
export function createSseParser(onEvent, { maxSize = 131072, onActivity = () => {} } = {}) {
  let line = '',
    data = [],
    type = '',
    id = '',
    skipLF = false,
    size = 0;
  const invalid = () => {
    throw Object.assign(new Error('AI_INVALID_RESPONSE'), { code: 'AI_INVALID_RESPONSE' });
  };
  function endLine() {
    if (!line) {
      if (data.length) onEvent({ type: type || 'message', id, data: data.join('\n') });
      data = [];
      type = '';
      size = 0;
    } else if (!line.startsWith(':')) {
      const colon = line.indexOf(':');
      const field = colon < 0 ? line : line.slice(0, colon);
      let value = colon < 0 ? '' : line.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'data') data.push(value);
      else if (field === 'event') type = value;
      else if (field === 'id' && !value.includes('\0')) id = value;
    }
    line = '';
  }
  return {
    push(text) {
      onActivity();
      for (const char of text) {
        if (skipLF) {
          skipLF = false;
          if (char === '\n') continue;
        }
        if (++size > maxSize) invalid();
        if (char === '\r' || char === '\n') {
          endLine();
          skipLF = char === '\r';
        } else line += char;
      }
    },
    // EOF does not dispatch an unterminated event.
    end() {
      line = '';
      data = [];
      type = '';
      size = 0;
    },
  };
}

export async function readSse(body, onEvent, { signal, onActivity } = {}) {
  if (!body?.getReader)
    throw Object.assign(new Error('AI_STREAM_UNAVAILABLE'), { code: 'AI_STREAM_UNAVAILABLE' });
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const parser = createSseParser(onEvent, { onActivity });
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    while (!signal?.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      parser.push(decoder.decode(value, { stream: true }));
    }
    if (!signal?.aborted) parser.push(decoder.decode());
    parser.end();
  } finally {
    signal?.removeEventListener('abort', cancel);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
