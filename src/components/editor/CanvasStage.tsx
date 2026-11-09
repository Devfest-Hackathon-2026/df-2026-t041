"use client";

import { useEffect, useRef } from "react";
import { useEditor } from "./EditorContext";

export function CanvasStage() {
  const ed = useEditor();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = canvasRef.current;
    const container = containerRef.current;
    if (!el || !container) return;
    void ed.mount(el, container);
    return () => ed.unmount();
  }, [ed]);

  return (
    <div
      ref={containerRef}
      className="relative flex min-w-0 flex-1 overflow-auto bg-[#e9ebee]"
      data-testid="canvas-stage"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) ed.deselect();
      }}
    >
      <div className="m-auto p-6">
        <canvas ref={canvasRef} data-testid="editor-canvas" />
      </div>
      <div className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-white/90 px-2 py-1 text-[11px] text-muted shadow">
        {ed.size.label} · {ed.size.width}×{ed.size.height}
        {ed.size.widthMm ? ` · ${ed.size.widthMm}×${ed.size.heightMm}mm` : ""}
      </div>
    </div>
  );
}
