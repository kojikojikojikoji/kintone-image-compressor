import { defineConfig } from "@playwright/test";

// E2E runs against a development kintone environment. Connection details come
// from environment variables so nothing environment-specific is committed:
//   KINTONE_BASE_URL   e.g. https://example.cybozu.com
//   KINTONE_USERNAME   login name
//   KINTONE_PASSWORD   password
//   KINTONE_APP_ID     app id with the demo form (see docs section 12)
// These specs are not run in CI; they document the main user flows and expect a
// prepared app with the image-compressor plugin installed.
export default defineConfig({
  testDir: "./test/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.KINTONE_BASE_URL,
    headless: true,
  },
});
