import type { KeyboardEvent, ReactNode } from 'react';

interface Option<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface Props<T extends string> {
  /** Names the group for screen readers. */
  label: string;
  options: Array<Option<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/**
 * Pick one of a few options. A radio group: arrow keys move the choice and
 * only the chosen option is in the tab order. Wraps instead of scrolling.
 */
export function Segmented<T extends string>({ label, options, value, onChange, className }: Props<T>) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const index = options.findIndex((option) => option.value === value);
    const next = options[(index + step + options.length) % options.length]!;
    onChange(next.value);
    const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button');
    buttons[options.indexOf(next)]?.focus();
  }

  return (
    <div
      className={className ? `segmented ${className}` : 'segmented'}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          tabIndex={option.value === value ? 0 : -1}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}
