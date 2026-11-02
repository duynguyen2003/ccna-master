import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Terminal } from '@xterm/xterm';
import CliTerminal from './CliTerminal';
jest.mock('@xterm/xterm', () => ({
  Terminal: class {
    static instances = [];
    constructor(options) {
      this.options = { ...options };
      this.open = jest.fn();
      this.loadAddon = jest.fn();
      this.write = jest.fn((text, callback) => callback?.());
      this.reset = jest.fn();
      this.dispose = jest.fn();
      this.focus = jest.fn();
      this.attachCustomKeyEventHandler = jest.fn();
      this.hasSelection = jest.fn(() => false);
      this.clearSelection = jest.fn();
      this.select = jest.fn();
      this.cols = 80;
      this.buffer = { active: { baseY: 0, cursorY: 2, cursorX: 30 } };
      this.onData = jest.fn(() => ({ dispose: jest.fn() }));
      this.constructor.instances.push(this);
    }
  },
}));
beforeEach(() => {
  Terminal.instances = [];
  global.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
});
jest.mock('@xterm/addon-fit', () => ({
  FitAddon: class {
    fit() {}
  },
}));

const shortcut = (terminal, key, options = {}) => {
  const event = new KeyboardEvent('keydown', {
    key,
    ctrlKey: true,
    cancelable: true,
    ...options,
  });
  const allowed = terminal.attachCustomKeyEventHandler.mock.calls[0][0](event);
  return { event, allowed };
};
test('identical polling history does not erase the terminal; new commands append with aligned errors', () => {
  global.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  const first = { sequence: 1, prompt: 'R1>', command: 'enable', output: '', isError: false };
  const props = { prompt: 'R1#', history: [first], onCommand: jest.fn(), onComplete: jest.fn() };
  const view = render(<CliTerminal {...props} />);
  const terminal = Terminal.instances[0];
  expect(terminal.reset).toHaveBeenCalledTimes(1);
  const writes = terminal.write.mock.calls.length;
  view.rerender(<CliTerminal {...props} history={[{ ...first }]} />);
  expect(terminal.write).toHaveBeenCalledTimes(writes);
  const invalid = {
    sequence: 2,
    prompt: 'R1#',
    command: 'invalid',
    output: '^\n% Invalid input',
    isError: true,
  };
  view.rerender(<CliTerminal {...props} history={[first, invalid]} />);
  expect(terminal.reset).toHaveBeenCalledTimes(1);
  expect(terminal.write).toHaveBeenCalledWith(expect.stringContaining('   ^\r\n% Invalid input'));
});

test('theme updates preserve the terminal instance, history and partially typed command', async () => {
  global.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  let colors = {
    '--surface-terminal': '#f8fafc',
    '--terminal-foreground': '#0f172a',
    '--terminal-cursor': '#0284c7',
  };
  const css = jest
    .spyOn(window, 'getComputedStyle')
    .mockImplementation(() => ({ getPropertyValue: (key) => colors[key] || '' }));
  try {
    const props = {
      prompt: 'R1#',
      history: [],
      onCommand: jest.fn(),
      onComplete: jest.fn(),
      theme: 'light',
    };
    const view = render(<CliTerminal {...props} />);
    const terminal = Terminal.instances[0];
    expect(terminal.options.theme.background).toBe('#f8fafc');
    const input = terminal.onData.mock.calls[0][0];
    await act(async () => input('show ip'));
    const resets = terminal.reset.mock.calls.length;
    colors = {
      '--surface-terminal': '#0f172a',
      '--terminal-foreground': '#e2e8f0',
      '--terminal-cursor': '#38bdf8',
    };
    view.rerender(<CliTerminal {...props} theme="dark" />);
    expect(Terminal.instances).toHaveLength(1);
    expect(terminal.options.theme.background).toBe('#0f172a');
    expect(terminal.reset).toHaveBeenCalledTimes(resets);
    expect(terminal.dispose).not.toHaveBeenCalled();
    await act(async () => input(' route'));
    expect(terminal.write).toHaveBeenLastCalledWith(expect.stringContaining('R1#show ip route'));
  } finally {
    css.mockRestore();
  }
});

test('pasted command appends to the manual draft, survives theme changes and waits for Enter', async () => {
  const onCommand = jest.fn().mockResolvedValue();
  const onDraftChange = jest.fn();
  const props = {
    prompt: 'R2(config)#',
    history: [],
    onCommand,
    onComplete: jest.fn(),
    onDraftChange,
    initialDraft: 'router ',
  };
  const view = render(<CliTerminal {...props} />);
  const terminal = Terminal.instances[0];
  fireEvent.paste(screen.getByLabelText('Cisco CLI terminal'), {
    clipboardData: { getData: () => 'eigrp 1' },
  });
  expect(terminal.write).toHaveBeenCalledWith(expect.stringContaining('R2(config)#router eigrp 1'));
  expect(onDraftChange).toHaveBeenLastCalledWith('router eigrp 1');
  expect(onCommand).not.toHaveBeenCalled();
  view.rerender(<CliTerminal {...props} theme="dark" />);
  expect(Terminal.instances).toHaveLength(1);
  await act(async () => terminal.onData.mock.calls[0][0]('\r'));
  expect(onCommand).toHaveBeenCalledWith('router eigrp 1');
  expect(onDraftChange).toHaveBeenLastCalledWith('');
});

test('native paste shortcuts stay available without cancelling browser defaults or other keys', () => {
  render(<CliTerminal prompt="R1#" history={[]} />);
  const keyHandler = Terminal.instances[0].attachCustomKeyEventHandler.mock.calls[0][0];
  for (const init of [
    { key: 'v', ctrlKey: true },
    { key: 'V', ctrlKey: true, shiftKey: true },
    { key: 'v', metaKey: true },
    { key: 'м', code: 'KeyV', ctrlKey: true },
    { key: 'Insert', shiftKey: true },
  ]) {
    const event = new KeyboardEvent('keydown', { ...init, cancelable: true });
    expect(keyHandler(event)).toBe(false);
    expect(event.defaultPrevented).toBe(false);
  }
  for (const init of [
    { key: 'c', ctrlKey: true },
    { key: 'v', ctrlKey: true, altKey: true },
    { key: 'v' },
    { key: 'Enter' },
    { key: 'Tab' },
  ])
    expect(keyHandler(new KeyboardEvent('keydown', init))).toBe(true);
});

test.each([
  ['show ip interface brief\r\n', 'show ip interface brief '],
  ['show\tip\r\ninterface brief', 'show ip interface brief'],
  ['?', '?'],
  ['\r', ' '],
])('paste %p only edits the draft without running commands or completion', (text, expected) => {
  const onCommand = jest.fn();
  const onComplete = jest.fn();
  const onDraftChange = jest.fn();
  render(
    <CliTerminal
      prompt="R1#"
      history={[]}
      onCommand={onCommand}
      onComplete={onComplete}
      onDraftChange={onDraftChange}
    />
  );
  const getData = jest.fn(() => text);
  fireEvent.paste(screen.getByLabelText('Cisco CLI terminal'), { clipboardData: { getData } });
  expect(getData).toHaveBeenCalledWith('text/plain');
  expect(onDraftChange).toHaveBeenLastCalledWith(expected);
  expect(onCommand).not.toHaveBeenCalled();
  expect(onComplete).not.toHaveBeenCalled();
});

test('read-only and pending terminals reject pasted text, then accept it after the request finishes', async () => {
  let finish;
  const onCommand = jest.fn(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const onDraftChange = jest.fn();
  const props = {
    prompt: 'R1#',
    history: [],
    initialDraft: 'show version',
    onCommand,
    onDraftChange,
  };
  const view = render(<CliTerminal {...props} disabled />);
  const paste = () =>
    fireEvent.paste(screen.getByLabelText('Cisco CLI terminal'), {
      clipboardData: { getData: () => 'enable' },
    });
  onDraftChange.mockClear();
  paste();
  expect(onDraftChange).not.toHaveBeenCalled();
  view.rerender(<CliTerminal {...props} disabled={false} />);
  act(() => {
    void Terminal.instances[0].onData.mock.calls[0][0]('\r');
  });
  expect(onCommand).toHaveBeenCalledWith('show version');
  onDraftChange.mockClear();
  paste();
  expect(onDraftChange).not.toHaveBeenCalled();
  await act(async () => finish());
  paste();
  expect(onDraftChange).toHaveBeenLastCalledWith('enable');
  expect(onCommand).toHaveBeenCalledTimes(1);
});

test('paste listeners are removed on unmount and long input keeps the command limit', () => {
  const onDraftChange = jest.fn();
  const view = render(<CliTerminal prompt="R1#" history={[]} onDraftChange={onDraftChange} />);
  const node = screen.getByLabelText('Cisco CLI terminal');
  fireEvent.paste(node, { clipboardData: { getData: () => 'x'.repeat(600) } });
  expect(onDraftChange).toHaveBeenLastCalledWith('x'.repeat(500));
  view.unmount();
  onDraftChange.mockClear();
  fireEvent.paste(node, { clipboardData: { getData: () => 'enable' } });
  expect(onDraftChange).not.toHaveBeenCalled();
});

test.each([false, true])(
  'Ctrl+C copies a terminal selection without cancelling the draft (readonly=%s)',
  (disabled) => {
    const onDraftChange = jest.fn();
    const onCommand = jest.fn();
    render(
      <CliTerminal
        prompt="R1#"
        history={[]}
        initialDraft="show version"
        disabled={disabled}
        onDraftChange={onDraftChange}
        onCommand={onCommand}
      />
    );
    const terminal = Terminal.instances[0];
    terminal.hasSelection.mockReturnValue(true);
    onDraftChange.mockClear();
    const result = shortcut(terminal, 'c');
    expect(result.allowed).toBe(false);
    expect(result.event.defaultPrevented).toBe(false);
    expect(onDraftChange).not.toHaveBeenCalled();
    expect(onCommand).not.toHaveBeenCalled();
  }
);

test('Ctrl+C without a selection cancels the current draft without running it', async () => {
  const onDraftChange = jest.fn();
  const onCommand = jest.fn();
  render(
    <CliTerminal
      prompt="R1#"
      history={[]}
      initialDraft="show version"
      onDraftChange={onDraftChange}
      onCommand={onCommand}
    />
  );
  const terminal = Terminal.instances[0];
  expect(shortcut(terminal, 'c').allowed).toBe(true);
  await act(async () => terminal.onData.mock.calls[0][0]('\x03'));
  expect(onDraftChange).toHaveBeenLastCalledWith('');
  expect(terminal.write).toHaveBeenCalledWith('^C\r\n');
  expect(onCommand).not.toHaveBeenCalled();
});

test('Ctrl+A selects and copies only the draft, excluding the prompt and command history', () => {
  const value = 'show ip interface brief';
  render(<CliTerminal prompt="R1#" history={[]} initialDraft={value} />);
  const terminal = Terminal.instances[0];
  terminal.buffer.active.cursorX = 3 + value.length;
  const result = shortcut(terminal, 'a');
  expect(result.allowed).toBe(false);
  expect(result.event.defaultPrevented).toBe(true);
  expect(terminal.select).toHaveBeenLastCalledWith(3, 2, value.length);
  expect(shortcut(terminal, 'c').allowed).toBe(false);
  const setData = jest.fn();
  fireEvent.copy(screen.getByLabelText('Cisco CLI terminal'), { clipboardData: { setData } });
  expect(setData).toHaveBeenCalledWith('text/plain', value);
});

test('typing after Ctrl+A replaces the draft and undo/redo restore text without executing it', async () => {
  const onDraftChange = jest.fn();
  const onCommand = jest.fn();
  render(
    <CliTerminal
      prompt="R1(config)#"
      history={[]}
      initialDraft="old command"
      onDraftChange={onDraftChange}
      onCommand={onCommand}
    />
  );
  const terminal = Terminal.instances[0];
  shortcut(terminal, 'a');
  await act(async () => terminal.onData.mock.calls[0][0]('new command'));
  expect(onDraftChange).toHaveBeenLastCalledWith('new command');
  expect(shortcut(terminal, 'z').event.defaultPrevented).toBe(true);
  expect(onDraftChange).toHaveBeenLastCalledWith('old command');
  shortcut(terminal, 'z', { shiftKey: true });
  expect(onDraftChange).toHaveBeenLastCalledWith('new command');
  shortcut(terminal, 'z');
  shortcut(terminal, 'y');
  expect(onDraftChange).toHaveBeenLastCalledWith('new command');
  expect(onCommand).not.toHaveBeenCalled();
});

test('paste and Backspace replace Ctrl+A selection and can be undone', async () => {
  const onDraftChange = jest.fn();
  render(
    <CliTerminal
      prompt="R1#"
      history={[]}
      initialDraft="old command"
      onDraftChange={onDraftChange}
    />
  );
  const terminal = Terminal.instances[0];
  shortcut(terminal, 'a');
  fireEvent.paste(screen.getByLabelText('Cisco CLI terminal'), {
    clipboardData: { getData: () => 'show version' },
  });
  expect(onDraftChange).toHaveBeenLastCalledWith('show version');
  shortcut(terminal, 'z');
  expect(onDraftChange).toHaveBeenLastCalledWith('old command');
  shortcut(terminal, 'a');
  await act(async () => terminal.onData.mock.calls[0][0]('\x7f'));
  expect(onDraftChange).toHaveBeenLastCalledWith('');
  shortcut(terminal, 'z');
  expect(onDraftChange).toHaveBeenLastCalledWith('old command');
});

test('undo survives theme/polling changes but never restores a submitted or cancelled command', async () => {
  const onDraftChange = jest.fn();
  const onCommand = jest.fn().mockResolvedValue();
  const props = { prompt: 'R1#', history: [], onDraftChange, onCommand };
  const view = render(<CliTerminal {...props} />);
  const terminal = Terminal.instances[0];
  const input = terminal.onData.mock.calls[0][0];
  await act(async () => input('show'));
  await act(async () => input(' version'));
  view.rerender(<CliTerminal {...props} history={[]} theme="dark" />);
  shortcut(terminal, 'z');
  expect(onDraftChange).toHaveBeenLastCalledWith('show');
  await act(async () => input('\r'));
  shortcut(terminal, 'z');
  expect(onDraftChange).toHaveBeenLastCalledWith('');
  expect(onCommand).toHaveBeenCalledTimes(1);
  expect(onCommand).toHaveBeenCalledWith('show');
  await act(async () => input('next'));
  await act(async () => input('\x03'));
  shortcut(terminal, 'z');
  expect(onDraftChange).toHaveBeenLastCalledWith('');
});

test('readonly/pending block undo and a fresh edit discards redo history', async () => {
  let finish;
  const onCommand = jest.fn(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const onDraftChange = jest.fn();
  const props = { prompt: 'R1#', history: [], onDraftChange, onCommand };
  const view = render(<CliTerminal {...props} />);
  const terminal = Terminal.instances[0];
  const input = terminal.onData.mock.calls[0][0];
  await act(async () => input('a'));
  await act(async () => input('b'));
  view.rerender(<CliTerminal {...props} disabled />);
  shortcut(terminal, 'z');
  expect(onDraftChange).toHaveBeenLastCalledWith('ab');
  view.rerender(<CliTerminal {...props} disabled={false} />);
  shortcut(terminal, 'z');
  await act(async () => input('c'));
  shortcut(terminal, 'y');
  expect(onDraftChange).toHaveBeenLastCalledWith('ac');
  act(() => {
    void input('\r');
  });
  onDraftChange.mockClear();
  shortcut(terminal, 'z');
  expect(onDraftChange).not.toHaveBeenCalled();
  await act(async () => finish());
});

test('wrapped draft selection excludes the prompt and clearing it erases old wrapped rows', async () => {
  const value = 'x'.repeat(40);
  render(<CliTerminal prompt="R1#" history={[]} initialDraft={value} />);
  const terminal = Terminal.instances[0];
  terminal.cols = 20;
  terminal.buffer.active = { baseY: 0, cursorY: 4, cursorX: 3 };
  shortcut(terminal, 'a');
  expect(terminal.select).toHaveBeenLastCalledWith(3, 2, value.length);
  await act(async () => terminal.onData.mock.calls[0][0]('\x7f'));
  expect(terminal.write).toHaveBeenLastCalledWith('\r\x1b[2A\x1b[JR1#');
});

test('late selection paint cannot select an old draft after typing or unmount', async () => {
  const onDraftChange = jest.fn();
  const view = render(
    <CliTerminal prompt="R1#" history={[]} initialDraft="old" onDraftChange={onDraftChange} />
  );
  const terminal = Terminal.instances[0];
  const paints = [];
  terminal.write.mockImplementation((text, callback) => {
    if (callback) paints.push(callback);
  });
  shortcut(terminal, 'a');
  await act(async () => terminal.onData.mock.calls[0][0]('new'));
  paints[0]();
  expect(terminal.select).not.toHaveBeenCalled();
  shortcut(terminal, 'a');
  view.unmount();
  paints[1]();
  expect(terminal.select).not.toHaveBeenCalled();
});
