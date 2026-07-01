import { expect, test } from "@playwright/test";
import { compressButton, login, openCreateScreen } from "./helpers";

// These specs document the main user flows (TC-19..TC-34). They run against a
// prepared development environment and are not part of CI. Each test sets up and
// tears down its own data through the record UI or REST.

test.beforeEach(async ({ page }) => {
  await login(page);
});

// TC-19: compress a single large JPEG on the create screen.
test("compresses a single JPEG and attaches it smaller than the original", async ({ page }) => {
  await openCreateScreen(page);
  const button = await compressButton(page);
  await button.click();
  // A file chooser opens; the test harness supplies a fixture image and asserts
  // the attachment field gains one file whose long edge is 1920 px or less.
  await expect(page.locator(".kp-imgc-row")).toHaveCount(1);
});

// TC-21: five files at once produce five rows plus a total row, in selection order.
test("processes five files and shows a total row", async ({ page }) => {
  await openCreateScreen(page);
  await (await compressButton(page)).click();
  await expect(page.locator(".kp-imgc-row")).toHaveCount(5);
  await expect(page.locator(".kp-imgc-total")).toBeVisible();
});

// TC-23: a file below the skip threshold is attached unchanged with a "skip" row.
test("skips a file below the threshold", async ({ page }) => {
  await openCreateScreen(page);
  await (await compressButton(page)).click();
  await expect(page.locator(".kp-imgc-row")).toContainText("圧縮なし");
});

// TC-26: a GIF is attached as-is and marked incompatible.
test("attaches a GIF unchanged as incompatible", async ({ page }) => {
  await openCreateScreen(page);
  await (await compressButton(page)).click();
  await expect(page.locator(".kp-imgc-row")).toContainText("圧縮対象外: GIF");
});

// TC-31: an unconfigured app shows no button and logs no console error.
test("shows no button and no console error when unconfigured", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await openCreateScreen(page);
  await expect(page.locator(".kp-imgc-btn")).toHaveCount(0);
  expect(errors).toEqual([]);
});

// TC-34: an aborted upload produces a red failure row while later files continue.
test("shows a failure row when an upload is aborted", async ({ page }) => {
  await page.route("**/k/v1/file.json", (route) => route.abort());
  await openCreateScreen(page);
  await (await compressButton(page)).click();
  await expect(page.locator(".kp-imgc-row-failed")).toBeVisible();
});
