import { test, expect } from "@playwright/test";
import path from "node:path";
import { OUT_DIR, canvasPoint, createProject, editorState, selectByLayerName } from "./helpers";

/** Captures the main screens for visual review and checks in-canvas text editing. */
test("editor screens render and in-canvas double-click editing works", async ({ page }) => {
  await page.goto("/new");
  await page.screenshot({ path: path.join(OUT_DIR, "screen-wizard-size.png") });
  await createProject(page, {
    preset: "a4-portrait",
    product: "唐揚げ定食",
    price: "780円",
    shop: "和食処 さくら",
    description: "国産鶏もも肉を秘伝のタレに漬け込み、注文を受けてから揚げます。",
    prompt: "落ち着いた和食店の雰囲気。料理写真を大きく、値段は目立たせて。",
    choose: 1,
  });
  await page.screenshot({ path: path.join(OUT_DIR, "screen-editor.png") });
  await selectByLayerName(page, "価格");
  await page.screenshot({ path: path.join(OUT_DIR, "screen-editor-selected.png") });
  await page.getByTestId("tab-ai").click();
  await page.screenshot({ path: path.join(OUT_DIR, "screen-editor-ai.png") });

  // double-click the product name on the canvas and type
  await page.keyboard.press("Escape");
  const prod = (await editorState(page)).objects.find((o) => o.role === "product")!;
  const pt = await canvasPoint(page, prod.bl + prod.w / 2, prod.bt + prod.h / 2);
  await page.mouse.dblclick(pt.x, pt.y);
  await page.keyboard.press("Meta+a");
  await page.keyboard.type("特製唐揚げ定食");
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await editorState(page)).objects.find((o) => o.role === "product")?.text).toBe("特製唐揚げ定食");
  await page.screenshot({ path: path.join(OUT_DIR, "screen-editor-edited.png") });

  await page.goto("/");
  await expect(page.getByTestId("project-card")).toHaveCount(1);
  await page.screenshot({ path: path.join(OUT_DIR, "screen-home.png") });
});
