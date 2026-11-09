export type SizePresetId =
  | "a4-portrait"
  | "a4-landscape"
  | "a5-portrait"
  | "a5-landscape"
  | "ig-square"
  | "ig-portrait"
  | "custom";

export interface CanvasSize {
  preset: SizePresetId;
  label: string;
  /** Document units (px at 96 dpi for print sizes, native px for SNS sizes). */
  width: number;
  height: number;
  /** Physical size, present for print presets. */
  widthMm?: number;
  heightMm?: number;
}

const MM_TO_PX96 = 96 / 25.4;
const mm = (v: number) => Math.round(v * MM_TO_PX96);

export const SIZE_PRESETS: CanvasSize[] = [
  { preset: "a4-portrait", label: "A4 縦", width: mm(210), height: mm(297), widthMm: 210, heightMm: 297 },
  { preset: "a4-landscape", label: "A4 横", width: mm(297), height: mm(210), widthMm: 297, heightMm: 210 },
  { preset: "a5-portrait", label: "A5 縦", width: mm(148), height: mm(210), widthMm: 148, heightMm: 210 },
  { preset: "a5-landscape", label: "A5 横", width: mm(210), height: mm(148), widthMm: 210, heightMm: 148 },
  { preset: "ig-square", label: "Instagram 正方形 1080×1080", width: 1080, height: 1080 },
  { preset: "ig-portrait", label: "Instagram 縦型 1080×1350", width: 1080, height: 1350 },
];

export function getPreset(id: SizePresetId): CanvasSize {
  return SIZE_PRESETS.find((p) => p.preset === id) ?? SIZE_PRESETS[0];
}

export function customSize(width: number, height: number): CanvasSize {
  return { preset: "custom", label: `カスタム ${width}×${height}px`, width, height };
}

export const PRINT_DPI = 300;

/** Pixel dimensions of the export raster. Print sizes export at 300 dpi; screen sizes at native px (x2 optional). */
export function exportPixelSize(size: CanvasSize, screenScale = 1): { width: number; height: number; multiplier: number } {
  if (size.widthMm && size.heightMm) {
    const width = Math.round((size.widthMm / 25.4) * PRINT_DPI);
    const height = Math.round((size.heightMm / 25.4) * PRINT_DPI);
    return { width, height, multiplier: width / size.width };
  }
  return { width: size.width * screenScale, height: size.height * screenScale, multiplier: screenScale };
}

/** PDF page size in PostScript points. */
export function pdfPageSizePt(size: CanvasSize): { width: number; height: number } {
  if (size.widthMm && size.heightMm) {
    return { width: (size.widthMm / 25.4) * 72, height: (size.heightMm / 25.4) * 72 };
  }
  // Screen sizes: treat 96 px as 1 inch.
  return { width: size.width * 0.75, height: size.height * 0.75 };
}
