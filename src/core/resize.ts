import type { Dimensions, ImageFormat, OutputFormat } from "./types";

/**
 * Compute the drawn dimensions after scaling the long edge down to maxLongEdge
 * (FR-6). When the long edge already fits, the original size is kept and only
 * re-encoding happens. The short edge is rounded with Math.round.
 */
export function computeResizedDimensions(
  width: number,
  height: number,
  maxLongEdge: number,
): Dimensions {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxLongEdge) {
    return { width, height };
  }
  const scale = maxLongEdge / longEdge;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

export interface OutputDecision {
  format: OutputFormat;
  /** Whether the source must be flattened onto white before encoding (WebP alpha to JPEG). */
  flattenToWhite: boolean;
}

/**
 * Decide the output container and whether to flatten transparency, from the
 * detected input format, whether the pixels carry any transparency, and the
 * "convert opaque PNG to JPEG" setting (FR-7 table). Only jpeg/webp/png inputs
 * reach here; other formats are attached without re-encoding.
 */
export function decideOutputFormat(
  input: ImageFormat,
  hasAlpha: boolean,
  convertPngToJpeg: boolean,
): OutputDecision {
  switch (input) {
    case "jpeg":
      return { format: "jpeg", flattenToWhite: false };
    case "png":
      if (hasAlpha) return { format: "png", flattenToWhite: false };
      return convertPngToJpeg
        ? { format: "jpeg", flattenToWhite: false }
        : { format: "png", flattenToWhite: false };
    case "webp":
      // WebP always encodes to JPEG; flatten onto white when it has transparency.
      return { format: "jpeg", flattenToWhite: hasAlpha };
    default:
      // Not reached for compressible inputs; default keeps the safest container.
      return { format: "png", flattenToWhite: false };
  }
}
