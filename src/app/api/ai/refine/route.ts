import { z } from "zod";
import { resolvePatchOverlaps } from "@/lib/ai/shared";
import { NOT_CONNECTED_MESSAGE, currentProvider, runWithFallback } from "@/lib/ai/provider";
import { designSpecSchema } from "@/lib/design/spec";


const bodySchema = z.object({
  current: designSpecSchema,
  instruction: z.string().min(1).max(300),
  /** Canvas width / height, used to keep edited texts from overlapping. */
  canvasAspect: z.number().positive().optional(),
});

export async function POST(req: Request) {
  if (!currentProvider()) {
    return Response.json({ error: NOT_CONNECTED_MESSAGE }, { status: 503 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "リクエストの形式が不正です。" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "入力内容が不正です。", details: parsed.error.issues }, { status: 400 });
  try {
    const { result: raw, provider } = await runWithFallback((p) => p.refine(parsed.data.current, parsed.data.instruction));
    const patch = parsed.data.canvasAspect ? resolvePatchOverlaps(parsed.data.current, raw, parsed.data.canvasAspect) : raw;
    return Response.json({ patch, provider: provider.label });
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI調整に失敗しました。";
    return Response.json({ error: `AI調整に失敗しました: ${message}` }, { status: 502 });
  }
}
