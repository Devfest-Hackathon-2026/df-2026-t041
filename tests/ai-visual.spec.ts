import { test, expect } from "@playwright/test";
import path from "node:path";
import { waitForEditor } from "./helpers";

const FIXTURE = path.join(__dirname, "fixtures", "karaage.jpg");

test("AI provider generates proposals and refines (visual)", async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto("/new");
  const st = await page.evaluate(() => fetch("/api/ai/status").then((r) => r.json()));
  test.skip(!st.available, "AI provider not connected");
  await page.getByTestId("size-a4-portrait").click();
  await page.getByTestId("next-step").click();
  await page.getByTestId("input-product").fill("唐揚げ定食");
  await page.getByTestId("input-price").fill("780円");
  await page.getByTestId("input-shop").fill("和食処 さくら");
  await page.getByTestId("input-description").fill("自家製ダレに漬け込んだジューシーな唐揚げ。ご飯・味噌汁・小鉢付き。");
  await page.getByTestId("input-prompt").fill("落ち着いた和食店の雰囲気。料理写真を大きく、値段は目立たせて。");
  await page.getByTestId("photo-input").setInputFiles(FIXTURE);
  await expect(page.getByTestId("photo-preview")).toBeVisible();
  await page.getByTestId("generate").click();
  // The primary provider may fall back to another one (e.g. Gemini overloaded -> OpenAI)
  await expect(page.getByTestId("proposal-thumb")).toHaveCount(3, { timeout: 150_000 });
  await expect(page.getByText(/(Gemini|OpenAI)が提案した3案です。/)).toBeVisible();
  await page.screenshot({ path: "tests/output/ai-proposals.png", fullPage: true });
  await page.getByTestId("choose-1").click();
  await page.waitForURL(/\/editor\//, { timeout: 60_000 });
  await waitForEditor(page);
  await page.getByTestId("tab-ai").click();
  await expect(page.getByTestId("ai-status")).toContainText("接続済み");
  await page.getByTestId("refine-input").fill("値段をもっと大きく赤色にして、店名は右上に小さく");
  await page.getByTestId("refine-run").click();
  await expect(page.getByTestId("refine-result")).toHaveAttribute("data-kind", "ok", { timeout: 90_000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "tests/output/ai-refined.png" });
  console.log("refine result:", await page.getByTestId("refine-result").textContent());
});
