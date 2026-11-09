import {
  ActiveSelection,
  Canvas,
  Ellipse,
  FabricImage,
  FabricObject,
  InteractiveFabricObject,
  Line,
  Point,
  Rect,
  Textbox,
  cache,
} from "fabric";
import { AligningGuidelines } from "fabric/extensions";
import { putProject, type Project } from "@/lib/db";
import { History } from "@/lib/history";
import type { CanvasSize } from "@/lib/sizes";
import { ensureFontsLoaded, nearestWeight } from "@/lib/fonts";
import { readImageFile } from "@/lib/image";
import { META_PROPS, applyPatch, coverImage, extractSpec, findById, getMeta, loadSpecIntoCanvas, newId, syncImageClip } from "@/lib/design/fabricBridge";
import type { DesignSpec } from "@/lib/design/spec";
import { refineLocally } from "@/lib/design/refine";
import { AI_OFFLINE, aiRefine, fetchAiStatus, type AiStatus } from "@/lib/ai/client";
import { downloadBlob, exportPdfBlob, exportPngBlob, fontFacesOfJson, projectFileBlob, renderJsonToPng, safeFilename } from "@/lib/export";

export type SaveState = "saved" | "saving" | "dirty" | "error";
export type Notice = { message: string; kind: "error" | "info"; id: number };

interface Snapshot {
  size: CanvasSize;
  json: Record<string, unknown>;
}

let defaultsApplied = false;
function applyControlDefaults() {
  if (defaultsApplied) return;
  defaultsApplied = true;
  Object.assign(InteractiveFabricObject.ownDefaults, {
    transparentCorners: false,
    cornerColor: "#ffffff",
    cornerStrokeColor: "#2563eb",
    cornerStyle: "circle",
    cornerSize: 9,
    touchCornerSize: 20,
    borderColor: "#2563eb",
    borderScaleFactor: 1.5,
    padding: 0,
  });
}

export class EditorController {
  canvas: Canvas | null = null;
  project: Project;
  selection: FabricObject[] = [];
  version = 0;
  saveState: SaveState = "saved";
  zoom = 1;
  aiStatus: AiStatus = AI_OFFLINE;
  busy: string | null = null;
  notice: Notice | null = null;
  ready = false;

  private history = new History(80);
  private loading = false;
  private listeners = new Set<() => void>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private commitTimer: ReturnType<typeof setTimeout> | null = null;
  private clipboard: FabricObject | null = null;
  private container: HTMLDivElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private guidelines: AligningGuidelines | null = null;
  private rafPending = false;
  private mountToken = 0;
  private keyHandler = (e: KeyboardEvent) => this.onKeyDown(e);

  constructor(project: Project) {
    this.project = project;
  }

  /* ---------- subscription ---------- */
  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  private emit() {
    this.version += 1;
    for (const l of this.listeners) l();
  }
  private emitThrottled() {
    if (this.rafPending) return;
    this.rafPending = true;
    requestAnimationFrame(() => {
      this.rafPending = false;
      this.emit();
    });
  }
  notify(message: string, kind: "error" | "info" = "info") {
    this.notice = { message, kind, id: Date.now() };
    this.emit();
  }
  clearNotice() {
    this.notice = null;
    this.emit();
  }
  private setBusy(b: string | null) {
    this.busy = b;
    this.emit();
  }

  get size(): CanvasSize {
    return this.project.size;
  }
  get canUndo() {
    return this.history.canUndo();
  }
  get canRedo() {
    return this.history.canRedo();
  }

  /* ---------- mounting ---------- */
  async mount(el: HTMLCanvasElement, container: HTMLDivElement) {
    applyControlDefaults();
    if (this.canvas) this.unmount();
    const token = ++this.mountToken;
    this.ready = false;
    this.container = container;
    const canvas = new Canvas(el, {
      width: this.size.width,
      height: this.size.height,
      preserveObjectStacking: true,
      controlsAboveOverlay: true,
      selectionColor: "rgba(37, 99, 235, 0.08)",
      selectionBorderColor: "#2563eb",
      selectionLineWidth: 1,
      stopContextMenu: true,
      fireRightClick: false,
      enableRetinaScaling: true,
    });
    this.canvas = canvas;
    this.loading = true;
    try {
      const { faces, text } = fontFacesOfJson(this.project.canvasJson);
      await ensureFontsLoaded(faces, text);
      cache.clearFontCache();
      try {
        await canvas.loadFromJSON(this.project.canvasJson);
      } catch (e) {
        if (token !== this.mountToken) return; // canvas was unmounted while loading (e.g. React strict mode)
        throw e;
      }
      if (token !== this.mountToken) return;
      this.afterLoad();
    } catch (e) {
      this.notify(`デザインデータを読み込めませんでした: ${e instanceof Error ? e.message : String(e)}`, "error");
      return;
    } finally {
      if (token === this.mountToken) this.loading = false;
    }
    this.bindEvents();
    this.guidelines = new AligningGuidelines(canvas, { margin: 6, color: "#f43f5e", width: 1, lineDash: [4, 3] });
    this.resizeObserver = new ResizeObserver(() => this.zoomToFit());
    this.resizeObserver.observe(container);
    this.zoomToFit();
    this.history.reset(this.serialize());
    window.addEventListener("keydown", this.keyHandler);
    this.ready = true;
    this.emit();
    void fetchAiStatus().then((s) => {
      this.aiStatus = s;
      this.emit();
    });
  }

  /** Detaches from the DOM. The controller can be mounted again on a fresh canvas element. */
  unmount() {
    this.mountToken += 1;
    window.removeEventListener("keydown", this.keyHandler);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.guidelines?.dispose();
    this.guidelines = null;
    if (this.commitTimer) {
      clearTimeout(this.commitTimer);
      this.commitTimer = null;
    }
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
      void this.save();
    }
    const canvas = this.canvas;
    this.canvas = null;
    this.ready = false;
    this.selection = [];
    if (canvas) void canvas.dispose().catch(() => undefined);
  }

  private afterLoad() {
    const canvas = this.canvas!;
    for (const obj of canvas.getObjects()) {
      getMeta(obj);
      this.applyObjectBehavior(obj);
    }
    canvas.requestRenderAll();
  }

  private applyObjectBehavior(obj: FabricObject) {
    const m = getMeta(obj);
    if (obj instanceof FabricImage || m.keepAspect) {
      const keep = m.keepAspect !== false;
      obj.setControlsVisibility({ ml: !keep, mr: !keep, mt: !keep, mb: !keep });
    }
    if (obj instanceof Textbox) {
      obj.set({ splitByGrapheme: true, editable: true });
    }
    if (m.role === "placeholder-label") {
      obj.set({ selectable: false, evented: false });
    }
  }

  private bindEvents() {
    const canvas = this.canvas!;
    const updateSel = () => {
      this.selection = canvas.getActiveObjects();
      this.emit();
    };
    canvas.on("selection:created", updateSel);
    canvas.on("selection:updated", updateSel);
    canvas.on("selection:cleared", updateSel);
    canvas.on("object:modified", () => this.commit());
    canvas.on("object:added", () => {
      if (!this.loading) this.commit();
    });
    canvas.on("object:removed", () => {
      if (!this.loading) this.commit();
    });
    canvas.on("text:changed", () => this.commitDebounced(500));
    canvas.on("text:editing:exited", () => this.commit());
    canvas.on("object:moving", (e) => {
      this.snapToCanvas(e.target);
      this.emitThrottled();
    });
    canvas.on("object:scaling", () => this.emitThrottled());
    canvas.on("object:rotating", () => this.emitThrottled());
    canvas.on("object:resizing", () => this.emitThrottled());
  }

  private snapToCanvas(target: FabricObject) {
    const canvas = this.canvas!;
    const threshold = 6 / this.zoom;
    const W = this.size.width;
    const H = this.size.height;
    const br = target.getBoundingRect();
    const xs = [0, W / 2 - br.width / 2, W - br.width];
    const ys = [0, H / 2 - br.height / 2, H - br.height];
    let dx = 0;
    let dy = 0;
    for (const x of xs) if (Math.abs(br.left - x) < threshold) dx = x - br.left;
    for (const y of ys) if (Math.abs(br.top - y) < threshold) dy = y - br.top;
    if (dx || dy) {
      target.set({ left: target.left + dx, top: target.top + dy });
      target.setCoords();
      canvas.requestRenderAll();
    }
  }

  /* ---------- zoom ---------- */
  zoomToFit() {
    if (!this.canvas || !this.container) return;
    const rect = this.container.getBoundingClientRect();
    const pad = 48;
    const z = Math.min((rect.width - pad) / this.size.width, (rect.height - pad) / this.size.height);
    this.setZoom(Math.max(0.05, Math.min(z, 2)));
  }
  setZoom(z: number) {
    if (!this.canvas) return;
    this.zoom = Math.max(0.05, Math.min(4, z));
    this.canvas.setDimensions({ width: this.size.width * this.zoom, height: this.size.height * this.zoom });
    this.canvas.setZoom(this.zoom);
    this.canvas.requestRenderAll();
    this.emit();
  }

  /* ---------- history / save ---------- */
  private serialize(): string {
    const json = this.canvas!.toObject(META_PROPS) as Record<string, unknown>;
    const snap: Snapshot = { size: this.size, json };
    return JSON.stringify(snap);
  }
  commit() {
    if (!this.canvas || this.loading) return;
    if (this.commitTimer) {
      clearTimeout(this.commitTimer);
      this.commitTimer = null;
    }
    if (this.history.push(this.serialize())) {
      this.saveState = "dirty";
      this.scheduleSave();
    }
    this.emit();
  }
  commitDebounced(ms = 400) {
    if (this.commitTimer) clearTimeout(this.commitTimer);
    this.commitTimer = setTimeout(() => {
      this.commitTimer = null;
      this.commit();
    }, ms);
  }
  private scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.save(), 800);
  }
  async save(): Promise<boolean> {
    if (!this.canvas) return false;
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.saveState = "saving";
    this.emit();
    try {
      const canvas = this.canvas;
      const json = canvas.toObject(META_PROPS) as Record<string, unknown>;
      // Rendered offscreen: the live canvas carries interaction hooks that are not safe for toDataURL.
      const thumbnail = await renderJsonToPng(json, this.size, Math.min(1, 320 / Math.max(this.size.width, this.size.height)));
      this.project = { ...this.project, canvasJson: json, thumbnail, updatedAt: Date.now() };
      await putProject(this.project);
      this.saveState = "saved";
      this.emit();
      return true;
    } catch (e) {
      this.saveState = "error";
      this.notify(`保存に失敗しました: ${e instanceof Error ? e.message : String(e)}`, "error");
      return false;
    }
  }
  private async restore(snapshot: string) {
    const canvas = this.canvas!;
    const snap = JSON.parse(snapshot) as Snapshot;
    this.loading = true;
    try {
      canvas.discardActiveObject();
      if (snap.size.width !== this.size.width || snap.size.height !== this.size.height || snap.size.preset !== this.size.preset) {
        this.project = { ...this.project, size: snap.size };
        this.zoomToFit();
      }
      await canvas.loadFromJSON(snap.json);
      this.afterLoad();
    } finally {
      this.loading = false;
    }
    this.selection = [];
    this.saveState = "dirty";
    this.scheduleSave();
    this.emit();
  }
  async undo() {
    const s = this.history.undo();
    if (s) await this.restore(s);
  }
  async redo() {
    const s = this.history.redo();
    if (s) await this.restore(s);
  }

  rename(name: string) {
    this.project = { ...this.project, name };
    this.saveState = "dirty";
    this.scheduleSave();
    this.emit();
  }

  /* ---------- selection helpers ---------- */
  select(objs: FabricObject[]) {
    const canvas = this.canvas!;
    canvas.discardActiveObject();
    if (objs.length === 1) canvas.setActiveObject(objs[0]);
    else if (objs.length > 1) canvas.setActiveObject(new ActiveSelection(objs, { canvas }));
    canvas.requestRenderAll();
    this.selection = canvas.getActiveObjects();
    this.emit();
  }
  deselect() {
    this.canvas?.discardActiveObject();
    this.canvas?.requestRenderAll();
    this.selection = [];
    this.emit();
  }
  get active(): FabricObject | undefined {
    return this.canvas?.getActiveObject();
  }

  /* ---------- property edits ---------- */
  setProps(obj: FabricObject, props: Record<string, unknown>, debounceMs = 0) {
    obj.set(props);
    if (obj instanceof Textbox && ("text" in props || "fontFamily" in props || "fontWeight" in props || "width" in props)) obj.initDimensions();
    obj.setCoords();
    this.canvas?.requestRenderAll();
    if (debounceMs > 0) this.commitDebounced(debounceMs);
    else this.commit();
  }
  async setFont(obj: Textbox, family: string, weight?: number) {
    const w = nearestWeight(family, weight ?? (typeof obj.fontWeight === "number" ? obj.fontWeight : 400));
    await ensureFontsLoaded([{ family, weight: w }], obj.text);
    cache.clearFontCache(family);
    this.setProps(obj, { fontFamily: family, fontWeight: w });
  }
  setBackground(color: string) {
    if (!this.canvas) return;
    this.canvas.backgroundColor = color;
    this.canvas.requestRenderAll();
    this.commitDebounced(300);
  }
  /** Sets the top-left position of the object's axis-aligned bounds in document units. */
  setPosition(obj: FabricObject, x?: number, y?: number) {
    const br = obj.getBoundingRect();
    const dx = x !== undefined ? x - br.left : 0;
    const dy = y !== undefined ? y - br.top : 0;
    this.setProps(obj, { left: obj.left + dx, top: obj.top + dy });
  }
  /** Sets the visual size (scaled width/height) while keeping the top-left corner fixed. */
  setSize(obj: FabricObject, w?: number, h?: number, keepAspect = false) {
    const br = obj.getBoundingRect();
    const curW = obj.getScaledWidth();
    const curH = obj.getScaledHeight();
    let nw = w ?? curW;
    let nh = h ?? curH;
    if (keepAspect) {
      if (w !== undefined) nh = (curH * nw) / curW;
      else if (h !== undefined) nw = (curW * nh) / curH;
    }
    nw = Math.max(1, nw);
    nh = Math.max(1, nh);
    if (obj instanceof Textbox) {
      obj.set({ width: nw / (obj.scaleX || 1) });
      obj.initDimensions();
    } else if (obj instanceof Rect) {
      obj.set({ width: nw / (obj.scaleX || 1) - obj.strokeWidth, height: nh / (obj.scaleY || 1) - obj.strokeWidth });
    } else if (obj instanceof Ellipse) {
      obj.set({ rx: (nw / (obj.scaleX || 1) - obj.strokeWidth) / 2, ry: (nh / (obj.scaleY || 1) - obj.strokeWidth) / 2 });
    } else {
      obj.set({ scaleX: (obj.scaleX || 1) * (nw / curW), scaleY: (obj.scaleY || 1) * (nh / curH) });
    }
    obj.setCoords();
    const nbr = obj.getBoundingRect();
    obj.set({ left: obj.left + (br.left - nbr.left), top: obj.top + (br.top - nbr.top) });
    obj.setCoords();
    this.canvas?.requestRenderAll();
    this.commit();
  }
  setKeepAspect(obj: FabricObject, keep: boolean) {
    Object.assign(obj, { keepAspect: keep });
    obj.setControlsVisibility({ ml: !keep, mr: !keep, mt: !keep, mb: !keep });
    this.canvas?.requestRenderAll();
    this.commit();
  }
  setImageRadius(img: FabricImage, radius: number) {
    syncImageClip(img, radius);
    this.canvas?.requestRenderAll();
    this.commitDebounced(200);
  }
  /** Crop insets as fractions (0..0.9) of the original image. */
  setImageCrop(img: FabricImage, insets: { left: number; top: number; right: number; bottom: number }) {
    const { width: ow, height: oh } = img.getOriginalSize();
    const l = clamp(insets.left, 0, 0.95);
    const t = clamp(insets.top, 0, 0.95);
    const r = clamp(insets.right, 0, 0.95 - l);
    const b = clamp(insets.bottom, 0, 0.95 - t);
    const center = img.getCenterPoint();
    const radius = img.clipPath instanceof Rect ? img.clipPath.rx * (img.scaleX || 1) : 0;
    img.set({ cropX: ow * l, cropY: oh * t, width: Math.max(1, ow * (1 - l - r)), height: Math.max(1, oh * (1 - t - b)) });
    syncImageClip(img, radius);
    img.setPositionByOrigin(center, "center", "center");
    img.setCoords();
    this.canvas?.requestRenderAll();
    this.commitDebounced(200);
  }
  /** Re-crops the image so it fills its current on-canvas box (cover). */
  recoverImage(img: FabricImage) {
    const bw = img.getScaledWidth();
    const bh = img.getScaledHeight();
    const center = img.getCenterPoint();
    const radius = img.clipPath instanceof Rect ? img.clipPath.rx * (img.scaleX || 1) : 0;
    coverImage(img, bw, bh);
    syncImageClip(img, radius);
    img.setPositionByOrigin(center, "center", "center");
    img.setCoords();
    this.canvas?.requestRenderAll();
    this.commit();
  }

  /* ---------- add / remove ---------- */
  private centerPlace(obj: FabricObject) {
    obj.set({ left: this.size.width / 2, top: this.size.height / 2 });
    obj.setCoords();
  }
  async addText(kind: "heading" | "body") {
    const canvas = this.canvas!;
    const W = this.size.width;
    const family = "Noto Sans JP";
    const weight = kind === "heading" ? 700 : 400;
    await ensureFontsLoaded([{ family, weight }], "テキスト見出し本文");
    const tb = new Textbox(kind === "heading" ? "見出しテキスト" : "本文テキストを入力", {
      width: W * 0.6,
      fontSize: kind === "heading" ? W * 0.07 : W * 0.03,
      fontFamily: family,
      fontWeight: weight,
      fill: this.contrastColor(),
      textAlign: "left",
      lineHeight: 1.3,
      splitByGrapheme: true,
    });
    Object.assign(tb, { id: newId("text"), role: "custom" });
    this.centerPlace(tb);
    canvas.add(tb);
    this.select([tb]);
  }
  addRect() {
    const W = this.size.width;
    const r = new Rect({ width: W * 0.3, height: W * 0.2, fill: "#2563eb", rx: 0, ry: 0 });
    Object.assign(r, { id: newId("rect"), role: "custom" });
    this.centerPlace(r);
    this.canvas!.add(r);
    this.select([r]);
  }
  addEllipse() {
    const W = this.size.width;
    const e = new Ellipse({ rx: W * 0.12, ry: W * 0.12, fill: "#dc2626" });
    Object.assign(e, { id: newId("ellipse"), role: "custom" });
    this.centerPlace(e);
    this.canvas!.add(e);
    this.select([e]);
  }
  addLine() {
    const W = this.size.width;
    const l = new Line([0, 0, W * 0.4, 0], { stroke: this.contrastColor(), strokeWidth: Math.max(2, W * 0.004) });
    Object.assign(l, { id: newId("line"), role: "custom", keepAspect: false });
    this.centerPlace(l);
    this.canvas!.add(l);
    this.select([l]);
  }
  private contrastColor(): string {
    const bg = typeof this.canvas?.backgroundColor === "string" ? this.canvas.backgroundColor : "#ffffff";
    let s = bg.replace("#", "");
    if (s.length === 3) s = s.split("").map((c) => c + c).join("");
    const r = parseInt(s.slice(0, 2), 16);
    const g = parseInt(s.slice(2, 4), 16);
    const b = parseInt(s.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128 ? "#ffffff" : "#1b1f24";
  }

  async addImageFile(file: File) {
    const canvas = this.canvas!;
    this.setBusy("画像を読み込んでいます…");
    try {
      const { dataUrl } = await readImageFile(file);
      const img = await FabricImage.fromURL(dataUrl);
      const placeholder = canvas.getObjects().find((o) => getMeta(o).role === "photo-placeholder");
      if (placeholder) {
        const bw = placeholder.getScaledWidth();
        const bh = placeholder.getScaledHeight();
        const c = placeholder.getCenterPoint();
        const radius = placeholder instanceof Rect ? placeholder.rx * (placeholder.scaleX || 1) : 0;
        coverImage(img, bw, bh);
        syncImageClip(img, radius);
        img.set({ left: c.x, top: c.y, angle: placeholder.angle });
        Object.assign(img, { id: newId("photo"), role: "photo", keepAspect: true });
        const index = canvas.getObjects().indexOf(placeholder);
        const label = findById(canvas, `${getMeta(placeholder).id}-label`);
        this.loading = true;
        canvas.remove(placeholder);
        if (label) canvas.remove(label);
        canvas.insertAt(index, img);
        this.loading = false;
        this.project = { ...this.project, photoSrc: dataUrl };
        this.commit();
      } else {
        const W = this.size.width;
        const H = this.size.height;
        const { width: ow, height: oh } = img.getOriginalSize();
        const scale = Math.min((W * 0.6) / ow, (H * 0.6) / oh, 1);
        img.set({ scaleX: scale, scaleY: scale });
        Object.assign(img, { id: newId("image"), role: canvas.getObjects().some((o) => getMeta(o).role === "photo") ? "custom" : "photo", keepAspect: true });
        if (!this.project.photoSrc) this.project = { ...this.project, photoSrc: dataUrl };
        this.centerPlace(img);
        canvas.add(img);
      }
      this.applyObjectBehavior(img);
      this.select([img]);
      this.notify("画像を追加しました。");
    } catch (e) {
      this.notify(e instanceof Error ? e.message : "画像を追加できませんでした。", "error");
    } finally {
      this.setBusy(null);
    }
  }

  async replaceImageFile(target: FabricImage, file: File) {
    const canvas = this.canvas!;
    this.setBusy("画像を読み込んでいます…");
    try {
      const { dataUrl } = await readImageFile(file);
      const img = await FabricImage.fromURL(dataUrl);
      const bw = target.getScaledWidth();
      const bh = target.getScaledHeight();
      const c = target.getCenterPoint();
      const radius = target.clipPath instanceof Rect ? target.clipPath.rx * (target.scaleX || 1) : 0;
      coverImage(img, bw, bh);
      syncImageClip(img, radius);
      img.set({ left: c.x, top: c.y, angle: target.angle, opacity: target.opacity });
      const m = getMeta(target);
      Object.assign(img, { id: m.id, role: m.role, name: m.name, keepAspect: m.keepAspect !== false });
      const index = canvas.getObjects().indexOf(target);
      this.loading = true;
      canvas.remove(target);
      canvas.insertAt(index, img);
      this.loading = false;
      if (m.role === "photo") this.project = { ...this.project, photoSrc: dataUrl };
      this.applyObjectBehavior(img);
      this.commit();
      this.select([img]);
      this.notify("画像を差し替えました。");
    } catch (e) {
      this.notify(e instanceof Error ? e.message : "画像を差し替えられませんでした。", "error");
    } finally {
      this.setBusy(null);
    }
  }

  deleteSelection() {
    const canvas = this.canvas!;
    const objs = canvas.getActiveObjects();
    if (objs.length === 0) return;
    canvas.discardActiveObject();
    this.loading = true;
    for (const o of objs) canvas.remove(o);
    this.loading = false;
    this.selection = [];
    canvas.requestRenderAll();
    this.commit();
  }
  deleteObject(obj: FabricObject) {
    const canvas = this.canvas!;
    if (canvas.getActiveObjects().includes(obj)) canvas.discardActiveObject();
    canvas.remove(obj);
    this.selection = canvas.getActiveObjects();
    canvas.requestRenderAll();
  }

  async copy() {
    const active = this.active;
    if (!active) return;
    this.clipboard = await active.clone(META_PROPS);
  }
  async paste() {
    const canvas = this.canvas!;
    if (!this.clipboard) return;
    const clone = await this.clipboard.clone(META_PROPS);
    canvas.discardActiveObject();
    clone.set({ left: clone.left + 24, top: clone.top + 24, evented: true });
    this.loading = true;
    if (clone instanceof ActiveSelection) {
      clone.canvas = canvas;
      clone.forEachObject((o) => {
        Object.assign(o, { id: newId(o.type) });
        this.applyObjectBehavior(o);
        canvas.add(o);
      });
      clone.setCoords();
    } else {
      Object.assign(clone, { id: newId(clone.type) });
      this.applyObjectBehavior(clone);
      canvas.add(clone);
    }
    this.loading = false;
    this.clipboard.set({ left: this.clipboard.left + 24, top: this.clipboard.top + 24 });
    canvas.setActiveObject(clone);
    canvas.requestRenderAll();
    this.selection = canvas.getActiveObjects();
    this.commit();
  }
  async duplicate() {
    const active = this.active;
    if (!active) return;
    const saved = this.clipboard;
    this.clipboard = await active.clone(META_PROPS);
    await this.paste();
    this.clipboard = saved;
  }

  /* ---------- ordering ---------- */
  bringForward(obj?: FabricObject) {
    const o = obj ?? this.active;
    if (!o) return;
    const canvas = this.canvas!;
    if (o instanceof ActiveSelection) o.forEachObject((x) => canvas.bringObjectForward(x));
    else canvas.bringObjectForward(o);
    canvas.requestRenderAll();
    this.commit();
  }
  sendBackwards(obj?: FabricObject) {
    const o = obj ?? this.active;
    if (!o) return;
    const canvas = this.canvas!;
    if (o instanceof ActiveSelection) o.forEachObject((x) => canvas.sendObjectBackwards(x));
    else canvas.sendObjectBackwards(o);
    canvas.requestRenderAll();
    this.commit();
  }
  bringToFront(obj?: FabricObject) {
    const o = obj ?? this.active;
    if (!o) return;
    const canvas = this.canvas!;
    if (o instanceof ActiveSelection) o.forEachObject((x) => canvas.bringObjectToFront(x));
    else canvas.bringObjectToFront(o);
    canvas.requestRenderAll();
    this.commit();
  }
  sendToBack(obj?: FabricObject) {
    const o = obj ?? this.active;
    if (!o) return;
    const canvas = this.canvas!;
    if (o instanceof ActiveSelection) [...o.getObjects()].reverse().forEach((x) => canvas.sendObjectToBack(x));
    else canvas.sendObjectToBack(o);
    canvas.requestRenderAll();
    this.commit();
  }
  moveObjectTo(obj: FabricObject, index: number) {
    const canvas = this.canvas!;
    canvas.moveObjectTo(obj, Math.max(0, Math.min(canvas.getObjects().length - 1, index)));
    canvas.requestRenderAll();
    this.commit();
  }
  toggleVisible(obj: FabricObject) {
    obj.set({ visible: !obj.visible });
    if (!obj.visible && this.canvas!.getActiveObjects().includes(obj)) this.canvas!.discardActiveObject();
    this.canvas!.requestRenderAll();
    this.commit();
  }
  toggleLock(obj: FabricObject) {
    const locked = obj.lockMovementX;
    obj.set({ lockMovementX: !locked, lockMovementY: !locked, lockScalingX: !locked, lockScalingY: !locked, lockRotation: !locked, hasControls: locked });
    this.canvas!.requestRenderAll();
    this.commit();
  }
  isLocked(obj: FabricObject) {
    return Boolean(obj.lockMovementX);
  }

  /* ---------- alignment to canvas ---------- */
  align(kind: "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom") {
    const o = this.active;
    if (!o) return;
    const W = this.size.width;
    const H = this.size.height;
    const br = o.getBoundingRect();
    let dx = 0;
    let dy = 0;
    if (kind === "left") dx = -br.left;
    if (kind === "hcenter") dx = W / 2 - (br.left + br.width / 2);
    if (kind === "right") dx = W - (br.left + br.width);
    if (kind === "top") dy = -br.top;
    if (kind === "vcenter") dy = H / 2 - (br.top + br.height / 2);
    if (kind === "bottom") dy = H - (br.top + br.height);
    o.set({ left: o.left + dx, top: o.top + dy });
    o.setCoords();
    this.canvas!.requestRenderAll();
    this.commit();
  }
  nudge(dx: number, dy: number) {
    const o = this.active;
    if (!o || this.isLocked(o)) return;
    o.set({ left: o.left + dx, top: o.top + dy });
    o.setCoords();
    this.canvas!.requestRenderAll();
    this.commitDebounced(300);
  }
  selectAll() {
    const canvas = this.canvas!;
    this.select(canvas.getObjects().filter((o) => o.selectable !== false && o.visible));
  }

  /* ---------- size change ---------- */
  changeSize(size: CanvasSize) {
    const canvas = this.canvas!;
    const old = this.size;
    const r = Math.min(size.width / old.width, size.height / old.height);
    const ox = (size.width - old.width * r) / 2;
    const oy = (size.height - old.height * r) / 2;
    canvas.discardActiveObject();
    for (const obj of canvas.getObjects()) {
      const c = obj.getCenterPoint();
      if (obj instanceof Textbox) {
        obj.set({ fontSize: obj.fontSize * r, width: obj.width * r });
        obj.initDimensions();
      } else if (obj instanceof Rect) {
        obj.set({ width: obj.width * r, height: obj.height * r, rx: obj.rx * r, ry: obj.ry * r, strokeWidth: obj.strokeWidth * r });
      } else if (obj instanceof Ellipse) {
        obj.set({ rx: obj.rx * r, ry: obj.ry * r, strokeWidth: obj.strokeWidth * r });
      } else {
        obj.set({ scaleX: (obj.scaleX || 1) * r, scaleY: (obj.scaleY || 1) * r });
      }
      obj.setPositionByOrigin(new Point(c.x * r + ox, c.y * r + oy), "center", "center");
      obj.setCoords();
    }
    this.project = { ...this.project, size };
    this.selection = [];
    this.zoomToFit();
    canvas.requestRenderAll();
    this.commit();
  }

  /* ---------- export ---------- */
  async exportPng() {
    if (!this.canvas) return;
    this.setBusy("PNGを書き出しています…");
    try {
      const json = this.canvas.toObject(META_PROPS) as Record<string, unknown>;
      const { blob, width, height } = await exportPngBlob(json, this.size);
      downloadBlob(blob, safeFilename(this.project.name, "png"));
      this.notify(`PNGを書き出しました（${width}×${height}px）。`);
    } catch (e) {
      this.notify(`PNGの書き出しに失敗しました: ${e instanceof Error ? e.message : String(e)}`, "error");
    } finally {
      this.setBusy(null);
    }
  }
  async exportPdf() {
    if (!this.canvas) return;
    this.setBusy("PDFを書き出しています…");
    try {
      const json = this.canvas.toObject(META_PROPS) as Record<string, unknown>;
      const { blob } = await exportPdfBlob(json, this.size);
      downloadBlob(blob, safeFilename(this.project.name, "pdf"));
      this.notify(this.size.widthMm ? `印刷用PDFを書き出しました（${this.size.widthMm}×${this.size.heightMm}mm、300dpi）。` : "PDFを書き出しました。");
    } catch (e) {
      this.notify(`PDFの書き出しに失敗しました: ${e instanceof Error ? e.message : String(e)}`, "error");
    } finally {
      this.setBusy(null);
    }
  }
  async exportProject() {
    const ok = await this.save();
    if (!ok) return;
    downloadBlob(projectFileBlob(this.project), safeFilename(this.project.name, "flyer.json"));
    this.notify("プロジェクトファイルを書き出しました。");
  }

  /* ---------- AI / design ---------- */
  async applyDesign(spec: DesignSpec) {
    const canvas = this.canvas!;
    this.setBusy("デザインを適用しています…");
    this.loading = true;
    try {
      canvas.discardActiveObject();
      await loadSpecIntoCanvas(canvas, spec, this.size, { photoSrc: this.project.photoSrc });
      this.afterLoad();
    } finally {
      this.loading = false;
      this.setBusy(null);
    }
    this.selection = [];
    this.commit();
  }
  updateBrief(brief: Project["brief"]) {
    this.project = { ...this.project, brief };
    this.saveState = "dirty";
    this.scheduleSave();
    this.emit();
  }
  async refine(instruction: string): Promise<string> {
    const canvas = this.canvas!;
    const current = extractSpec(canvas, this.size);
    let patch;
    let source = "内蔵ルール";
    if (this.aiStatus.available) {
      try {
        this.setBusy(`${this.aiStatus.label}が調整案を作成しています…`);
        const res = await aiRefine(current, instruction, this.size.width / this.size.height);
        patch = res.patch;
        source = res.provider ?? this.aiStatus.label ?? "AI";
      } catch (e) {
        this.setBusy(null);
        throw e;
      }
    } else {
      patch = refineLocally(current, instruction);
    }
    this.setBusy("調整を適用しています…");
    try {
      canvas.discardActiveObject();
      this.loading = true;
      await applyPatch(canvas, patch, this.size, { photoSrc: this.project.photoSrc });
      for (const o of canvas.getObjects()) this.applyObjectBehavior(o);
    } finally {
      this.loading = false;
      this.setBusy(null);
    }
    this.selection = [];
    this.commit();
    return `${patch.summary}（${source}）`;
  }

  /* ---------- keyboard ---------- */
  private onKeyDown(e: KeyboardEvent) {
    const canvas = this.canvas;
    if (!canvas) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
    const active = canvas.getActiveObject();
    if (active instanceof Textbox && active.isEditing) return;
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();
    if (mod && key === "z") {
      e.preventDefault();
      if (e.shiftKey) void this.redo();
      else void this.undo();
      return;
    }
    if (mod && key === "y") {
      e.preventDefault();
      void this.redo();
      return;
    }
    if (mod && key === "s") {
      e.preventDefault();
      void this.save().then((ok) => ok && this.notify("保存しました。"));
      return;
    }
    if (mod && key === "c") {
      e.preventDefault();
      void this.copy();
      return;
    }
    if (mod && key === "v") {
      e.preventDefault();
      void this.paste();
      return;
    }
    if (mod && key === "d") {
      e.preventDefault();
      void this.duplicate();
      return;
    }
    if (mod && key === "a") {
      e.preventDefault();
      this.selectAll();
      return;
    }
    if (mod && (key === "]" || key === "[")) {
      e.preventDefault();
      if (key === "]") {
        if (e.shiftKey) this.bringToFront();
        else this.bringForward();
      } else if (e.shiftKey) this.sendToBack();
      else this.sendBackwards();
      return;
    }
    if (mod && (key === "=" || key === "+" || key === "-" || key === "0")) {
      e.preventDefault();
      if (key === "0") this.zoomToFit();
      else this.setZoom(this.zoom * (key === "-" ? 1 / 1.2 : 1.2));
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      if (active) {
        e.preventDefault();
        this.deleteSelection();
      }
      return;
    }
    if (e.key === "Escape") {
      this.deselect();
      return;
    }
    if (e.key.startsWith("Arrow") && active) {
      e.preventDefault();
      const step = (e.shiftKey ? 10 : 1) / 1;
      this.nudge(e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0, e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0);
    }
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
