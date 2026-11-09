export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGE_EDGE = 3200;

/**
 * Reads an image file, validates it, downsizes very large photos (keeping print-quality
 * resolution) and returns a data URL plus dimensions. Throws with a Japanese message.
 */
export async function readImageFile(file: File): Promise<{ dataUrl: string; width: number; height: number }> {
  if (!file.type.startsWith("image/")) throw new Error("画像ファイル（JPEG / PNG / WebP など）を選択してください。");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("ファイルサイズが20MBを超えています。小さい画像を選択してください。");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("画像を読み込めませんでした。ファイルが壊れているか、対応していない形式です。"));
      el.src = url;
    });
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("画像処理用のキャンバスを作成できませんでした。");
    ctx.drawImage(img, 0, 0, w, h);
    const hasAlpha = file.type === "image/png" || file.type === "image/webp" || file.type === "image/gif";
    const dataUrl = hasAlpha ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.92);
    return { dataUrl, width: w, height: h };
  } finally {
    URL.revokeObjectURL(url);
  }
}
