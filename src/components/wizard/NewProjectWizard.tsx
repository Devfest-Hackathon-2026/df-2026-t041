"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ImagePlus, Sparkles, X } from "lucide-react";
import { SIZE_PRESETS, customSize, type CanvasSize } from "@/lib/sizes";
import { readImageFile } from "@/lib/image";
import { generateDesigns } from "@/lib/design/generator";
import type { DesignBrief, DesignSpec } from "@/lib/design/spec";
import { FontSelect } from "@/components/FontSelect";
import { AI_OFFLINE, aiGenerate, fetchAiStatus, type AiStatus } from "@/lib/ai/client";
import { Field, NumberInput, Toast } from "@/components/ui";
import { ProposalGrid } from "./ProposalGrid";
import { createProjectFromSpec } from "@/lib/project";

type Step = 1 | 2 | 3;

export function NewProjectWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [size, setSize] = useState<CanvasSize>(SIZE_PRESETS[0]);
  const [custom, setCustom] = useState({ width: 1200, height: 1600 });
  const [shopName, setShopName] = useState("");
  const [productName, setProductName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [fontFamily, setFontFamily] = useState("");
  const [photo, setPhoto] = useState<{ dataUrl: string; width: number; height: number } | null>(null);
  const [ai, setAi] = useState<AiStatus>(AI_OFFLINE);
  const [useAi, setUseAi] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [designs, setDesigns] = useState<DesignSpec[] | null>(null);
  const [source, setSource] = useState<"ai" | "local">("local");
  const [aiUsed, setAiUsed] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; kind: "error" | "info" } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void fetchAiStatus().then((s) => {
      setAi(s);
      setUseAi(s.available);
    });
  }, []);

  const brief = (): DesignBrief => ({
    shopName: shopName.trim(),
    productName: productName.trim(),
    price: price.trim(),
    description: description.trim(),
    prompt: prompt.trim(),
    hasPhoto: Boolean(photo),
    photoAspect: photo ? photo.width / photo.height : undefined,
    canvasAspect: size.width / size.height,
    fontFamily: fontFamily || undefined,
  });

  const onPhoto = async (file: File) => {
    try {
      setBusy("写真を読み込んでいます…");
      setPhoto(await readImageFile(file));
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : "写真を読み込めませんでした。", kind: "error" });
    } finally {
      setBusy(null);
    }
  };

  const generate = async () => {
    if (!productName.trim()) {
      setToast({ message: "商品名を入力してください。", kind: "error" });
      return;
    }
    setStep(3);
    setDesigns(null);
    const b = brief();
    if (useAi && ai.available) {
      try {
        setBusy(`${ai.label}がデザイン案を考えています…`);
        const result = await aiGenerate(b);
        setDesigns(result.designs);
        setAiUsed(result.provider ?? ai.label);
        setSource("ai");
        setBusy(null);
        return;
      } catch (e) {
        setToast({ message: `${e instanceof Error ? e.message : "AI生成に失敗しました。"} 内蔵のデザイン生成で続行します。`, kind: "error" });
      }
    }
    setBusy("デザイン案を作成しています…");
    setDesigns(generateDesigns(b));
    setSource("local");
    setBusy(null);
  };

  const choose = async (spec: DesignSpec) => {
    try {
      setBusy("プロジェクトを作成しています…");
      const project = await createProjectFromSpec({
        spec,
        size,
        brief: { shopName: shopName.trim(), productName: productName.trim(), price: price.trim(), description: description.trim(), prompt: prompt.trim(), fontFamily: fontFamily || undefined },
        photoSrc: photo?.dataUrl,
      });
      router.push(`/editor/${project.id}`);
    } catch (e) {
      setBusy(null);
      setToast({ message: `プロジェクトを作成できませんでした: ${e instanceof Error ? e.message : String(e)}`, kind: "error" });
    }
  };

  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 px-6 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/" className="ui-btn-icon" aria-label="ホームへ戻る">
          <ArrowLeft size={16} />
        </Link>
        <h1 className="text-[18px] font-bold">新しいビラを作成</h1>
        <ol className="ml-auto flex items-center gap-2 text-[12px] text-muted">
          {["用途・サイズ", "内容と写真", "デザイン案を選ぶ"].map((label, i) => (
            <li key={label} className={`flex items-center gap-1.5 ${step === i + 1 ? "font-semibold text-fg" : ""}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${step >= i + 1 ? "bg-accent text-white" : "bg-gray-200"}`}>{i + 1}</span>
              {label}
            </li>
          ))}
        </ol>
      </div>

      {step === 1 && (
        <section className="rounded-lg border border-border bg-panel p-6">
          <h2 className="mb-4 text-[14px] font-semibold">用途・サイズを選択</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {SIZE_PRESETS.map((p) => (
              <button
                key={p.preset}
                data-testid={`size-${p.preset}`}
                onClick={() => setSize(p)}
                className={`flex items-center gap-3 rounded-md border p-3 text-left transition-colors ${size.preset === p.preset ? "border-accent bg-blue-50" : "border-border hover:bg-gray-50"}`}
              >
                <div className="flex h-12 w-12 items-center justify-center">
                  <div className="border border-gray-500 bg-white" style={{ width: p.width >= p.height ? 40 : (40 * p.width) / p.height, height: p.height >= p.width ? 40 : (40 * p.height) / p.width }} />
                </div>
                <div>
                  <div className="text-[13px] font-medium">{p.label}</div>
                  <div className="text-[11px] text-muted">{p.widthMm ? `${p.widthMm} × ${p.heightMm} mm（印刷用）` : `${p.width} × ${p.height} px（SNS用）`}</div>
                </div>
              </button>
            ))}
            <div className={`rounded-md border p-3 ${size.preset === "custom" ? "border-accent bg-blue-50" : "border-border"}`}>
              <div className="mb-2 text-[13px] font-medium">カスタムサイズ（px）</div>
              <div className="flex items-center gap-2">
                <NumberInput value={custom.width} min={200} max={6000} onChange={(v) => setCustom((c) => ({ ...c, width: v }))} ariaLabel="カスタム幅" />
                <span className="text-muted">×</span>
                <NumberInput value={custom.height} min={200} max={6000} onChange={(v) => setCustom((c) => ({ ...c, height: v }))} ariaLabel="カスタム高さ" />
                <button className="ui-btn shrink-0" onClick={() => setSize(customSize(custom.width, custom.height))}>
                  使用
                </button>
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button className="ui-btn-primary" data-testid="next-step" onClick={() => setStep(2)}>
              次へ：内容を入力
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="grid gap-6 md:grid-cols-[1fr_320px]">
          <div className="rounded-lg border border-border bg-panel p-6">
            <h2 className="mb-4 text-[14px] font-semibold">内容を入力</h2>
            <div className="grid gap-4">
              <Field label="商品名（必須）">
                <input className="ui-input" data-testid="input-product" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="例：唐揚げ定食" maxLength={80} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="価格">
                  <input className="ui-input" data-testid="input-price" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="例：780円 / 780" maxLength={40} />
                </Field>
                <Field label="店名">
                  <input className="ui-input" data-testid="input-shop" value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="例：和食処 さくら" maxLength={60} />
                </Field>
              </div>
              <Field label="説明文">
                <textarea className="ui-input h-20 resize-none py-1.5" data-testid="input-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="例：国産鶏もも肉を秘伝のタレに漬け込み、注文を受けてから揚げます。" maxLength={400} />
              </Field>
              <Field label="雰囲気の指示（日本語で自由に）">
                <textarea className="ui-input h-20 resize-none py-1.5" data-testid="input-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="例：落ち着いた和食店の雰囲気。料理写真を大きく、値段は目立たせて。" maxLength={300} />
              </Field>
              <div className="flex flex-wrap gap-1.5">
                {["落ち着いた和食店の雰囲気", "高級な焼肉店っぽく", "今風のカフェらしく", "元気な居酒屋", "写真を大きく", "値段を目立たせて"].map((t) => (
                  <button key={t} className="rounded-md border border-border bg-white px-2 py-1 text-[12px] text-muted hover:bg-gray-50" onClick={() => setPrompt((p) => (p ? `${p}。${t}` : t))}>
                    {t}
                  </button>
                ))}
              </div>
              <Field label="フォント">
                <FontSelect value={fontFamily} onChange={setFontFamily} allowAuto testId="input-font" preview={productName.trim() || "唐揚げ定食 780円"} />
              </Field>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-border bg-panel p-5">
              <h2 className="mb-3 text-[14px] font-semibold">料理写真</h2>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                data-testid="photo-input"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onPhoto(f);
                  e.target.value = "";
                }}
              />
              {photo ? (
                <div className="relative overflow-hidden rounded-md border border-border bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.dataUrl} alt="アップロードした料理写真" className="max-h-56 w-full object-contain" data-testid="photo-preview" />
                  <button className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md bg-white/90 shadow" aria-label="写真を削除" onClick={() => setPhoto(null)}>
                    <X size={14} />
                  </button>
                  <div className="px-2 py-1 text-[11px] text-muted">
                    {photo.width} × {photo.height} px
                  </div>
                </div>
              ) : (
                <button className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-gray-300 text-muted hover:bg-gray-50" onClick={() => fileRef.current?.click()}>
                  <ImagePlus size={22} />
                  <span>PCから画像をアップロード</span>
                  <span className="text-[11px]">JPEG / PNG / WebP、20MBまで</span>
                </button>
              )}
              <p className="mt-2 text-[11px] text-muted">写真がない場合は、あとから編集画面で追加できる枠付きのデザインを作成します。</p>
            </div>
            <div className="rounded-lg border border-border bg-panel p-5">
              <h2 className="mb-2 text-[14px] font-semibold">デザイン生成</h2>
              {ai.available ? (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} />
                  <span>{ai.label}（{ai.model}）でレイアウトを提案</span>
                </label>
              ) : (
                <p className="text-[12px] text-muted" data-testid="ai-unavailable">
                  AI機能は未接続です（サーバーにGEMINI_API_KEY / OPENAI_API_KEYが未設定）。内蔵のデザイン生成を使用します。
                </p>
              )}
            </div>
            <div className="flex justify-between">
              <button className="ui-btn" onClick={() => setStep(1)}>
                戻る
              </button>
              <button className="ui-btn-primary" data-testid="generate" onClick={() => void generate()} disabled={busy !== null}>
                <Sparkles size={15} /> デザイン案を3つ作成
              </button>
            </div>
          </div>
        </section>
      )}

      {step === 3 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-[14px] font-semibold">デザイン案を選ぶ</h2>
              <p className="text-[12px] text-muted">{designs ? (source === "ai" ? `${aiUsed ?? ai.label}が提案した3案です。` : "内蔵のデザイン生成による3案です。") : ""}選んだ案は編集画面で自由に調整できます。</p>
            </div>
            <div className="flex gap-2">
              <button className="ui-btn" onClick={() => setStep(2)} disabled={busy !== null}>
                内容を修正
              </button>
              <button className="ui-btn" onClick={() => void generate()} disabled={busy !== null}>
                別の案を作る
              </button>
            </div>
          </div>
          {designs ? (
            <ProposalGrid designs={designs} size={size} photoSrc={photo?.dataUrl} onChoose={(d) => void choose(d)} disabled={busy !== null} />
          ) : (
            <p className="py-12 text-center text-muted">{busy}</p>
          )}
        </section>
      )}

      {busy && step !== 3 && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-white/60">
          <div className="rounded-md bg-gray-900 px-4 py-2 text-white">{busy}</div>
        </div>
      )}
      {toast && <Toast message={toast.message} kind={toast.kind} onClose={() => setToast(null)} />}
    </main>
  );
}
