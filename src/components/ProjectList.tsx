"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { FolderOpen, Plus, Trash2, Clock, Ruler, Sparkles, Download } from "lucide-react";
import { deleteProject, listProjects, parseProjectFile, putProject, type Project } from "@/lib/db";
import { Toast } from "./ui";

export function ProjectList() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [toast, setToast] = useState<{ message: string; kind: "error" | "info" } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    try {
      setProjects(await listProjects());
    } catch (e) {
      setProjects([]);
      setToast({ message: `保存データを読み込めませんでした: ${e instanceof Error ? e.message : String(e)}`, kind: "error" });
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void reload(), 0);
    return () => clearTimeout(t);
  }, [reload]);

  const onImport = async (file: File) => {
    try {
      const text = await file.text();
      const project = parseProjectFile(text);
      const existing = projects?.find((p) => p.id === project.id);
      if (existing && !window.confirm(`同じIDのプロジェクト「${existing.name}」があります。上書きしますか？`)) return;
      await putProject(project);
      router.push(`/editor/${project.id}`);
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : "読み込みに失敗しました。", kind: "error" });
    }
  };

  const onDelete = async (p: Project) => {
    if (!window.confirm(`「${p.name}」を削除しますか？この操作は取り消せません。`)) return;
    try {
      await deleteProject(p.id);
      await reload();
      setToast({ message: "削除しました。", kind: "info" });
    } catch (e) {
      setToast({ message: `削除に失敗しました: ${e instanceof Error ? e.message : String(e)}`, kind: "error" });
    }
  };

  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 px-6 py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">ビラ・POPメーカー</h1>
          <p className="mt-1 text-[13px] text-muted">料理写真と短い日本語の指示から、印刷・SNS用のビラを作成します。</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            data-testid="import-project-input"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImport(f);
              e.target.value = "";
            }}
          />
          <button className="ui-btn" onClick={() => fileRef.current?.click()}>
            <FolderOpen size={15} /> プロジェクトファイルを開く
          </button>
          <Link href="/new" className="ui-btn-primary" data-testid="new-project">
            <Plus size={15} /> 新しいビラを作成
          </Link>
        </div>
      </header>

      <ol className="mb-8 grid gap-3 sm:grid-cols-3" aria-label="使い方" data-testid="how-it-works">
        {[
          { icon: <Ruler size={16} />, title: "用途とサイズを選ぶ", body: "A4・A5の印刷用やInstagram用など" },
          { icon: <Sparkles size={16} />, title: "写真と一言でAIが3案を提案", body: "商品名・価格と「落ち着いた和食店っぽく」などの指示から" },
          { icon: <Download size={16} />, title: "自由に編集して書き出し", body: "日本語で「値段を大きく」と頼むこともできます。PNG・PDFで保存" },
        ].map((s, i) => (
          <li key={s.title} className="flex gap-3 rounded-lg border border-border bg-panel p-3.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">{s.icon}</span>
            <div>
              <div className="text-[13px] font-semibold">
                {i + 1}. {s.title}
              </div>
              <div className="mt-0.5 text-[12px] leading-relaxed text-muted">{s.body}</div>
            </div>
          </li>
        ))}
      </ol>

      {projects === null ? (
        <p className="text-muted">読み込み中…</p>
      ) : projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-panel p-12 text-center">
          <p className="text-[14px] font-medium">まだプロジェクトがありません</p>
          <p className="mt-1 text-muted">「新しいビラを作成」から始めてください。作成したビラはこのブラウザに保存されます。</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4" data-testid="project-list">
          {projects.map((p) => (
            <li key={p.id} className="group relative overflow-hidden rounded-lg border border-border bg-panel transition-shadow hover:shadow-md">
              <Link href={`/editor/${p.id}`} className="block" data-testid="project-card">
                <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-gray-100">
                  {p.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.thumbnail} alt="" className="max-h-full max-w-full object-contain shadow-sm" />
                  ) : (
                    <span className="text-muted">プレビューなし</span>
                  )}
                </div>
                <div className="px-3 py-2.5">
                  <div className="truncate text-[13px] font-medium">{p.name}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
                    <Clock size={11} /> {new Date(p.updatedAt).toLocaleString("ja-JP")} · {p.size.label}
                  </div>
                </div>
              </Link>
              <button
                className="absolute right-2 top-2 hidden h-7 w-7 items-center justify-center rounded-md bg-white/90 text-muted shadow hover:text-danger group-hover:flex [@media(hover:none)]:flex"
                aria-label="削除"
                onClick={() => void onDelete(p)}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {toast && <Toast message={toast.message} kind={toast.kind} onClose={() => setToast(null)} />}
    </main>
  );
}
