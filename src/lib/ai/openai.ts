import OpenAI from "openai";
import type { DesignBrief, DesignSpec, RefinePatch } from "../design/spec";
import { AI_TIMEOUT_MS, PATCH_JSON_SCHEMA, SPEC_JSON_SCHEMA, generatePrompt, parseDesigns, parseJson, parsePatch, refinePrompt } from "./shared";

/** Server-only OpenAI access. The key never leaves the server. */
export function openaiAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function openaiModel(): string {
  return process.env.OPENAI_MODEL || "gpt-6.1-terra";
}

function client() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY が設定されていません。");
  return new OpenAI({ apiKey, timeout: AI_TIMEOUT_MS, maxRetries: 1 });
}

async function completeJson(prompt: string, schemaName: string, schema: Record<string, unknown>, temperature: number): Promise<unknown> {
  const model = openaiModel();
  const res = await client().chat.completions.create({
    model,
    // GPT-5 family and reasoning models reject a custom temperature; only the GPT-4 family accepts it.
    ...(model.startsWith("gpt-4") ? { temperature } : {}),
    messages: [{ role: "user", content: prompt }],
    // Non-strict schema: OpenAI strict mode requires every property to be required, which does not fit optional element props.
    response_format: { type: "json_schema", json_schema: { name: schemaName, schema, strict: false } },
  });
  const choice = res.choices[0];
  if (choice?.finish_reason === "length") throw new Error("OpenAIの応答が長すぎて途中で打ち切られました。");
  return parseJson(choice?.message?.content, "OpenAI");
}

export async function generateWithOpenAI(brief: DesignBrief): Promise<DesignSpec[]> {
  // Top-level must be an object for the json_schema response format.
  const schema = {
    type: "object",
    properties: { designs: { type: "array", minItems: 3, maxItems: 3, items: SPEC_JSON_SCHEMA } },
    required: ["designs"],
  };
  const parsed = await completeJson(`${generatePrompt(brief)}\n\nReturn {"designs": [spec, spec, spec]}.`, "flyer_designs", schema, 0.9);
  return parseDesigns(parsed, "OpenAI", brief);
}

export async function refineWithOpenAI(current: DesignSpec, instruction: string): Promise<RefinePatch> {
  const parsed = await completeJson(refinePrompt(current, instruction), "flyer_patch", PATCH_JSON_SCHEMA, 0.4);
  return parsePatch(parsed, current);
}
