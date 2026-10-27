import React, { useState } from 'react';
import { HighlightedTerminalText, INTERFACE_OUTPUT } from './HeroTerminalPreview';

const help = 'Lệnh minh họa: show ip interface brief, show version, help, clear.';
const answers = {
  'show ip interface brief': INTERFACE_OUTPUT,
  'show version':
    'NetMaster · Router R1 minh họa\nMở một bài lab để thực hành cấu hình và kiểm tra kết nối.',
  help,
};

export default function HeroTerminal() {
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState([]);
  const submit = (event) => {
    event.preventDefault();
    const text = command.trim().toLowerCase();
    if (!text) return;
    if (text === 'clear') setHistory([]);
    else
      setHistory((items) => [
        ...items.slice(-5),
        {
          command: text,
          result: Object.prototype.hasOwnProperty.call(answers, text) ? answers[text] : help,
        },
      ]);
    setCommand('');
  };
  return (
    <>
      <p className="hero-terminal-help">
        Thử <code>show ip interface brief</code> để xem trạng thái cổng.
      </p>
      <div
        className="hero-terminal-output"
        role="log"
        aria-label="Kết quả terminal minh họa"
        aria-live="polite"
      >
        {history.map((entry, index) => (
          <pre key={index} tabIndex={0} role="group" aria-label={`Kết quả ${entry.command}`}>
            <HighlightedTerminalText text={`R1# ${entry.command}\n${entry.result}`} />
          </pre>
        ))}
      </div>
      <form onSubmit={submit} className="hero-terminal-form">
        <label htmlFor="hero-command" className="hero-terminal-token--prompt">
          R1#
        </label>
        <input
          id="hero-command"
          aria-label="Lệnh terminal minh họa"
          value={command}
          maxLength={80}
          onChange={(event) => setCommand(event.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" className="hero-demo-button">
          Chạy
        </button>
      </form>
    </>
  );
}
