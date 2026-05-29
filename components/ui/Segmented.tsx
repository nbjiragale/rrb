"use client";

interface Props<T extends string | number> {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

// A small segmented control — used for the 1–5 confidence prompt.
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  disabled,
  ariaLabel,
}: Props<T>) {
  return (
    <div role="group" aria-label={ariaLabel} className="inline-flex rounded-md border border-border-strong bg-surface p-0.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={`min-w-9 rounded-[7px] px-3 py-1.5 text-body transition-colors duration-150 disabled:opacity-50 ${
              active ? "bg-accent text-on-accent font-medium" : "text-secondary hover:bg-hover"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
