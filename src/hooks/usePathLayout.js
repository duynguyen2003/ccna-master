import { useState, useEffect, useRef, useCallback } from 'react';

const DESKTOP_BREAKPOINT = 1024;
const RESIZE_DEBOUNCE_MS = 150;

/**
 * Hook quan sát kích thước container của Learning Path Map
 * Đảm bảo ResizeObserver tự động ngắt kết nối khi unmount
 * và debounce để tránh re-render liên tục khi user resize cửa sổ.
 */
export const usePathLayout = () => {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({
    width: 0,
    height: 0,
  });

  const timerRef = useRef(null);

  const updateDimensions = useCallback((width, height) => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      setDimensions((prev) => {
        // Tránh re-render nếu chênh lệch < 4px
        if (Math.abs(prev.width - width) < 4 && Math.abs(prev.height - height) < 4) {
          return prev;
        }
        return {
          width: Math.floor(width),
          height: Math.floor(height),
        };
      });
    }, RESIZE_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;

    // Đo kích thước ban đầu ngay khi mount
    const rect = node.getBoundingClientRect();
    if (rect.width > 0) {
      setDimensions({
        width: Math.floor(rect.width),
        height: Math.floor(rect.height),
      });
    }

    if (typeof ResizeObserver === 'undefined') {
      const handleWindowResize = () => {
        if (containerRef.current) {
          const r = containerRef.current.getBoundingClientRect();
          updateDimensions(r.width, r.height);
        }
      };
      window.addEventListener('resize', handleWindowResize);
      return () => window.removeEventListener('resize', handleWindowResize);
    }

    const observer = new ResizeObserver((entries) => {
      if (!entries || !entries.length) return;
      const entry = entries[0];
      const width = entry.contentRect.width;
      const height = entry.contentRect.height;
      updateDimensions(width, height);
    });

    observer.observe(node);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      observer.disconnect();
    };
  }, [updateDimensions]);

  const effectiveWidth = dimensions.width || 1024;
  const isDesktop = effectiveWidth >= DESKTOP_BREAKPOINT;

  return {
    containerRef,
    width: effectiveWidth,
    height: dimensions.height,
    isDesktop,
    isMobile: !isDesktop,
    isMeasured: dimensions.width > 0,
  };
};

export default usePathLayout;
