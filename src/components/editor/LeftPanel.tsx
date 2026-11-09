"use client";

import { useRef, useState } from "react";
import { FabricImage, FabricObject, Textbox } from "fabric";
import { ArrowDown, ArrowUp, Circle, Eye, EyeOff, Heading, ImagePlus, Layers, Lock, Minus, Plus, Sparkles, Square, Type, Unlock, LayoutTemplate } from "lucide-react";
import { useEditor } from "./EditorContext";
import { getMeta } from "@/lib/design/fabricBridge";
import { generateDesigns } from "@/lib/design/generator";
import type { DesignSpec } from "@/lib/design/spec";
import { aiGenerate } from "@/lib/ai/client";
import { ProposalGrid } from "../wizard/ProposalGrid";
import { Field } from "../ui";

type Tab = "add" | "layers" | "design" | "ai";

export function LeftPanel() {
  const [tab, setTab] = useState<Tab>("add");
  const tabs: { id: Tab; label: string; icon: React.ReactNode; testId: string }[] = [
    { id: "add", label: "追加", icon: <Plus size={15} />, testId: "tab-add" },
    { id: "layers", label: "レイヤー", icon: <Layers size={15} />, testId: "tab-layers" },
    { id: "design", label: "テンプレート", icon: <LayoutTemplate size={15} />, testId: "tab-design" },
    { id: "ai", label: "AI調整", icon: <Sparkles size={15} />, testId: "tab-ai" },
  ];
  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-r border-border bg-panel">
      <nav className="grid grid-cols-4 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            data-testid={t.testId}
            onClick={() => setTab(t.id)}
            className={`flex h-11 flex-col items-center justify-center gap-0.5 text-[10px] ${tab === t.id ? "border-b-2 border-accent text-accent" : "text-muted hover:text-fg"}`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "add" && <AddPanel />}
        {tab === "layers" && <LayersPanel />}
        {tab === "design" && <DesignPanel />}
        {tab === "ai" && <AiPanel />}
      </div>
    </aside>
  );
}

function Item({ icon, label, onClick, testId, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; testId: string; disabled: boolean }) {
  return (
    <button className="flex h-10 w-full items-center gap-3 rounded-md border border-border px-3 text-left hover:bg-gray-50" onClick={onClick} data-testid={testId} disabled={disabled}>
      <span className="text-muted">{icon}</span>
      {label}
    </button>
  );
}

function AddPanel() {
  const ed = useEditor();
  const fileRef = useRef<HTMLInputElement>(null);
  const disabled = !ed.ready;
  return (
    <div className="flex flex-col gap-4">
      <section>
        <h3 className="ui-section-title">テキスト</h3>
        <div className="flex flex-col gap-2">
          <Item icon={<Heading size={16} />} label="見出しを追加" onClick={() => void ed.addText("heading")} testId="add-heading" disabled={disabled} />
          <Item icon={<Type size={16} />} label="本文を追加" onClick={() => void ed.addText("body")} testId="add-body" disabled={disabled} />
        </div>
      </section>
      <section>
        <h3 className="ui-section-title">画像</h3>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          data-testid="upload-image"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void ed.addImageFile(f);
            e.target.value = "";
          }}
        />
        <Item icon={<ImagePlus size={16} />} label="PCから画像をアップロード" onClick={() => fileRef.current?.click()} testId="add-image" disabled={disabled} />
        <p className="mt-1.5 text-[11px] text-muted">写真の枠がある場合はその位置に配置されます。</p>
      </section>
      <section>
        <h3 className="ui-section-title">図形・線</h3>
        <div className="flex flex-col gap-2">
          <Item icon={<Square size={16} />} label="四角形" onClick={() => ed.addRect()} testId="add-rect" disabled={disabled} />
          <Item icon={<Circle size={16} />} label="円" onClick={() => ed.addEllipse()} testId="add-ellipse" disabled={disabled} />
          <Item icon={<Minus size={16} />} label="線" onClick={() => ed.addLine()} testId="add-line" disabled={disabled} />
        </div>
      </section>
      <section className="rounded-md bg-gray-50 p-3 text-[11px] leading-relaxed text-muted">
        <div className="mb-1 font-semibold text-fg">ショートカット</div>
        ⌘Z 元に戻す / ⇧⌘Z やり直す / ⌘C ⌘V コピー・貼り付け / ⌘D 複製 / Delete 削除 / 矢印キー 移動（⇧で10px）/ ⌘] ⌘[ 前後へ / ⌘S 保存 / ダブルクリックで文字編集
      </section>
    </div>
  );
}

function LayersPanel() {
  const ed = useEditor();
  const canvas = ed.canvas;
  if (!canvas) return <p className="text-muted">読み込み中…</p>;
  const objects = canvas.getObjects().filter((o) => getMeta(o).role !== "placeholder-label");
  const list = [...objects].reverse();
  const selected = new Set(ed.selection);
  return (
    <div>
      <h3 className="ui-section-title">レイヤー（上が前面）</h3>
      <ul className="flex flex-col gap-0.5" data-testid="layer-list">
        {list.map((obj) => {
          const m = getMeta(obj);
          const isSel = selected.has(obj);
          const index = objects.indexOf(obj);
          return (
            <li
              key={m.id}
              data-testid="layer-item"
              data-selected={isSel ? "true" : "false"}
              className={`group flex h-8 items-center gap-1 rounded-md px-1.5 ${isSel ? "bg-blue-50 text-accent" : "hover:bg-gray-50"}`}
            >
              <button
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                onClick={(e) => {
                  if (obj.visible === false) return;
                  if (e.shiftKey) ed.select(isSel ? ed.selection.filter((o) => o !== obj) : [...ed.selection, obj]);
                  else ed.select([obj]);
                }}
              >
                <LayerIcon obj={obj} />
                <span className="truncate text-[12px]">{m.name}</span>
              </button>
              <button className="ui-btn-icon h-6 w-6" title="前面へ" aria-label="前面へ" onClick={() => ed.moveObjectTo(obj, index + 1)} disabled={index >= objects.length - 1}>
                <ArrowUp size={12} />
              </button>
              <button className="ui-btn-icon h-6 w-6" title="背面へ" aria-label="背面へ" onClick={() => ed.moveObjectTo(obj, index - 1)} disabled={index <= 0}>
                <ArrowDown size={12} />
              </button>
              <button className="ui-btn-icon h-6 w-6" title={obj.visible ? "非表示" : "表示"} aria-label={obj.visible ? "非表示にする" : "表示する"} onClick={() => ed.toggleVisible(obj)}>
                {obj.visible ? <Eye size={12} /> : <EyeOff size={12} className="text-muted" />}
              </button>
              <button className="ui-btn-icon h-6 w-6" title={ed.isLocked(obj) ? "ロック解除" : "ロック"} aria-label={ed.isLocked(obj) ? "ロック解除" : "ロック"} onClick={() => ed.toggleLock(obj)}>
                {ed.isLocked(obj) ? <Lock size={12} /> : <Unlock size={12} className="text-muted" />}
              </button>
            </li>
          );
        })}
      </ul>
      {list.length === 0 && <p className="text-muted">要素がありません。</p>}
    </div>
  );
}

function LayerIcon({ obj }: { obj: FabricObject }) {
  if (obj instanceof Textbox) return <Type size={13} className="shrink-0 text-muted" />;
  if (obj instanceof FabricImage) return <ImagePlus size={13} className="shrink-0 text-muted" />;
  if (obj.type === "ellipse") return <Circle size={13} className="shrink-0 text-muted" />;
  if (obj.type === "line") return <Minus size={13} className="shrink-0 text-muted" />;
  return <Square size={13} className="shrink-0 text-muted" />;
}

function DesignPanel() {
  const ed = useEditor();
  const [brief, setBrief] = useState(ed.project.brief);
  const [designs, setDesigns] = useState<DesignSpec[] | null>(null);
  const [source, setSource] = useState<"ai" | "local" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const generate = async () => {
    if (!brief.productName.trim()) {
      setError("商品名を入力してください。");
      return;
    }
    setError(null);
    setWorking(true);
    ed.updateBrief(brief);
    const b = {
      ...brief,
      hasPhoto: Boolean(ed.project.photoSrc),
      photoAspect: undefined,
      canvasAspect: ed.size.width / ed.size.height,
    };
    if (ed.aiStatus.available) {
      try {
        setDesigns((await aiGenerate(b)).designs);
        setSource("ai");
        setWorking(false);
        return;
      } catch (e) {
        setError(`${e instanceof Error ? e.message : "AI生成に失敗しました。"} 内蔵のデザイン生成で続行します。`);
      }
    }
    setDesigns(generateDesigns(b));
    setSource("local");
    setWorking(false);
  };

  const apply = async (d: DesignSpec) => {
    if (!window.confirm("現在のキャンバスをこの案で置き換えます。よろしいですか？（元に戻すで戻せます）")) return;
    await ed.applyDesign(d);
    ed.notify("デザイン案を適用しました。");
  };

  return (
    <div className="flex flex-col gap-3">
      <h3 className="ui-section-title">デザイン案を作り直す</h3>
      <Field label="商品名">
        <input className="ui-input" value={brief.productName} onChange={(e) => setBrief({ ...brief, productName: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="価格">
          <input className="ui-input" value={brief.price} onChange={(e) => setBrief({ ...brief, price: e.target.value })} />
        </Field>
        <Field label="店名">
          <input className="ui-input" value={brief.shopName} onChange={(e) => setBrief({ ...brief, shopName: e.target.value })} />
        </Field>
      </div>
      <Field label="説明文">
        <textarea className="ui-input h-16 resize-none py-1.5" value={brief.description} onChange={(e) => setBrief({ ...brief, description: e.target.value })} />
      </Field>
      <Field label="雰囲気の指示">
        <textarea className="ui-input h-16 resize-none py-1.5" value={brief.prompt} onChange={(e) => setBrief({ ...brief, prompt: e.target.value })} data-testid="design-prompt" />
      </Field>
      <button className="ui-btn-primary" onClick={() => void generate()} disabled={working || !ed.ready} data-testid="regenerate">
        <Sparkles size={14} /> 3案を生成{ed.aiStatus.available ? `（${ed.aiStatus.label}）` : "（内蔵）"}
      </button>
      {error && <p className="text-[12px] text-danger">{error}</p>}
      {working && <p className="text-muted">生成中…</p>}
      {designs && (
        <>
          <p className="text-[11px] text-muted">{source === "ai" ? `${ed.aiStatus.label}の提案` : "内蔵デザイン生成"}。写真は現在のプロジェクトの写真を使用します。</p>
          <ProposalGrid designs={designs} size={ed.size} photoSrc={ed.project.photoSrc} onChoose={(d) => void apply(d)} compact disabled={ed.busy !== null} />
        </>
      )}
    </div>
  );
}

function AiPanel() {
  const ed = useEditor();
  const [instruction, setInstruction] = useState("");
  const [result, setResult] = useState<{ kind: "ok" | "error"; message: string } | null>(null);
  const [working, setWorking] = useState(false);
  const run = async () => {
    if (!instruction.trim()) return;
    setWorking(true);
    setResult(null);
    try {
      const summary = await ed.refine(instruction.trim());
      setResult({ kind: "ok", message: summary });
    } catch (e) {
      setResult({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    } finally {
      setWorking(false);
    }
  };
  const examples = ["価格を大きく", "写真を少し小さく", "商品名を明朝に", "背景を黒に", "高級な焼肉店っぽく", "文字を中央揃えに"];
  return (
    <div className="flex flex-col gap-3">
      <h3 className="ui-section-title">日本語の指示で調整</h3>
      <div className={`rounded-md px-2.5 py-2 text-[11px] ${ed.aiStatus.available ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`} data-testid="ai-status">
        {ed.aiStatus.available
          ? `${ed.aiStatus.label}（${ed.aiStatus.model}）に接続済み。自由な指示を解釈します。`
          : "AI（Gemini / OpenAI）は未接続です。内蔵ルールで「価格を大きく」「背景を黒に」「和風に」などの定型的な指示に対応します。"}
      </div>
      <textarea
        className="ui-input h-20 resize-none py-1.5"
        placeholder="例：価格をもっと目立たせて"
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        data-testid="refine-input"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void run();
        }}
      />
      <div className="flex flex-wrap gap-1.5">
        {examples.map((t) => (
          <button key={t} className="rounded-md border border-border bg-white px-2 py-0.5 text-[11px] text-muted hover:bg-gray-50" onClick={() => setInstruction(t)}>
            {t}
          </button>
        ))}
      </div>
      <button className="ui-btn-primary" onClick={() => void run()} disabled={working || !instruction.trim() || !ed.ready} data-testid="refine-run">
        <Sparkles size={14} /> 調整を適用
      </button>
      {result && (
        <p className={`text-[12px] ${result.kind === "ok" ? "text-green-700" : "text-danger"}`} data-testid="refine-result" data-kind={result.kind}>
          {result.message}
        </p>
      )}
      <p className="text-[11px] text-muted">変更は対象の要素だけに適用され、「元に戻す」で取り消せます。</p>
    </div>
  );
}
