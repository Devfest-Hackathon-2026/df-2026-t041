export interface Palette {
  bg: string;
  text: string;
  sub: string;
  accent: string;
  /** Text color placed on top of the accent color. */
  onAccent: string;
  /** Color for overlay bands drawn over photos. */
  band: string;
  onBand: string;
}

export interface StyleDef {
  id: StyleId;
  label: string;
  keywords: string[];
  palette: Palette;
  /** Alternative palette used by the third variant. */
  alt: Palette;
  heading: { family: string; weight: number };
  body: { family: string; weight: number };
  price: { family: string; weight: number };
  /** Corner radius tendency, fraction of canvas width. */
  radius: number;
  /** Heading letter spacing in 1/1000 em. */
  headingSpacing: number;
}

export type StyleId =
  | "washoku"
  | "yakiniku"
  | "cafe"
  | "izakaya"
  | "ramen"
  | "restaurant"
  | "minimal"
  | "modern"
  | "retro"
  | "pop";

export const STYLES: StyleDef[] = [
  {
    id: "washoku",
    label: "和風・落ち着き",
    keywords: ["和食", "和風", "落ち着", "老舗", "寿司", "そば", "蕎麦", "うどん", "定食", "料亭", "割烹", "天ぷら", "和"],
    palette: { bg: "#f5efe3", text: "#2a2522", sub: "#6e645a", accent: "#9b2d2d", onAccent: "#fbf6ec", band: "#2a2522", onBand: "#f5efe3" },
    alt: { bg: "#1f2730", text: "#f1ebdf", sub: "#b9b0a2", accent: "#c8a45c", onAccent: "#1f2730", band: "#1f2730", onBand: "#f1ebdf" },
    heading: { family: "Shippori Mincho", weight: 700 },
    body: { family: "Noto Serif JP", weight: 400 },
    price: { family: "Shippori Mincho", weight: 800 },
    radius: 0,
    headingSpacing: 80,
  },
  {
    id: "yakiniku",
    label: "高級・焼肉",
    keywords: ["焼肉", "高級", "ステーキ", "肉", "黒毛", "ラグジュアリー", "贅沢", "重厚"],
    palette: { bg: "#141211", text: "#f3e9d8", sub: "#b8ada0", accent: "#c9a24a", onAccent: "#141211", band: "#141211", onBand: "#f3e9d8" },
    alt: { bg: "#f3ebdd", text: "#1c1816", sub: "#6c625a", accent: "#8c1d1d", onAccent: "#f3ebdd", band: "#1c1816", onBand: "#f3ebdd" },
    heading: { family: "Noto Serif JP", weight: 700 },
    body: { family: "Noto Sans JP", weight: 400 },
    price: { family: "Noto Serif JP", weight: 700 },
    radius: 0,
    headingSpacing: 120,
  },
  {
    id: "cafe",
    label: "今風カフェ",
    keywords: ["カフェ", "今風", "おしゃれ", "ナチュラル", "コーヒー", "珈琲", "スイーツ", "パン", "ベーカリー", "ブランチ"],
    palette: { bg: "#faf7f1", text: "#2f2a26", sub: "#7a716a", accent: "#8a6b4e", onAccent: "#faf7f1", band: "#faf7f1", onBand: "#2f2a26" },
    alt: { bg: "#e7e1d6", text: "#2f2a26", sub: "#6d655d", accent: "#2f2a26", onAccent: "#faf7f1", band: "#2f2a26", onBand: "#faf7f1" },
    heading: { family: "Zen Kaku Gothic New", weight: 700 },
    body: { family: "Zen Kaku Gothic New", weight: 400 },
    price: { family: "Zen Kaku Gothic New", weight: 900 },
    radius: 0.02,
    headingSpacing: 40,
  },
  {
    id: "izakaya",
    label: "居酒屋・元気",
    keywords: ["居酒屋", "元気", "にぎやか", "賑やか", "ビール", "酒", "大衆", "串", "焼き鳥", "宴会"],
    palette: { bg: "#f8ead0", text: "#221c18", sub: "#5f554c", accent: "#c8352b", onAccent: "#fff6e6", band: "#221c18", onBand: "#f8ead0" },
    alt: { bg: "#1b1715", text: "#fff3df", sub: "#bfae99", accent: "#e8b42e", onAccent: "#1b1715", band: "#1b1715", onBand: "#fff3df" },
    heading: { family: "Noto Sans JP", weight: 900 },
    body: { family: "Noto Sans JP", weight: 500 },
    price: { family: "Noto Sans JP", weight: 900 },
    radius: 0.006,
    headingSpacing: 0,
  },
  {
    id: "ramen",
    label: "ラーメン・力強い",
    keywords: ["ラーメン", "らーめん", "インパクト", "力強", "ガッツリ", "がっつり", "餃子", "中華", "濃厚"],
    palette: { bg: "#121212", text: "#ffffff", sub: "#c4c4c4", accent: "#e63b2e", onAccent: "#ffffff", band: "#121212", onBand: "#ffffff" },
    alt: { bg: "#f3c23b", text: "#121212", sub: "#4a3f12", accent: "#121212", onAccent: "#f3c23b", band: "#121212", onBand: "#ffffff" },
    heading: { family: "Noto Sans JP", weight: 900 },
    body: { family: "Noto Sans JP", weight: 500 },
    price: { family: "Noto Sans JP", weight: 900 },
    radius: 0,
    headingSpacing: -20,
  },
  {
    id: "restaurant",
    label: "レストラン・上品",
    keywords: ["レストラン", "上品", "イタリアン", "フレンチ", "ビストロ", "ワイン", "洋食", "エレガント", "記念日", "ディナー"],
    palette: { bg: "#ffffff", text: "#1f2a33", sub: "#6b7680", accent: "#7b5c3a", onAccent: "#ffffff", band: "#1f2a33", onBand: "#ffffff" },
    alt: { bg: "#1f2a33", text: "#f4f1ea", sub: "#aeb6bd", accent: "#c8ab7a", onAccent: "#1f2a33", band: "#1f2a33", onBand: "#f4f1ea" },
    heading: { family: "Noto Serif JP", weight: 600 },
    body: { family: "Noto Sans JP", weight: 400 },
    price: { family: "Noto Serif JP", weight: 700 },
    radius: 0,
    headingSpacing: 100,
  },
  {
    id: "minimal",
    label: "ミニマル",
    keywords: ["ミニマル", "シンプル", "余白", "静か", "すっきり"],
    palette: { bg: "#ffffff", text: "#111111", sub: "#777777", accent: "#111111", onAccent: "#ffffff", band: "#ffffff", onBand: "#111111" },
    alt: { bg: "#f0f0f0", text: "#111111", sub: "#666666", accent: "#111111", onAccent: "#ffffff", band: "#111111", onBand: "#ffffff" },
    heading: { family: "Noto Sans JP", weight: 500 },
    body: { family: "Noto Sans JP", weight: 400 },
    price: { family: "Noto Sans JP", weight: 700 },
    radius: 0,
    headingSpacing: 60,
  },
  {
    id: "modern",
    label: "モダン",
    keywords: ["モダン", "スタイリッシュ", "都会", "現代", "クール", "先進"],
    palette: { bg: "#f2f2f0", text: "#111111", sub: "#5c5c5c", accent: "#ff5a1f", onAccent: "#ffffff", band: "#111111", onBand: "#ffffff" },
    alt: { bg: "#111111", text: "#f2f2f0", sub: "#a9a9a9", accent: "#ff5a1f", onAccent: "#ffffff", band: "#111111", onBand: "#f2f2f0" },
    heading: { family: "Zen Kaku Gothic New", weight: 900 },
    body: { family: "Zen Kaku Gothic New", weight: 400 },
    price: { family: "Zen Kaku Gothic New", weight: 900 },
    radius: 0,
    headingSpacing: -10,
  },
  {
    id: "retro",
    label: "レトロ",
    keywords: ["レトロ", "昭和", "喫茶", "純喫茶", "懐かし", "ノスタル", "大正"],
    palette: { bg: "#efe1c2", text: "#3a2d20", sub: "#7a6a56", accent: "#b8572a", onAccent: "#fff4e2", band: "#3a2d20", onBand: "#efe1c2" },
    alt: { bg: "#2f4f4f", text: "#f3e9d2", sub: "#c2b79f", accent: "#e0a53a", onAccent: "#2f4f4f", band: "#2f4f4f", onBand: "#f3e9d2" },
    heading: { family: "Shippori Mincho", weight: 800 },
    body: { family: "Noto Serif JP", weight: 500 },
    price: { family: "Shippori Mincho", weight: 800 },
    radius: 0.01,
    headingSpacing: 60,
  },
  {
    id: "pop",
    label: "ポップ・かわいい",
    keywords: ["ポップ", "かわいい", "可愛い", "明るい", "楽しい", "キッズ", "ファミリー", "子ども", "子供", "クレープ", "タピオカ"],
    palette: { bg: "#fff4e6", text: "#4a3b2f", sub: "#8c7a6b", accent: "#ff7a59", onAccent: "#ffffff", band: "#ff7a59", onBand: "#ffffff" },
    alt: { bg: "#ffe3ea", text: "#4a2f3b", sub: "#8c6b7a", accent: "#2e9e8f", onAccent: "#ffffff", band: "#2e9e8f", onBand: "#ffffff" },
    heading: { family: "M PLUS Rounded 1c", weight: 800 },
    body: { family: "M PLUS Rounded 1c", weight: 500 },
    price: { family: "M PLUS Rounded 1c", weight: 900 },
    radius: 0.03,
    headingSpacing: 20,
  },
];

export function findStyle(id: StyleId): StyleDef {
  return STYLES.find((s) => s.id === id) ?? STYLES[0];
}

/** Picks the style whose keywords best match the Japanese prompt. Defaults to "restaurant". */
export function detectStyle(prompt: string): StyleDef {
  let best: StyleDef | null = null;
  let bestScore = 0;
  for (const style of STYLES) {
    let score = 0;
    for (const kw of style.keywords) {
      const idx = prompt.indexOf(kw);
      if (idx >= 0) score += kw.length + (kw.length === 1 ? 0 : 2);
    }
    if (score > bestScore) {
      bestScore = score;
      best = style;
    }
  }
  return best ?? findStyle("restaurant");
}

export const COLOR_WORDS: { words: string[]; hex: string }[] = [
  { words: ["赤", "レッド", "朱"], hex: "#c8352b" },
  { words: ["青", "ブルー"], hex: "#1f5fa8" },
  { words: ["紺", "ネイビー"], hex: "#1f2a44" },
  { words: ["緑", "グリーン"], hex: "#2e7d4f" },
  { words: ["黒", "ブラック"], hex: "#111111" },
  { words: ["白", "ホワイト"], hex: "#ffffff" },
  { words: ["金", "ゴールド"], hex: "#c9a24a" },
  { words: ["茶", "ブラウン"], hex: "#6b4a2b" },
  { words: ["黄", "イエロー"], hex: "#f3c23b" },
  { words: ["オレンジ"], hex: "#f28c28" },
  { words: ["ピンク"], hex: "#e87ca0" },
  { words: ["紫", "パープル"], hex: "#6a4c93" },
  { words: ["グレー", "灰"], hex: "#8a8a8a" },
  { words: ["ベージュ", "生成り", "クリーム"], hex: "#f3ebdd" },
];

export function detectColor(text: string): string | null {
  for (const c of COLOR_WORDS) {
    if (c.words.some((w) => text.includes(w))) return c.hex;
  }
  return null;
}
