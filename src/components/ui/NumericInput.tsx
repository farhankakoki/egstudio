import { useEffect, useState } from 'react';

interface NumericInputProps {
  id?: string;
  ariaLabel?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onChange: (val: number) => void;
  className?: string;
}

export function NumericInput({
  id,
  ariaLabel,
  value,
  min,
  max,
  step = 1,
  disabled = false,
  onChange,
  className = '',
}: NumericInputProps) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDraft(String(value));
    }
  }, [value, focused]);

  const clampVal = (num: number) => Math.max(min, Math.min(max, num));

  return (
    <input
      id={id}
      aria-label={ariaLabel}
      type="number"
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      value={focused ? draft : String(value)}
      onFocus={() => {
        setFocused(true);
        setDraft(String(value));
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        if (raw.trim() === '' || raw === '-') return;
        const parsed = parseFloat(raw);
        if (Number.isFinite(parsed)) {
          onChange(clampVal(parsed));
        }
      }}
      onBlur={() => {
        setFocused(false);
        const parsed = parseFloat(draft);
        if (Number.isFinite(parsed)) {
          const clamped = clampVal(parsed);
          onChange(clamped);
          setDraft(String(clamped));
        } else {
          setDraft(String(value));
        }
      }}
      className={className}
    />
  );
}
