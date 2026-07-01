import { expect, type Page } from "@playwright/test";

// Shared helpers for the E2E specs. Connection details come from environment
// variables so nothing environment-specific is committed (common spec, BUILD
// INSTRUCTIONS). A prepared app with the demo form (docs section 12) and the
// image-compressor plugin installed is assumed.

export function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}. See playwright.config.ts.`);
  }
  return value;
}

export const APP_ID = process.env.KINTONE_APP_ID ?? "1";

/** Log in to kintone with the credentials from the environment. */
export async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.fill('input[name="username"]', env("KINTONE_USERNAME"));
  await page.fill('input[name="password"]', env("KINTONE_PASSWORD"));
  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle");
}

export async function openCreateScreen(page: Page): Promise<void> {
  await page.goto(`/k/${APP_ID}/edit`);
  await page.waitForLoadState("networkidle");
}

/** The compress button rendered by the plugin into the configured space. */
export async function compressButton(page: Page) {
  const button = page.locator(".kp-imgc-btn");
  await expect(button).toBeVisible();
  return button;
}
