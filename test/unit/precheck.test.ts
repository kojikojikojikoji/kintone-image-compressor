import { describe, expect, it } from "vitest";
import { MAX_PIXELS, precheck } from "../../src/core/precheck";

function input(overrides: Partial<Parameters<typeof precheck>[0]> = {}) {
  return precheck({
    sizeBytes: 1_000_000,
    format: "jpeg",
    isApng: false,
    pixels: 4_000_000,
    skipThresholdBytes: 300 * 1024,
    ...overrides,
  });
}

describe("precheck order (FR-5)", () => {
  it("rejects an empty file", () => {
    expect(input({ sizeBytes: 0 })).toEqual({ action: "reject", reason: "empty" });
  });
  it("rejects a file over 100 MB", () => {
    expect(input({ sizeBytes: 104_857_601 })).toEqual({ action: "reject", reason: "too-large" });
  });
  it("attaches incompatible formats unchanged", () => {
    expect(input({ format: "gif" })).toEqual({
      action: "attach-original",
      reason: "incompatible-gif",
    });
    expect(input({ format: "heic" })).toEqual({
      action: "attach-original",
      reason: "incompatible-heic",
    });
  });
  it("attaches an animated PNG unchanged", () => {
    expect(input({ format: "png", isApng: true })).toEqual({
      action: "attach-original",
      reason: "apng",
    });
  });
  it("attaches over-100MP images unchanged (TC-6)", () => {
    // 10000 x 10001 = 100,010,000 pixels, just over the 100 MP limit.
    expect(input({ pixels: 10000 * 10001 })).toEqual({
      action: "attach-original",
      reason: "too-many-pixels",
    });
    expect(10000 * 10001).toBeGreaterThan(MAX_PIXELS);
  });
});

describe("precheck threshold (TC-16)", () => {
  it("skips just under the 300 KB threshold and compresses at it", () => {
    expect(input({ sizeBytes: 307199 })).toEqual({
      action: "attach-original",
      reason: "below-threshold",
    });
    expect(input({ sizeBytes: 307200 })).toEqual({ action: "compress" });
  });
});
