"use client";

import { useEffect } from "react";
import { FONTS, FONT_CATEGORIES, loadFontCss } from "@/lib/fonts";

/**
 * Font picker grouped by style. Fonts come from Google Fonts on demand; the chosen family is
 * loaded for the preview line so the user sees the real typeface before applying it.
 */
export function FontSelect({
  value,
  onChange,
  testId,
  allowAuto = false,
  preview,
}: {
  value: string;
  onChange: (family: string) => void;
  testId?: string;
  /** Adds an "おまかせ" option with value "" (let the design / AI choose). */
  allowAuto?: boolean;
  /** Sample text drawn in the selected font under the select. */
  preview?: string;
}) {
  useEffect(() => {
    if (value && preview) void loadFontCss(value).catch(() => undefined);
  }, [value, preview]);
  return (
    <div className="flex flex-col gap-1">
      <select className="ui-select" value={value} data-testid={testId} onChange={(e) => onChange(e.target.value)}>
        {allowAuto && <option value="">おまかせ（デザインに合わせて選ぶ）</option>}
        {FONT_CATEGORIES.map((c) => (
          <optgroup key={c.id} label={c.label}>
            {FONTS.filter((f) => f.category === c.id).map((f) => (
              <option key={f.family} value={f.family}>
                {f.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {value && preview && (
        <div className="truncate rounded-md border border-border bg-white px-2 py-1.5 text-[18px] leading-tight" style={{ fontFamily: `"${value}", sans-serif` }} data-testid={testId ? `${testId}-preview` : undefined}>
          {preview}
        </div>
      )}
    </div>
  );
}
