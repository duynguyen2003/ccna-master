import React from 'react';

// Local SVGs keep the agent UI independent of the application's icon wrapper.
const paths = {
  assistant:
    'M12 8V4H8 M5 8h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2 M8 12v2 M16 12v2 M9 17h6 M1 12v4 M23 12v4',
  close: 'm6 6 12 12 M6 18 18 6',
  send: 'm5 12 7-7 7 7 M12 5v14',
  next: 'M5 12h14 m-6-6 6 6-6 6',
  diagnose: 'M6 3v12a3 3 0 0 0 3 3h9 M3 3h6 M15 15l3 3-3 3 M14 3h7v7h-7z',
  concept: 'M12 7v14 M3 3h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5v15h-5a4 4 0 0 0-4 3 4 4 0 0 0-4-3H3z',
  copy: 'M9 9h12v12H9z M5 15H3V3h12v2',
  check: 'm5 12 4 4L19 6',
};

export default function AiIcon({ name, size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name] || paths.assistant} />
    </svg>
  );
}
