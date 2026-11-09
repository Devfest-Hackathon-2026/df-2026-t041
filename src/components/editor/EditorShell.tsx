"use client";

import { useEffect, useMemo } from "react";
import type { Project } from "@/lib/db";
import { EditorController } from "./EditorController";
import { EditorContext, useEditor } from "./EditorContext";
import { TopBar } from "./TopBar";
import { LeftPanel } from "./LeftPanel";
import { RightPanel } from "./RightPanel";
import { CanvasStage } from "./CanvasStage";
import { Toast } from "../ui";

export function EditorShell({ project }: { project: Project }) {
  const ctrl = useMemo(() => new EditorController(project), [project]);
  useEffect(() => {
    // Exposed for end-to-end tests and debugging.
    (window as unknown as { __flyerEditor?: EditorController }).__flyerEditor = ctrl;
    return () => {
      delete (window as unknown as { __flyerEditor?: EditorController }).__flyerEditor;
    };
  }, [ctrl]);
  return (
    <EditorContext.Provider value={ctrl}>
      <EditorLayout />
    </EditorContext.Provider>
  );
}

function EditorLayout() {
  const ed = useEditor();
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (ed.saveState === "dirty" || ed.saveState === "saving") {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [ed]);
  return (
    <div className="flex h-screen flex-col overflow-hidden" data-testid="editor" data-ready={ed.ready ? "true" : "false"}>
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <LeftPanel />
        <CanvasStage />
        <RightPanel />
      </div>
      {ed.busy && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center">
          <div className="rounded-md bg-gray-900/90 px-4 py-2 text-[13px] text-white shadow-lg" role="status">
            {ed.busy}
          </div>
        </div>
      )}
      {ed.notice && <Toast key={ed.notice.id} message={ed.notice.message} kind={ed.notice.kind} onClose={() => ed.clearNotice()} />}
    </div>
  );
}
