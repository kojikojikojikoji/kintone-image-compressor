const MIB = 1024 * 1024;

/**
 * Human-readable byte size (6 chapter). 1 MiB and above shows one decimal in MB;
 * below that shows an integer in KB. Both use base 1024.
 */
export function formatSize(bytes: number): string {
  if (bytes >= MIB) {
    return `${(bytes / MIB).toFixed(1)}MB`;
  }
  return `${Math.round(bytes / 1024)}KB`;
}

/** Reduction percentage from original to compressed size: round((1 - after/before) * 100). */
export function reductionRate(originalBytes: number, compressedBytes: number): number {
  if (originalBytes <= 0) return 0;
  return Math.round((1 - compressedBytes / originalBytes) * 100);
}
