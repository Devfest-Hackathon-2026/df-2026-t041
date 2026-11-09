"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getProject, type Project } from "@/lib/db";
import { EditorShell } from "./EditorShell";

export function EditorPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [state, setState] = useState<{ status: "loading" } | { status: "missing" } | { status: "error"; message: string } | { status: "ok"; project: Project }>({ status: "loading" });

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getProject(id)
      .then((p) => {
        if (cancelled) return;
        setState(p ? { status: "ok", project: p } : { status: "missing" });
      })
      .catch((e) => !cancelled && setState({ status: "error", message: e instanceof Error ? e.message : String(e) }));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.status === "loading") return <div className="flex flex-1 items-center justify-center text-muted">プロジェクトを読み込んでいます…</div>;
  if (state.status === "missing")
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <p>プロジェクトが見つかりません。</p>
        <Link href="/" className="ui-btn">
          ホームへ戻る
        </Link>
      </div>
    );
  if (state.status === "error")
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <p className="text-danger">読み込みエラー: {state.message}</p>
        <Link href="/" className="ui-btn">
          ホームへ戻る
        </Link>
      </div>
    );
  return <EditorShell key={state.project.id} project={state.project} />;
}
