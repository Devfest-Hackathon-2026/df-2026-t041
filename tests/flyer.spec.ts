import { FONTS } from "../src/lib/fonts";
import { stripPunctuation } from "../src/lib/design/spec";
import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import { PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import {
  FIXTURE_PNG,
  canvasPoint,
  colorClose,
  countColor,
  createProject,
  download,
  editorState,
  hexToRgb,
  pixel,
  readPng,
  selectByLayerName,
  waitForEditor,
  waitSaved,
} from "./helpers";

test.describe.configure({ mode: "serial" });

const SAMPLE = {
  product: "唐揚げ定食",
  price: "780円",
  shop: "和食処 さくら",
  description: "国産鶏もも肉を秘伝のタレに漬け込み、注文を受けてから揚げます。",
  prompt: "落ち着いた和食店の雰囲気。料理写真を大きく、値段は目立たせて。",
};

let page: Page;
let projectUrl = "";

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
});

test("home shows an empty project list", async () => {
  await page.goto("/");
  await expect(page.getByText("まだプロジェクトがありません")).toBeVisible();
  await expect(page.getByTestId("new-project")).toBeVisible();
});

test("creates a project from the sample brief with three distinct proposals", async () => {
  await createProject(page, { preset: "a4-portrait", ...SAMPLE, choose: 0 });
  projectUrl = page.url();
  const st = await editorState(page);
  expect(st.size.preset).toBe("a4-portrait");
  const texts = st.objects.filter((o) => o.type === "textbox").map((o) => o.text);
  expect(texts).toContain("唐揚げ定食");
  expect(texts).toContain("780円");
  expect(texts).toContain("和食処 さくら");
  // AI providers may break the description at 、 with a newline instead of a space; compare ignoring whitespace
  const squash = (t: string | undefined) => (t ?? "").replace(/\s+/g, "");
  expect(texts.map(squash)).toContain(squash(stripPunctuation(SAMPLE.description)));
  expect(texts.some((t) => /[、。]/.test(t ?? ""))).toBe(false);
  const photo = st.objects.find((o) => o.role === "photo");
  expect(photo?.type).toBe("image");
  expect(photo!.w).toBeGreaterThan(st.size.width * 0.5);
  // AI status is reported honestly
  const status = await page.evaluate(() => fetch("/api/ai/status").then((r) => r.json()));
  if (!status.available) await expect(page.getByTestId("tab-ai")).toBeVisible();
});

test("text can be edited from the panel and the canvas reflects it", async () => {
  await selectByLayerName(page, "価格");
  await expect(page.getByTestId("selected-name")).toHaveText("価格");
  const ta = page.getByTestId("text-content");
  await expect(ta).toHaveValue("780円");
  await ta.fill("880円");
  await expect.poll(async () => (await editorState(page)).objects.find((o) => o.role === "price")?.text).toBe("880円");
  await page.waitForTimeout(700); // let the debounced history commit flush so each change is its own undo step
  // font change
  // pick a font the AI/template did not already use, so the change is a real undo step
  const currentFont = (await editorState(page)).objects.find((o) => o.role === "price")?.fontFamily;
  const newFont = currentFont === "Noto Serif JP" ? "Noto Sans JP" : "Noto Serif JP";
  await page.getByTestId("font-family").selectOption(newFont);
  await expect.poll(async () => (await editorState(page)).objects.find((o) => o.role === "price")?.fontFamily).toBe(newFont);
  await page.getByTestId("text-color").fill("#1f5fa8");
  await expect.poll(async () => (await editorState(page)).objects.find((o) => o.role === "price")?.fill).toBe("#1f5fa8");
  await page.waitForTimeout(400);
  const align = (await editorState(page)).objects.find((o) => o.role === "price")?.textAlign;
  await page.getByTestId(align === "center" ? "align-text-left" : "align-text-center").click();
  await page.waitForTimeout(200);
});

test("undo and redo work", async () => {
  await page.getByTestId("undo").click(); // align
  await page.getByTestId("undo").click(); // color
  await page.getByTestId("undo").click(); // font
  await page.getByTestId("undo").click(); // text
  await expect.poll(async () => (await editorState(page)).objects.find((o) => o.role === "price")?.text).toBe("780円");
  await page.getByTestId("redo").click();
  await expect.poll(async () => (await editorState(page)).objects.find((o) => o.role === "price")?.text).toBe("880円");
  await page.getByTestId("redo").click();
  await page.getByTestId("redo").click();
  await page.getByTestId("redo").click();
  await expect.poll(async () => (await editorState(page)).objects.find((o) => o.role === "price")?.fill).toBe("#1f5fa8");
});

test("elements can be moved by dragging and resized from the panel", async () => {
  await page.keyboard.press("Escape");
  const before = (await editorState(page)).objects.find((o) => o.role === "product")!;
  const from = await canvasPoint(page, before.bl + before.w / 2, before.bt + before.h / 2);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 40, from.y + 30, { steps: 8 });
  await page.mouse.move(from.x + 80, from.y + 60, { steps: 8 });
  await page.mouse.up();
  const zoom = (await editorState(page)).zoom;
  const after = (await editorState(page)).objects.find((o) => o.role === "product")!;
  expect(after.bl - before.bl).toBeGreaterThan(60 / zoom);
  expect(after.bt - before.bt).toBeGreaterThan(40 / zoom);
  await expect(page.getByTestId("selected-name")).toHaveText("商品名");
  // move back with the X/Y fields
  await page.getByTestId("prop-x").fill(String(Math.round(before.bl)));
  await page.getByTestId("prop-x").press("Enter");
  await page.getByTestId("prop-y").fill(String(Math.round(before.bt)));
  await page.getByTestId("prop-y").press("Enter");
  const back = (await editorState(page)).objects.find((o) => o.role === "product")!;
  expect(Math.abs(back.bl - before.bl)).toBeLessThan(1.5);
  expect(Math.abs(back.bt - before.bt)).toBeLessThan(1.5);
  // resize the photo from the panel keeping aspect ratio
  await selectByLayerName(page, "料理写真");
  const photo = (await editorState(page)).objects.find((o) => o.role === "photo")!;
  const ratio = photo.h / photo.w;
  await page.getByTestId("prop-w").fill("600");
  await page.getByTestId("prop-w").press("Enter");
  const resized = (await editorState(page)).objects.find((o) => o.role === "photo")!;
  expect(Math.abs(resized.w - 600)).toBeLessThan(1);
  expect(Math.abs(resized.h - 600 * ratio)).toBeLessThan(2);
  // restore
  await page.getByTestId("prop-w").fill(String(Math.round(photo.w)));
  await page.getByTestId("prop-w").press("Enter");
  await page.getByTestId("crop-cover").click();
  // rotation and opacity
  await page.getByTestId("prop-angle").fill("5");
  await page.getByTestId("prop-angle").press("Enter");
  await page.getByTestId("prop-angle").fill("0");
  await page.getByTestId("prop-angle").press("Enter");
});

test("image crop, radius and replacement work", async () => {
  await selectByLayerName(page, "料理写真");
  const before = (await editorState(page)).objects.find((o) => o.role === "photo")!;
  const currentLeft = Number(await page.getByTestId("crop-left").inputValue());
  await page.getByTestId("crop-left").fill(String(currentLeft + 20));
  await page.getByTestId("crop-left").press("Enter");
  await page.waitForTimeout(400);
  const cropped = (await editorState(page)).objects.find((o) => o.role === "photo")!;
  expect(cropped.w).toBeLessThan(before.w - 1);
  expect(Math.abs(cropped.h - before.h)).toBeLessThan(1);
  await page.getByTestId("undo").click();
  await expect.poll(async () => Math.round((await editorState(page)).objects.find((o) => o.role === "photo")!.w)).toBe(Math.round(before.w));
  // reset shows the whole uncropped photo (fixture is 4:3, so it becomes wider than the box)
  await selectByLayerName(page, "料理写真");
  await page.getByTestId("crop-reset").click();
  await page.waitForTimeout(400);
  const reset = (await editorState(page)).objects.find((o) => o.role === "photo")!;
  expect(Math.abs(reset.w / reset.h - 1200 / 900)).toBeLessThan(0.01);
  await page.getByTestId("undo").click();
  await expect.poll(async () => Math.round((await editorState(page)).objects.find((o) => o.role === "photo")!.w)).toBe(Math.round(before.w));
  await selectByLayerName(page, "料理写真");
  await page.getByTestId("image-radius").fill("40");
  await page.getByTestId("image-radius").press("Enter");
  await page.waitForTimeout(400);
  await page.getByTestId("replace-image-input").setInputFiles(FIXTURE_PNG);
  await expect.poll(async () => (await editorState(page)).objects.find((o) => o.role === "photo")?.srcLen).not.toBe(before.srcLen);
  const replaced = (await editorState(page)).objects.find((o) => o.role === "photo")!;
  expect(Math.abs(replaced.w - before.w)).toBeLessThan(2);
  expect(Math.abs(replaced.h - before.h)).toBeLessThan(2);
  expect(replaced.type).toBe("image");
  expect(replaced.index).toBe(before.index);
});

test("layers: order, visibility, lock and multi-select", async () => {
  await page.getByTestId("tab-add").click();
  await page.getByTestId("add-rect").click();
  await expect(page.getByTestId("selected-name")).toHaveText("四角形");
  let st = await editorState(page);
  const rect = st.objects.find((o) => o.type === "rect" && o.role === "custom")!;
  expect(rect.index).toBe(st.objects.length - 1);
  await page.getByTestId("order-back").click();
  st = await editorState(page);
  expect(st.objects.find((o) => o.id === rect.id)!.index).toBe(0);
  await page.getByTestId("order-forward").click();
  st = await editorState(page);
  expect(st.objects.find((o) => o.id === rect.id)!.index).toBe(1);
  await page.getByTestId("order-front").click();
  st = await editorState(page);
  expect(st.objects.find((o) => o.id === rect.id)!.index).toBe(st.objects.length - 1);
  // layer list order reflects the canvas (first item is top-most)
  await page.getByTestId("tab-layers").click();
  await expect(page.locator('[data-testid="layer-item"]').first()).toContainText("四角形");
  // visibility toggle
  await page.locator('[data-testid="layer-item"]').first().getByLabel("非表示にする").click();
  st = await editorState(page);
  expect(st.objects.find((o) => o.id === rect.id)!.visible).toBe(false);
  await page.locator('[data-testid="layer-item"]').first().getByLabel("表示する").click();
  // lock toggle
  await page.locator('[data-testid="layer-item"]').first().getByLabel("ロック").click();
  await page.locator('[data-testid="layer-item"]').first().getByLabel("ロック解除").click();
  // multi-select with shift-click
  await page.locator('[data-testid="layer-item"]', { hasText: "商品名" }).locator("button").first().click();
  await page.locator('[data-testid="layer-item"]', { hasText: "価格" }).locator("button").first().click({ modifiers: ["Shift"] });
  await expect(page.getByText("2個の要素を選択中")).toBeVisible();
  await page.keyboard.press("Escape");
  // delete the rect via keyboard and undo
  await selectByLayerName(page, "四角形");
  await page.keyboard.press("Delete");
  await expect.poll(async () => (await editorState(page)).objects.some((o) => o.id === rect.id)).toBe(false);
  await page.keyboard.press("Meta+z");
  await expect.poll(async () => (await editorState(page)).objects.some((o) => o.id === rect.id)).toBe(true);
  await selectByLayerName(page, "四角形");
  await page.getByTestId("delete").click();
  await expect.poll(async () => (await editorState(page)).objects.some((o) => o.id === rect.id)).toBe(false);
});

test("add text, shapes, duplicate and keyboard nudge", async () => {
  await page.getByTestId("tab-add").click();
  const n0 = (await editorState(page)).objects.length;
  await page.getByTestId("add-heading").click();
  await page.getByTestId("add-body").click();
  await page.getByTestId("add-ellipse").click();
  await page.getByTestId("add-line").click();
  expect((await editorState(page)).objects.length).toBe(n0 + 4);
  await page.getByTestId("duplicate").click();
  expect((await editorState(page)).objects.length).toBe(n0 + 5);
  const sel = await page.evaluate(() => (window as unknown as { __flyerEditor: { active?: { left: number } } }).__flyerEditor.active?.left);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowRight");
  await expect.poll(() => page.evaluate(() => (window as unknown as { __flyerEditor: { active?: { left: number } } }).__flyerEditor.active?.left)).toBeCloseTo(sel! + 11, 3);
  // remove the five added objects
  for (let i = 0; i < 5; i++) {
    const st = await editorState(page);
    const last = st.objects[st.objects.length - 1];
    await page.evaluate((id) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ed = (window as any).__flyerEditor;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ed.select(ed.canvas.getObjects().filter((o: any) => o.id === id));
    }, last.id);
    await page.getByTestId("delete").click();
  }
  expect((await editorState(page)).objects.length).toBe(n0);
});

test("offline refinement adjusts only the targeted element and reports unknown instructions", async () => {
  await page.getByTestId("tab-ai").click();
  const status = await page.evaluate(() => fetch("/api/ai/status").then((r) => r.json()));
  const before = await editorState(page);
  await page.getByTestId("refine-input").fill("価格を大きく");
  await page.getByTestId("refine-run").click();
  await expect(page.getByTestId("refine-result")).toHaveAttribute("data-kind", "ok", { timeout: 60_000 });
  const after = await editorState(page);
  expect(after.objects.find((o) => o.role === "price")!.fontSize!).toBeGreaterThan(before.objects.find((o) => o.role === "price")!.fontSize! * 1.1);
  const prodBefore = before.objects.find((o) => o.role === "product")!;
  const prodAfter = after.objects.find((o) => o.role === "product")!;
  expect(prodAfter.text).toBe(prodBefore.text);
  if (!status.available) {
    expect(Math.abs(prodAfter.fontSize! - prodBefore.fontSize!)).toBeLessThan(0.01);
    await expect(page.getByTestId("ai-status")).toContainText("未接続");
    await page.getByTestId("refine-input").fill("ほげほげ");
    await page.getByTestId("refine-run").click();
    await expect(page.getByTestId("refine-result")).toHaveAttribute("data-kind", "error");
  }
  await page.getByTestId("refine-input").fill("背景を黒に");
  await page.getByTestId("refine-run").click();
  await expect(page.getByTestId("refine-result")).toHaveAttribute("data-kind", "ok", { timeout: 60_000 });
  if (!status.available) expect((await editorState(page)).bg).toBe("#111111");
  await page.getByTestId("undo").click();
  await page.getByTestId("undo").click();
  expect((await editorState(page)).bg).toBe(before.bg);
});

test("save, reload and restore", async () => {
  await page.getByTestId("project-name").fill("唐揚げ定食 A4ビラ");
  await page.getByTestId("save").click();
  await waitSaved(page);
  const before = await editorState(page);
  await page.reload();
  await waitForEditor(page);
  const after = await editorState(page);
  expect(after.objects.length).toBe(before.objects.length);
  expect(after.objects.map((o) => [o.id, o.type, o.text])).toEqual(before.objects.map((o) => [o.id, o.type, o.text]));
  expect(after.objects.find((o) => o.role === "price")!.text).toBe("880円");
  expect(after.objects.find((o) => o.role === "price")!.fontFamily).toBe(before.objects.find((o) => o.role === "price")!.fontFamily);
  expect(after.objects.find((o) => o.role === "photo")!.srcLen).toBe(before.objects.find((o) => o.role === "photo")!.srcLen);
  expect(after.bg).toBe(before.bg);
  await expect(page.getByTestId("project-name")).toHaveValue("唐揚げ定食 A4ビラ");
  await page.goto("/");
  await expect(page.getByTestId("project-card")).toHaveCount(1);
  await expect(page.getByTestId("project-card")).toContainText("唐揚げ定食 A4ビラ");
  await page.getByTestId("project-card").click();
  await waitForEditor(page);
});

test("exports a 300dpi PNG with the right colors, text and photo", async () => {
  const st = await editorState(page);
  const file = await download(
    page,
    async () => {
      await page.getByTestId("export-menu").click();
      await page.getByTestId("export-png").click();
    },
    "a4.png",
  );
  const png = readPng(file);
  expect(png.width).toBe(2480);
  expect(png.height).toBe(3508);
  const m = png.width / st.size.width;
  // background: sample a point not covered by any element (full-bleed layouts may have none)
  const candidates = [
    [4, 4],
    [st.size.width - 4, 4],
    [4, st.size.height - 4],
    [st.size.width - 4, st.size.height - 4],
    [st.size.width / 2, st.size.height - 4],
  ];
  const free = candidates.find(([x, y]) => !st.objects.some((o) => o.visible && x >= o.bl && x <= o.bl + o.w && y >= o.bt && y <= o.bt + o.h));
  if (free) expect(colorClose(pixel(png, free[0] * m, free[1] * m), hexToRgb(st.bg))).toBe(true);
  // photo region contains the wooden table / plate colors from the fixture, not the background
  const photo = st.objects.find((o) => o.role === "photo")!;
  const region = { x: (photo.bl + photo.w * 0.1) * m, y: (photo.bt + photo.h * 0.1) * m, w: photo.w * 0.8 * m, h: photo.h * 0.8 * m };
  const total = (region.w / 2) * (region.h / 2);
  const plate = countColor(png, region, [250, 247, 242], 14);
  expect(plate).toBeGreaterThan(total * 0.05);
  let wood = 0;
  for (let y = region.y; y < region.y + region.h; y += 2)
    for (let x = region.x; x < region.x + region.w; x += 2) {
      const [r, g, b] = pixel(png, x, y);
      if (r > g + 30 && g > b + 20) wood += 1;
    }
  expect(wood).toBeGreaterThan(total * 0.05);
  // price text in its fill color inside its box
  const price = st.objects.find((o) => o.role === "price")!;
  const priceRegion = { x: price.bl * m, y: price.bt * m, w: price.w * m, h: price.h * m };
  expect(countColor(png, priceRegion, hexToRgb(price.fill!), 40)).toBeGreaterThan(200);
  // product name in dark text color
  const prod = st.objects.find((o) => o.role === "product")!;
  const prodRegion = { x: prod.bl * m, y: prod.bt * m, w: prod.w * m, h: prod.h * m };
  expect(countColor(png, prodRegion, hexToRgb(prod.fill!), 40)).toBeGreaterThan(200);
  // changing the price changes the exported pixels in the price region only
  await selectByLayerName(page, "価格");
  await page.getByTestId("text-content").fill("980円");
  await page.keyboard.press("Escape");
  const file2 = await download(
    page,
    async () => {
      await page.getByTestId("export-menu").click();
      await page.getByTestId("export-png").click();
    },
    "a4-980.png",
  );
  const png2 = readPng(file2);
  let diffInPrice = 0;
  let diffInProduct = 0;
  for (let y = 0; y < png.height; y += 4) {
    for (let x = 0; x < png.width; x += 4) {
      const same = colorClose(pixel(png, x, y), pixel(png2, x, y), 8);
      if (same) continue;
      if (x >= priceRegion.x && x <= priceRegion.x + priceRegion.w && y >= priceRegion.y && y <= priceRegion.y + priceRegion.h) diffInPrice += 1;
      if (x >= prodRegion.x && x <= prodRegion.x + prodRegion.w && y >= prodRegion.y && y <= prodRegion.y + prodRegion.h) diffInProduct += 1;
    }
  }
  expect(diffInPrice).toBeGreaterThan(50);
  expect(diffInProduct).toBe(0);
  await page.getByTestId("undo").click();
});

test("exports an A4 PDF with a full-page 300dpi image", async () => {
  const file = await download(
    page,
    async () => {
      await page.getByTestId("export-menu").click();
      await page.getByTestId("export-pdf").click();
    },
    "a4.pdf",
  );
  const bytes = fs.readFileSync(file);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBe(1);
  const p = pdf.getPage(0);
  expect(Math.abs(p.getWidth() - 595.28)).toBeLessThan(0.5);
  expect(Math.abs(p.getHeight() - 841.89)).toBeLessThan(0.5);
  const images = pdf.context.enumerateIndirectObjects().filter(([, obj]) => obj instanceof PDFRawStream && obj.dict.get(PDFName.of("Subtype")) === PDFName.of("Image"));
  expect(images.length).toBe(1);
  const dict = (images[0][1] as PDFRawStream).dict;
  expect(dict.get(PDFName.of("Width"))!.toString()).toBe("2480");
  expect(dict.get(PDFName.of("Height"))!.toString()).toBe("3508");
});

test("exports and re-imports the project file", async () => {
  const before = await editorState(page);
  const file = await download(
    page,
    async () => {
      await page.getByTestId("export-menu").click();
      await page.getByTestId("export-project").click();
    },
    "project.flyer.json",
  );
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  expect(data.version).toBe(1);
  expect(Array.isArray(data.canvasJson.objects)).toBe(true);
  expect(data.canvasJson.objects.length).toBe(before.objects.length);
  // import into a fresh browser context (empty IndexedDB)
  const ctx = await page.context().browser()!.newContext();
  const p2 = await ctx.newPage();
  await p2.goto("/");
  await expect(p2.getByText("まだプロジェクトがありません")).toBeVisible();
  await p2.getByTestId("import-project-input").setInputFiles(file);
  await p2.waitForURL(/\/editor\//);
  await waitForEditor(p2);
  const imported = await editorState(p2);
  expect(imported.objects.map((o) => [o.id, o.text])).toEqual(before.objects.map((o) => [o.id, o.text]));
  // invalid file is rejected with a message
  const bad = file.replace(".flyer.json", ".bad.json");
  fs.writeFileSync(bad, '{"hello": 1}');
  await p2.goto("/");
  await p2.getByTestId("import-project-input").setInputFiles(bad);
  await expect(p2.getByRole("alert").filter({ hasText: "プロジェクト" })).toContainText("プロジェクトファイルではありません");
  await ctx.close();
});

test("size change re-fits the design and exports correctly", async () => {
  await page.getByTestId("size-menu").click();
  await page.getByTestId("size-option-ig-square").click();
  let st = await editorState(page);
  expect(st.size.width).toBe(1080);
  expect(st.size.height).toBe(1080);
  for (const o of st.objects) {
    expect(o.bl + o.w).toBeLessThanOrEqual(1080 + 2);
    expect(o.bt + o.h).toBeLessThanOrEqual(1080 + 2);
  }
  const png = readPng(
    await download(
      page,
      async () => {
        await page.getByTestId("export-menu").click();
        await page.getByTestId("export-png").click();
      },
      "ig-square.png",
    ),
  );
  expect(png.width).toBe(1080);
  expect(png.height).toBe(1080);
  await page.getByTestId("size-menu").click();
  await page.getByTestId("size-option-a4-landscape").click();
  st = await editorState(page);
  expect(st.size.preset).toBe("a4-landscape");
  const pdfFile = await download(
    page,
    async () => {
      await page.getByTestId("export-menu").click();
      await page.getByTestId("export-pdf").click();
    },
    "a4-landscape.pdf",
  );
  const pdf = await PDFDocument.load(fs.readFileSync(pdfFile));
  expect(Math.abs(pdf.getPage(0).getWidth() - 841.89)).toBeLessThan(0.5);
  expect(Math.abs(pdf.getPage(0).getHeight() - 595.28)).toBeLessThan(0.5);
  // undo size change twice returns to A4 portrait
  await page.getByTestId("undo").click();
  await page.getByTestId("undo").click();
  st = await editorState(page);
  expect(st.size.preset).toBe("a4-portrait");
});

test("regenerating templates replaces the canvas and keeps the photo", async () => {
  await page.getByTestId("tab-design").click();
  await page.getByTestId("design-prompt").fill("今風のカフェらしく");
  await page.getByTestId("regenerate").click();
  await expect(page.getByTestId("proposal-thumb")).toHaveCount(3, { timeout: 60_000 });
  page.once("dialog", (d) => d.accept());
  await page.getByTestId("choose-1").click();
  await expect.poll(async () => (await editorState(page)).objects.find((o) => o.role === "photo")?.type, { timeout: 30_000 }).toBe("image");
  const st = await editorState(page);
  expect(st.objects.find((o) => o.role === "product")?.text).toBe("唐揚げ定食");
  // The built-in generator maps "カフェ" to Zen Kaku Gothic New; a connected AI provider may pick any listed font.
  const aiOn = (await page.evaluate(() => fetch("/api/ai/status").then((r) => r.json()))).available as boolean;
  const family = st.objects.find((o) => o.role === "product")?.fontFamily;
  if (aiOn) expect(FONTS.map((f) => f.family)).toContain(family);
  else expect(family).toBe("Zen Kaku Gothic New");
});

test("other sizes and the no-photo path create valid projects", async () => {
  await createProject(page, { preset: "ig-portrait", product: "季節のパフェ", price: "650", shop: "cafe Hana", prompt: "今風のカフェらしく", photo: null, choose: 2 });
  let st = await editorState(page);
  expect(st.size.width).toBe(1080);
  expect(st.size.height).toBe(1350);
  expect(st.objects.some((o) => o.role === "photo-placeholder")).toBe(true);
  expect(st.objects.find((o) => o.role === "price")?.text).toBe("650円");
  // uploading a photo fills the placeholder
  await page.getByTestId("tab-add").click();
  await page.getByTestId("upload-image").setInputFiles(FIXTURE_PNG);
  await expect.poll(async () => (await editorState(page)).objects.some((o) => o.role === "photo")).toBe(true);
  st = await editorState(page);
  expect(st.objects.some((o) => o.role === "photo-placeholder")).toBe(false);
  const png = readPng(
    await download(
      page,
      async () => {
        await page.getByTestId("export-menu").click();
        await page.getByTestId("export-png").click();
      },
      "ig-portrait.png",
    ),
  );
  expect(png.width).toBe(1080);
  expect(png.height).toBe(1350);
  await createProject(page, { preset: "a5-landscape", product: "牛タン焼き", price: "1,480円", shop: "炭火焼肉 真", description: "厚切り牛タンを炭火で。", prompt: "高級な焼肉店っぽく", choose: 1 });
  st = await editorState(page);
  expect(st.size.preset).toBe("a5-landscape");
  const pdfFile = await download(
    page,
    async () => {
      await page.getByTestId("export-menu").click();
      await page.getByTestId("export-pdf").click();
    },
    "a5-landscape.pdf",
  );
  const pdf = await PDFDocument.load(fs.readFileSync(pdfFile));
  expect(Math.abs(pdf.getPage(0).getWidth() - 595.28)).toBeLessThan(0.5);
  expect(Math.abs(pdf.getPage(0).getHeight() - 419.53)).toBeLessThan(0.5);
  await page.goto("/");
  await expect(page.getByTestId("project-card")).toHaveCount(3);
});

test("main screens have no horizontal overflow", async () => {
  for (const vp of [
    { width: 1440, height: 900 },
    { width: 1280, height: 760 },
  ]) {
    await page.setViewportSize(vp);
    for (const url of ["/", "/new", projectUrl]) {
      await page.goto(url);
      if (url === projectUrl) await waitForEditor(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      expect(overflow, `${url} @ ${vp.width}`).toBe(false);
    }
  }
});
