import React, {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import './styles/DropdownSelect.css';

const textContent = (node) => {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textContent).join('');
  if (isValidElement(node)) return textContent(node.props.children);
  return '';
};

const readOptions = (children) =>
  Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child)) return [];
    if (child.type === React.Fragment) return readOptions(child.props.children);
    if (child.type !== 'option') return [];

    const label = textContent(child.props.label ?? child.props.children).trim();
    const value = child.props.value ?? label;
    return [
      {
        value: String(value),
        label,
        disabled: Boolean(child.props.disabled),
      },
    ];
  });

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();

const durationMs = (value, fallback = 150) => {
  const duration = String(value || '').trim();
  const number = Number.parseFloat(duration);
  if (!Number.isFinite(number)) return fallback;
  return duration.endsWith('ms') ? number : number * 1000;
};

const requestFrame = (callback) =>
  typeof window.requestAnimationFrame === 'function'
    ? window.requestAnimationFrame(callback)
    : window.setTimeout(callback, 16);

const cancelFrame = (frameId) => {
  if (typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(frameId);
  else window.clearTimeout(frameId);
};

const nextEnabledIndex = (options, start, direction) => {
  if (!options.length) return -1;
  for (let offset = 0; offset < options.length; offset += 1) {
    const index = (start + direction * offset + options.length * 2) % options.length;
    if (!options[index].disabled) return index;
  }
  return -1;
};

/**
 * A select-only combobox that keeps option data in the familiar <option>
 * children shape while rendering a scrollable, consistently styled listbox.
 */
export default function DropdownSelect({
  value,
  onChange,
  children,
  className = '',
  disabled = false,
  id,
  title,
  style,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
}) {
  const options = useMemo(() => readOptions(children), [children]);
  const currentValue = value === null || value === undefined ? '' : String(value);
  const selectedIndex = options.findIndex((option) => option.value === currentValue);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null;
  const generatedId = useId().replace(/:/g, '');
  const listboxId = `dropdown-select-listbox-${generatedId}`;

  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const optionRefs = useRef([]);
  const closeTimerRef = useRef(null);
  const typeaheadTimerRef = useRef(null);
  const typeaheadRef = useRef('');
  const closeMenuRef = useRef(() => {});

  const [phase, setPhase] = useState('closed');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [position, setPosition] = useState(null);
  const isMounted = phase !== 'closed';

  const closeMenu = useCallback(() => {
    if (phase === 'closed') return;
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    setPhase('closing');
    const closeDuration = durationMs(
      window
        .getComputedStyle(document.documentElement)
        .getPropertyValue('--dropdown-close-dur')
    );
    closeTimerRef.current = window.setTimeout(() => {
      setPhase('closed');
      setPosition(null);
      closeTimerRef.current = null;
    }, closeDuration);
  }, [phase]);

  closeMenuRef.current = closeMenu;

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === 'undefined') return;

    const rect = trigger.getBoundingClientRect();
    const margin = 8;
    const gap = 6;
    const width = Math.min(rect.width, window.innerWidth - margin * 2);
    const rightLimit = window.innerWidth - width - margin;
    const alignToRight = rect.left > rightLimit;
    const left = Math.max(margin, Math.min(rect.left, rightLimit));
    const viewportMaxHeight = Math.max(120, Math.min(320, window.innerHeight - margin * 2));
    const estimatedHeight = Math.min(viewportMaxHeight, Math.max(44, options.length * 38 + 12));
    const openAbove =
      rect.bottom + gap + estimatedHeight > window.innerHeight - margin &&
      rect.top > estimatedHeight + margin;
    const availableHeight = openAbove
      ? rect.top - gap - margin
      : window.innerHeight - rect.bottom - gap - margin;
    const maxHeight = Math.max(96, Math.min(viewportMaxHeight, availableHeight));
    const top = openAbove
      ? Math.max(margin, rect.top - gap - Math.min(estimatedHeight, maxHeight))
      : Math.min(rect.bottom + gap, window.innerHeight - maxHeight - margin);

    const computed = window.getComputedStyle(trigger);
    const readThemeValue = (name, fallback) => computed.getPropertyValue(name).trim() || fallback;
    const resolvedBackground = computed.backgroundColor;
    const theme = {
      '--app-select-menu-bg':
        resolvedBackground && resolvedBackground !== 'rgba(0, 0, 0, 0)'
          ? resolvedBackground
          : 'var(--card-bg, #ffffff)',
      '--app-select-menu-color': computed.color || 'var(--text-color, #0f172a)',
      '--app-select-menu-border': computed.borderColor || 'var(--border-color, #cbd5e1)',
      '--app-select-menu-accent': readThemeValue(
        '--cli-accent',
        readThemeValue(
          '--lab-accent-strong',
          readThemeValue('--admin-primary', 'var(--primary-color, #2563eb)')
        )
      ),
      '--app-select-menu-muted': readThemeValue(
        '--cli-text-muted',
        readThemeValue('--lab-text-muted', readThemeValue('--admin-text-muted', '#64748b'))
      ),
      '--app-select-menu-hover': readThemeValue(
        '--cli-surface-muted',
        readThemeValue('--lab-surface-soft', readThemeValue('--hover-bg', '#f1f5f9'))
      ),
    };

    setPosition({
      top,
      left,
      width,
      maxHeight,
      origin: openAbove
        ? alignToRight
          ? 'bottom-right'
          : 'bottom-left'
        : alignToRight
          ? 'top-right'
          : 'top-left',
      theme,
    });
  }, [options.length]);

  const openMenu = useCallback(
    (preferredIndex = selectedIndex) => {
      if (disabled || !options.some((option) => !option.disabled)) return;
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      const fallbackIndex = nextEnabledIndex(options, 0, 1);
      setActiveIndex(
        preferredIndex >= 0 && !options[preferredIndex]?.disabled ? preferredIndex : fallbackIndex
      );
      setPhase((current) => {
        if (current === 'closed') return 'opening';
        if (current === 'closing') return 'open';
        return current;
      });
    },
    [disabled, options, selectedIndex]
  );

  useLayoutEffect(() => {
    if (!isMounted) return undefined;

    updatePosition();
    let frameId;
    if (phase === 'opening') {
      frameId = requestFrame(() => setPhase('open'));
    }
    const reposition = () => updatePosition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);

    return () => {
      if (frameId) cancelFrame(frameId);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [isMounted, phase, updatePosition]);

  useEffect(() => {
    if (!isMounted) return undefined;

    const closeWhenOutside = (event) => {
      if (
        triggerRef.current?.contains(event.target) ||
        menuRef.current?.contains(event.target)
      ) {
        return;
      }
      closeMenuRef.current();
    };

    document.addEventListener('pointerdown', closeWhenOutside, true);
    document.addEventListener('focusin', closeWhenOutside, true);
    return () => {
      document.removeEventListener('pointerdown', closeWhenOutside, true);
      document.removeEventListener('focusin', closeWhenOutside, true);
    };
  }, [isMounted]);

  useEffect(() => {
    if (disabled && isMounted) closeMenu();
  }, [disabled, isMounted, closeMenu]);

  useEffect(() => {
    if (activeIndex >= 0 && phase !== 'closed') {
      optionRefs.current[activeIndex]?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [activeIndex, phase]);

  useEffect(
    () => () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
      if (typeaheadTimerRef.current) window.clearTimeout(typeaheadTimerRef.current);
    },
    []
  );

  const selectOption = useCallback(
    (option) => {
      if (!option || option.disabled) return;
      if (option.value !== currentValue) {
        onChange?.({ target: { value: option.value }, currentTarget: { value: option.value } });
      }
      triggerRef.current?.focus();
      closeMenu();
    },
    [closeMenu, currentValue, onChange]
  );

  const moveActive = (direction) => {
    const start = activeIndex >= 0 ? activeIndex + direction : direction > 0 ? 0 : options.length - 1;
    const next = nextEnabledIndex(options, start, direction);
    if (next >= 0) setActiveIndex(next);
  };

  const handleTypeahead = (key) => {
    if (key.length !== 1 || key.trim() === '' || key === ' ') return false;
    typeaheadRef.current += normalizeText(key);
    if (typeaheadTimerRef.current) window.clearTimeout(typeaheadTimerRef.current);
    typeaheadTimerRef.current = window.setTimeout(() => {
      typeaheadRef.current = '';
      typeaheadTimerRef.current = null;
    }, 600);

    const start = activeIndex >= 0 ? activeIndex + 1 : Math.max(0, selectedIndex + 1);
    for (let offset = 0; offset < options.length; offset += 1) {
      const index = (start + offset) % options.length;
      if (
        !options[index].disabled &&
        normalizeText(options[index].label).startsWith(typeaheadRef.current)
      ) {
        setActiveIndex(index);
        if (phase === 'closed' || phase === 'closing') openMenu(index);
        return true;
      }
    }
    return true;
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (phase === 'closed' || phase === 'closing') {
        openMenu(selectedIndex >= 0 ? selectedIndex : nextEnabledIndex(options, 0, 1));
      } else {
        moveActive(event.key === 'ArrowDown' ? 1 : -1);
      }
      return;
    }

    if (event.key === 'Home' || event.key === 'End') {
      if (phase === 'closed') return;
      event.preventDefault();
      const start = event.key === 'Home' ? 0 : options.length - 1;
      const direction = event.key === 'Home' ? 1 : -1;
      const next = nextEnabledIndex(options, start, direction);
      if (next >= 0) setActiveIndex(next);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (phase === 'closed' || phase === 'closing') openMenu();
      else selectOption(options[activeIndex] || selectedOption);
      return;
    }

    if (event.key === 'Escape') {
      if (phase !== 'closed') {
        event.preventDefault();
        closeMenu();
      }
      return;
    }

    if (event.key === 'Tab') {
      closeMenu();
      return;
    }

    handleTypeahead(event.key);
  };

  const menu =
    isMounted && position
      ? createPortal(
          <div
            id={listboxId}
            ref={menuRef}
            className={`app-select__menu t-dropdown ${phase === 'open' ? 'is-open' : ''} ${phase === 'closing' ? 'is-closing' : ''}`}
            data-origin={position.origin}
            role="listbox"
            aria-label={ariaLabel ? `${ariaLabel} options` : undefined}
            aria-hidden={phase === 'closing'}
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
              width: position.width,
              maxHeight: position.maxHeight,
              ...position.theme,
            }}
          >
            {options.length ? (
              options.map((option, index) => (
                <div
                  id={`${listboxId}-option-${index}`}
                  key={`${option.value}-${index}`}
                  ref={(element) => {
                    optionRefs.current[index] = element;
                  }}
                  className={`app-select__option ${index === activeIndex ? 'is-active' : ''} ${option.value === currentValue ? 'is-selected' : ''}`}
                  role="option"
                  aria-selected={option.value === currentValue}
                  aria-disabled={option.disabled || undefined}
                  onMouseMove={() => !option.disabled && setActiveIndex(index)}
                  onClick={() => selectOption(option)}
                >
                  <span>{option.label}</span>
                  {option.value === currentValue ? <Check size={16} aria-hidden="true" /> : null}
                </div>
              ))
            ) : (
              <div className="app-select__empty" role="status">
                Không có lựa chọn
              </div>
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-haspopup="listbox"
        aria-expanded={isMounted && phase !== 'closing'}
        aria-controls={isMounted ? listboxId : undefined}
        aria-activedescendant={
          isMounted && phase !== 'closing' && activeIndex >= 0
            ? `${listboxId}-option-${activeIndex}`
            : undefined
        }
        className={`app-select__trigger ${className}`.trim()}
        disabled={disabled}
        title={title}
        style={style}
        onClick={() =>
          phase === 'closed' || phase === 'closing' ? openMenu() : closeMenu()
        }
        onKeyDown={handleKeyDown}
      >
        <span className="app-select__value">{selectedOption?.label || '\u00a0'}</span>
        <ChevronDown
          className="app-select__chevron"
          size={16}
          aria-hidden="true"
          focusable="false"
        />
      </button>
      {menu}
    </>
  );
}
