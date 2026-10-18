import React, { useEffect, useRef } from 'react';

const CHECK_PATH = 'M5 13l4 4L19 7';
const MIXED_PATH = 'M6 12h12';

/** Keep native checkbox semantics and draw the checked mark with SVG. */
export default function AnimatedCheckbox({ indeterminate = false, className = '', ...props }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <span className={`animated-checkbox ${className}`.trim()}>
      <input ref={inputRef} type="checkbox" className="animated-checkbox__input" {...props} />
      <svg
        className="animated-checkbox__icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path d={indeterminate ? MIXED_PATH : CHECK_PATH} />
      </svg>
    </span>
  );
}
