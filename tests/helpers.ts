import { expect, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { PNG } from "pngjs";

export const FIXTURE_JPG = path.join(__dirname, "fixtures", "karaage.jpg");
export const FIXTURE_PNG = path.join(__dirname, "fixtures", "karaage.png");
export const OUT_DIR = path.join(__dirname, "output");

export interface ObjState {
  id: string;
  role: string;
  type: string;
  text?: string;
  left: number;
  top: number;
  bl: number;
  bt: number;
  w: number;
  h: number;
  fontSize?: number;
  fontFamily?: string;
  textAlign?: string;
  fill?: string;
  visible: boolean;
  srcLen?: number;
  index: number;
}

export interface EditorState {
  objects: ObjState[];
  zoom: number;
  size: { preset: string; width: number; height: number; widthMm?: number; heightMm?: number };
  bg: string;
  canUndo: boolean;
  canRedo: boolean;
  saveState: string;
}

export async function editorState(page: Page): Promise<EditorState> {
  return page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ed = (window as any).__flyerEditor;
    const canvas = ed.canvas;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const objects = canvas.getObjects().map((o: any, index: number) => {
      const br = o.getBoundingRect();
      return {
        id: o.id,
        role: o.role,
        type: o.type,
        text: o.text,
        left: o.left,
        top: o.top,
        bl: br.left,
        bt: br.top,
        w: o.getScaledWidth(),
        h: o.getScaledHeight(),
        fontSize: o.fontSize,
        fontFamily: o.fontFamily,
        textAlign: o.textAlign,
        fill: typeof o.fill === "string" ? o.fill : undefined,
        visible: o.visible,
        srcLen: typeof o.getSrc === "function" ? o.getSrc().length : undefined,
        index,
      };
    });
    return { objects, zoom: ed.zoom, size: ed.size, bg: canvas.backgroundColor, canUndo: ed.canUndo, canRedo: ed.canRedo, saveState: ed.saveState };
  });
}

export async function waitForEditor(page: Page) {
  await expect(page.locator('[data-testid="editor"][data-ready="true"]')).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(300);
}

/** Screen position of a document-space point. */
export async function canvasPoint(page: Page, x: number, y: number) {
  const box = await page.locator("canvas.upper-canvas").boundingBox();
  if (!box) throw new Error("canvas not found");
  const zoom = (await editorState(page)).zoom;
  return { x: box.x + x * zoom, y: box.y + y * zoom };
}

export async function selectByLayerName(page: Page, name: string) {
  await page.getByTestId("tab-layers").click();
  const item = page.locator('[data-testid="layer-item"]', { hasText: name }).first();
  await item.locator("button").first().click();
  await expect(item).toHaveAttribute("data-selected", "true");
}

export async function waitSaved(page: Page) {
  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved", { timeout: 20_000 });
}

export async function download(page: Page, trigger: () => Promise<void>, filename: string): Promise<string> {
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 90_000 }), trigger()]);
  const target = path.join(OUT_DIR, filename);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await dl.saveAs(target);
  return target;
}

export function readPng(file: string): PNG {
  return PNG.sync.read(fs.readFileSync(file));
}

export function pixel(png: PNG, x: number, y: number): [number, number, number] {
  const i = (Math.round(y) * png.width + Math.round(x)) * 4;
  return [png.data[i], png.data[i + 1], png.data[i + 2]];
}

export function hexToRgb(hex: string): [number, number, number] {
  const s = hex.replace("#", "");
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

export function colorClose(a: [number, number, number], b: [number, number, number], tol = 12): boolean {
  return Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol && Math.abs(a[2] - b[2]) <= tol;
}

/** Counts pixels in a region whose color is close to `color`. */
export function countColor(png: PNG, region: { x: number; y: number; w: number; h: number }, color: [number, number, number], tol = 40): number {
  let n = 0;
  const x0 = Math.max(0, Math.floor(region.x));
  const y0 = Math.max(0, Math.floor(region.y));
  const x1 = Math.min(png.width, Math.ceil(region.x + region.w));
  const y1 = Math.min(png.height, Math.ceil(region.y + region.h));
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      if (colorClose(pixel(png, x, y), color, tol)) n += 1;
    }
  }
  return n;
}

export async function createProject(
  page: Page,
  opts: { preset?: string; product: string; price?: string; shop?: string; description?: string; prompt?: string; photo?: string | null; choose?: number },
) {
  await page.goto("/new");
  if (opts.preset) await page.getByTestId(`size-${opts.preset}`).click();
  await page.getByTestId("next-step").click();
  await page.getByTestId("input-product").fill(opts.product);
  if (opts.price) await page.getByTestId("input-price").fill(opts.price);
  if (opts.shop) await page.getByTestId("input-shop").fill(opts.shop);
  if (opts.description) await page.getByTestId("input-description").fill(opts.description);
  if (opts.prompt) await page.getByTestId("input-prompt").fill(opts.prompt);
  if (opts.photo !== null) {
    await page.getByTestId("photo-input").setInputFiles(opts.photo ?? FIXTURE_JPG);
    await expect(page.getByTestId("photo-preview")).toBeVisible();
  }
  await page.getByTestId("generate").click();
  await expect(page.getByTestId("proposal-thumb")).toHaveCount(3, { timeout: 60_000 });
  const srcs = await page.getByTestId("proposal-thumb").evaluateAll((imgs) => imgs.map((i) => (i as HTMLImageElement).src));
  expect(new Set(srcs).size).toBe(3);
  await page.getByTestId(`choose-${opts.choose ?? 0}`).click();
  await page.waitForURL(/\/editor\//, { timeout: 60_000 });
  await waitForEditor(page);
}
