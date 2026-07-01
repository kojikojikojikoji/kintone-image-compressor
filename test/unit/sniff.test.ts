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

describe("malformed headers stay null", () => {
  it("rejects a JPEG SOF whose segment is too short for dimensions", () => {
    // FF D8 FF, then SOF0 with declared length 2 (no room for h/w) and junk.
    const b = new Uint8Array([
      0xff, 0xd8, 0xff, 0xc0, 0x00, 0x02, 0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc,
    ]);
    expect(readDimensions("jpeg", b)).toBeNull();
  });

  it("rejects a PNG whose first chunk is not a 13-byte IHDR", () => {
    const b = new Uint8Array(32);
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    // Chunk length 4, type "junk", then arbitrary bytes where IHDR dims live.
    b.set([0x00, 0x00, 0x00, 0x04], 8);
    b.set([0x6a, 0x75, 0x6e, 0x6b], 12);
    b.set([0x00, 0x01, 0x00, 0x00], 16);
    expect(readDimensions("png", b)).toBeNull();
  });

  it("survives an EXIF IFD offset pointing far outside the buffer", () => {
    // Minimal JPEG with an APP1 Exif segment whose IFD0 offset is huge.
    const b = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe1, 0x00, 0x14, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
      // TIFF header, little endian, magic 0x2A, IFD0 offset 0x7fffffff
      0x49, 0x49, 0x2a, 0x00, 0xff, 0xff, 0xff, 0x7f, 0x00, 0x00, 0xff, 0xd9,
    ]);
    expect(readExifDateTimeOriginal(b)).toBeNull();
  });

  it("caps a declared IFD entry count that does not fit the buffer", () => {
    // Valid TIFF start but entry count 0xFFFF with only a few bytes behind it.
    const b = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe1, 0x00, 0x14, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x49, 0x49, 0x2a,
      0x00, 0x08, 0x00, 0x00, 0x00, 0xff, 0xff, 0x01, 0x02,
    ]);
    expect(readExifDateTimeOriginal(b)).toBeNull();
  });
});
