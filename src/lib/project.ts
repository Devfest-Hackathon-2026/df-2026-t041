import { StaticCanvas } from "fabric";
import { newProjectId, putProject, type Project, type ProjectBrief } from "./db";
import type { CanvasSize } from "./sizes";
import type { DesignSpec } from "./design/spec";
import { META_PROPS, loadSpecIntoCanvas } from "./design/fabricBridge";

/** Builds the fabric JSON for a spec offscreen and stores a new project. */
export async function createProjectFromSpec(args: { spec: DesignSpec; size: CanvasSize; brief: ProjectBrief; photoSrc?: string }): Promise<Project> {
  const { spec, size, brief, photoSrc } = args;
  const sc = new StaticCanvas(undefined, { width: size.width, height: size.height, renderOnAddRemove: false });
  try {
    await loadSpecIntoCanvas(sc, spec, size, { photoSrc });
    sc.renderAll();
    const canvasJson = sc.toObject(META_PROPS) as Record<string, unknown>;
    const thumbnail = sc.toDataURL({ format: "png", multiplier: Math.min(1, 320 / Math.max(size.width, size.height)) });
    const now = Date.now();
    const project: Project = {
      id: newProjectId(),
      name: brief.productName ? `${brief.productName}のビラ` : "無題のビラ",
      createdAt: now,
      updatedAt: now,
      size,
      brief,
      photoSrc,
      canvasJson,
      thumbnail,
      version: 1,
    };
    await putProject(project);
    return project;
  } finally {
    sc.dispose();
  }
}
