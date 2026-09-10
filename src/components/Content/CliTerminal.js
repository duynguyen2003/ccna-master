import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export default function CliTerminal({
  prompt,
  history,
  disabled,
  onCommand,
  onComplete,
  shakeKey = 0,
}) {
  const host = useRef(null);
  const term = useRef(null);
  const props = useRef({});
  props.current = { prompt, history, disabled, onCommand, onComplete };
  const input = useRef('');
  const pending = useRef(false);
  const historyIndex = useRef(-1);
  const redraw = () =>
    term.current?.write(`\x1b[2K\r${props.current.prompt || '>'}${input.current}`);
  useEffect(() => {
    const terminal = new Terminal({
      cursorBlink: true,
      convertEol: true,
      screenReaderMode: true,
      scrollback: 3000,
      fontSize: 14,
      theme: { background: '#071019', foreground: '#d7e1eb', cursor: '#4ade80' },
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(host.current);
    fit.fit();
    term.current = terminal;
    const resize = new ResizeObserver(() => {
      try {
        fit.fit();
      } catch {
        /* disposed */
      }
    });
    resize.observe(host.current);
    const subscription = terminal.onData(async (data) => {
      if (props.current.disabled || pending.current) return;
      if (data === '\r') {
        const command = input.current.trim();
        if (!command) {
          terminal.write('\r\n');
          redraw();
          return;
        }
        pending.current = true;
        input.current = '';
        historyIndex.current = -1;
        try {
          await props.current.onCommand(command);
        } catch (e) {
          terminal.write(`\r\n% ${e.message}\r\n`);
          redraw();
        } finally {
          pending.current = false;
        }
      } else if (data === '\t' || data === '?') {
        pending.current = true;
        try {
          const result = await props.current.onComplete(input.current);
          if (data === '\t' && result.completion) input.current = result.completion;
          else {
            terminal.write('\r\n');
            for (const c of result.candidates)
              terminal.write(`  ${c.value.padEnd(22)} ${c.help}\r\n`);
          }
          redraw();
        } catch (e) {
          terminal.write(`\r\n% ${e.message}\r\n`);
          redraw();
        } finally {
          pending.current = false;
        }
      } else if (data === '\x7f') {
        input.current = input.current.slice(0, -1);
        redraw();
      } else if (data === '\x03') {
        input.current = '';
        terminal.write('^C\r\n');
        redraw();
      } else if (data === '\x0c') {
        terminal.clear();
        redraw();
      } else if (data === '\x1b[A' || data === '\x1b[B') {
        const items = props.current.history.filter((h) => !h.action || h.action.type === 'command');
        if (data === '\x1b[A')
          historyIndex.current = Math.min(items.length - 1, historyIndex.current + 1);
        else historyIndex.current = Math.max(-1, historyIndex.current - 1);
        input.current =
          historyIndex.current < 0
            ? ''
            : items[items.length - 1 - historyIndex.current]?.command || '';
        redraw();
      } else if (!data.includes('\x1b')) {
        const clean = Array.from(data)
          .filter((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126)
          .join('');
        input.current = (input.current + clean).slice(0, 500);
        redraw();
      }
    });
    return () => {
      resize.disconnect();
      subscription.dispose();
      terminal.dispose();
      term.current = null;
    };
  }, []);
  useEffect(() => {
    const terminal = term.current;
    if (!terminal) return;
    terminal.reset();
    terminal.write(
      'Cisco network lab · mô phỏng CCNA\r\nTab: hoàn thành lệnh · ?: trợ giúp · ↑↓: lịch sử\r\n\r\n'
    );
    for (const event of history) {
      terminal.write(`${event.prompt}${event.command}\r\n`);
      if (event.output)
        terminal.write(
          `${event.isError ? '\x1b[31m' : ''}${event.output.replace(/\r?\n/g, '\r\n')}\x1b[0m\r\n`
        );
    }
    redraw();
  }, [history, prompt]);
  return (
    <div
      className={`cli-xterm-host ${shakeKey ? 'cli-terminal-shake' : ''}`}
      ref={host}
      aria-label="Cisco CLI terminal"
    />
  );
}
