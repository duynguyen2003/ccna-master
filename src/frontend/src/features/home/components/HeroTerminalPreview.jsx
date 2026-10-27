import React from 'react';
import './HeroTerminalPreview.css';

export const INTERFACE_OUTPUT =
  'Interface              IP-Address    Status\nGigabitEthernet0/0      192.0.2.1     up\nGigabitEthernet0/1      unassigned    down';

const COMPACT_INTERFACE_OUTPUT =
  'Interface  IP-Address   Status\nG0/0       192.0.2.1    up\nG0/1       unassigned   down';

const terminalToken = /(R1#|\b(?:\d{1,3}\.){3}\d{1,3}\b|\b(?:up|down)\b)/gi;

export function HighlightedTerminalText({ text }) {
  return text.split(terminalToken).map((part, index) => {
    const token = part.toLowerCase();
    let type;
    if (token === 'r1#') type = 'prompt';
    else if (token === 'up' || token === 'down') type = token;
    else if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(part)) type = 'address';
    return type ? (
      <span className={`hero-terminal-token--${type}`} key={index}>
        {part}
      </span>
    ) : (
      <React.Fragment key={index}>{part}</React.Fragment>
    );
  });
}

export default function HeroTerminalPreview() {
  return (
    <>
      <pre className="hero-terminal-preview hero-terminal-preview--full">
        <HighlightedTerminalText text={`R1# show ip interface brief\n${INTERFACE_OUTPUT}`} />
      </pre>
      <pre className="hero-terminal-preview hero-terminal-preview--compact">
        <HighlightedTerminalText
          text={`R1# show ip interface brief\n${COMPACT_INTERFACE_OUTPUT}`}
        />
      </pre>
    </>
  );
}
