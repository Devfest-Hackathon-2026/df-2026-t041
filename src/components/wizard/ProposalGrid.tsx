"use client";

import { useEffect, useState } from "react";
import type { DesignSpec } from "@/lib/design/spec";
import type { CanvasSize } from "@/lib/sizes";
import { renderSpecThumbnail } from "@/lib/design/fabricBridge";

export function ProposalGrid({
  designs,
  size,
  photoSrc,
  onChoose,
  disabled,
  compact,
}: {
  designs: DesignSpec[];
  size: CanvasSize;
  photoSrc?: string;
  onChoose: (d: DesignSpec) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [state, setState] = useState<{ designs: DesignSpec[]; thumbs: Record<string, string | "error"> }>({ designs, thumbs: {} });
  if (state.designs !== designs) setState({ designs, thumbs: {} });
  const thumbs = state.designs === designs ? state.thumbs : {};

  useEffect(() => {
    let cancelled = false;
    const scale = Math.min(1, (compact ? 320 : 640) / Math.max(size.width, size.height));
    (async () => {
      for (const d of designs) {
        let url: string | "error";
        try {
          url = await renderSpecThumbnail(d, size, { photoSrc }, scale);
        } catch {
          url = "error";
        }
        if (!cancelled) setState((s) => (s.designs === designs ? { designs, thumbs: { ...s.thumbs, [d.id]: url } } : s));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [designs, size, photoSrc, compact]);

  return (
    <div className={`grid gap-4 ${compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-3"}`} data-testid="proposal-grid">
      {designs.map((d, i) => {
        const t = thumbs[d.id];
        return (
          <div key={d.id} className="flex flex-col overflow-hidden rounded-lg border border-border bg-panel">
            <div className={`flex items-center justify-center bg-gray-100 ${compact ? "p-2" : "p-4"}`} style={{ minHeight: compact ? 160 : 320 }}>
              {t === undefined ? (
                <span className="text-muted">描画中…</span>
              ) : t === "error" ? (
                <span className="text-danger">プレビューを描画できませんでした</span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t} alt={`案${i + 1}: ${d.name}`} data-testid="proposal-thumb" className="max-h-[420px] max-w-full shadow-md" />
              )}
            </div>
            <div className="flex items-start justify-between gap-2 p-3">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold">
                  案{i + 1}　{d.name}
                </div>
                {!compact && <div className="mt-0.5 text-[11px] text-muted">{d.description}</div>}
              </div>
              <button className="ui-btn-primary shrink-0" data-testid={`choose-${i}`} onClick={() => onChoose(d)} disabled={disabled || t === undefined || t === "error"}>
                この案を使う
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
