import type { DesignBrief, DesignSpec, RefinePatch } from "../design/spec";
import { geminiAvailable, geminiModel, generateWithGemini, refineWithGemini } from "./gemini";
import { generateWithOpenAI, openaiAvailable, openaiModel, refineWithOpenAI } from "./openai";
import { friendlyAiError } from "./shared";

export type ProviderId = "gemini" | "openai";

export interface Provider {
  id: ProviderId;
  label: string;
  model: string;
  generate(brief: DesignBrief): Promise<DesignSpec[]>;
  refine(current: DesignSpec, instruction: string): Promise<RefinePatch>;
}

export const NOT_CONNECTED_MESSAGE = "AI機能は未接続です（サーバーにGEMINI_API_KEYまたはOPENAI_API_KEYが設定されていません）。";

function gemini(): Provider | null {
  return geminiAvailable() ? { id: "gemini", label: "Gemini", model: geminiModel(), generate: generateWithGemini, refine: refineWithGemini } : null;
}
function openai(): Provider | null {
  return openaiAvailable() ? { id: "openai", label: "OpenAI", model: openaiModel(), generate: generateWithOpenAI, refine: refineWithOpenAI } : null;
}

/**
 * Providers to try, in order. AI_PROVIDER=gemini|openai forces exactly one (unavailable if its
 * key is missing); otherwise every provider with a key is used, Gemini first, the rest as fallbacks.
 */
export function providerChain(): Provider[] {
  const forced = process.env.AI_PROVIDER?.toLowerCase();
  if (forced === "gemini") return [gemini()].filter((p): p is Provider => p !== null);
  if (forced === "openai") return [openai()].filter((p): p is Provider => p !== null);
  return [gemini(), openai()].filter((p): p is Provider => p !== null);
}

/** The primary provider (what the UI reports), or null when AI is not connected. */
export function currentProvider(): Provider | null {
  return providerChain()[0] ?? null;
}

/**
 * Runs `task` on each provider in turn until one succeeds. Returns the result and the provider
 * that produced it; throws a short Japanese message when every provider failed.
 */
export async function runWithFallback<T>(task: (p: Provider) => Promise<T>): Promise<{ result: T; provider: Provider }> {
  const chain = providerChain();
  if (chain.length === 0) throw new Error(NOT_CONNECTED_MESSAGE);
  let lastError: unknown;
  for (const p of chain) {
    try {
      return { result: await task(p), provider: p };
    } catch (e) {
      lastError = e;
      console.warn(`[ai] ${p.label} (${p.model}) failed:`, e instanceof Error ? e.message.slice(0, 300) : e);
    }
  }
  throw new Error(friendlyAiError(lastError));
}
