import { z } from "zod";
import { NOT_CONNECTED_MESSAGE, currentProvider, runWithFallback } from "@/lib/ai/provider";


const bodySchema = z.object({
  shopName: z.string().max(60),
  productName: z.string().min(1).max(80),
  price: z.string().max(40),
  description: z.string().max(400),
  prompt: z.string().max(300),
  hasPhoto: z.boolean(),
  photoAspect: z.number().positive().optional(),
  canvasAspect: z.number().positive(),
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
    const { result: designs, provider } = await runWithFallback((p) => p.generate(parsed.data));
    return Response.json({ designs, provider: provider.label });
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI生成に失敗しました。";
    return Response.json({ error: `AI生成に失敗しました: ${message}` }, { status: 502 });
  }
}
