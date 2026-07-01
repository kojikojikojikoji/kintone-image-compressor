import { INCOMPATIBLE_FORMATS, type ImageFormat } from "./types";

export const MAX_FILE_BYTES = 104_857_600; // 100 MB (FR-5 step 2, EC-10)
export const MAX_PIXELS = 100_000_000; // 100 MP (FR-5 step 5, EC-9)

/** Why a file is attached without compression, mapped to a result-row reason. */
export type SkipReason =
  | "incompatible-gif"
  | "incompatible-svg"
  | "incompatible-heic"
  | "incompatible-unknown"
  | "apng"
  | "too-many-pixels"
  | "below-threshold";

/** Why a file cannot be attached at all (red failure row). */
export type RejectReason = "empty" | "too-large";

export type PrecheckResult =
  | { action: "reject"; reason: RejectReason }
  | { action: "attach-original"; reason: SkipReason }
  | { action: "compress" };

export interface PrecheckInput {
  sizeBytes: number;
  format: ImageFormat;
  isApng: boolean;
  /** width * height from the header, or null when it could not be read. */
  pixels: number | null;
  skipThresholdBytes: number;
}

function incompatibleReason(format: ImageFormat): SkipReason {
  switch (format) {
    case "gif":
      return "incompatible-gif";
    case "svg":
      return "incompatible-svg";
    case "heic":
      return "incompatible-heic";
    default:
      return "incompatible-unknown";
  }
}

/**
 * Apply the FR-5 ordered pre-checks. The first matching rule wins:
 * 1. empty file -> reject
 * 2. over 100 MB -> reject
 * 3. incompatible format (GIF/SVG/HEIC/unknown) -> attach original
 * 4. animated PNG -> attach original
 * 5. over 100 MP -> attach original (do not decode)
 * 6. below the skip threshold -> attach original
 * otherwise -> compress
 */
export function precheck(input: PrecheckInput): PrecheckResult {
  if (input.sizeBytes === 0) {
    return { action: "reject", reason: "empty" };
  }
  if (input.sizeBytes > MAX_FILE_BYTES) {
    return { action: "reject", reason: "too-large" };
  }
  if (INCOMPATIBLE_FORMATS.includes(input.format)) {
    return { action: "attach-original", reason: incompatibleReason(input.format) };
  }
  if (input.format === "png" && input.isApng) {
    return { action: "attach-original", reason: "apng" };
  }
  if (input.pixels !== null && input.pixels > MAX_PIXELS) {
    return { action: "attach-original", reason: "too-many-pixels" };
  }
  if (input.sizeBytes < input.skipThresholdBytes) {
    return { action: "attach-original", reason: "below-threshold" };
  }
  return { action: "compress" };
}
