import type { Dimensions, ImageFormat } from "./types";

// How many leading bytes callers should read from a file for these routines.
// JPEG dimensions (SOF marker) and the EXIF APP1 segment can sit well past the
// first kilobytes, so read a generous header slice before calling in.
export const HEADER_BYTES = 256 * 1024;

function startsWith(bytes: Uint8Array, sig: number[], offset = 0): boolean {
  if (bytes.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i += 1) {
    if (bytes[offset + i] !== sig[i]) return false;
  }
  return true;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    const b = bytes[offset + i];
    if (b === undefined) break;
    out += String.fromCharCode(b);
  }
  return out;
}

function read16BE(b: Uint8Array, o: number): number {
  return (b[o] << 8) | b[o + 1];
}

function read32BE(b: Uint8Array, o: number): number {
  return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
}

const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "heif", "mif1", "msf1", "hevx"]);

/**
 * Detect the real image format from the leading bytes (FR-4). Extension and MIME
 * type are ignored; only the magic bytes decide.
 */
export function sniffFormat(bytes: Uint8Array): ImageFormat {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return "gif";
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "webp";
  }
  if (startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4) && HEIC_BRANDS.has(ascii(bytes, 8, 4))) {
    return "heic";
  }
  const head = ascii(bytes, 0, Math.min(bytes.length, 1024)).toLowerCase();
  if (head.includes("<svg")) return "svg";
  return "unknown";
}

function jpegDimensions(b: Uint8Array): Dimensions | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      i += 1;
      continue;
    }
    let marker = b[i + 1];
    // Skip padding 0xFF bytes.
    while (marker === 0xff && i + 1 < b.length) {
      i += 1;
      marker = b[i + 1];
    }
    // Standalone markers without a length field.
    if (
      marker === 0xd8 ||
      marker === 0xd9 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      i += 2;
      continue;
    }
    const isSof =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      const height = read16BE(b, i + 5);
      const width = read16BE(b, i + 7);
      if (width > 0 && height > 0) return { width, height };
      return null;
    }
    const segLen = read16BE(b, i + 2);
    if (segLen < 2) return null;
    i += 2 + segLen;
  }
  return null;
}

function pngDimensions(b: Uint8Array): Dimensions | null {
  if (b.length < 24) return null;
  const width = read32BE(b, 16);
  const height = read32BE(b, 20);
  if (width > 0 && height > 0) return { width, height };
  return null;
}

function webpDimensions(b: Uint8Array): Dimensions | null {
  const kind = ascii(b, 12, 4);
  if (kind === "VP8 ") {
    if (b.length < 30) return null;
    const width = ((b[26] | (b[27] << 8)) & 0x3fff) + 0; // 14-bit
    const height = ((b[28] | (b[29] << 8)) & 0x3fff) + 0;
    return width > 0 && height > 0 ? { width, height } : null;
  }
  if (kind === "VP8L") {
    if (b.length < 25 || b[20] !== 0x2f) return null;
    const b0 = b[21];
    const b1 = b[22];
    const b2 = b[23];
    const b3 = b[24];
    const width = 1 + (((b1 & 0x3f) << 8) | b0);
    const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    return { width, height };
  }
  if (kind === "VP8X") {
    if (b.length < 30) return null;
    const width = 1 + (b[24] | (b[25] << 8) | (b[26] << 16));
    const height = 1 + (b[27] | (b[28] << 8) | (b[29] << 16));
    return { width, height };
  }
  return null;
}

/**
 * Read pixel dimensions straight from the header, without decoding the image
 * (FR-5 step 5, memory protection). Returns null when the header is too short or
 * the format is not one this reads.
 */
export function readDimensions(format: ImageFormat, bytes: Uint8Array): Dimensions | null {
  switch (format) {
    case "jpeg":
      return jpegDimensions(bytes);
    case "png":
      return pngDimensions(bytes);
    case "webp":
      return webpDimensions(bytes);
    default:
      return null;
  }
}

/**
 * Whether a PNG carries an acTL chunk before its first IDAT, i.e. it is an
 * animated PNG (FR-5 step 4). Compressing it through a canvas would keep only
 * the first frame, so callers attach it unchanged.
 */
export function isApng(bytes: Uint8Array): boolean {
  if (!startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return false;
  let pos = 8;
  while (pos + 8 <= bytes.length) {
    const len = read32BE(bytes, pos);
    const type = ascii(bytes, pos + 4, 4);
    if (type === "acTL") return true;
    if (type === "IDAT") return false;
    pos += 12 + len; // length(4) + type(4) + data(len) + crc(4)
    if (len < 0) return false;
  }
  return false;
}

interface TiffReader {
  u16(o: number): number;
  u32(o: number): number;
}

function makeTiffReader(b: Uint8Array, base: number, little: boolean): TiffReader {
  return {
    u16: (o: number) =>
      little ? b[base + o] | (b[base + o + 1] << 8) : (b[base + o] << 8) | b[base + o + 1],
    u32: (o: number) =>
      (little
        ? b[base + o] | (b[base + o + 1] << 8) | (b[base + o + 2] << 16) | (b[base + o + 3] << 24)
        : (b[base + o] << 24) |
          (b[base + o + 1] << 16) |
          (b[base + o + 2] << 8) |
          b[base + o + 3]) >>> 0,
  };
}

function findExifApp1(b: Uint8Array): number | null {
  let i = 2;
  while (i + 4 < b.length) {
    if (b[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = b[i + 1];
    if (
      marker === 0xd8 ||
      marker === 0xd9 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      i += 2;
      continue;
    }
    const segLen = read16BE(b, i + 2);
    if (marker === 0xe1 && ascii(b, i + 4, 4) === "Exif" && b[i + 8] === 0 && b[i + 9] === 0) {
      return i + 10; // start of the TIFF header
    }
    if (marker === 0xda) return null; // start of scan: no EXIF found
    if (segLen < 2) return null;
    i += 2 + segLen;
  }
  return null;
}

function readIfdTag(
  r: TiffReader,
  ifdOffset: number,
  wantedTag: number,
): { type: number; count: number; valueOffset: number } | null {
  const count = r.u16(ifdOffset);
  for (let e = 0; e < count; e += 1) {
    const off = ifdOffset + 2 + e * 12;
    const tag = r.u16(off);
    if (tag === wantedTag) {
      return { type: r.u16(off + 2), count: r.u32(off + 4), valueOffset: r.u32(off + 8) };
    }
  }
  return null;
}

/**
 * Read EXIF DateTimeOriginal from a JPEG and return it as "YYYYMMDD" (FR-9,
 * TC-9). Returns null when the file is not a JPEG, has no EXIF, or the tag is
 * absent or malformed.
 */
export function readExifDateTimeOriginal(bytes: Uint8Array): string | null {
  const tiff = findExifApp1(bytes);
  if (tiff === null) return null;
  const byteOrder = ascii(bytes, tiff, 2);
  const little = byteOrder === "II";
  if (!little && byteOrder !== "MM") return null;
  const r = makeTiffReader(bytes, tiff, little);
  if (r.u16(2) !== 0x002a) return null; // TIFF magic
  const ifd0 = r.u32(4);
  const exifPtr = readIfdTag(r, ifd0, 0x8769);
  if (!exifPtr) return null;
  const dt = readIfdTag(r, exifPtr.valueOffset, 0x9003);
  if (!dt || dt.type !== 2 || dt.count < 10) return null;
  // ASCII value "YYYY:MM:DD HH:MM:SS\0" (20 bytes) lives at the given offset.
  const value = ascii(bytes, tiff + dt.valueOffset, 10); // "YYYY:MM:DD"
  const m = /^(\d{4}):(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  return `${m[1]}${m[2]}${m[3]}`;
}
