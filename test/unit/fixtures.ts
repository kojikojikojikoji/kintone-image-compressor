// Minimal byte fixtures for the sniff/dimension/APNG/EXIF unit tests. Each helper
// builds only the header bytes those routines inspect, not a valid full image.

export function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function u32be(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

function chunk(type: string, dataLength: number): number[] {
  const typeBytes = [...type].map((c) => c.charCodeAt(0));
  const data = new Array(dataLength).fill(0);
  const crc = [0, 0, 0, 0];
  return [...u32be(dataLength), ...typeBytes, ...data, ...crc];
}

export const JPEG_HEADER = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46);
export const GIF_HEADER = bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00);
export const HEIC_HEADER = bytes(
  0x00,
  0x00,
  0x00,
  0x18,
  0x66,
  0x74,
  0x79,
  0x70,
  0x68,
  0x65,
  0x69,
  0x63,
);
export const UNKNOWN_HEADER = bytes(0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07);

export function svgHeader(): Uint8Array {
  return new TextEncoder().encode(
    '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>',
  );
}

/** JPEG with an SOF0 marker carrying width x height (for dimension reads). */
export function jpegWithSof(width: number, height: number): Uint8Array {
  return bytes(
    0xff,
    0xd8, // SOI
    0xff,
    0xc0, // SOF0 marker (i = 2)
    0x00,
    0x11, // segment length
    0x08, // precision
    (height >> 8) & 0xff,
    height & 0xff, // height at i+5
    (width >> 8) & 0xff,
    width & 0xff, // width at i+7
    0x03, // components
  );
}

/** PNG with an IHDR chunk carrying width x height. */
export function pngWithIhdr(width: number, height: number): Uint8Array {
  const head = [...PNG_SIG, ...u32be(13), 0x49, 0x48, 0x44, 0x52];
  const arr = new Uint8Array(head.length + 13 + 4);
  arr.set(head, 0);
  const dv = new DataView(arr.buffer);
  dv.setUint32(16, width);
  dv.setUint32(20, height);
  return arr;
}

/** WebP VP8X (extended) header carrying canvas width x height. */
export function webpVp8x(width: number, height: number): Uint8Array {
  const arr = new Uint8Array(32);
  arr.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  arr.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
  arr.set([0x56, 0x50, 0x38, 0x58], 12); // VP8X
  const w = width - 1;
  const h = height - 1;
  arr[24] = w & 0xff;
  arr[25] = (w >> 8) & 0xff;
  arr[26] = (w >> 16) & 0xff;
  arr[27] = h & 0xff;
  arr[28] = (h >> 8) & 0xff;
  arr[29] = (h >> 16) & 0xff;
  return arr;
}

/** WebP VP8 (lossy) header carrying width x height in the 14-bit fields. */
export function webpVp8(width: number, height: number): Uint8Array {
  const arr = new Uint8Array(32);
  arr.set([0x52, 0x49, 0x46, 0x46], 0);
  arr.set([0x57, 0x45, 0x42, 0x50], 8);
  arr.set([0x56, 0x50, 0x38, 0x20], 12); // "VP8 "
  arr[26] = width & 0xff;
  arr[27] = (width >> 8) & 0x3f;
  arr[28] = height & 0xff;
  arr[29] = (height >> 8) & 0x3f;
  return arr;
}

/** WebP VP8L (lossless) header for a fixed 100 x 200 image. */
export function webpVp8l100x200(): Uint8Array {
  const arr = new Uint8Array(32);
  arr.set([0x52, 0x49, 0x46, 0x46], 0);
  arr.set([0x57, 0x45, 0x42, 0x50], 8);
  arr.set([0x56, 0x50, 0x38, 0x4c], 12); // "VP8L"
  arr[20] = 0x2f; // signature
  arr[21] = 0x63; // b0
  arr[22] = 0xc0; // b1
  arr[23] = 0x31; // b2
  arr[24] = 0x00; // b3
  return arr;
}

/** PNG carrying an acTL chunk before IDAT (animated) or not. */
export function pngAnimated(animated: boolean): Uint8Array {
  const parts: number[] = [...PNG_SIG, ...chunk("IHDR", 13)];
  if (animated) parts.push(...chunk("acTL", 8));
  parts.push(...chunk("IDAT", 4));
  return bytes(...parts);
}

/** JPEG carrying an EXIF DateTimeOriginal of "2026:07:01 12:34:56" (big-endian TIFF). */
export function jpegWithExifDate(): Uint8Array {
  const tiff: number[] = [];
  tiff.push(0x4d, 0x4d, 0x00, 0x2a); // "MM", magic
  tiff.push(...u32be(8)); // IFD0 at offset 8
  // IFD0: one entry (ExifIFD pointer)
  tiff.push(0x00, 0x01);
  tiff.push(0x87, 0x69, 0x00, 0x04, ...u32be(1), ...u32be(26)); // tag 0x8769 -> Exif IFD at 26
  tiff.push(...u32be(0)); // next IFD
  // Exif IFD at offset 26: one entry (DateTimeOriginal)
  tiff.push(0x00, 0x01);
  tiff.push(0x90, 0x03, 0x00, 0x02, ...u32be(20), ...u32be(44)); // tag 0x9003, ASCII, at 44
  tiff.push(...u32be(0)); // next IFD
  // ASCII value at offset 44
  const ascii = "2026:07:01 12:34:56\0";
  for (const c of ascii) tiff.push(c.charCodeAt(0));

  const exifSig = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
  const app1Len = 2 + exifSig.length + tiff.length;
  return bytes(
    0xff,
    0xd8, // SOI
    0xff,
    0xe1, // APP1
    (app1Len >> 8) & 0xff,
    app1Len & 0xff,
    ...exifSig,
    ...tiff,
  );
}
