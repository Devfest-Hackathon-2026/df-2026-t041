"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronDown, Download, FileJson, FileText, Image as ImageIcon, Minus, Plus, Redo2, Save, Undo2, Maximize2 } from "lucide-react";
import { SIZE_PRESETS, customSize, type SizePresetId } from "@/lib/sizes";
import { useEditor } from "./EditorContext";
import { NumberInput } from "../ui";

export function TopBar() {
  const ed = useEditor();
  const [exportOpen, setExportOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
  const [custom, setCustom] = useState({ width: ed.size.width, height: ed.size.height });
  const menuRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setExportOpen(false);
      if (sizeRef.current && !sizeRef.current.contains(e.target as Node)) setSizeOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const saveLabel = ed.saveState === "saved" ? "保存済み" : ed.saveState === "saving" ? "保存中…" : ed.saveState === "error" ? "保存エラー" : "未保存の変更";

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-panel px-3">
      <Link href="/" className="ui-btn-icon" aria-label="ホームへ戻る" title="ホームへ戻る">
        <ArrowLeft size={16} />
      </Link>
      <input
        className="h-8 w-56 rounded-md border border-transparent bg-transparent px-2 text-[13px] font-medium hover:border-border focus:border-accent focus:outline-none"
        value={ed.project.name}
        aria-label="プロジェクト名"
        data-testid="project-name"
        onChange={(e) => ed.rename(e.target.value)}
      />
      <span className={`text-[11px] ${ed.saveState === "error" ? "text-danger" : "text-muted"}`} data-testid="save-state" data-state={ed.saveState}>
        {saveLabel}
      </span>

      <div className="mx-2 h-6 w-px bg-border" />
      <button className="ui-btn-icon" onClick={() => void ed.undo()} disabled={!ed.canUndo} aria-label="元に戻す" title="元に戻す (⌘Z)" data-testid="undo">
        <Undo2 size={16} />
      </button>
      <button className="ui-btn-icon" onClick={() => void ed.redo()} disabled={!ed.canRedo} aria-label="やり直す" title="やり直す (⇧⌘Z)" data-testid="redo">
        <Redo2 size={16} />
      </button>

      <div className="mx-2 h-6 w-px bg-border" />
      <div className="relative" ref={sizeRef}>
        <button className="ui-btn" onClick={() => setSizeOpen((v) => !v)} data-testid="size-menu">
          {ed.size.label} <ChevronDown size={14} />
        </button>
        {sizeOpen && (
          <div className="absolute left-0 top-9 z-30 w-72 rounded-md border border-border bg-panel p-1 shadow-lg">
            {SIZE_PRESETS.map((p) => (
              <button
                key={p.preset}
                data-testid={`size-option-${p.preset}`}
                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left hover:bg-gray-100"
                onClick={() => {
                  setSizeOpen(false);
                  if (p.preset !== ed.size.preset) ed.changeSize(p);
                }}
              >
                <span>{p.label}</span>
                <span className="text-[11px] text-muted">{p.widthMm ? `${p.widthMm}×${p.heightMm}mm` : `${p.width}×${p.height}px`}</span>
                {p.preset === (ed.size.preset as SizePresetId) && <Check size={14} className="ml-2 text-accent" />}
              </button>
            ))}
            <div className="mt-1 border-t border-border px-2 py-2">
              <div className="mb-1 text-[11px] text-muted">カスタム（px）</div>
              <div className="flex items-center gap-1">
                <NumberInput value={custom.width} min={200} max={6000} onChange={(v) => setCustom((c) => ({ ...c, width: v }))} ariaLabel="幅" />
                <span className="text-muted">×</span>
                <NumberInput value={custom.height} min={200} max={6000} onChange={(v) => setCustom((c) => ({ ...c, height: v }))} ariaLabel="高さ" />
                <button
                  className="ui-btn shrink-0"
                  onClick={() => {
                    setSizeOpen(false);
                    ed.changeSize(customSize(custom.width, custom.height));
                  }}
                >
                  適用
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1">
        <button className="ui-btn-icon" onClick={() => ed.setZoom(ed.zoom / 1.2)} aria-label="縮小" title="縮小">
          <Minus size={15} />
        </button>
        <span className="w-12 text-center text-[12px] tabular-nums text-muted" data-testid="zoom">
          {Math.round(ed.zoom * 100)}%
        </span>
        <button className="ui-btn-icon" onClick={() => ed.setZoom(ed.zoom * 1.2)} aria-label="拡大" title="拡大">
          <Plus size={15} />
        </button>
        <button className="ui-btn-icon" onClick={() => ed.zoomToFit()} aria-label="画面に合わせる" title="画面に合わせる (⌘0)">
          <Maximize2 size={15} />
        </button>
      </div>

      <div className="mx-2 h-6 w-px bg-border" />
      <button className="ui-btn" onClick={() => void ed.save().then((ok) => ok && ed.notify("保存しました。"))} data-testid="save">
        <Save size={15} /> 保存
      </button>
      <div className="relative" ref={menuRef}>
        <button className="ui-btn-primary" onClick={() => setExportOpen((v) => !v)} data-testid="export-menu" disabled={ed.busy !== null}>
          <Download size={15} /> 書き出し <ChevronDown size={14} />
        </button>
        {exportOpen && (
          <div className="absolute right-0 top-9 z-30 w-60 rounded-md border border-border bg-panel p-1 shadow-lg">
            <button
              className="flex w-full items-center gap-2 rounded px-2 py-2 text-left hover:bg-gray-100"
              data-testid="export-png"
              onClick={() => {
                setExportOpen(false);
                void ed.exportPng();
              }}
            >
              <ImageIcon size={15} /> PNG画像 {ed.size.widthMm ? "（300dpi）" : ""}
            </button>
            <button
              className="flex w-full items-center gap-2 rounded px-2 py-2 text-left hover:bg-gray-100"
              data-testid="export-pdf"
              onClick={() => {
                setExportOpen(false);
                void ed.exportPdf();
              }}
            >
              <FileText size={15} /> PDF {ed.size.widthMm ? `（印刷用 ${ed.size.widthMm}×${ed.size.heightMm}mm）` : ""}
            </button>
            <button
              className="flex w-full items-center gap-2 rounded px-2 py-2 text-left hover:bg-gray-100"
              data-testid="export-project"
              onClick={() => {
                setExportOpen(false);
                void ed.exportProject();
              }}
            >
              <FileJson size={15} /> プロジェクトデータ（再編集用）
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
