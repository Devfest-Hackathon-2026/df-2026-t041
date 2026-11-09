"use client";

import { FontSelect } from "@/components/FontSelect";

import { useRef } from "react";
import { ActiveSelection, Ellipse, FabricImage, FabricObject, Line, Rect, Textbox } from "fabric";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  ArrowDownToLine,
  ArrowUpToLine,
  ChevronDown,
  ChevronUp,
  Copy,
  Trash2,
  Lock,
  Unlock,
  RefreshCw,
} from "lucide-react";
import { FONTS } from "@/lib/fonts";
import { getMeta, imageRadius } from "@/lib/design/fabricBridge";
import { useEditor } from "./EditorContext";
import { ColorInput, Field, NumberInput } from "../ui";

export function RightPanel() {
  const ed = useEditor();
  const active = ed.active;
  return (
    <aside className="flex w-[300px] shrink-0 flex-col overflow-y-auto border-l border-border bg-panel p-3" data-testid="right-panel">
      {!ed.ready ? (
        <p className="text-muted">読み込み中…</p>
      ) : !active ? (
        <PageSettings />
      ) : active instanceof ActiveSelection ? (
        <MultiSettings count={ed.selection.length} />
      ) : (
        <ObjectSettings obj={active} />
      )}
    </aside>
  );
}

function PageSettings() {
  const ed = useEditor();
  const bg = typeof ed.canvas?.backgroundColor === "string" ? ed.canvas.backgroundColor : "#ffffff";
  return (
    <div className="flex flex-col gap-4">
      <h3 className="ui-section-title">ページ設定</h3>
      <Field label="背景色">
        <ColorInput value={bg} onChange={(v) => ed.setBackground(v)} ariaLabel="背景色" testId="bg-color" />
      </Field>
      <div className="text-[11px] text-muted">
        サイズ: {ed.size.label}（{ed.size.width}×{ed.size.height}
        {ed.size.widthMm ? `、${ed.size.widthMm}×${ed.size.heightMm}mm` : "px"}）。サイズは上部のメニューから変更できます。
      </div>
      <p className="text-[11px] text-muted">要素をクリックすると、ここに詳細設定が表示されます。</p>
    </div>
  );
}

function MultiSettings({ count }: { count: number }) {
  const ed = useEditor();
  return (
    <div className="flex flex-col gap-4">
      <h3 className="ui-section-title">{count}個の要素を選択中</h3>
      <AlignButtons />
      <OrderButtons />
      <div className="flex gap-2">
        <button className="ui-btn flex-1" onClick={() => void ed.duplicate()}>
          <Copy size={14} /> 複製
        </button>
        <button className="ui-btn flex-1 text-danger" onClick={() => ed.deleteSelection()}>
          <Trash2 size={14} /> 削除
        </button>
      </div>
      <p className="text-[11px] text-muted">ドラッグでまとめて移動できます。⇧クリックで選択に追加・解除。</p>
    </div>
  );
}

function AlignButtons() {
  const ed = useEditor();
  const items: { k: Parameters<typeof ed.align>[0]; icon: React.ReactNode; label: string }[] = [
    { k: "left", icon: <AlignStartVertical size={14} />, label: "左端に揃える" },
    { k: "hcenter", icon: <AlignCenterVertical size={14} />, label: "左右中央に揃える" },
    { k: "right", icon: <AlignEndVertical size={14} />, label: "右端に揃える" },
    { k: "top", icon: <AlignStartHorizontal size={14} />, label: "上端に揃える" },
    { k: "vcenter", icon: <AlignCenterHorizontal size={14} />, label: "上下中央に揃える" },
    { k: "bottom", icon: <AlignEndHorizontal size={14} />, label: "下端に揃える" },
  ];
  return (
    <div>
      <div className="ui-label">キャンバスに整列</div>
      <div className="grid grid-cols-6 gap-1">
        {items.map((i) => (
          <button key={i.k} className="ui-btn h-8 px-0" title={i.label} aria-label={i.label} onClick={() => ed.align(i.k)} data-testid={`align-${i.k}`}>
            {i.icon}
          </button>
        ))}
      </div>
    </div>
  );
}

function OrderButtons({ obj }: { obj?: FabricObject }) {
  const ed = useEditor();
  return (
    <div>
      <div className="ui-label">重なり順</div>
      <div className="grid grid-cols-4 gap-1">
        <button className="ui-btn h-8 px-0" title="最前面へ" aria-label="最前面へ" onClick={() => ed.bringToFront(obj)} data-testid="order-front">
          <ArrowUpToLine size={14} />
        </button>
        <button className="ui-btn h-8 px-0" title="前面へ" aria-label="前面へ" onClick={() => ed.bringForward(obj)} data-testid="order-forward">
          <ChevronUp size={14} />
        </button>
        <button className="ui-btn h-8 px-0" title="背面へ" aria-label="背面へ" onClick={() => ed.sendBackwards(obj)} data-testid="order-backward">
          <ChevronDown size={14} />
        </button>
        <button className="ui-btn h-8 px-0" title="最背面へ" aria-label="最背面へ" onClick={() => ed.sendToBack(obj)} data-testid="order-back">
          <ArrowDownToLine size={14} />
        </button>
      </div>
    </div>
  );
}

function ObjectSettings({ obj }: { obj: FabricObject }) {
  const ed = useEditor();
  const m = getMeta(obj);
  const br = obj.getBoundingRect();
  const locked = ed.isLocked(obj);
  const keepAspect = m.keepAspect !== false && (obj instanceof FabricImage || m.keepAspect === true);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="ui-section-title mb-0" data-testid="selected-name">
          {m.name}
        </h3>
        <button className="ui-btn-icon h-7 w-7" title={locked ? "ロック解除" : "ロック"} aria-label={locked ? "ロック解除" : "ロック"} onClick={() => ed.toggleLock(obj)}>
          {locked ? <Lock size={14} /> : <Unlock size={14} />}
        </button>
      </div>

      {obj instanceof Textbox && <TextSettings obj={obj} />}
      {obj instanceof FabricImage && <ImageSettings obj={obj} />}
      {(obj instanceof Rect || obj instanceof Ellipse) && <ShapeSettings obj={obj} />}
      {obj instanceof Line && <LineSettings obj={obj} />}

      <section>
        <div className="ui-label">位置とサイズ（px）</div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="X">
            <NumberInput value={br.left} onChange={(v) => ed.setPosition(obj, v, undefined)} ariaLabel="X" testId="prop-x" />
          </Field>
          <Field label="Y">
            <NumberInput value={br.top} onChange={(v) => ed.setPosition(obj, undefined, v)} ariaLabel="Y" testId="prop-y" />
          </Field>
          <Field label="幅">
            <NumberInput value={obj.getScaledWidth()} min={1} onChange={(v) => ed.setSize(obj, v, undefined, keepAspect)} ariaLabel="幅" testId="prop-w" />
          </Field>
          {!(obj instanceof Textbox) && (
            <Field label="高さ">
              <NumberInput value={obj.getScaledHeight()} min={1} onChange={(v) => ed.setSize(obj, undefined, v, keepAspect)} ariaLabel="高さ" testId="prop-h" />
            </Field>
          )}
          <Field label="回転">
            <NumberInput value={obj.angle} min={-360} max={360} suffix="°" onChange={(v) => ed.setProps(obj, { angle: v })} ariaLabel="回転" testId="prop-angle" />
          </Field>
          <Field label="不透明度">
            <NumberInput value={Math.round(obj.opacity * 100)} min={0} max={100} suffix="%" onChange={(v) => ed.setProps(obj, { opacity: v / 100 })} ariaLabel="不透明度" testId="prop-opacity" />
          </Field>
        </div>
        {!(obj instanceof Textbox) && !(obj instanceof Line) && (
          <label className="mt-2 flex items-center gap-2 text-[12px]">
            <input type="checkbox" checked={keepAspect} onChange={(e) => ed.setKeepAspect(obj, e.target.checked)} data-testid="keep-aspect" />
            縦横比を固定
          </label>
        )}
      </section>

      <AlignButtons />
      <OrderButtons obj={obj} />

      <div className="flex gap-2">
        <button className="ui-btn flex-1" onClick={() => void ed.duplicate()} data-testid="duplicate">
          <Copy size={14} /> 複製
        </button>
        <button className="ui-btn flex-1 text-danger" onClick={() => ed.deleteSelection()} data-testid="delete">
          <Trash2 size={14} /> 削除
        </button>
      </div>
    </div>
  );
}

function TextSettings({ obj }: { obj: Textbox }) {
  const ed = useEditor();
  const font = FONTS.find((f) => f.family === obj.fontFamily) ?? FONTS[0];
  const weight = typeof obj.fontWeight === "number" ? obj.fontWeight : obj.fontWeight === "bold" ? 700 : 400;
  const fill = typeof obj.fill === "string" ? obj.fill : "#000000";
  return (
    <section className="flex flex-col gap-3">
      <Field label="テキスト">
        <textarea
          className="ui-input h-20 resize-y py-1.5"
          value={obj.text}
          data-testid="text-content"
          aria-label="テキスト"
          onChange={(e) => ed.setProps(obj, { text: e.target.value }, 400)}
        />
      </Field>
      <div className="grid grid-cols-[1fr_88px] gap-2">
        <Field label="フォント">
          <FontSelect value={font.family} onChange={(f) => void ed.setFont(obj, f)} testId="font-family" />
        </Field>
        <Field label="太さ">
          <select className="ui-select" value={font.weights.includes(weight) ? weight : font.weights[0]} data-testid="font-weight" onChange={(e) => void ed.setFont(obj, font.family, Number(e.target.value))}>
            {font.weights.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Field label="サイズ">
          <NumberInput value={obj.fontSize * (obj.scaleX || 1)} min={4} max={1000} onChange={(v) => ed.setProps(obj, { fontSize: v, scaleX: 1, scaleY: 1 })} ariaLabel="文字サイズ" testId="font-size" />
        </Field>
        <Field label="行間">
          <NumberInput value={obj.lineHeight} min={0.6} max={3} step={0.05} onChange={(v) => ed.setProps(obj, { lineHeight: v })} ariaLabel="行間" testId="line-height" />
        </Field>
        <Field label="字間">
          <NumberInput value={obj.charSpacing} min={-200} max={1000} step={10} onChange={(v) => ed.setProps(obj, { charSpacing: v })} ariaLabel="文字間隔" testId="char-spacing" />
        </Field>
      </div>
      <div className="grid grid-cols-[1fr_auto] items-end gap-2">
        <Field label="文字色">
          <ColorInput value={fill} onChange={(v) => ed.setProps(obj, { fill: v }, 150)} ariaLabel="文字色" testId="text-color" />
        </Field>
        <div>
          <div className="ui-label">揃え</div>
          <div className="flex gap-1">
            {(["left", "center", "right"] as const).map((a) => (
              <button
                key={a}
                className={`ui-btn h-8 w-8 px-0 ${obj.textAlign === a ? "border-accent bg-blue-50 text-accent" : ""}`}
                aria-label={a === "left" ? "左揃え" : a === "center" ? "中央揃え" : "右揃え"}
                data-testid={`align-text-${a}`}
                onClick={() => ed.setProps(obj, { textAlign: a })}
              >
                {a === "left" ? <AlignLeft size={14} /> : a === "center" ? <AlignCenter size={14} /> : <AlignRight size={14} />}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ImageSettings({ obj }: { obj: FabricImage }) {
  const ed = useEditor();
  const fileRef = useRef<HTMLInputElement>(null);
  const { width: ow, height: oh } = obj.getOriginalSize();
  const insets = {
    left: ow ? obj.cropX / ow : 0,
    top: oh ? obj.cropY / oh : 0,
    right: ow ? 1 - (obj.cropX + obj.width) / ow : 0,
    bottom: oh ? 1 - (obj.cropY + obj.height) / oh : 0,
  };
  const setInset = (k: keyof typeof insets, v: number) => ed.setImageCrop(obj, { ...insets, [k]: v / 100 });
  return (
    <section className="flex flex-col gap-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        data-testid="replace-image-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void ed.replaceImageFile(obj, f);
          e.target.value = "";
        }}
      />
      <button className="ui-btn" onClick={() => fileRef.current?.click()} data-testid="replace-image">
        <RefreshCw size={14} /> 画像を差し替え
      </button>
      <div>
        <div className="ui-label">トリミング（元画像からの切り落とし %）</div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="左">
            <NumberInput value={Math.round(insets.left * 1000) / 10} min={0} max={90} onChange={(v) => setInset("left", v)} ariaLabel="左トリミング" testId="crop-left" />
          </Field>
          <Field label="右">
            <NumberInput value={Math.round(insets.right * 1000) / 10} min={0} max={90} onChange={(v) => setInset("right", v)} ariaLabel="右トリミング" testId="crop-right" />
          </Field>
          <Field label="上">
            <NumberInput value={Math.round(insets.top * 1000) / 10} min={0} max={90} onChange={(v) => setInset("top", v)} ariaLabel="上トリミング" testId="crop-top" />
          </Field>
          <Field label="下">
            <NumberInput value={Math.round(insets.bottom * 1000) / 10} min={0} max={90} onChange={(v) => setInset("bottom", v)} ariaLabel="下トリミング" testId="crop-bottom" />
          </Field>
        </div>
        <div className="mt-2 flex gap-2">
          <button className="ui-btn flex-1" onClick={() => ed.setImageCrop(obj, { left: 0, top: 0, right: 0, bottom: 0 })} data-testid="crop-reset">
            トリミング解除
          </button>
          <button className="ui-btn flex-1" title="現在の枠いっぱいに写真を収め直します" onClick={() => ed.recoverImage(obj)} data-testid="crop-cover">
            枠に合わせる
          </button>
        </div>
      </div>
      <Field label="角丸（px）">
        <NumberInput value={imageRadius(obj)} min={0} max={1000} onChange={(v) => ed.setImageRadius(obj, v)} ariaLabel="角丸" testId="image-radius" />
      </Field>
      <p className="text-[11px] text-muted">
        元画像 {ow}×{oh}px。角のハンドルで縦横比を保ったまま拡大縮小できます。
      </p>
    </section>
  );
}

function ShapeSettings({ obj }: { obj: Rect | Ellipse }) {
  const ed = useEditor();
  const fill = typeof obj.fill === "string" ? obj.fill : "#000000";
  const stroke = typeof obj.stroke === "string" ? obj.stroke : "";
  return (
    <section className="flex flex-col gap-3">
      <Field label="塗り">
        <ColorInput value={fill} onChange={(v) => ed.setProps(obj, { fill: v }, 150)} ariaLabel="塗り" testId="shape-fill" />
      </Field>
      <div className="grid grid-cols-[1fr_80px] gap-2">
        <Field label="枠線色">
          <ColorInput value={stroke || "#000000"} onChange={(v) => ed.setProps(obj, { stroke: v }, 150)} ariaLabel="枠線色" />
        </Field>
        <Field label="枠線太さ">
          <NumberInput value={obj.strokeWidth} min={0} max={200} onChange={(v) => ed.setProps(obj, { strokeWidth: v, stroke: v > 0 ? stroke || "#000000" : stroke })} ariaLabel="枠線太さ" testId="stroke-width" />
        </Field>
      </div>
      {obj instanceof Rect && (
        <Field label="角丸（px）">
          <NumberInput value={obj.rx} min={0} max={1000} onChange={(v) => ed.setProps(obj, { rx: v, ry: v })} ariaLabel="角丸" testId="rect-radius" />
        </Field>
      )}
    </section>
  );
}

function LineSettings({ obj }: { obj: Line }) {
  const ed = useEditor();
  const stroke = typeof obj.stroke === "string" ? obj.stroke : "#000000";
  return (
    <section className="grid grid-cols-[1fr_80px] gap-2">
      <Field label="線の色">
        <ColorInput value={stroke} onChange={(v) => ed.setProps(obj, { stroke: v }, 150)} ariaLabel="線の色" />
      </Field>
      <Field label="太さ">
        <NumberInput value={obj.strokeWidth} min={1} max={200} onChange={(v) => ed.setProps(obj, { strokeWidth: v })} ariaLabel="線の太さ" />
      </Field>
    </section>
  );
}
