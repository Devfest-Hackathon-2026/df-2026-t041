"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import type { EditorController } from "./EditorController";

export const EditorContext = createContext<EditorController | null>(null);

/** Returns the controller and re-renders the caller whenever the editor state changes. */
export function useEditor(): EditorController {
  const ctrl = useContext(EditorContext);
  if (!ctrl) throw new Error("EditorContext missing");
  useSyncExternalStore(
    (cb) => ctrl.subscribe(cb),
    () => ctrl.version,
    () => ctrl.version,
  );
  return ctrl;
}
