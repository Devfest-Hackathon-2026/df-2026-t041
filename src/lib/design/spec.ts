import { z } from "zod";
import { FONT_FAMILIES } from "../fonts";

/**
 * A design is a list of editable elements positioned in normalized coordinates
 * (0..1 of the canvas width/height) so the same spec works for every size.
 */
export const TEXT_ROLES = ["shop", "product", "price", "description", "tagline", "custom"] as const;
export type TextRole = (typeof TEXT_ROLES)[number];

const hex = z.string().regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8}|[0-9a-fA-F]{3})$/);
const unit = z.number().min(-0.5).max(1.5);

export const specTextSchema = z.object({
  kind: z.literal("text"),
  id: z.string().min(1),
  role: z.enum(TEXT_ROLES),
  text: z.string(),
  x: unit,
  y: unit,
  w: z.number().min(0.02).max(1.5),
  fontFamily: z.enum(FONT_FAMILIES as [string, ...string[]]),
  fontWeight: z.number().int().min(100).max(900),
  /** Font size as a fraction of canvas width. */
  fontSize: z.number().min(0.005).max(0.6),
  fill: hex,
  align: z.enum(["left", "center", "right"]),
  lineHeight: z.number().min(0.6).max(3).default(1.2),
  /** Letter spacing in 1/1000 em. */
  charSpacing: z.number().min(-200).max(1000).default(0),
  angle: z.number().min(-180).max(180).default(0),
  opacity: z.number().min(0).max(1).default(1),
});

export const specImageSchema = z.object({
  kind: z.literal("image"),
  id: z.string().min(1),
  role: z.literal("photo"),
  x: unit,
  y: unit,
  w: z.number().min(0.02).max(1.5),
  h: z.number().min(0.02).max(1.5),
  /** Corner radius as a fraction of canvas width. */
  radius: z.number().min(0).max(0.5).default(0),
  opacity: z.number().min(0).max(1).default(1),
  angle: z.number().min(-180).max(180).default(0),
});

export const specRectSchema = z.object({
  kind: z.literal("rect"),
  id: z.string().min(1),
  role: z.enum(["decor", "photo-placeholder", "custom"]).default("decor"),
  x: unit,
  y: unit,
  w: z.number().min(0).max(1.5),
  h: z.number().min(0).max(1.5),
  fill: hex,
  radius: z.number().min(0).max(0.5).default(0),
  opacity: z.number().min(0).max(1).default(1),
  stroke: hex.optional(),
  strokeWidth: z.number().min(0).max(0.1).default(0),
  angle: z.number().min(-180).max(180).default(0),
});

export const specEllipseSchema = z.object({
  kind: z.literal("ellipse"),
  id: z.string().min(1),
  role: z.enum(["decor", "custom"]).default("decor"),
  x: unit,
  y: unit,
  w: z.number().min(0).max(1.5),
  h: z.number().min(0).max(1.5),
  fill: hex,
  opacity: z.number().min(0).max(1).default(1),
  stroke: hex.optional(),
  strokeWidth: z.number().min(0).max(0.1).default(0),
  angle: z.number().min(-180).max(180).default(0),
});

export const specLineSchema = z.object({
  kind: z.literal("line"),
  id: z.string().min(1),
  role: z.enum(["decor", "custom"]).default("decor"),
  x1: unit,
  y1: unit,
  x2: unit,
  y2: unit,
  stroke: hex,
  /** Stroke width as a fraction of canvas width. */
  strokeWidth: z.number().min(0.0005).max(0.1),
  opacity: z.number().min(0).max(1).default(1),
});

export const specElementSchema = z.discriminatedUnion("kind", [
  specTextSchema,
  specImageSchema,
  specRectSchema,
  specEllipseSchema,
  specLineSchema,
]);

export const designSpecSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(40),
  description: z.string().max(200).default(""),
  background: hex,
  elements: z.array(specElementSchema).min(1).max(40),
});

export type SpecText = z.infer<typeof specTextSchema>;
export type SpecImage = z.infer<typeof specImageSchema>;
export type SpecRect = z.infer<typeof specRectSchema>;
export type SpecEllipse = z.infer<typeof specEllipseSchema>;
export type SpecLine = z.infer<typeof specLineSchema>;
export type SpecElement = z.infer<typeof specElementSchema>;
export type DesignSpec = z.infer<typeof designSpecSchema>;

/** A partial update returned by the refine step. Only listed ids change. */
export const refinePatchSchema = z.object({
  summary: z.string().max(200),
  background: hex.optional(),
  changes: z
    .array(
      z.object({
        id: z.string().min(1),
        set: z
          .object({
            text: z.string().optional(),
            x: unit.optional(),
            y: unit.optional(),
            w: z.number().min(0.01).max(1.5).optional(),
            h: z.number().min(0.01).max(1.5).optional(),
            fontFamily: z.enum(FONT_FAMILIES as [string, ...string[]]).optional(),
            fontWeight: z.number().int().min(100).max(900).optional(),
            fontSize: z.number().min(0.005).max(0.6).optional(),
            fill: hex.optional(),
            align: z.enum(["left", "center", "right"]).optional(),
            lineHeight: z.number().min(0.6).max(3).optional(),
            charSpacing: z.number().min(-200).max(1000).optional(),
            opacity: z.number().min(0).max(1).optional(),
            radius: z.number().min(0).max(0.5).optional(),
            stroke: hex.optional(),
            strokeWidth: z.number().min(0).max(0.1).optional(),
            angle: z.number().min(-180).max(180).optional(),
          })
          .strict(),
      }),
    )
    .max(40),
  add: z.array(specElementSchema).max(10).default([]),
  remove: z.array(z.string()).max(40).default([]),
});
export type RefinePatch = z.infer<typeof refinePatchSchema>;

export interface DesignBrief {
  shopName: string;
  productName: string;
  price: string;
  description: string;
  prompt: string;
  hasPhoto: boolean;
  /** width / height of the uploaded photo, when present */
  photoAspect?: number;
  /** Canvas aspect ratio width / height */
  canvasAspect: number;
}

/** Formats a price string for display without inventing information. */
export function formatPrice(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^[0-9,]+$/.test(t)) return `${t}円`;
  return t;
}

/** Flyer copy carries no 、。 : sentences break onto new lines instead. */
export function stripPunctuation(text: string): string {
  return text
    .replace(/[。．]/g, "\n")
    .replace(/[、，]/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}
