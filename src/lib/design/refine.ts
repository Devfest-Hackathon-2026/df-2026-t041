import type { DesignSpec, RefinePatch, SpecElement, SpecText } from "./spec";
import { STYLES, detectColor, type Palette } from "./styles";
import { FONTS } from "../fonts";

/**
 * Offline refinement: interprets a short Japanese instruction and returns a patch
 * that only touches the elements the instruction refers to. Unknown instructions
 * throw so the UI can say so instead of pretending.
 */
export class RefineNotUnderstood extends Error {}

type Target = "price" | "photo" | "product" | "shop" | "description" | "allText" | "background";

function detectTargets(text: string): Target[] {
  const t: Target[] = [];
  if (/(値段|価格|金額)/.test(text)) t.push("price");
  if (/(写真|画像)/.test(text)) t.push("photo");
  if (/(商品名|タイトル|見出し|品名)/.test(text)) t.push("product");
  if (/店名/.test(text)) t.push("shop");
  if (/(説明|本文|キャプション)/.test(text)) t.push("description");
  if (/背景/.test(text)) t.push("background");
  if (t.length === 0 && /(文字|テキスト|フォント|全体)/.test(text)) t.push("allText");
  return t;
}

function elementsOf(spec: DesignSpec, target: Target): SpecElement[] {
  switch (target) {
    case "price":
      return spec.elements.filter((e) => e.kind === "text" && e.role === "price");
    case "photo":
      return spec.elements.filter((e) => e.kind === "image" || (e.kind === "rect" && e.role === "photo-placeholder"));
    case "product":
      return spec.elements.filter((e) => e.kind === "text" && e.role === "product");
    case "shop":
      return spec.elements.filter((e) => e.kind === "text" && e.role === "shop");
    case "description":
      return spec.elements.filter((e) => e.kind === "text" && e.role === "description");
    case "allText":
      return spec.elements.filter((e) => e.kind === "text");
    default:
      return [];
  }
}

function restyle(spec: DesignSpec, pal: Palette, fonts?: { heading: { family: string; weight: number }; body: { family: string; weight: number }; price: { family: string; weight: number } }): RefinePatch {
  const bgDark = isDarkHex(spec.background);
  const changes: RefinePatch["changes"] = [];
  for (const el of spec.elements) {
    if (el.kind === "text") {
      const set: RefinePatch["changes"][number]["set"] = {};
      const onDarkBand = isDarkHex(el.fill) !== bgDark; // text sitting on a band/badge keeps contrast rule
      if (el.role === "price") set.fill = onDarkBand ? pal.onAccent : pal.accent;
      else if (el.role === "shop" || el.role === "description") set.fill = onDarkBand ? pal.onBand : pal.sub;
      else set.fill = onDarkBand ? pal.onBand : pal.text;
      if (fonts) {
        const f = el.role === "price" ? fonts.price : el.role === "product" || el.role === "shop" ? fonts.heading : fonts.body;
        set.fontFamily = f.family;
        set.fontWeight = f.weight;
      }
      changes.push({ id: el.id, set });
    } else if (el.kind === "rect" || el.kind === "ellipse") {
      if (el.role === "photo-placeholder") continue;
      const set: RefinePatch["changes"][number]["set"] = {};
      const fillDark = isDarkHex(el.fill);
      if (el.kind === "ellipse") set.fill = pal.accent;
      else if (el.stroke && el.w > 0.8) {
        set.fill = pal.bg;
        set.stroke = pal.accent;
      } else set.fill = fillDark === bgDark && el.fill.toLowerCase() === spec.background.toLowerCase() ? pal.bg : fillDark ? pal.band : pal.accent;
      changes.push({ id: el.id, set });
    } else if (el.kind === "line") {
      changes.push({ id: el.id, set: { stroke: pal.accent } });
    }
  }
  return { summary: "配色を変更しました", background: pal.bg, changes, add: [], remove: [] };
}

function isDarkHex(hex: string): boolean {
  let s = hex.replace("#", "");
  if (s.length === 3) s = s.split("").map((c) => c + c).join("");
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

export function refineLocally(spec: DesignSpec, instruction: string): RefinePatch {
  const text = instruction.trim();
  if (!text) throw new RefineNotUnderstood("指示を入力してください。");

  // 1. whole-style changes
  for (const style of STYLES) {
    if (style.keywords.some((k) => k.length >= 2 && text.includes(k)) && /(風|っぽく|らしく|雰囲気|テイスト|調|に|で)/.test(text)) {
      const useAlt = /(暗|ダーク|黒)/.test(text);
      const pal = useAlt ? style.alt : style.palette;
      const patch = restyle(spec, pal, { heading: style.heading, body: style.body, price: style.price });
      patch.summary = `${style.label}の配色とフォントに変更しました`;
      return patch;
    }
  }

  const targets = detectTargets(text);
  const bigger = /(大き|目立|強調|太く|拡大)/.test(text);
  const smaller = /(小さ|控えめ|細く|縮小|目立たな)/.test(text);
  const color = detectColor(text);
  const changes: RefinePatch["changes"] = [];
  const summaries: string[] = [];

  if (targets.includes("background")) {
    if (color) {
      summaries.push("背景色を変更");
      const patch = restyle(spec, pickPaletteForBackground(color));
      patch.background = color;
      patch.summary = "背景色を変更しました";
      return patch;
    }
    throw new RefineNotUnderstood("背景の指示は「背景を黒に」のように色を指定してください。");
  }

  const fontMatch = /(明朝|ゴシック|丸ゴ|丸い文字|丸文字|手書き|セリフ)/.exec(text);
  const fontFamily = fontMatch
    ? fontMatch[1].startsWith("明朝") || fontMatch[1] === "セリフ"
      ? "Noto Serif JP"
      : fontMatch[1].startsWith("丸")
        ? "M PLUS Rounded 1c"
        : "Noto Sans JP"
    : null;
  const alignMatch = /(中央|センター|左|右)(寄せ|揃え|に)/.exec(text);
  const align = alignMatch ? (alignMatch[1] === "左" ? "left" : alignMatch[1] === "右" ? "right" : "center") : null;
  const moveUp = /上に/.test(text) && /(移動|寄せ|動か|ずら)/.test(text);
  const moveDown = /下に/.test(text) && /(移動|寄せ|動か|ずら)/.test(text);

  const effectiveTargets: Target[] = targets.length ? targets : fontFamily || align ? ["allText"] : [];
  if (effectiveTargets.length === 0) throw new RefineNotUnderstood("対象が分かりませんでした。「価格を大きく」「写真を小さく」「和風に」「背景を黒に」のように指定してください。");

  for (const target of effectiveTargets) {
    const els = elementsOf(spec, target);
    if (els.length === 0) {
      summaries.push(`${labelOf(target)}が見つかりません`);
      continue;
    }
    for (const el of els) {
      const set: RefinePatch["changes"][number]["set"] = {};
      if (el.kind === "text") {
        if (bigger) set.fontSize = Math.min(0.6, el.fontSize * 1.3);
        if (smaller) set.fontSize = Math.max(0.01, el.fontSize * 0.75);
        if (/太く/.test(text)) set.fontWeight = 900;
        if (/細く/.test(text)) set.fontWeight = 400;
        if (color) set.fill = color;
        if (fontFamily) {
          set.fontFamily = fontFamily;
          const def = FONTS.find((f) => f.family === fontFamily);
          if (def && !def.weights.includes(set.fontWeight ?? el.fontWeight)) set.fontWeight = def.weights.includes(700) ? 700 : def.weights[0];
        }
        if (align) set.align = align;
        if (moveUp) set.y = Math.max(0, el.y - 0.08);
        if (moveDown) set.y = Math.min(0.95, el.y + 0.08);
        if (/(改行|縦書き)/.test(text)) throw new RefineNotUnderstood("改行や縦書きは右側のパネルから直接編集してください。");
      } else if (el.kind === "line") {
        continue;
      } else {
        // photo / placeholder: scale around its center
        const factor = bigger ? 1.2 : smaller ? 0.8 : 1;
        if (factor !== 1) {
          const nw = Math.min(1, el.w * factor);
          const nh = Math.min(1, el.h * factor);
          set.w = nw;
          set.h = nh;
          set.x = clamp(el.x - (nw - el.w) / 2, 0, 1 - nw);
          set.y = clamp(el.y - (nh - el.h) / 2, 0, 1 - nh);
        }
        if (/(角丸|丸く|角を丸)/.test(text)) set.radius = 0.03;
        if (/(角丸.{0,4}(なし|やめ|解除)|四角く)/.test(text)) set.radius = 0;
        if (moveUp) set.y = Math.max(0, el.y - 0.08);
        if (moveDown) set.y = Math.min(1 - el.h, el.y + 0.08);
      }
      if (Object.keys(set).length === 0) continue;
      changes.push({ id: el.id, set });
    }
    summaries.push(`${labelOf(target)}を調整`);
  }
  if (changes.length === 0) throw new RefineNotUnderstood("変更内容が分かりませんでした。「大きく」「小さく」「赤に」「明朝に」「中央揃えに」などを含めてください。");
  return { summary: summaries.join("、") + "しました", changes, add: [], remove: [] };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function labelOf(t: Target): string {
  return { price: "価格", photo: "写真", product: "商品名", shop: "店名", description: "説明文", allText: "文字", background: "背景" }[t];
}

function pickPaletteForBackground(bg: string): Palette {
  const dark = isDarkHex(bg);
  return dark
    ? { bg, text: "#f5f1ea", sub: "#c7c0b5", accent: "#e0b45c", onAccent: "#1a1a1a", band: "#1a1a1a", onBand: "#f5f1ea" }
    : { bg, text: "#1e1b18", sub: "#6b655f", accent: "#b23a2f", onAccent: "#ffffff", band: "#1e1b18", onBand: "#ffffff" };
}

export type { SpecText };
