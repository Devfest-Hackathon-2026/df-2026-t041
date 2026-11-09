import { test, expect } from "@playwright/test";
import { editorState, waitForEditor } from "./helpers";

test("a font chosen in the wizard is applied to every text and actually loaded from Google Fonts", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/new");
  await page.getByTestId("size-a4-portrait").click();
  await page.getByTestId("next-step").click();
  await page.getByTestId("input-product").fill("唐揚げ定食");
  await page.getByTestId("input-price").fill("780");
  await page.getByTestId("input-shop").fill("和食処 さくら");
  await page.getByTestId("input-font").selectOption("Dela Gothic One");
  await expect(page.getByTestId("input-font-preview")).toHaveText("唐揚げ定食");
  // Use the built-in generator so the test does not depend on (or pay for) an AI call
  const aiToggle = page.locator('input[type="checkbox"]').first();
  if (await aiToggle.isChecked()) await aiToggle.uncheck();
  await page.getByTestId("generate").click();
  await expect(page.getByTestId("proposal-thumb")).toHaveCount(3);
  await page.getByTestId("choose-1").click();
  await page.waitForURL(/\/editor\//);
  await waitForEditor(page);
  // Flyer copy only (the "add a photo here" hint label is UI, not flyer text)
  const texts = (await editorState(page)).objects.filter((o) => o.type === "textbox" && ["shop", "product", "price", "description", "tagline"].includes(o.role ?? ""));
  expect(texts.length).toBeGreaterThan(0);
  for (const t of texts) expect(t.fontFamily).toBe("Dela Gothic One");
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready;
    return document.fonts.check('400 24px "Dela Gothic One"', "唐揚げ定食");
  });
  expect(loaded).toBe(true);
  const fromGoogle = await page.evaluate(() => [...document.querySelectorAll('link[data-font]')].map((l) => (l as HTMLLinkElement).href));
  expect(fromGoogle.some((h) => h.startsWith("https://fonts.googleapis.com/css2?family=Dela+Gothic+One"))).toBe(true);
  // Switching the font of one element from the editor picker
  await page.getByTestId("tab-layers").click();
  const item = page.locator('[data-testid="layer-item"]', { hasText: "商品名" }).first();
  await item.locator("button").first().click();
  await page.getByTestId("font-family").selectOption("Yuji Syuku");
  await expect.poll(async () => (await editorState(page)).objects.find((o) => o.role === "product")?.fontFamily).toBe("Yuji Syuku");
});
