import { GoogleGenAI, ThinkingLevel, type ThinkingConfig } from "@google/genai";
import type { DesignBrief, DesignSpec, RefinePatch } from "../design/spec";
import { AI_TIMEOUT_MS, PATCH_JSON_SCHEMA, SPEC_JSON_SCHEMA, generatePrompt, parseDesigns, parseJson, parsePatch, refinePrompt } from "./shared";

/**
 * Server-only Gemini access, via either
 *  - the Gemini Developer API with GEMINI_API_KEY, or
 *  - Vertex AI with the runtime's service account (GOOGLE_GENAI_USE_VERTEXAI=true plus
 *    GOOGLE_CLOUD_PROJECT / GOOGLE_CLOUD_LOCATION), which needs no key at all on Cloud Run.
 * Credentials never reach the browser.
 */
function vertexEnabled(): boolean {
  return /^(1|true)$/i.test(process.env.GOOGLE_GENAI_USE_VERTEXAI ?? "");
}

export function geminiAvailable(): boolean {
  return Boolean(process.env.GEMINI_API_KEY) || (vertexEnabled() && Boolean(process.env.GOOGLE_CLOUD_PROJECT));
}

export function geminiModel(): string {
  return process.env.GEMINI_MODEL || "gemini-3-flash-preview";
}

function client() {
  const httpOptions = { timeout: AI_TIMEOUT_MS };
  if (vertexEnabled()) {
    return new GoogleGenAI({ vertexai: true, project: process.env.GOOGLE_CLOUD_PROJECT, location: process.env.GOOGLE_CLOUD_LOCATION || "global", httpOptions });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY が設定されていません。");
  return new GoogleGenAI({ apiKey, httpOptions });
}

/**
 * Gemini 3+ models think before answering by default, which can take longer than the request
 * timeout. Layout JSON needs little reasoning, so keep thinking low (older models ignore this).
 */
function thinkingConfig(): { thinkingConfig?: ThinkingConfig } {
  return /^gemini-([3-9]|\d{2,})/.test(geminiModel()) ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {};
}

/**
 * Constrained decoding with responseJsonSchema is very slow on Vertex AI for this schema (>150s,
 * versus ~12s without it), so Gemini gets plain JSON mode with the schema spelled out in the
 * prompt. Every element is validated and repaired server-side afterwards (see shared.ts).
 */
function schemaInstruction(schema: unknown): string {
  return `\n\nReturn ONLY JSON (no markdown) that conforms to this JSON Schema:\n${JSON.stringify(schema)}`;
}

export async function generateWithGemini(brief: DesignBrief): Promise<DesignSpec[]> {
  const schema = { type: "array", minItems: 3, maxItems: 3, items: SPEC_JSON_SCHEMA };
  const response = await client().models.generateContent({
    model: geminiModel(),
    contents: generatePrompt(brief) + schemaInstruction(schema),
    config: { responseMimeType: "application/json", temperature: 0.9, ...thinkingConfig() },
  });
  return parseDesigns(parseJson(response.text, "Gemini"), "Gemini", brief);
}

export async function refineWithGemini(current: DesignSpec, instruction: string): Promise<RefinePatch> {
  const response = await client().models.generateContent({
    model: geminiModel(),
    contents: refinePrompt(current, instruction) + schemaInstruction(PATCH_JSON_SCHEMA),
    config: { responseMimeType: "application/json", temperature: 0.4, ...thinkingConfig() },
  });
  return parsePatch(parseJson(response.text, "Gemini"), current);
}
