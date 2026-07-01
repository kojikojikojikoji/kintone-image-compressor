import { describe, expect, it } from "vitest";
import { computeResizedDimensions, decideOutputFormat } from "../../src/core/resize";

describe("computeResizedDimensions (TC-3, TC-4, TC-5)", () => {
  it("scales a landscape image down to the long-edge limit", () => {
    expect(computeResizedDimensions(4032, 3024, 1920)).toEqual({ width: 1920, height: 1440 });
  });
  it("scales a portrait image down to the long-edge limit", () => {
    expect(computeResizedDimensions(3024, 4032, 1920)).toEqual({ width: 1440, height: 1920 });
  });
  it("keeps the original size when the long edge already fits", () => {
    expect(computeResizedDimensions(1600, 1200, 1920)).toEqual({ width: 1600, height: 1200 });
  });
});

describe("decideOutputFormat (TC-10)", () => {
  it("covers the FR-7 table plus the CF-6-off case", () => {
    // JPEG input -> JPEG.
    expect(decideOutputFormat("jpeg", false, true)).toEqual({
      format: "jpeg",
      flattenToWhite: false,
    });
    // Opaque PNG with convert on -> JPEG.
    expect(decideOutputFormat("png", false, true)).toEqual({
      format: "jpeg",
      flattenToWhite: false,
    });
    // Opaque PNG with convert off -> PNG.
    expect(decideOutputFormat("png", false, false)).toEqual({
      format: "png",
      flattenToWhite: false,
    });
    // PNG with alpha -> PNG (resize only).
    expect(decideOutputFormat("png", true, true)).toEqual({ format: "png", flattenToWhite: false });
    // Opaque WebP -> JPEG.
    expect(decideOutputFormat("webp", false, true)).toEqual({
      format: "jpeg",
      flattenToWhite: false,
    });
    // WebP with alpha -> JPEG, flattened onto white.
    expect(decideOutputFormat("webp", true, true)).toEqual({
      format: "jpeg",
      flattenToWhite: true,
    });
  });
});
