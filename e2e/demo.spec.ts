import { expect, test, type Page } from "@playwright/test";

const findings = (page: Page) =>
  page.getByRole("region", { name: "Checker findings", exact: true });
const reviewer = (page: Page) =>
  page.getByRole("region", { name: "Reviewer result" });
const badge = (page: Page, text: string) =>
  page
    .getByRole("main")
    .locator("header")
    .getByLabel(`Status: ${text}`)
    .first();

test("3-minute demo flow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("Status: Clean")).toBeVisible();
  await expect(page.getByLabel("Status: Flags")).toBeVisible();
  await expect(page.getByLabel("Status: Missing evidence")).toBeVisible();

  await page.locator('a[href="/pr/pr-1"]').click();
  const matrix = page.getByRole("table", {
    name: "Requirement → evidence matrix",
  });
  await expect(matrix).toBeVisible();
  const statuses = matrix.locator("tbody tr td:nth-child(2)");
  expect(await statuses.count()).toBeGreaterThan(0);
  for (const cell of await statuses.all()) {
    await expect(cell).toContainText("met");
    await expect(cell).not.toContainText("unmet");
  }
  await expect(
    page.getByText(/SAMPLE — hand-authored|RECORDED/).first(),
  ).toBeVisible();
  await expect(badge(page, "Clean")).toBeVisible();

  const t0 = Date.now();
  await page.getByRole("button", { name: "Sabotage: silence a test" }).click();
  const flag = findings(page).getByText("new_skip_marker", { exact: true });
  await expect(flag).toBeVisible();
  const link = findings(page).getByRole("link", {
    name: /tests\/test_specifiers\.py:88/,
  });
  await expect(link).toBeVisible();
  expect(Date.now() - t0).toBeLessThan(1000);
  await expect(badge(page, "Flags")).toBeVisible();

  await link.click();
  const hash = new URL(page.url()).hash;
  expect(hash.length).toBeGreaterThan(1);
  await expect(page.locator(`[id="${hash.slice(1)}"]`).first()).toBeVisible();

  await page.getByRole("radio", { name: /^A ·/ }).check();
  await expect(reviewer(page).getByText("silenced_test")).toHaveCount(0);
  await expect(
    reviewer(page).getByText("approve", { exact: true }),
  ).toBeVisible();
  await page.getByRole("radio", { name: /^D ·/ }).check();
  await expect(reviewer(page).getByText("silenced_test").first()).toBeVisible();

  await page.goto("/pr/pr-2");
  await expect(findings(page).getByText("injection_text")).toBeVisible();
  await page.getByRole("radio", { name: /^D ·/ }).check();
  await expect(
    reviewer(page).getByText("injection", { exact: true }),
  ).toBeVisible();
  await expect(
    reviewer(page).getByText("request_changes", { exact: true }),
  ).toBeVisible();

  await page.goto("/pr/pr-3");
  await expect(page.getByText("Missing evidence").first()).toBeVisible();
  await expect(
    page.getByRole("row", { name: /R2/ }).getByText("Missing evidence"),
  ).toBeVisible();
  await expect(findings(page).getByText("out_of_scope")).toBeVisible();

  await page.goto("/results");
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.locator("caption")).toContainText("not a benchmark");
});

test("keyboard-only: sabotage and arm radios", async ({ page }) => {
  await page.goto("/pr/pr-1");
  const sabotage = page.getByRole("button", {
    name: "Sabotage: silence a test",
  });
  // Radio group is one tab stop, then the button.
  await page.getByRole("radio", { checked: true }).focus();
  await page.keyboard.press("Tab");
  await expect(sabotage).toBeFocused();
  await page.keyboard.press("Space");
  await expect(
    findings(page).getByText("new_skip_marker", { exact: true }),
  ).toBeVisible();

  await page.keyboard.press("Shift+Tab");
  const before = await page
    .getByRole("radio", { checked: true })
    .getAttribute("value");
  await page.keyboard.press("ArrowRight");
  const after = page.getByRole("radio", { checked: true });
  await expect(after).toBeFocused();
  await expect(after).not.toHaveAttribute("value", before ?? "");
});
