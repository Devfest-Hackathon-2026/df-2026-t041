import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { CanvasSize } from "./sizes";

export interface ProjectBrief {
  shopName: string;
  productName: string;
  price: string;
  description: string;
  prompt: string;
  /** Font family chosen in the wizard, if any. */
  fontFamily?: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  size: CanvasSize;
  brief: ProjectBrief;
  /** Original uploaded photo (data URL) so it can be re-fitted when layouts change. */
  photoSrc?: string;
  /** fabric.js canvas JSON including custom properties. */
  canvasJson: Record<string, unknown>;
  /** Small PNG data URL for the project list. */
  thumbnail?: string;
  version: 1;
}

interface FlyerDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
    indexes: { updatedAt: number };
  };
}

let dbPromise: Promise<IDBPDatabase<FlyerDB>> | null = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<FlyerDB>("flyer-maker", 1, {
      upgrade(db) {
        const store = db.createObjectStore("projects", { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      },
    });
  }
  return dbPromise;
}

export async function listProjects(): Promise<Project[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("projects", "updatedAt");
  return all.reverse();
}

export async function getProject(id: string): Promise<Project | undefined> {
  const db = await getDb();
  return db.get("projects", id);
}

export async function putProject(project: Project): Promise<void> {
  const db = await getDb();
  await db.put("projects", project);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("projects", id);
}

export function newProjectId(): string {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Validates an imported project file. Throws with a Japanese message on failure. */
export function parseProjectFile(text: string): Project {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("JSONとして読み込めませんでした。");
  }
  if (!data || typeof data !== "object") throw new Error("プロジェクトファイルの形式が不正です。");
  const p = data as Partial<Project>;
  if (p.version !== 1 || typeof p.id !== "string" || !p.size || !p.canvasJson || typeof p.canvasJson !== "object") {
    throw new Error("このアプリのプロジェクトファイルではありません。");
  }
  if (typeof p.size.width !== "number" || typeof p.size.height !== "number") throw new Error("サイズ情報が不正です。");
  return {
    id: p.id,
    name: typeof p.name === "string" ? p.name : "無題",
    createdAt: typeof p.createdAt === "number" ? p.createdAt : Date.now(),
    updatedAt: Date.now(),
    size: p.size,
    brief: p.brief ?? { shopName: "", productName: "", price: "", description: "", prompt: "" },
    photoSrc: typeof p.photoSrc === "string" ? p.photoSrc : undefined,
    canvasJson: p.canvasJson as Record<string, unknown>,
    thumbnail: typeof p.thumbnail === "string" ? p.thumbnail : undefined,
    version: 1,
  };
}
