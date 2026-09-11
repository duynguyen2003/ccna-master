import { useState, useEffect } from 'react';

/**
 * Hook phản ứng với cài đặt prefers-reduced-motion của hệ điều hành.
 * Có listener để cập nhật ngay khi người dùng thay đổi thiết lập trong OS/trình duyệt.
 */
export const useReducedMotion = () => {
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (e) => {
      setReducedMotion(e.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }

    return undefined;
  }, []);

  return reducedMotion;
};

export default useReducedMotion;
