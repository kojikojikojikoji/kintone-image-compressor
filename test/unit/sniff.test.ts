import { describe, expect, it } from "vitest";
import {
  isApng as isApngCore,
  readDimensions,
  readExifDateTimeOriginal,
  sniffFormat,
} from "../../src/core/sniff";
import {
  GIF_HEADER,
  HEIC_HEADER,
  JPEG_HEADER,
  UNKNOWN_HEADER,
  jpegWithExifDate,
  jpegWithSof,
  pngAnimated,
  pngWithIhdr,
  svgHeader,
  webpVp8,
  webpVp8l100x200,
  webpVp8x,
} from "./fixtures";

describe("sniffFormat (TC-1, TC-2)", () => {
  it("detects each format from its leading bytes", () => {
    expect(sniffFormat(JPEG_HEADER)).toBe("jpeg");
    expect(sniffFormat(pngWithIhdr(1, 1))).toBe("png");
    expect(sniffFormat(GIF_HEADER)).toBe("gif");
    expect(sniffFormat(webpVp8x(1, 1))).toBe("webp");
    expect(sniffFormat(HEIC_HEADER)).toBe("heic");
    expect(sniffFormat(svgHeader())).toBe("svg");
    expect(sniffFormat(UNKNOWN_HEADER)).toBe("unknown");
  });

  it("uses the real bytes, not the extension (TC-2)", () => {
    // A PNG whose caller believed it was a .jpg still sniffs as png.
    expect(sniffFormat(pngWithIhdr(10, 10))).toBe("png");
  });
});

describe("readDimensions (TC-8)", () => {
  it("reads JPEG SOF dimensions", () => {
    expect(readDimensions("jpeg", jpegWithSof(4032, 3024))).toEqual({ width: 4032, height: 3024 });
  });
  it("reads PNG IHDR dimensions", () => {
    expect(readDimensions("png", pngWithIhdr(800, 600))).toEqual({ width: 800, height: 600 });
  });
  it("reads WebP VP8X dimensions", () => {
    expect(readDimensions("webp", webpVp8x(1920, 1080))).toEqual({ width: 1920, height: 1080 });
  });
  it("reads WebP VP8 (lossy) dimensions", () => {
    expect(readDimensions("webp", webpVp8(640, 480))).toEqual({ width: 640, height: 480 });
  });
  it("reads WebP VP8L (lossless) dimensions", () => {
    expect(readDimensions("webp", webpVp8l100x200())).toEqual({ width: 100, height: 200 });
  });
});

describe("isApng (TC-7)", () => {
  it("is true only when an acTL chunk precedes IDAT", () => {
    expect(isApngCore(pngAnimated(true))).toBe(true);
    expect(isApngCore(pngAnimated(false))).toBe(false);
  });
});

describe("readExifDateTimeOriginal (TC-9)", () => {
  it("returns YYYYMMDD from DateTimeOriginal", () => {
    expect(readExifDateTimeOriginal(jpegWithExifDate())).toBe("20260701");
  });
  it("returns null when there is no EXIF", () => {
    expect(readExifDateTimeOriginal(jpegWithSof(100, 100))).toBeNull();
  });
});
