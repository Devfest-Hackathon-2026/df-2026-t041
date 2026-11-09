"use client";

import { useEffect, useState, type ReactNode } from "react";

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="ui-label">{label}</span>
      {children}
    </label>
  );
}

/** Numeric input that commits on blur / Enter and on arrow steps. */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  ariaLabel,
  testId,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  ariaLabel?: string;
  testId?: string;
}) {
  const [text, setText] = useState(String(round(value)));
  const [lastValue, setLastValue] = useState(value);
  if (lastValue !== value) {
    // prop changed from outside (undo, drag, other panel): resync the draft text
    setLastValue(value);
    setText(String(round(value)));
  }
  const commit = () => {
    const n = Number(text);
    if (!Number.isFinite(n)) {
      setText(String(round(value)));
      return;
    }
    let v = n;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    setText(String(round(v)));
    if (v !== value) onChange(v);
  };
  return (
    <div className="relative">
      <input
        type="number"
        className="ui-input pr-7"
        value={text}
        min={min}
        max={max}
        step={step}
        aria-label={ariaLabel}
        data-testid={testId}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit();
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      {suffix && <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted">{suffix}</span>}
    </div>
  );
}

function round(v: number) {
  return Math.round(v * 100) / 100;
}

export function ColorInput({ value, onChange, ariaLabel, testId }: { value: string; onChange: (v: string) => void; ariaLabel?: string; testId?: string }) {
  const hex = toHex6(value);
  const [text, setText] = useState(hex);
  const [lastHex, setLastHex] = useState(hex);
  if (lastHex !== hex) {
    setLastHex(hex);
    setText(hex);
  }
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        className="h-8 w-9 cursor-pointer rounded-md border border-border bg-white p-0.5"
        value={hex}
        aria-label={ariaLabel}
        data-testid={testId}
        onChange={(e) => onChange(e.target.value)}
      />
      <input
        className="ui-input font-mono"
        value={text}
        aria-label={ariaLabel ? `${ariaLabel}（16進数）` : undefined}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const v = normalizeHex(text);
          if (v) onChange(v);
          else setText(hex);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    </div>
  );
}

export function toHex6(v: string): string {
  const n = normalizeHex(v);
  return n ?? "#000000";
}

export function normalizeHex(v: string): string | null {
  let s = v.trim();
  if (!s.startsWith("#")) s = `#${s}`;
  if (/^#[0-9a-fA-F]{3}$/.test(s)) s = `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  if (/^#[0-9a-fA-F]{8}$/.test(s)) s = s.slice(0, 7);
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : null;
}

export function Toast({ message, kind, onClose }: { message: string; kind: "error" | "info"; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, kind === "error" ? 8000 : 3500);
    return () => clearTimeout(t);
  }, [message, kind, onClose]);
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={`fixed bottom-4 left-1/2 z-50 max-w-[520px] -translate-x-1/2 rounded-md px-4 py-2.5 text-[13px] shadow-lg ${
        kind === "error" ? "bg-red-600 text-white" : "bg-gray-900 text-white"
      }`}
    >
      {message}
    </div>
  );
}
