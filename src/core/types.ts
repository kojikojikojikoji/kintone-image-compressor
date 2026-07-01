// Shared pure types for the compression decision logic. Nothing here touches
// the DOM, canvas, or the kintone global, so every module that imports only
// from core/ stays unit-testable in a Node environment.

/** Image format detected from the leading bytes (FR-4). */
export type ImageFormat = "jpeg" | "png" | "gif" | "webp" | "heic" | "svg" | "unknown";

/** Formats the plugin can decode and re-encode. Everything else is attached as-is. */
export const COMPRESSIBLE_FORMATS: readonly ImageFormat[] = ["jpeg", "png", "webp"];

/** Formats attached without change because no browser decoder or intent covers them. */
export const INCOMPATIBLE_FORMATS: readonly ImageFormat[] = ["gif", "svg", "heic", "unknown"];

/** Output container the encoder targets (FR-7). WebP/AVIF output is out of scope. */
export type OutputFormat = "jpeg" | "png";

export interface Dimensions {
  width: number;
  height: number;
}
