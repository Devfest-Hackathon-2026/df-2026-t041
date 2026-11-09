/**
 * Japanese fonts for flyers. Font files are not bundled with the app or stored in the repository:
 * each family is loaded on demand from Google Fonts (CSS2 API) the first time it is used.
 * Every family and weight below was checked against the Google Fonts API.
 */
export type FontCategory = "gothic" | "mincho" | "rounded" | "pop" | "hand";

export interface FontDef {
  family: string;
  label: string;
  category: FontCategory;
  weights: number[];
}

export const FONT_CATEGORIES: { id: FontCategory; label: string }[] = [
  { id: "gothic", label: "ゴシック" },
  { id: "mincho", label: "明朝" },
  { id: "rounded", label: "丸ゴシック" },
  { id: "pop", label: "ポップ・見出し向け" },
  { id: "hand", label: "手書き・筆" },
];

export const FONTS: FontDef[] = [
  // ゴシック
  { family: "Noto Sans JP", label: "Noto Sans JP", category: "gothic", weights: [400, 500, 700, 900] },
  { family: "Zen Kaku Gothic New", label: "Zen角ゴシック New", category: "gothic", weights: [400, 500, 700, 900] },
  { family: "BIZ UDPGothic", label: "BIZ UDPゴシック", category: "gothic", weights: [400, 700] },
  { family: "Murecho", label: "Murecho", category: "gothic", weights: [400, 500, 700, 900] },
  { family: "Sawarabi Gothic", label: "さわらびゴシック", category: "gothic", weights: [400] },
  // 明朝
  { family: "Noto Serif JP", label: "Noto Serif JP", category: "mincho", weights: [400, 500, 600, 700, 900] },
  { family: "Shippori Mincho", label: "しっぽり明朝", category: "mincho", weights: [400, 500, 600, 700, 800] },
  { family: "Zen Old Mincho", label: "Zen オールド明朝", category: "mincho", weights: [400, 500, 600, 700, 900] },
  { family: "BIZ UDPMincho", label: "BIZ UDP明朝", category: "mincho", weights: [400, 700] },
  { family: "Kaisei Decol", label: "解星デコール", category: "mincho", weights: [400, 500, 700] },
  { family: "Sawarabi Mincho", label: "さわらび明朝", category: "mincho", weights: [400] },
  // 丸ゴシック
  { family: "M PLUS Rounded 1c", label: "M PLUS 丸ゴシック", category: "rounded", weights: [400, 500, 700, 800, 900] },
  { family: "Zen Maru Gothic", label: "Zen丸ゴシック", category: "rounded", weights: [400, 500, 700, 900] },
  { family: "Kosugi Maru", label: "小杉丸ゴシック", category: "rounded", weights: [400] },
  { family: "Kiwi Maru", label: "キウイ丸", category: "rounded", weights: [400, 500] },
  // ポップ・見出し向け
  { family: "Dela Gothic One", label: "デラゴシック", category: "pop", weights: [400] },
  { family: "Mochiy Pop One", label: "モッチーポップ", category: "pop", weights: [400] },
  { family: "RocknRoll One", label: "ロックンロール", category: "pop", weights: [400] },
  { family: "Reggae One", label: "レゲエ", category: "pop", weights: [400] },
  { family: "Potta One", label: "ポッタ", category: "pop", weights: [400] },
  { family: "Train One", label: "トレイン", category: "pop", weights: [400] },
  { family: "Rampart One", label: "ランパート", category: "pop", weights: [400] },
  { family: "DotGothic16", label: "ドットゴシック16", category: "pop", weights: [400] },
  // 手書き・筆
  { family: "Klee One", label: "クレー", category: "hand", weights: [400, 600] },
  { family: "Yuji Syuku", label: "佑字 肅（筆）", category: "hand", weights: [400] },
  { family: "Yusei Magic", label: "油性マジック", category: "hand", weights: [400] },
  { family: "Hachi Maru Pop", label: "はちまるポップ", category: "hand", weights: [400] },
  { family: "Zen Kurenaido", label: "Zen紅道", category: "hand", weights: [400] },
  { family: "Yomogi", label: "よもぎ", category: "hand", weights: [400] },
  { family: "Stick", label: "スティック", category: "hand", weights: [400] },
];

export const FONT_FAMILIES = FONTS.map((f) => f.family);

export function isKnownFont(family: string): boolean {
  return FONT_FAMILIES.includes(family);
}

export function fontDef(family: string): FontDef | undefined {
  return FONTS.find((f) => f.family === family);
}

export function nearestWeight(family: string, weight: number): number {
  const def = fontDef(family) ?? FONTS[0];
  return def.weights.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), def.weights[0]);
}

/** Google Fonts CSS2 URL for one family with all of its catalog weights. */
export function googleFontsCssUrl(def: FontDef): string {
  const fam = encodeURIComponent(def.family).replace(/%20/g, "+");
  const wght = def.weights.length > 1 || def.weights[0] !== 400 ? `:wght@${def.weights.join(";")}` : "";
  return `https://fonts.googleapis.com/css2?family=${fam}${wght}&display=swap`;
}

const cssLoads = new Map<string, Promise<void>>();

/** Adds the family's Google Fonts stylesheet once and waits until its @font-face rules are registered. */
export function loadFontCss(family: string): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  const def = fontDef(family);
  if (!def) return Promise.resolve();
  const existing = cssLoads.get(family);
  if (existing) return existing;
  const p = new Promise<void>((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = googleFontsCssUrl(def);
    link.dataset.font = family;
    link.onload = () => resolve();
    link.onerror = () => {
      cssLoads.delete(family);
      link.remove();
      reject(new Error(`フォント「${def.label}」を読み込めませんでした。`));
    };
    document.head.appendChild(link);
  });
  cssLoads.set(family, p);
  return p;
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
        await loadFontCss(family);
        const loaded = await document.fonts.load(`${weight} 24px "${family}"`, sample);
        if (loaded.length === 0 && isKnownFont(family)) failed.push(key);
      } catch {
        failed.push(key);
      }
    }),
  );
  return { failed };
}
