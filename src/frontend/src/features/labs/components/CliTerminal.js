import React, { useCallback, useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { terminalOutput } from '../utils/terminalFormatting';

const paletteOf = (node) => {
  const css = getComputedStyle(node);
  const value = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  return {
    background: value('--surface-terminal', '#071019'),
    foreground: value('--terminal-foreground', '#d7e1eb'),
    cursor: value('--terminal-cursor', '#4ade80'),
    selectionBackground: value('--terminal-selection', '#284563'),
  };
};

export default function CliTerminal({
  prompt,
  history,
  disabled,
  onCommand,
  onComplete,
  shakeKey = 0,
  theme,
  initialDraft = '',
  onDraftChange,
}) {
  const host = useRef(null);
  const term = useRef(null);
  const props = useRef({});
  props.current = { prompt, history, disabled, onCommand, onComplete, onDraftChange };
  const input = useRef(initialDraft);
  const pending = useRef(false);
  const historyIndex = useRef(-1);
  const rendered = useRef(null);
  const selectedDraft = useRef(false);
  const edits = useRef({ undo: [], redo: [] });
  const drawnLine = useRef('');
  const drawVersion = useRef(0);
  const eraseDraft = useCallback(() => {
    const rows = Math.floor(Math.max(0, drawnLine.current.length - 1) / (term.current?.cols || 80));
    drawnLine.current = '';
    return `\r${rows ? `\x1b[${rows}A` : ''}\x1b[J`;
  }, []);
  const redraw = useCallback(() => {
    props.current.onDraftChange?.(input.current);
    const terminal = term.current;
    if (!terminal) return;
    const value = input.current;
    const text = `${props.current.prompt || '>'}${value}`;
    const output = `${eraseDraft()}${text}`;
    drawnLine.current = text;
    const version = ++drawVersion.current;
    if (!selectedDraft.current || !value) {
      terminal.write(output);
      return;
    }
    terminal.write(output, () => {
      if (term.current !== terminal || !selectedDraft.current || version !== drawVersion.current)
        return;
      const buffer = terminal.buffer.active;
      const end = (buffer.baseY + buffer.cursorY) * terminal.cols + buffer.cursorX;
      const start = Math.max(0, end - value.length);
      terminal.select(start % terminal.cols, Math.floor(start / terminal.cols), value.length);
    });
  }, [eraseDraft]);
  const editDraft = useCallback((value) => {
    const next = value.slice(0, 500);
    if (next !== input.current) {
      edits.current.undo.push(input.current);
      if (edits.current.undo.length > 100) edits.current.undo.shift();
      edits.current.redo = [];
      input.current = next;
    }
    selectedDraft.current = false;
    term.current?.clearSelection();
    historyIndex.current = -1;
  }, []);
  const selectDraft = useCallback(() => {
    selectedDraft.current = Boolean(input.current);
    term.current?.clearSelection();
    redraw();
  }, [redraw]);
  const restoreDraft = useCallback(
    (redo = false) => {
      if (props.current.disabled || pending.current) return;
      const source = redo ? edits.current.redo : edits.current.undo;
      if (!source.length) return;
      const target = redo ? edits.current.undo : edits.current.redo;
      target.push(input.current);
      input.current = source.pop();
      selectedDraft.current = false;
      term.current?.clearSelection();
      historyIndex.current = -1;
      redraw();
    },
    [redraw]
  );
  const resetEdits = useCallback(() => {
    edits.current = { undo: [], redo: [] };
    selectedDraft.current = false;
    term.current?.clearSelection();
    historyIndex.current = -1;
  }, []);
  useEffect(() => {
    const terminal = new Terminal({
      cursorBlink: true,
      convertEol: true,
      screenReaderMode: true,
      scrollback: 3000,
      fontSize: 13,
      theme: paletteOf(host.current),
      fontFamily:
        getComputedStyle(host.current).getPropertyValue('--lab-code-font').trim() ||
        'ui-monospace, Consolas, monospace',
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(host.current);
    fit.fit();
    term.current = terminal;
    rendered.current = null;
    // Browser clipboard shortcuts and draft editing must not become CLI control codes.
    terminal.attachCustomKeyEventHandler((event) => {
      const key = /^Key[A-Z]$/.test(event.code || '')
        ? event.code.slice(3).toLowerCase()
        : event.key?.toLowerCase();
      const modifier = (event.ctrlKey || event.metaKey) && !event.altKey;
      const pasteKey = modifier && key === 'v';
      const insertPaste =
        event.shiftKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        event.key === 'Insert';
      if (pasteKey || insertPaste) return false;
      if (
        modifier &&
        key === 'c' &&
        !event.shiftKey &&
        (selectedDraft.current || terminal.hasSelection())
      )
        return false;
      if (
        modifier &&
        ((key === 'a' && !event.shiftKey) || key === 'z' || (key === 'y' && !event.shiftKey))
      ) {
        event.preventDefault();
        event.stopPropagation();
        if (event.type === 'keydown') {
          if (key === 'a') selectDraft();
          else restoreDraft(key === 'y' || event.shiftKey);
        }
        return false;
      }
      return true;
    });
    const terminalHost = host.current;
    const onPaste = (event) => {
      if (!event.clipboardData) return;
      event.preventDefault();
      event.stopPropagation();
      if (props.current.disabled || pending.current) return;
      // Pasted newlines, tabs and '?' are draft text, never Enter/completion keys.
      const text = event.clipboardData
        .getData('text/plain')
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/[^\x20-\x7e]/g, '');
      if (!text) return;
      editDraft(selectedDraft.current ? text : input.current + text);
      redraw();
    };
    const onMouseDown = () => {
      selectedDraft.current = false;
    };
    const onCopy = (event) => {
      if (!selectedDraft.current || !input.current || !event.clipboardData) return;
      event.clipboardData.setData('text/plain', input.current);
      event.preventDefault();
      event.stopPropagation();
    };
    terminalHost.addEventListener('paste', onPaste, true);
    terminalHost.addEventListener('mousedown', onMouseDown, true);
    terminalHost.addEventListener('copy', onCopy, true);
    const resize = new ResizeObserver(() => {
      try {
        fit.fit();
        if (selectedDraft.current) redraw();
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
          drawnLine.current = '';
          redraw();
          return;
        }
        pending.current = true;
        input.current = '';
        resetEdits();
        props.current.onDraftChange?.('');
        try {
          await props.current.onCommand(command);
        } catch (e) {
          drawnLine.current = '';
          terminal.write(`\r\n% ${e.message}\r\n`);
          redraw();
        } finally {
          pending.current = false;
        }
      } else if (data === '\t' || data === '?') {
        pending.current = true;
        try {
          const result = await props.current.onComplete(input.current);
          if (data === '\t' && result.completion) editDraft(result.completion);
          else {
            drawnLine.current = '';
            terminal.write('\r\n');
            for (const c of result.candidates)
              terminal.write(`  ${c.value.padEnd(22)} ${c.help}\r\n`);
          }
          redraw();
        } catch (e) {
          drawnLine.current = '';
          terminal.write(`\r\n% ${e.message}\r\n`);
          redraw();
        } finally {
          pending.current = false;
        }
      } else if (data === '\x7f') {
        editDraft(selectedDraft.current ? '' : input.current.slice(0, -1));
        redraw();
      } else if (data === '\x03') {
        input.current = '';
        resetEdits();
        drawnLine.current = '';
        terminal.write('^C\r\n');
        redraw();
      } else if (data === '\x01') {
        selectDraft();
      } else if (data === '\x1a') {
        restoreDraft();
      } else if (data === '\x0c') {
        terminal.clear();
        drawnLine.current = '';
        redraw();
      } else if (data === '\x1b[A' || data === '\x1b[B') {
        const items = props.current.history.filter((h) => !h.action || h.action.type === 'command');
        if (data === '\x1b[A')
          historyIndex.current = Math.min(items.length - 1, historyIndex.current + 1);
        else historyIndex.current = Math.max(-1, historyIndex.current - 1);
        const nextIndex = historyIndex.current;
        editDraft(nextIndex < 0 ? '' : items[items.length - 1 - nextIndex]?.command || '');
        historyIndex.current = nextIndex;
        redraw();
      } else if (!data.includes('\x1b')) {
        const clean = Array.from(data)
          .filter((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126)
          .join('');
        if (clean) {
          editDraft(selectedDraft.current ? clean : input.current + clean);
          redraw();
        }
      }
    });
    return () => {
      terminalHost.removeEventListener('paste', onPaste, true);
      terminalHost.removeEventListener('mousedown', onMouseDown, true);
      terminalHost.removeEventListener('copy', onCopy, true);
      resize.disconnect();
      subscription.dispose();
      terminal.dispose();
      term.current = null;
    };
  }, [editDraft, redraw, resetEdits, restoreDraft, selectDraft]);
  useEffect(() => {
    if (term.current && host.current) term.current.options.theme = paletteOf(host.current);
  }, [theme]);
  useEffect(() => {
    const terminal = term.current;
    if (!terminal) return;
    const previous = rendered.current;
    const sameEvent = (a, b) =>
      a &&
      b &&
      ['sequence', 'command', 'prompt', 'output', 'isError'].every((key) => a[key] === b[key]);
    const prefix =
      previous &&
      previous.history.length <= history.length &&
      previous.history.every((event, i) => sameEvent(event, history[i]));
    if (prefix && previous.history.length === history.length && previous.prompt === prompt) return;
    rendered.current = { history, prompt };
    if (!prefix) {
      terminal.reset();
      drawnLine.current = '';
      terminal.write('Tab: hoàn thành lệnh · ?: trợ giúp · ↑↓: lịch sử\r\n\r\n');
    }
    const added = prefix ? history.slice(previous.history.length) : history;
    if (prefix && added.length) terminal.write(eraseDraft());
    for (const event of added) {
      terminal.write(`${event.prompt}${event.command}\r\n`);
      if (event.output)
        terminal.write(
          `${event.isError ? '\x1b[31m' : ''}${terminalOutput(event).replace(/\r?\n/g, '\r\n')}\x1b[0m\r\n`
        );
    }
    redraw();
  }, [history, prompt, eraseDraft, redraw]);
  return (
    <div
      className={`cli-xterm-host ${shakeKey ? 'cli-terminal-shake' : ''}`}
      ref={host}
      aria-label="Cisco CLI terminal"
    />
  );
}
