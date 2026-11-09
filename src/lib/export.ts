import { StaticCanvas, cache } from "fabric";
import { PDFDocument } from "pdf-lib";
import { exportPixelSize, pdfPageSizePt, type CanvasSize } from "./sizes";
import { ensureFontsLoaded } from "./fonts";
import type { Project } from "./db";

/** Collects font faces used in a serialized canvas so they are loaded before rendering. */
export function fontFacesOfJson(json: Record<string, unknown>): { faces: { family: string; weight: number }[]; text: string } {
  const objects = (json.objects as Array<Record<string, unknown>> | undefined) ?? [];
  const faces: { family: string; weight: number }[] = [];
  let text = "";
  for (const o of objects) {
    if (typeof o.fontFamily === "string") {
      const w = typeof o.fontWeight === "number" ? o.fontWeight : o.fontWeight === "bold" ? 700 : 400;
      faces.push({ family: o.fontFamily, weight: w });
      if (typeof o.text === "string") text += o.text;
    }
  }
  return { faces, text };
}

/**
 * Renders the saved canvas JSON offscreen at the exact document size and returns a PNG data URL at the given multiplier.
 * When `exact` is given the raster is resampled to exactly that pixel size (print sizes need an exact 300 dpi raster).
 */
export async function renderJsonToPng(json: Record<string, unknown>, size: CanvasSize, multiplier: number, exact?: { width: number; height: number }): Promise<string> {
  const { faces, text } = fontFacesOfJson(json);
  await ensureFontsLoaded(faces, text);
  cache.clearFontCache();
  const sc = new StaticCanvas(undefined, { width: size.width, height: size.height, renderOnAddRemove: false, enableRetinaScaling: false });
  try {
    await sc.loadFromJSON(json);
    sc.renderAll();
    const el = sc.toCanvasElement(multiplier);
    if (exact && (el.width !== exact.width || el.height !== exact.height)) {
      const out = document.createElement("canvas");
      out.width = exact.width;
      out.height = exact.height;
      const ctx = out.getContext("2d");
      if (!ctx) throw new Error("書き出し用のキャンバスを作成できませんでした。");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(el, 0, 0, exact.width, exact.height);
      return out.toDataURL("image/png");
    }
    return el.toDataURL("image/png");
  } finally {
    sc.dispose();
  }
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? "application/octet-stream";
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function exportPngBlob(json: Record<string, unknown>, size: CanvasSize): Promise<{ blob: Blob; width: number; height: number }> {
  const px = exportPixelSize(size, 1);
  const dataUrl = await renderJsonToPng(json, size, px.multiplier, { width: px.width, height: px.height });
  return { blob: dataUrlToBlob(dataUrl), width: px.width, height: px.height };
}

export async function exportPdfBlob(json: Record<string, unknown>, size: CanvasSize): Promise<{ blob: Blob; widthPt: number; heightPt: number }> {
  const px = exportPixelSize(size, 2);
  const dataUrl = await renderJsonToPng(json, size, px.multiplier, { width: px.width, height: px.height });
  const pngBytes = await dataUrlToBlob(dataUrl).arrayBuffer();
  const pdf = await PDFDocument.create();
  pdf.setTitle("flyer");
  pdf.setProducer("Flyer Maker");
  const page = pdf.addPage([pdfPageSizePt(size).width, pdfPageSizePt(size).height]);
  const png = await pdf.embedPng(pngBytes);
  page.drawImage(png, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
  const bytes = await pdf.save();
  return { blob: new Blob([bytes as BlobPart], { type: "application/pdf" }), widthPt: page.getWidth(), heightPt: page.getHeight() };
}

export function projectFileBlob(project: Project): Blob {
  return new Blob([JSON.stringify(project)], { type: "application/json" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function safeFilename(name: string, ext: string): string {
  const base = name.replace(/[\\/:*?"<>|]/g, "_").trim() || "flyer";
  return `${base}.${ext}`;
}
