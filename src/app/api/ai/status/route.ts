import { connection } from "next/server";
import { currentProvider } from "@/lib/ai/provider";

export async function GET() {
  // Evaluated per request so the key can be provided at runtime rather than build time.
  await connection();
  const p = currentProvider();
  return Response.json(p ? { available: true, provider: p.id, label: p.label, model: p.model } : { available: false, provider: null, label: null, model: null });
}
