export interface FontDef {
  family: string;
  label: string;
  category: "gothic" | "mincho" | "rounded";
  weights: number[];
}

export const FONTS: FontDef[] = [
  { family: "Noto Sans JP", label: "Noto Sans JP（ゴシック）", category: "gothic", weights: [400, 500, 700, 900] },
  { family: "Zen Kaku Gothic New", label: "Zen角ゴシック New", category: "gothic", weights: [400, 500, 700, 900] },
  { family: "M PLUS Rounded 1c", label: "M PLUS 丸ゴシック", category: "rounded", weights: [400, 500, 700, 800, 900] },
  { family: "Noto Serif JP", label: "Noto Serif JP（明朝）", category: "mincho", weights: [400, 500, 600, 700, 900] },
  { family: "Shippori Mincho", label: "しっぽり明朝", category: "mincho", weights: [400, 500, 600, 700, 800] },
];

export const FONT_FAMILIES = FONTS.map((f) => f.family);

export function isKnownFont(family: string): boolean {
  return FONT_FAMILIES.includes(family);
}

export function nearestWeight(family: string, weight: number): number {
  const def = FONTS.find((f) => f.family === family) ?? FONTS[0];
  return def.weights.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), def.weights[0]);
}

const SAMPLE = "あいうえお漢字カタカナ円税込ABC0123456789¥,.!？";

/**
 * Loads the given font faces (family+weight) for the given text so canvas rendering uses the real glyphs.
 * Resolves even if a font fails (falls back to system font) but reports failures.
 */
export async function ensureFontsLoaded(
  faces: { family: string; weight: number }[],
  text = "",
): Promise<{ failed: string[] }> {
  if (typeof document === "undefined" || !("fonts" in document)) return { failed: [] };
  const failed: string[] = [];
  const seen = new Set<string>();
  const sample = SAMPLE + text;
  await Promise.all(
    faces.map(async ({ family, weight }) => {
      const key = `${family}|${weight}`;
      if (seen.has(key)) return;
      seen.add(key);
      try {
        const loaded = await document.fonts.load(`${weight} 24px "${family}"`, sample);
        if (loaded.length === 0 && isKnownFont(family)) failed.push(key);
      } catch {
        failed.push(key);
      }
    }),
  );
  return { failed };
}
