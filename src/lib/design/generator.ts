import type { DesignBrief, DesignSpec, SpecElement, SpecText, TextRole } from "./spec";
import { formatPrice, stripPunctuation } from "./spec";
import { detectStyle, type Palette, type StyleDef } from "./styles";

/**
 * Rule-based layout generator. Works fully offline and produces three distinct,
 * editable layouts from the brief. Every element is positioned in normalized units.
 */

interface Ctx {
  brief: DesignBrief;
  style: StyleDef;
  p: Palette;
  /** width / height */
  aspect: number;
  /** font-size multiplier for wide canvases */
  s: number;
  photoEmphasis: boolean;
  priceEmphasis: boolean;
  price: string;
  n: number;
}

let counter = 0;
function uid(prefix: string) {
  counter += 1;
  return `${prefix}-${counter}`;
}

function text(ctx: Ctx, role: TextRole, t: string, opts: Partial<SpecText>): SpecText {
  t = stripPunctuation(t);
  const base =
    role === "product"
      ? ctx.style.heading
      : role === "price"
        ? ctx.style.price
        : role === "shop"
          ? ctx.style.heading
          : ctx.style.body;
  return {
    kind: "text",
    id: uid(role),
    role,
    text: t,
    x: 0.06,
    y: 0.5,
    w: 0.88,
    fontFamily: base.family,
    fontWeight: base.weight,
    fontSize: 0.04 * ctx.s,
    fill: ctx.p.text,
    align: "left",
    lineHeight: 1.25,
    charSpacing: role === "product" || role === "shop" ? ctx.style.headingSpacing : 0,
    angle: 0,
    opacity: 1,
    ...opts,
  };
}

function photo(ctx: Ctx, x: number, y: number, w: number, h: number, radius = 0): SpecElement {
  if (ctx.brief.hasPhoto) {
    return { kind: "image", id: uid("photo"), role: "photo", x, y, w, h, radius, opacity: 1, angle: 0 };
  }
  return {
    kind: "rect",
    id: uid("photo-placeholder"),
    role: "photo-placeholder",
    x,
    y,
    w,
    h,
    fill: mix(ctx.p.bg, ctx.p.text, 0.12),
    radius,
    opacity: 1,
    strokeWidth: 0,
    angle: 0,
  };
}

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string, extra: Partial<Extract<SpecElement, { kind: "rect" }>> = {}): SpecElement {
  return { kind: "rect", id: uid("rect"), role: "decor", x, y, w, h, fill, radius: 0, opacity: 1, strokeWidth: 0, angle: 0, ...extra };
}

function line(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, stroke: string, strokeWidth = 0.002): SpecElement {
  return { kind: "line", id: uid("line"), role: "decor", x1, y1, x2, y2, stroke, strokeWidth: strokeWidth * ctx.s, opacity: 1 };
}

function ellipse(ctx: Ctx, cx: number, cy: number, wFrac: number, fill: string): SpecElement {
  // circle: width is wFrac of canvas width; height derived from aspect so it renders round
  const h = wFrac * ctx.aspect;
  return { kind: "ellipse", id: uid("badge"), role: "decor", x: cx - wFrac / 2, y: cy - h / 2, w: wFrac, h, fill, opacity: 1, strokeWidth: 0, angle: 0 };
}

/** Rough width of a string in em units (digits/latin ≈ 0.6em, CJK ≈ 1em). */
function estimateEm(text: string): number {
  let em = 0;
  for (const ch of text) em += /[0-9A-Za-z.,¥$!?:;'" -]/.test(ch) ? 0.6 : 1;
  return Math.max(1, em);
}

/** Font size (fraction of W) so that `text` fits a box of `boxW` (fraction of W) on one line. */
function fitFontSize(text: string, boxW: number, maxSize: number, s: number): number {
  return Math.min(maxSize * s, (boxW * 0.82) / estimateEm(text));
}

/** Mixes two hex colors. t=0 → a, t=1 → b */
export function mix(a: string, b: string, t: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
function parseHex(h: string): [number, number, number] {
  let s = h.replace("#", "");
  if (s.length === 3) s = s.split("").map((ch) => ch + ch).join("");
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
export function isDark(hex: string): boolean {
  const [r, g, b] = parseHex(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

/* ---------- Layouts (portrait / square) ---------- */

function layoutHeroTop(ctx: Ctx): DesignSpec {
  const { brief, p } = ctx;
  const photoH = ctx.photoEmphasis ? 0.58 : 0.5;
  const els: SpecElement[] = [];
  els.push(photo(ctx, 0, 0, 1, photoH));
  let y = photoH + 0.045;
  if (brief.shopName) {
    els.push(text(ctx, "shop", brief.shopName, { y, fontSize: 0.03 * ctx.s, fill: p.sub, w: 0.88 }));
    y += 0.05;
  }
  els.push(text(ctx, "product", brief.productName, { y, fontSize: 0.095 * ctx.s, lineHeight: 1.1, w: 0.88 }));
  y += 0.13;
  els.push(line(ctx, 0.06, y, 0.94, y, p.accent, 0.0025));
  y += 0.025;
  if (brief.description) {
    els.push(text(ctx, "description", brief.description, { y, fontSize: 0.03 * ctx.s, w: ctx.price ? 0.5 : 0.88, lineHeight: 1.6, fill: p.sub }));
  }
  if (ctx.price) {
    els.push(
      text(ctx, "price", ctx.price, {
        x: 0.46,
        y: y - 0.005,
        w: 0.48,
        align: "right",
        fontSize: fitFontSize(ctx.price, 0.48, ctx.priceEmphasis ? 0.12 : 0.095, ctx.s),
        fill: p.accent,
        lineHeight: 1,
      }),
    );
  }
  return { id: uid("design"), name: "写真を大きく・王道", description: "料理写真を上部いっぱいに配置し、下に商品名と価格を整然と並べた定番レイアウト。", background: p.bg, elements: els };
}

function layoutFullBleed(ctx: Ctx): DesignSpec {
  const { brief, p } = ctx;
  const els: SpecElement[] = [];
  els.push(photo(ctx, 0, 0, 1, 1));
  const bandY = 0.6;
  els.push(rect(ctx, 0, bandY, 1, 1 - bandY, p.band, { opacity: 0.88 }));
  if (brief.shopName) {
    els.push(rect(ctx, 0.06, 0.05, Math.min(0.88, 0.06 + brief.shopName.length * 0.032 * ctx.s), 0.055, p.band, { opacity: 0.85 }));
    els.push(text(ctx, "shop", brief.shopName, { x: 0.08, y: 0.061, w: 0.84, fontSize: 0.028 * ctx.s, fill: p.onBand, lineHeight: 1 }));
  }
  let y = bandY + 0.05;
  els.push(text(ctx, "product", brief.productName, { y, fontSize: 0.1 * ctx.s, fill: p.onBand, lineHeight: 1.1 }));
  y += 0.135;
  if (ctx.price) {
    els.push(text(ctx, "price", ctx.price, { y, fontSize: fitFontSize(ctx.price, 0.88, ctx.priceEmphasis ? 0.13 : 0.1, ctx.s), fill: p.accent === p.band ? p.onBand : p.accent, lineHeight: 1 }));
    y += 0.1;
  }
  if (brief.description) {
    els.push(text(ctx, "description", brief.description, { y, fontSize: 0.028 * ctx.s, fill: mix(p.onBand, p.band, 0.2), lineHeight: 1.6 }));
  }
  return { id: uid("design"), name: "全面写真・インパクト", description: "写真を全面に敷き、下部の帯に商品名と価格をまとめたSNS向けの強いレイアウト。", background: p.bg, elements: els };
}

function layoutFramedBadge(ctx: Ctx): DesignSpec {
  const { brief, p } = ctx;
  const els: SpecElement[] = [];
  const m = 0.06;
  // outer frame line
  els.push(rect(ctx, m / 2, (m / 2) * ctx.aspect, 1 - m, 1 - m * ctx.aspect, p.bg, { stroke: p.accent, strokeWidth: 0.003 * ctx.s }));
  let y = 0.07;
  if (brief.shopName) {
    els.push(text(ctx, "shop", brief.shopName, { x: m, y, w: 1 - 2 * m, align: "center", fontSize: 0.03 * ctx.s, fill: p.sub }));
    y += 0.045;
  }
  els.push(text(ctx, "product", brief.productName, { x: m, y, w: 1 - 2 * m, align: "center", fontSize: 0.085 * ctx.s, lineHeight: 1.15 }));
  y += 0.12;
  const photoH = 0.42;
  els.push(photo(ctx, m + 0.02, y, 1 - 2 * m - 0.04, photoH, ctx.style.radius));
  // price badge overlapping the photo's bottom-right corner
  if (ctx.price) {
    const badgeW = ctx.priceEmphasis ? 0.3 : 0.26;
    const cx = 1 - m - 0.08;
    const cy = y + photoH - 0.02;
    els.push(ellipse(ctx, cx, cy, badgeW, p.accent));
    const fs = fitFontSize(ctx.price, badgeW, 0.11, ctx.s);
    els.push(
      text(ctx, "price", ctx.price, {
        x: cx - badgeW / 2,
        y: cy - (fs * ctx.aspect) / 2 - 0.004,
        w: badgeW,
        align: "center",
        fontSize: fs,
        fill: p.onAccent,
        lineHeight: 1,
      }),
    );
    // keep the description clear of the badge's lower half
    y += (badgeW * ctx.aspect) / 2 - 0.02;
  }
  y += photoH + 0.04;
  if (brief.description) {
    els.push(text(ctx, "description", brief.description, { x: m + 0.02, y, w: 1 - 2 * m - 0.04, align: "center", fontSize: 0.03 * ctx.s, lineHeight: 1.7, fill: p.sub }));
  }
  return { id: uid("design"), name: "枠と価格バッジ", description: "細い枠で品よくまとめ、価格を丸いバッジで目立たせたレイアウト。", background: p.bg, elements: els };
}

function layoutPoster(ctx: Ctx): DesignSpec {
  const { brief, p } = ctx;
  const els: SpecElement[] = [];
  const m = 0.06;
  let y = 0.06;
  if (brief.shopName) {
    els.push(text(ctx, "shop", brief.shopName, { x: m, y, w: 1 - 2 * m, fontSize: 0.03 * ctx.s, fill: p.sub }));
    y += 0.05;
  }
  els.push(text(ctx, "product", brief.productName, { x: m, y, w: 1 - 2 * m, fontSize: 0.12 * ctx.s, lineHeight: 1.05, fill: p.text }));
  y += 0.17;
  const photoH = ctx.photoEmphasis ? 0.5 : 0.44;
  els.push(photo(ctx, m, y, 1 - 2 * m, photoH, ctx.style.radius));
  y += photoH + 0.03;
  // bottom bar with price and description
  const barY = Math.max(y, 0.8);
  els.push(rect(ctx, 0, barY, 1, 1 - barY, p.accent));
  if (ctx.price) {
    els.push(
      text(ctx, "price", ctx.price, {
        x: m,
        y: barY + (1 - barY) / 2 - 0.055 * ctx.s,
        w: 0.5,
        fontSize: fitFontSize(ctx.price, 0.5, ctx.priceEmphasis ? 0.12 : 0.1, ctx.s),
        fill: p.onAccent,
        lineHeight: 1,
      }),
    );
  }
  if (brief.description) {
    els.push(
      text(ctx, "description", brief.description, {
        x: ctx.price ? 0.56 : m,
        y: barY + 0.035,
        w: ctx.price ? 0.38 : 1 - 2 * m,
        fontSize: 0.026 * ctx.s,
        lineHeight: 1.6,
        fill: p.onAccent,
      }),
    );
  }
  return { id: uid("design"), name: "見出し強調・ポスター", description: "商品名を最上部に大きく据え、下のカラー帯に価格を置いたポスター調のレイアウト。", background: p.bg, elements: els };
}

/* ---------- Layouts (landscape) ---------- */

function layoutSplit(ctx: Ctx, photoLeft: boolean, badge: boolean): DesignSpec {
  const { brief, p } = ctx;
  const els: SpecElement[] = [];
  const photoW = ctx.photoEmphasis ? 0.56 : 0.5;
  const px = photoLeft ? 0 : 1 - photoW;
  els.push(photo(ctx, px, 0, photoW, 1));
  const tx = photoLeft ? photoW + 0.05 : 0.06;
  const tw = 1 - photoW - 0.11;
  let y = 0.12;
  if (brief.shopName) {
    els.push(text(ctx, "shop", brief.shopName, { x: tx, y, w: tw, fontSize: 0.024 * ctx.s, fill: p.sub }));
    y += 0.08;
  }
  els.push(text(ctx, "product", brief.productName, { x: tx, y, w: tw, fontSize: 0.075 * ctx.s, lineHeight: 1.12, fill: p.text }));
  y += 0.26;
  els.push(line(ctx, tx, y, tx + tw, y, p.accent, 0.002));
  y += 0.05;
  if (brief.description) {
    els.push(text(ctx, "description", brief.description, { x: tx, y, w: tw, fontSize: 0.022 * ctx.s, lineHeight: 1.7, fill: p.sub }));
  }
  if (ctx.price) {
    if (badge) {
      const badgeW = 0.2;
      const cx = photoLeft ? photoW - 0.02 : 1 - photoW + 0.02;
      const cy = 0.82;
      els.push(ellipse(ctx, cx, cy, badgeW, p.accent));
      const fs = fitFontSize(ctx.price, badgeW, 0.08, ctx.s);
      els.push(text(ctx, "price", ctx.price, { x: cx - badgeW / 2, y: cy - (fs * ctx.aspect) / 2 - 0.004, w: badgeW, align: "center", fontSize: fs, fill: p.onAccent, lineHeight: 1 }));
    } else {
      els.push(text(ctx, "price", ctx.price, { x: tx, y: 0.72, w: tw, align: "right", fontSize: fitFontSize(ctx.price, tw, ctx.priceEmphasis ? 0.09 : 0.075, ctx.s), fill: p.accent, lineHeight: 1 }));
    }
  }
  return {
    id: uid("design"),
    name: photoLeft ? "左に写真・右に情報" : "右に写真・価格バッジ",
    description: "横長の面を二分割し、写真と情報をすっきり並べたレイアウト。",
    background: p.bg,
    elements: els,
  };
}

function layoutLandscapeHero(ctx: Ctx): DesignSpec {
  const { brief, p } = ctx;
  const els: SpecElement[] = [];
  els.push(photo(ctx, 0, 0, 1, 0.56));
  const m = 0.05;
  let y = 0.61;
  if (brief.shopName) {
    els.push(text(ctx, "shop", brief.shopName, { x: m, y, w: 0.5, fontSize: 0.022 * ctx.s, fill: p.sub }));
    y += 0.07;
  }
  els.push(text(ctx, "product", brief.productName, { x: m, y, w: 0.55, fontSize: 0.07 * ctx.s, lineHeight: 1.1, fill: p.text }));
  if (brief.description) {
    els.push(text(ctx, "description", brief.description, { x: m, y: y + 0.2, w: 0.55, fontSize: 0.02 * ctx.s, lineHeight: 1.6, fill: p.sub }));
  }
  if (ctx.price) {
    els.push(rect(ctx, 0.64, 0.61, 0.31, 0.3, p.accent, { radius: ctx.style.radius }));
    const fs = fitFontSize(ctx.price, 0.31, 0.075, ctx.s);
    els.push(text(ctx, "price", ctx.price, { x: 0.64, y: 0.76 - (fs * ctx.aspect) / 2, w: 0.31, align: "center", fontSize: fs, fill: p.onAccent, lineHeight: 1 }));
  }
  return { id: uid("design"), name: "上に写真・価格ボックス", description: "写真を上部に広く置き、右下のカラーボックスで価格を際立たせたレイアウト。", background: p.bg, elements: els };
}

/* ---------- Entry ---------- */

export function interpretPrompt(prompt: string) {
  const photoEmphasis = /写真.{0,6}(大き|メイン|主役|目立|いっぱい|全面)|全面|写真重視/.test(prompt);
  const priceEmphasis = /(値段|価格|金額|円).{0,8}(目立|大き|強調|アピール)|価格重視|お得/.test(prompt);
  return { photoEmphasis, priceEmphasis };
}

export function generateDesigns(brief: DesignBrief): DesignSpec[] {
  const style = detectStyle(brief.prompt);
  const { photoEmphasis, priceEmphasis } = interpretPrompt(brief.prompt);
  const aspect = brief.canvasAspect;
  const s = aspect > 1.15 ? 0.7 : aspect > 0.9 ? 0.92 : 1;
  const ctx: Ctx = { brief, style, p: style.palette, aspect, s, photoEmphasis, priceEmphasis, price: formatPrice(brief.price), n: 0 };
  let specs: DesignSpec[];
  if (aspect > 1.15) {
    specs = [layoutSplit(ctx, true, false), layoutSplit(ctx, false, true), layoutLandscapeHero({ ...ctx, p: style.alt })];
  } else if (photoEmphasis) {
    specs = [layoutFullBleed(ctx), layoutHeroTop(ctx), layoutFramedBadge({ ...ctx, p: style.alt })];
  } else if (priceEmphasis) {
    specs = [layoutFramedBadge(ctx), layoutHeroTop(ctx), layoutPoster({ ...ctx, p: style.alt })];
  } else {
    specs = [layoutHeroTop(ctx), layoutFramedBadge(ctx), layoutPoster({ ...ctx, p: style.alt })];
  }
  return specs.map((spec, i) => ({ ...spec, id: `${style.id}-${i + 1}-${Date.now().toString(36)}` }));
}
