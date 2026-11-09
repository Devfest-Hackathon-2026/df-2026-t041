import type { DesignBrief, DesignSpec, RefinePatch } from "../design/spec";
import { designSpecSchema, refinePatchSchema } from "../design/spec";

export interface AiStatus {
  available: boolean;
  provider: "gemini" | "openai" | null;
  /** Human-readable provider name, e.g. "Gemini" / "OpenAI". */
  label: string | null;
  model: string | null;
}

export const AI_OFFLINE: AiStatus = { available: false, provider: null, label: null, model: null };

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

export async function fetchAiStatus(): Promise<AiStatus> {
  try {
    const res = await fetch("/api/ai/status", { cache: "no-store" });
    if (!res.ok) return AI_OFFLINE;
    return (await res.json()) as AiStatus;
  } catch {
    return AI_OFFLINE;
  }
}

/** Generated designs plus the label of the provider that actually produced them (may be a fallback). */
export async function aiGenerate(brief: DesignBrief): Promise<{ designs: DesignSpec[]; provider: string | null }> {
  const res = await fetch("/api/ai/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(brief) });
  if (!res.ok) throw new Error(await readError(res, `AI生成に失敗しました (HTTP ${res.status})`));
  const data = (await res.json()) as { designs: unknown[]; provider?: string };
  return { designs: data.designs.map((d) => designSpecSchema.parse(d)), provider: data.provider ?? null };
}

export async function aiRefine(current: DesignSpec, instruction: string, canvasAspect?: number): Promise<{ patch: RefinePatch; provider: string | null }> {
  const res = await fetch("/api/ai/refine", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ current, instruction, canvasAspect }) });
  if (!res.ok) throw new Error(await readError(res, `AI調整に失敗しました (HTTP ${res.status})`));
  const data = (await res.json()) as { patch: unknown; provider?: string };
  return { patch: refinePatchSchema.parse(data.patch), provider: data.provider ?? null };
}
