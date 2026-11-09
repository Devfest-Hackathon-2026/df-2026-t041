import { designSpecSchema, formatPrice, refinePatchSchema, specElementSchema, stripPunctuation, type SpecElement, type DesignBrief, type DesignSpec, type RefinePatch } from "../design/spec";
import { FONTS, fontDef, nearestWeight } from "../fonts";
import { STYLES } from "../design/styles";

const fontList = FONTS.map((f) => `"${f.family}" (${f.label}, weights ${f.weights.join("/")})`).join(", ");
const styleHints = STYLES.map((s) => `${s.label}: bg ${s.palette.bg}, text ${s.palette.text}, accent ${s.palette.accent}, heading ${s.heading.family}`).join("\n");

export const COMMON_RULES = `
You are a senior Japanese graphic designer producing flyers / POP for restaurants.
Output must be JSON matching the schema. Coordinates x, y, w, h are fractions of canvas width (x, w) and height (y, h), 0..1.
fontSize is a fraction of canvas width (e.g. 0.09 for a big product name on a portrait flyer, 0.03 for body text).
Use only these fonts: ${fontList}.
Colors are 6-digit hex (use "#00000000" for no fill). strokeWidth is also a fraction of canvas width (e.g. 0.003), never pixels. Every text, image, rect and ellipse needs numeric x, y, w (and h for non-text).
IMPORTANT: x, y is always the TOP-LEFT corner of the element box, also for text. "align" only aligns the text inside its box of width w; it never moves the box. A text box must satisfy x >= 0 and x + w <= 1. Example: page-wide centered title = x 0.06, w 0.88, align "center". Price centered in a badge whose box is x 0.62..0.92 = text x 0.62, w 0.30, align "center".
Keep strong contrast between text and whatever is behind it.
Never invent facts: use exactly the shop name, product name, price and description given. Do not add prices, opening hours, addresses, phone numbers, menu items, or claims that were not provided. Decorative short words like "おすすめ" are allowed only as role "tagline" and must not state facts.
Element roles: "shop", "product", "price", "description" (text; include one element per provided field), "photo" (image: exactly one when a photo exists; never when it does not), "decor" rects/ellipses/lines for bands, badges, frames.
The photo is the user's real dish photo and is center-cropped to fill its box (w×h). Give it a large, prominent box.
Keep text inside the canvas and avoid overlapping texts; leave generous margins (about 0.06).
Flyer copy never uses Japanese punctuation marks 、 and 。 (nor , and .). Taglines and decorative words must not contain them. If a provided description contains them, keep the wording but replace each 。 with a line break (\n) and replace each 、 with a single space (never a line break) instead of deleting words.
Style reference palettes:
${styleHints}
`;

export const SPEC_JSON_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", description: "Short Japanese name of the layout idea (max 20 chars)" },
    description: { type: "string", description: "One Japanese sentence describing the idea" },
    background: { type: "string" },
    elements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["text", "image", "rect", "ellipse", "line"] },
          id: { type: "string" },
          role: { type: "string" },
          text: { type: "string" },
          x: { type: "number" },
          y: { type: "number" },
          w: { type: "number" },
          h: { type: "number" },
          x1: { type: "number" },
          y1: { type: "number" },
          x2: { type: "number" },
          y2: { type: "number" },
          fontFamily: { type: "string" },
          fontWeight: { type: "integer" },
          fontSize: { type: "number" },
          fill: { type: "string" },
          align: { type: "string", enum: ["left", "center", "right"] },
          lineHeight: { type: "number" },
          charSpacing: { type: "number" },
          radius: { type: "number" },
          opacity: { type: "number" },
          stroke: { type: "string" },
          strokeWidth: { type: "number" },
        },
        required: ["kind", "id", "role"],
      },
    },
  },
  required: ["name", "description", "background", "elements"],
};

export function briefText(brief: DesignBrief): string {
  return `店名: ${brief.shopName || "(なし)"}
商品名: ${brief.productName}
価格: ${formatPrice(brief.price) || "(なし)"}
説明文: ${brief.description || "(なし)"}
雰囲気の指示: ${brief.prompt || "(指定なし)"}
料理写真: ${brief.hasPhoto ? `あり（縦横比 ${brief.photoAspect?.toFixed(2) ?? "不明"}）` : "なし"}
キャンバス縦横比 (width/height): ${brief.canvasAspect.toFixed(3)}${brief.fontFamily ? `\nフォント指定: "${brief.fontFamily}"（すべての文字にこのフォントを使う。太さは ${fontDef(brief.fontFamily)?.weights.join("/") ?? "400"} から選ぶ）` : ""}`;
}

const HEX = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8}|[0-9a-fA-F]{3})$/;
const TRANSPARENT = "#00000000";

/** Repairs a colour from model output: hex passes, "transparent"/"none" become fully transparent, anything else is dropped. */
function fixColor(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const c = v.trim();
  if (HEX.test(c)) return c;
  if (/^(transparent|none)$/i.test(c)) return TRANSPARENT;
  return undefined;
}

/** Stroke widths should be fractions of canvas width; models sometimes send pixels (e.g. 2). */
function fixStrokeWidth(v: unknown): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return undefined;
  return v > 0.1 ? Math.min(v / 1000, 0.1) : v;
}

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Fills or repairs the fields a model most often gets wrong, per element kind. */
function repairElement(e: Record<string, unknown>, background: string): Record<string, unknown> {
  const el = { ...e };
  for (const k of Object.keys(el)) if (el[k] === null) delete el[k];
  for (const k of ["fill", "stroke"]) {
    if (k in el) {
      const c = fixColor(el[k]);
      if (c) el[k] = c;
      else delete el[k];
    }
  }
  if ("strokeWidth" in el) {
    const w = fixStrokeWidth(el.strokeWidth);
    if (w === undefined) delete el.strokeWidth;
    else el.strokeWidth = w;
  }
  if (el.kind === "text") {
    if (!(TEXT_ROLE_LIST as readonly string[]).includes(el.role as string)) el.role = "custom";
    el.fontWeight = num(el.fontWeight) ? Math.min(900, Math.max(100, Math.round(el.fontWeight / 100) * 100)) : 700;
    el.fontFamily = FONTS.some((f) => f.family === el.fontFamily) ? el.fontFamily : "Noto Sans JP";
    if (!["left", "center", "right"].includes(el.align as string)) el.align = "left";
    if (!num(el.x)) el.x = 0.06;
    if (!num(el.w)) el.w = 0.88;
    if (!num(el.fontSize)) el.fontSize = 0.04;
    Object.assign(el, fitTextBox(el.x as number, el.w as number, el.align as string));
    Object.assign(el, fitSingleLine(el as { role: string; text: string; x: number; w: number; fontSize: number; align: string; charSpacing?: number }));
    if (num(el.y)) el.y = Math.min(Math.max(el.y, 0), 0.96);
    if (!el.fill) el.fill = "#222222";
    if (typeof el.text !== "string") el.text = "";
  } else if (el.kind === "image") {
    el.role = "photo";
  } else if (el.kind === "rect") {
    if (!["decor", "photo-placeholder", "custom"].includes(el.role as string)) el.role = "decor";
    if (!el.fill) el.fill = el.role === "photo-placeholder" ? "#e5e7eb" : el.stroke ? TRANSPARENT : background;
  } else if (el.kind === "ellipse") {
    el.role = "decor";
    if (!el.fill) el.fill = el.stroke ? TRANSPARENT : background;
  } else if (el.kind === "line") {
    el.role = "decor";
    if (!el.stroke) el.stroke = "#222222";
    if (!num(el.strokeWidth) || (el.strokeWidth as number) < 0.0005) el.strokeWidth = 0.003;
  }
  return el;
}

/**
 * Keeps a text box on the page. Models often send x as the alignment anchor (centre point for
 * centred text, right edge for right-aligned text) instead of the box's left edge; when the box
 * would overflow the right edge we re-read x that way and shrink the box around the anchor.
 */
export function fitTextBox(x: number, w: number, align: string): { x: number; w: number } {
  const margin = 0.02;
  if (x >= 0 && x + w <= 1 + margin) return { x, w };
  let nx = x;
  let nw = w;
  if (align === "center" && x > 0 && x < 1) {
    const half = Math.min(w / 2, x - margin, 1 - margin - x);
    nw = Math.max(0.08, half * 2);
    nx = x - nw / 2;
  } else if (align === "right" && x > 0 && x <= 1.02) {
    const right = Math.min(x, 1 - margin);
    nw = Math.max(0.08, Math.min(w, right - margin));
    nx = right - nw;
  } else {
    nx = Math.min(Math.max(x, margin), 1 - margin - 0.08);
    nw = Math.max(0.08, Math.min(w, 1 - margin - nx));
  }
  return { x: Math.round(nx * 1000) / 1000, w: Math.round(nw * 1000) / 1000 };
}

/** Rough rendered width of one line as a fraction of canvas width (CJK ~1em, ASCII ~0.6em). */
function estimateLineWidth(text: string, fontSize: number, charSpacing = 0): number {
  let em = 0;
  for (const ch of text) em += /[\x20-\x7e]/.test(ch) ? 0.6 : 1;
  return em * fontSize * (1 + charSpacing / 1000);
}

const SINGLE_LINE_ROLES = new Set(["price", "product", "shop", "tagline"]);

/**
 * Short labels (price, product, shop, tagline) must stay on one line. When the text is wider than
 * its box (typically after "make the price bigger"), grow the box around its alignment anchor, and
 * shrink the font only if even the full page width is not enough.
 */
export function fitSingleLine(el: { role: string; text: string; x: number; w: number; fontSize: number; align: string; charSpacing?: number }): { x: number; w: number; fontSize: number } {
  const margin = 0.03;
  let { x, w, fontSize } = el;
  if (!SINGLE_LINE_ROLES.has(el.role) || el.text.includes("\n") || !el.text) return { x, w, fontSize };
  let need = estimateLineWidth(el.text, fontSize, el.charSpacing) * 1.08;
  const maxW = 1 - 2 * margin;
  if (need > maxW) {
    fontSize = Math.max(0.01, fontSize * (maxW / need));
    need = maxW;
  }
  if (w >= need) return { x, w, fontSize };
  const anchor = el.align === "center" ? x + w / 2 : el.align === "right" ? x + w : x;
  w = need;
  x = el.align === "center" ? anchor - w / 2 : el.align === "right" ? anchor - w : anchor;
  x = Math.min(Math.max(x, margin), 1 - margin - w);
  const r = (v: number) => Math.round(v * 1000) / 1000;
  return { x: r(x), w: r(w), fontSize: r(fontSize) };
}

const TEXT_ROLE_LIST = ["shop", "product", "price", "description", "tagline", "custom"] as const;

/**
 * Normalizes loose model output into a strict DesignSpec. Broken decorations are dropped;
 * the layout is rejected only when a text field or the photo cannot be repaired.
 */
export function normalizeSpec(raw: unknown, idPrefix: string): DesignSpec {
  const r = (raw ?? {}) as Record<string, unknown>;
  const background = fixColor(r.background) ?? "#ffffff";
  const elements = Array.isArray(r.elements) ? r.elements : [];
  const cleaned: SpecElement[] = [];
  elements.forEach((e, i) => {
    if (!e || typeof e !== "object") return;
    const el = repairElement(e as Record<string, unknown>, background);
    el.id = typeof el.id === "string" && el.id ? `${idPrefix}-${el.id}` : `${idPrefix}-el-${i}`;
    const parsed = specElementSchema.safeParse(el);
    if (parsed.success) cleaned.push(parsed.data);
    else if (el.kind === "text" || el.kind === "image") throw new Error(`AIの出力に不正な要素がありました（${String(el.role ?? el.kind)}）。`);
  });
  const name = typeof r.name === "string" && r.name.trim() ? r.name.trim().slice(0, 40) : "AI提案";
  const description = typeof r.description === "string" ? r.description.slice(0, 200) : "";
  return designSpecSchema.parse({ id: idPrefix, name, description, background, elements: cleaned });
}

export const PATCH_JSON_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    background: { type: "string" },
    changes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          set: SPEC_JSON_SCHEMA.properties.elements.items.properties,
        },
        required: ["id", "set"],
      },
    },
    add: { type: "array", items: SPEC_JSON_SCHEMA.properties.elements.items },
    remove: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "changes"],
};

export function generatePrompt(brief: DesignBrief): string {
  return `${COMMON_RULES}
Create THREE clearly different layouts (different composition: e.g. photo top / photo full-bleed with band / framed with price badge / split). Each must include every provided text field once.
${brief.hasPhoto ? "Include exactly one image element with role photo in each layout." : "There is no photo yet: do not include image elements. Include exactly one rect with role photo-placeholder (large, where the dish photo will be dropped in later) in each layout."}

${briefText(brief)}`;
}

export function refinePrompt(current: DesignSpec, instruction: string): string {
  return `${COMMON_RULES}
The user is editing an existing design and asks for a change. Return a PATCH: only the elements that must change, by id, with the properties to set. Do not change other elements. Do not change any text content unless the instruction explicitly asks for new wording, and never invent facts.
Use "remove" to delete element ids and "add" for genuinely new decorative elements only.
Omit "background" unless the instruction asks to change the background or the overall mood/colour scheme.
"summary" is one short Japanese sentence describing what you changed.

Current design (JSON): ${JSON.stringify(current)}

Instruction: ${instruction}`;
}

export function parseJson(text: string | null | undefined, provider: string): unknown {
  if (!text) throw new Error(`${provider}から空の応答が返されました。`);
  // Tolerate ```json fences that some models add even in JSON mode.
  const body = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`${provider}のJSON応答を解析できませんでした。`);
  }
}

/** Accepts either a bare array of 3 specs or an object { designs: [...] }. */
export function parseDesigns(parsed: unknown, provider: string, brief?: DesignBrief): DesignSpec[] {
  const arr = Array.isArray(parsed) ? parsed : (parsed as { designs?: unknown })?.designs;
  if (!Array.isArray(arr) || arr.length < 3) throw new Error(`${provider}が3案を返しませんでした。`);
  const stamp = Date.now().toString(36);
  const price = brief ? formatPrice(brief.price) : "";
  return arr.slice(0, 3).map((p, i) => {
    const spec = normalizeSpec(p, `ai-${stamp}-${i + 1}`);
    for (const el of spec.elements) {
      if (el.kind !== "text") continue;
      if (price && el.role === "price") el.text = price;
      // The user's font choice is a decision, not a suggestion: enforce it on every text.
      if (brief?.fontFamily && fontDef(brief.fontFamily)) {
        el.fontWeight = nearestWeight(brief.fontFamily, el.fontWeight);
        el.fontFamily = brief.fontFamily;
      }
      el.text = stripPunctuation(el.text);
    }
    return spec;
  });
}

export function parsePatch(parsed: unknown, current?: DesignSpec): RefinePatch {
  const raw = parsed as Record<string, unknown>;
  const changes = Array.isArray(raw.changes)
    ? raw.changes.map((c) => {
        const ch = c as { id: string; set: Record<string, unknown> };
        const set: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(ch.set ?? {})) {
          if (v === null || v === undefined) continue;
          if (["kind", "id", "role", "x1", "y1", "x2", "y2"].includes(k)) continue;
          if (k === "fill" || k === "stroke") {
            const c = fixColor(v);
            if (c) set[k] = c;
          } else if (k === "strokeWidth") {
            const w = fixStrokeWidth(v);
            if (w !== undefined) set[k] = w;
          } else if (k === "fontWeight" && typeof v === "number") set[k] = Math.min(900, Math.max(100, Math.round(v / 100) * 100));
          else if (k === "text" && typeof v === "string") set[k] = stripPunctuation(v);
          else set[k] = v;
        }
        const target = current?.elements.find((e) => e.id === ch.id);
        if (target?.kind === "text") {
          const align = typeof set.align === "string" ? set.align : target.align;
          let x = num(set.x) ? set.x : target.x;
          let w = num(set.w) ? set.w : target.w;
          ({ x, w } = fitTextBox(x, w, align));
          const fontSize = num(set.fontSize) ? set.fontSize : target.fontSize;
          const text = typeof set.text === "string" ? set.text : target.text;
          const fitted = fitSingleLine({ role: target.role, text, x, w, fontSize, align, charSpacing: num(set.charSpacing) ? set.charSpacing : target.charSpacing });
          if (fitted.x !== target.x) set.x = fitted.x;
          if (fitted.w !== target.w) set.w = fitted.w;
          if (fitted.fontSize !== target.fontSize) set.fontSize = fitted.fontSize;
        }
        if (num(set.y)) set.y = Math.min(Math.max(set.y, 0), 0.96);
        return { id: ch.id, set };
      })
    : [];
  const stamp = Date.now().toString(36);
  const add = Array.isArray(raw.add)
    ? raw.add
        .map((e, i) => specElementSchema.safeParse({ ...repairElement((e ?? {}) as Record<string, unknown>, "#ffffff"), id: `ai-add-${stamp}-${i}` }))
        .filter((r) => r.success)
        .map((r) => r.data)
    : [];
  return refinePatchSchema.parse({ summary: typeof raw.summary === "string" && raw.summary ? raw.summary : "変更を適用しました", background: fixColor(raw.background), changes, add, remove: Array.isArray(raw.remove) ? raw.remove : [] });
}

/** Turns provider SDK errors (quota, overload, timeouts, raw JSON bodies) into one short Japanese sentence. */
export function friendlyAiError(e: unknown): string {
  const status = (e as { status?: number })?.status;
  const msg = e instanceof Error ? e.message : String(e ?? "");
  const name = (e as { name?: string })?.name ?? "";
  if (status === 402 || /credits are depleted|billing/i.test(msg)) return "AIの利用枠（クレジット）が不足しています。";
  if (status === 429 || /RESOURCE_EXHAUSTED|quota|rate limit/i.test(msg)) return "AIの利用上限に達しました。しばらく待ってから再度お試しください。";
  if (status === 503 || /UNAVAILABLE|overloaded|high demand/i.test(msg)) return "AIが混み合っています。少し待ってから再度お試しください。";
  if (status === 504 || /abort|timeout|timed out|DEADLINE_EXCEEDED/i.test(name + msg)) return "AIの応答が時間内に返りませんでした。もう一度お試しください。";
  if (status === 401 || status === 403 || /API key|permission/i.test(msg)) return "AIの認証に失敗しました（APIキーを確認してください）。";
  if (status === 404) return "指定したAIモデルが利用できません（モデル名を確認してください）。";
  // Our own validation/parsing messages are already short Japanese sentences.
  if (/[ぁ-んァ-ン一-龥]/.test(msg) && msg.length < 120) return msg;
  return "AIの処理中にエラーが発生しました。";
}

/** Per-call time limit for AI requests, in ms. */
export const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 45_000;

/** Estimated text box (fractions of canvas width/height) for overlap checks. */
function textBox(el: { role: string; text: string; x: number; y: number; w: number; fontSize: number; lineHeight?: number; charSpacing?: number }, aspect: number) {
  const paras = el.text.split("\n");
  const lines = SINGLE_LINE_ROLES.has(el.role)
    ? paras.length
    : paras.reduce((n, p) => n + Math.max(1, Math.ceil(estimateLineWidth(p, el.fontSize, el.charSpacing) / Math.max(el.w, 0.02))), 0);
  const h = lines * el.fontSize * (el.lineHeight ?? 1.2) * aspect;
  return { x: el.x, y: el.y, w: el.w, h };
}

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }, pad = 0.004): boolean {
  return a.x < b.x + b.w - pad && b.x < a.x + a.w - pad && a.y < b.y + b.h - pad && b.y < a.y + a.h - pad;
}

/**
 * After an AI edit, a resized or moved text can land on top of another text (e.g. a bigger price
 * placed on the description's line). Move each changed text to the nearest free spot just above or
 * below the text it collides with. `aspect` is canvas width / height.
 */
export function resolvePatchOverlaps(current: DesignSpec, patch: RefinePatch, aspect: number): RefinePatch {
  if (!(aspect > 0)) return patch;
  const removed = new Set(patch.remove);
  const texts = new Map(
    current.elements
      .filter((e): e is Extract<SpecElement, { kind: "text" }> => e.kind === "text" && !removed.has(e.id))
      .map((e) => [e.id, { ...e }]),
  );
  for (const ch of patch.changes) {
    const t = texts.get(ch.id);
    if (t) Object.assign(t, ch.set);
  }
  for (const ch of patch.changes) {
    const t = texts.get(ch.id);
    if (!t) continue;
    const box = textBox(t, aspect);
    const others = [...texts.values()].filter((o) => o.id !== t.id).map((o) => textBox(o, aspect));
    const hit = others.find((o) => overlaps(box, o));
    if (!hit) continue;
    const gap = 0.012;
    const candidates = [hit.y + hit.h + gap, hit.y - box.h - gap]
      .filter((y) => y >= 0.02 && y + box.h <= 0.98)
      .filter((y) => !others.some((o) => overlaps({ ...box, y }, o)))
      .sort((a, b) => Math.abs(a - box.y) - Math.abs(b - box.y));
    if (candidates.length > 0) {
      const y = Math.round(candidates[0] * 1000) / 1000;
      ch.set.y = y;
      t.y = y;
      continue;
    }
    // No free row: keep it on the same line, beside the other text, and shrink to fit the gap.
    const r = (v: number) => Math.round(v * 1000) / 1000;
    const onRight = box.x + box.w / 2 >= hit.x + hit.w / 2;
    const nx = onRight ? hit.x + hit.w + gap : box.x;
    const nw = onRight ? box.x + box.w - nx : hit.x - gap - box.x;
    if (nw < 0.1) continue;
    const need = estimateLineWidth(t.text.split("\n")[0], t.fontSize, t.charSpacing) * 1.08;
    const fontSize = need > nw ? t.fontSize * (nw / need) : t.fontSize;
    const squeezed = { ...t, x: nx, w: nw, fontSize };
    if (others.some((o) => overlaps(textBox(squeezed, aspect), o))) continue;
    ch.set.x = r(nx);
    ch.set.w = r(nw);
    ch.set.fontSize = r(fontSize);
    Object.assign(t, { x: ch.set.x, w: ch.set.w, fontSize: ch.set.fontSize });
  }
  return patch;
}
