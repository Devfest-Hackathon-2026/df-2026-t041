import { Suspense } from "react";
import { EditorPage } from "@/components/editor/EditorPage";

export default function Page() {
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center text-muted">プロジェクトを読み込んでいます…</div>}>
      <EditorPage />
    </Suspense>
  );
}
