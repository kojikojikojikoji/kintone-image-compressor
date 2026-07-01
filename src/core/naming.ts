import type { OutputFormat } from "./types";

function canonicalExtension(format: OutputFormat): string {
  return format === "jpeg" ? ".jpg" : ".png";
}

function splitName(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) {
    return { base: name, ext: "" };
  }
  return { base: name.slice(0, dot), ext: name.slice(dot) };
}

/**
 * Force the file extension to match the output format (FR-9 step 2). JPEG output
 * always uses ".jpg"; a name without an extension gains one. Called only when
 * the file was re-encoded.
 */
export function applyOutputExtension(name: string, format: OutputFormat): string {
  const { base } = splitName(name);
  return base + canonicalExtension(format);
}

/** Prepend a "YYYYMMDD_" capture-date prefix (FR-9 step 1). */
export function prependDate(name: string, datePrefix: string): string {
  return `${datePrefix}_${name}`;
}

/**
 * Add " (2)", " (3)", ... before the extension until the name no longer clashes
 * with an existing name (FR-9 step 3). Comparison ignores case.
 */
export function dedupeName(name: string, existingLower: Set<string>): string {
  if (!existingLower.has(name.toLowerCase())) {
    return name;
  }
  const { base, ext } = splitName(name);
  for (let n = 2; n < 10000; n += 1) {
    const candidate = `${base} (${n})${ext}`;
    if (!existingLower.has(candidate.toLowerCase())) {
      return candidate;
    }
  }
  return name;
}

export interface FilenameParams {
  originalName: string;
  /** Output container when re-encoded, or null to keep the original file unchanged. */
  outputFormat: OutputFormat | null;
  /** "YYYYMMDD" prefix to prepend, or null. Applied only when re-encoded. */
  datePrefix: string | null;
  /** Names already present in the target field plus names decided earlier in the batch. */
  existingNames: string[];
}

/**
 * Decide the final attachment file name from the original name, whether the file
 * was re-encoded, an optional date prefix, and the names to avoid colliding with
 * (FR-9). Extension change and date prefix apply only to re-encoded files;
 * deduplication always applies.
 */
export function buildFilename(params: FilenameParams): string {
  const existingLower = new Set(params.existingNames.map((n) => n.toLowerCase()));
  let name = params.originalName;
  if (params.outputFormat !== null) {
    name = applyOutputExtension(name, params.outputFormat);
    if (params.datePrefix) {
      name = prependDate(name, params.datePrefix);
    }
  }
  return dedupeName(name, existingLower);
}
