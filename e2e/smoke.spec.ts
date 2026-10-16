import { expect, test } from "@playwright/test";

test("home page renders the app heading", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Receipts PR Verifier" }),
  ).toBeVisible();
});

test("home lists 3 PRs with expected badges", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('a[href^="/pr/"]')).toHaveCount(3);
  const badge = (id: string) =>
    page.locator(`a[href="/pr/${id}"]`).getByLabel(/^Status:/);
  await expect(badge("pr-1")).toHaveAttribute("aria-label", "Status: Clean");
  await expect(badge("pr-2")).toHaveAttribute("aria-label", "Status: Flags");
  await expect(badge("pr-3")).toHaveAttribute(
    "aria-label",
    "Status: Missing evidence",
  );
});
