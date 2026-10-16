import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function expectClean(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(
    violations.filter((v) => v.impact === "serious" || v.impact === "critical"),
  ).toEqual([]);
}

test("axe: /", async ({ page }) => {
  await page.goto("/");
  await expectClean(page);
});

test("axe: /pr/pr-1 before and after sabotage", async ({ page }) => {
  await page.goto("/pr/pr-1");
  await expectClean(page);
  await page.getByRole("button", { name: "Sabotage: silence a test" }).click();
  await expect(
    page.getByText("new_skip_marker", { exact: true }),
  ).toBeVisible();
  await expectClean(page);
});

test("axe: /results", async ({ page }) => {
  await page.goto("/results");
  await expectClean(page);
});
