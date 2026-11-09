import { Canvas, Ellipse, FabricImage, FabricObject, Line, Rect, StaticCanvas, Textbox, cache } from "fabric";
import type { CanvasSize } from "../sizes";
import { ensureFontsLoaded, nearestWeight } from "../fonts";
import type { DesignSpec, RefinePatch, SpecElement, SpecText } from "./spec";

/** Custom properties persisted with every object. */
export const META_PROPS = [
  "id",
  "role",
  "name",
  "selectable",
  "evented",
  "lockMovementX",
  "lockMovementY",
  "lockScalingX",
  "lockScalingY",
  "lockRotation",
  "hasControls",
  "visible",
  "keepAspect",
  "splitByGrapheme",
];

export interface ObjMeta {
  id: string;
  role: string;
  name: string;
  keepAspect?: boolean;
}

type AnyObj = FabricObject & Partial<ObjMeta>;

let seq = 0;
export function newId(prefix = "el"): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

export function getMeta(obj: FabricObject): ObjMeta {
  const o = obj as AnyObj;
  if (!o.id) o.id = newId(obj.type);
  if (!o.role) o.role = "custom";
  return { id: o.id, role: o.role, name: o.name ?? defaultName(obj), keepAspect: o.keepAspect };
}

export function defaultName(obj: FabricObject): string {
  const o = obj as AnyObj;
  const roleNames: Record<string, string> = {
    shop: "店名",
    product: "商品名",
    price: "価格",
    description: "説明文",
    tagline: "キャッチコピー",
    photo: "料理写真",
    "photo-placeholder": "写真の枠",
  };
  if (o.role && roleNames[o.role]) return roleNames[o.role];
  if (obj instanceof Textbox) return `テキスト「${obj.text.slice(0, 8)}${obj.text.length > 8 ? "…" : ""}」`;
  if (obj instanceof FabricImage) return "画像";
  if (obj instanceof Rect) return "四角形";
  if (obj instanceof Ellipse) return "楕円";
  if (obj instanceof Line) return "線";
  return obj.type;
}

export function findById(canvas: StaticCanvas, id: string): FabricObject | undefined {
  return canvas.getObjects().find((o) => (o as AnyObj).id === id);
}

export function fontFacesOfSpec(spec: DesignSpec): { family: string; weight: number }[] {
  return spec.elements.filter((e): e is SpecText => e.kind === "text").map((e) => ({ family: e.fontFamily, weight: e.fontWeight }));
}

export function textOfSpec(spec: DesignSpec): string {
  return spec.elements
    .filter((e): e is SpecText => e.kind === "text")
    .map((e) => e.text)
    .join("");
}

/** Fits the image source to cover a box of bw×bh canvas units by scaling and center-cropping. */
export function coverImage(img: FabricImage, bw: number, bh: number) {
  const { width: iw, height: ih } = img.getOriginalSize();
  if (!iw || !ih) return;
  const scale = Math.max(bw / iw, bh / ih);
  const cw = Math.min(iw, bw / scale);
  const ch = Math.min(ih, bh / scale);
  img.set({ cropX: (iw - cw) / 2, cropY: (ih - ch) / 2, width: cw, height: ch, scaleX: scale, scaleY: scale });
  syncImageClip(img);
}

/** Keeps the rounded-corner clip path matching the (possibly cropped) image size. */
export function syncImageClip(img: FabricImage, radiusCanvasPx?: number) {
  const current = img.clipPath instanceof Rect ? img.clipPath : null;
  const r = radiusCanvasPx !== undefined ? radiusCanvasPx : current ? current.rx * (img.scaleX || 1) : 0;
  if (r <= 0) {
    img.clipPath = undefined;
    return;
  }
  const rl = r / (img.scaleX || 1);
  img.clipPath = new Rect({ width: img.width, height: img.height, rx: rl, ry: rl, left: 0, top: 0 });
  img.dirty = true;
}

export function imageRadius(img: FabricImage): number {
  return img.clipPath instanceof Rect ? img.clipPath.rx * (img.scaleX || 1) : 0;
}

export interface BuildOptions {
  photoSrc?: string;
}

export async function buildElement(el: SpecElement, size: CanvasSize, opts: BuildOptions): Promise<FabricObject | null> {
  const W = size.width;
  const H = size.height;
  switch (el.kind) {
    case "text": {
      const tb = new Textbox(el.text, {
        width: el.w * W,
        fontSize: el.fontSize * W,
        fontFamily: el.fontFamily,
        fontWeight: nearestWeight(el.fontFamily, el.fontWeight),
        fill: el.fill,
        textAlign: el.align,
        lineHeight: el.lineHeight,
        charSpacing: el.charSpacing,
        angle: el.angle,
        opacity: el.opacity,
        splitByGrapheme: true,
        editable: true,
      });
      tb.set({ left: el.x * W + tb.width / 2, top: el.y * H + tb.height / 2 });
      Object.assign(tb, { id: el.id, role: el.role });
      return tb;
    }
    case "image": {
      if (!opts.photoSrc) return null;
      const img = await FabricImage.fromURL(opts.photoSrc, { crossOrigin: "anonymous" });
      coverImage(img, el.w * W, el.h * H);
      syncImageClip(img, el.radius * W);
      img.set({ left: (el.x + el.w / 2) * W, top: (el.y + el.h / 2) * H, opacity: el.opacity, angle: el.angle });
      Object.assign(img, { id: el.id, role: el.role, keepAspect: true });
      return img;
    }
    case "rect": {
      const r = new Rect({
        width: el.w * W,
        height: el.h * H,
        fill: el.fill,
        rx: el.radius * W,
        ry: el.radius * W,
        stroke: el.stroke,
        strokeWidth: el.strokeWidth * W,
        opacity: el.opacity,
        angle: el.angle,
        left: (el.x + el.w / 2) * W,
        top: (el.y + el.h / 2) * H,
      });
      Object.assign(r, { id: el.id, role: el.role });
      return r;
    }
    case "ellipse": {
      const e = new Ellipse({
        rx: (el.w * W) / 2,
        ry: (el.h * H) / 2,
        fill: el.fill,
        stroke: el.stroke,
        strokeWidth: el.strokeWidth * W,
        opacity: el.opacity,
        angle: el.angle,
        left: (el.x + el.w / 2) * W,
        top: (el.y + el.h / 2) * H,
      });
      Object.assign(e, { id: el.id, role: el.role });
      return e;
    }
    case "line": {
      const l = new Line([el.x1 * W, el.y1 * H, el.x2 * W, el.y2 * H], {
        stroke: el.stroke,
        strokeWidth: Math.max(1, el.strokeWidth * W),
        opacity: el.opacity,
      });
      Object.assign(l, { id: el.id, role: el.role });
      return l;
    }
  }
}

/** Replaces the canvas content with the spec. Photo placeholders get a label when no photo exists. */
export async function loadSpecIntoCanvas(canvas: StaticCanvas, spec: DesignSpec, size: CanvasSize, opts: BuildOptions): Promise<void> {
  await ensureFontsLoaded(fontFacesOfSpec(spec), textOfSpec(spec) + "料理写真をここに追加");
  cache.clearFontCache();
  canvas.clear();
  canvas.backgroundColor = spec.background;
  const objects: FabricObject[] = [];
  for (const el of spec.elements) {
    const obj = await buildElement(el, size, opts);
    if (obj) objects.push(obj);
    if (el.kind === "rect" && el.role === "photo-placeholder") {
      const label = new Textbox("料理写真をここに追加\n（左の「素材」からアップロード）", {
        width: el.w * size.width,
        fontSize: Math.max(12, 0.028 * size.width),
        fontFamily: "Noto Sans JP",
        fontWeight: 500,
        fill: "#6b6b6b",
        textAlign: "center",
        lineHeight: 1.4,
        splitByGrapheme: true,
      });
      label.set({ left: (el.x + el.w / 2) * size.width, top: (el.y + el.h / 2) * size.height });
      Object.assign(label, { id: `${el.id}-label`, role: "placeholder-label" });
      objects.push(label);
    }
  }
  canvas.add(...objects);
  canvas.requestRenderAll();
}

/** Renders a spec to a PNG data URL at the given scale (used for the three proposals). */
export async function renderSpecThumbnail(spec: DesignSpec, size: CanvasSize, opts: BuildOptions, scale: number): Promise<string> {
  const sc = new StaticCanvas(undefined, { width: size.width, height: size.height, renderOnAddRemove: false });
  try {
    await loadSpecIntoCanvas(sc, spec, size, opts);
    sc.renderAll();
    return sc.toDataURL({ format: "png", multiplier: scale });
  } finally {
    sc.dispose();
  }
}

/* ---------- fabric → spec (for AI refinement and local refinement) ---------- */

export function extractSpec(canvas: StaticCanvas, size: CanvasSize, name = "current"): DesignSpec {
  const W = size.width;
  const H = size.height;
  const elements: SpecElement[] = [];
  for (const obj of canvas.getObjects()) {
    const m = getMeta(obj);
    const c = obj.getCenterPoint();
    const sw = obj.getScaledWidth();
    const sh = obj.getScaledHeight();
    const x = (c.x - sw / 2) / W;
    const y = (c.y - sh / 2) / H;
    const w = sw / W;
    const h = sh / H;
    if (obj instanceof Textbox) {
      elements.push({
        kind: "text",
        id: m.id,
        role: (["shop", "product", "price", "description", "tagline"].includes(m.role) ? m.role : "custom") as SpecText["role"],
        text: obj.text,
        x,
        y,
        w: obj.width / W,
        fontFamily: obj.fontFamily,
        fontWeight: typeof obj.fontWeight === "number" ? obj.fontWeight : obj.fontWeight === "bold" ? 700 : 400,
        fontSize: (obj.fontSize * (obj.scaleX || 1)) / W,
        fill: typeof obj.fill === "string" ? obj.fill : "#000000",
        align: (obj.textAlign as SpecText["align"]) ?? "left",
        lineHeight: obj.lineHeight,
        charSpacing: obj.charSpacing,
        angle: obj.angle,
        opacity: obj.opacity,
      });
    } else if (obj instanceof FabricImage) {
      elements.push({ kind: "image", id: m.id, role: "photo", x, y, w, h, radius: imageRadius(obj) / W, opacity: obj.opacity, angle: obj.angle });
    } else if (obj instanceof Rect) {
      elements.push({
        kind: "rect",
        id: m.id,
        role: m.role === "photo-placeholder" ? "photo-placeholder" : m.role === "custom" ? "custom" : "decor",
        x,
        y,
        w,
        h,
        fill: typeof obj.fill === "string" ? obj.fill : "#000000",
        radius: (obj.rx * (obj.scaleX || 1)) / W,
        opacity: obj.opacity,
        stroke: typeof obj.stroke === "string" ? obj.stroke : undefined,
        strokeWidth: obj.strokeWidth / W,
        angle: obj.angle,
      });
    } else if (obj instanceof Ellipse) {
      elements.push({
        kind: "ellipse",
        id: m.id,
        role: m.role === "custom" ? "custom" : "decor",
        x,
        y,
        w,
        h,
        fill: typeof obj.fill === "string" ? obj.fill : "#000000",
        opacity: obj.opacity,
        stroke: typeof obj.stroke === "string" ? obj.stroke : undefined,
        strokeWidth: obj.strokeWidth / W,
        angle: obj.angle,
      });
    } else if (obj instanceof Line) {
      const dx = (obj.x2 - obj.x1) * (obj.scaleX || 1);
      const dy = (obj.y2 - obj.y1) * (obj.scaleY || 1);
      elements.push({
        kind: "line",
        id: m.id,
        role: "decor",
        x1: (c.x - dx / 2) / W,
        y1: (c.y - dy / 2) / H,
        x2: (c.x + dx / 2) / W,
        y2: (c.y + dy / 2) / H,
        stroke: typeof obj.stroke === "string" ? obj.stroke : "#000000",
        strokeWidth: obj.strokeWidth / W,
        opacity: obj.opacity,
      });
    }
  }
  const bg = typeof canvas.backgroundColor === "string" && canvas.backgroundColor ? canvas.backgroundColor : "#ffffff";
  return { id: name, name, description: "", background: bg, elements };
}

/* ---------- apply a refine patch to live objects (only touches listed ids) ---------- */

export async function applyPatch(canvas: Canvas, patch: RefinePatch, size: CanvasSize, opts: BuildOptions): Promise<void> {
  const W = size.width;
  const H = size.height;
  const faces = patch.changes
    .filter((c) => c.set.fontFamily || c.set.fontWeight)
    .map((c) => {
      const obj = findById(canvas, c.id);
      const family = c.set.fontFamily ?? (obj instanceof Textbox ? obj.fontFamily : "Noto Sans JP");
      const weight = c.set.fontWeight ?? (obj instanceof Textbox && typeof obj.fontWeight === "number" ? obj.fontWeight : 400);
      return { family, weight: nearestWeight(family, weight) };
    });
  if (faces.length) {
    await ensureFontsLoaded(faces, patch.changes.map((c) => c.set.text ?? "").join(""));
    cache.clearFontCache();
  }
  if (patch.background) canvas.backgroundColor = patch.background;
  for (const id of patch.remove) {
    const obj = findById(canvas, id);
    if (obj) canvas.remove(obj);
  }
  for (const change of patch.changes) {
    const obj = findById(canvas, change.id);
    if (!obj) continue;
    const s = change.set;
    const c = obj.getCenterPoint();
    const curW = obj.getScaledWidth();
    const curH = obj.getScaledHeight();
    let x = (c.x - curW / 2) / W;
    let y = (c.y - curH / 2) / H;
    if (s.x !== undefined) x = s.x;
    if (s.y !== undefined) y = s.y;
    if (s.opacity !== undefined) obj.set("opacity", s.opacity);
    if (s.angle !== undefined) obj.set("angle", s.angle);
    if (obj instanceof Textbox) {
      if (s.text !== undefined) obj.set("text", s.text);
      if (s.fontFamily !== undefined) obj.set("fontFamily", s.fontFamily);
      if (s.fontWeight !== undefined) obj.set("fontWeight", nearestWeight(s.fontFamily ?? obj.fontFamily, s.fontWeight));
      if (s.fontSize !== undefined) obj.set({ fontSize: s.fontSize * W, scaleX: 1, scaleY: 1 });
      if (s.fill !== undefined) obj.set("fill", s.fill);
      if (s.align !== undefined) obj.set("textAlign", s.align);
      if (s.lineHeight !== undefined) obj.set("lineHeight", s.lineHeight);
      if (s.charSpacing !== undefined) obj.set("charSpacing", s.charSpacing);
      if (s.w !== undefined) obj.set("width", s.w * W);
      obj.initDimensions();
      obj.set({ left: x * W + obj.getScaledWidth() / 2, top: y * H + obj.getScaledHeight() / 2 });
    } else if (obj instanceof FabricImage) {
      const bw = (s.w ?? curW / W) * W;
      const bh = (s.h ?? curH / H) * H;
      if (s.w !== undefined || s.h !== undefined) coverImage(obj, bw, bh);
      if (s.radius !== undefined) syncImageClip(obj, s.radius * W);
      obj.set({ left: x * W + bw / 2, top: y * H + bh / 2 });
    } else if (obj instanceof Rect || obj instanceof Ellipse) {
      const bw = (s.w ?? curW / W) * W;
      const bh = (s.h ?? curH / H) * H;
      if (obj instanceof Rect) {
        obj.set({ width: bw - obj.strokeWidth, height: bh - obj.strokeWidth, scaleX: 1, scaleY: 1 });
        if (s.radius !== undefined) obj.set({ rx: s.radius * W, ry: s.radius * W });
      } else {
        obj.set({ rx: (bw - obj.strokeWidth) / 2, ry: (bh - obj.strokeWidth) / 2, scaleX: 1, scaleY: 1 });
      }
      if (s.fill !== undefined) obj.set("fill", s.fill);
      if (s.stroke !== undefined) obj.set("stroke", s.stroke);
      if (s.strokeWidth !== undefined) obj.set("strokeWidth", s.strokeWidth * W);
      obj.set({ left: x * W + bw / 2, top: y * H + bh / 2 });
    } else if (obj instanceof Line) {
      if (s.stroke !== undefined) obj.set("stroke", s.stroke);
      if (s.strokeWidth !== undefined) obj.set("strokeWidth", Math.max(1, s.strokeWidth * W));
      if (s.fill !== undefined) obj.set("stroke", s.fill);
      obj.set({ left: x * W + curW / 2, top: y * H + curH / 2 });
    }
    obj.setCoords();
  }
  for (const el of patch.add) {
    const obj = await buildElement(el, size, opts);
    if (!obj) continue;
    if (el.kind === "text") {
      canvas.add(obj);
    } else {
      // New decorations (panels, badges, lines) go behind every text so they never hide copy.
      const firstText = canvas.getObjects().findIndex((o) => o instanceof Textbox);
      if (firstText >= 0) canvas.insertAt(firstText, obj);
      else canvas.add(obj);
    }
  }
  canvas.requestRenderAll();
}
