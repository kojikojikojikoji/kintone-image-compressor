import { formatSize, reductionRate } from "./format";

// Builds the exact result-row strings shown under the button (requirement doc
// section 6). Text is Japanese by spec; only these UI strings are Japanese, not
// the README. Kept in core/ because it is pure string assembly and is unit
// tested. A full-width space (U+3000) separates the file name from its size.
const SEP = "　";

/** Reasons a file is attached unchanged and shown as "圧縮対象外". */
export type IncompatibleReason =
  | "incompatible-gif"
  | "incompatible-svg"
  | "incompatible-heic"
  | "incompatible-unknown"
  | "apng"
  | "too-many-pixels"
  | "decode-failed"
  | "device-unsupported";

/** Reasons a file could not be attached at all (red failure row). */
export type FailureReason = "empty" | "too-large" | "not-image" | "upload-failed" | "write-failed";

export type ResultRow =
  | { kind: "success"; name: string; originalBytes: number; compressedBytes: number }
  | { kind: "skipped"; name: string; originalBytes: number; thresholdKB: number }
  | { kind: "size-increased"; name: string; originalBytes: number }
  | { kind: "incompatible"; name: string; originalBytes: number; reason: IncompatibleReason }
  | { kind: "failed"; name: string; reason: FailureReason };

const INCOMPATIBLE_TEXT: Record<IncompatibleReason, string> = {
  "incompatible-gif": "GIF",
  "incompatible-svg": "SVG",
  "incompatible-heic": "HEIC",
  "incompatible-unknown": "対応していない形式",
  apng: "アニメーションPNG",
  "too-many-pixels": "画像が大きすぎるため（1億画素超）",
  "decode-failed": "この画像は変換できないため",
  "device-unsupported": "この端末では圧縮できないため",
};

const FAILURE_TEXT: Record<FailureReason, string> = {
  empty: "ファイルが空のため添付できません",
  "too-large": "100MBを超えるファイルは添付できません",
  "not-image": "画像ファイルではないため添付できません",
  "upload-failed": "アップロードに失敗しました。通信環境を確認して再試行してください",
  "write-failed":
    "添付ファイルフィールドに書き込めません。フィールドのアクセス権を確認してください",
};

/** Build the single result-row string for one processed file (section 6). */
export function buildRowText(row: ResultRow): string {
  switch (row.kind) {
    case "success": {
      const from = formatSize(row.originalBytes);
      const to = formatSize(row.compressedBytes);
      const rate = reductionRate(row.originalBytes, row.compressedBytes);
      return `${row.name}${SEP}${from} → ${to}（${rate}%削減）`;
    }
    case "skipped":
      return `${row.name}${SEP}${formatSize(row.originalBytes)}（${row.thresholdKB}KB未満のため圧縮なし）`;
    case "size-increased":
      return `${row.name}${SEP}${formatSize(row.originalBytes)}（圧縮後の方が大きいため元のファイルを添付）`;
    case "incompatible":
      return `${row.name}${SEP}${formatSize(row.originalBytes)}（圧縮対象外: ${INCOMPATIBLE_TEXT[row.reason]}）`;
    case "failed":
      return `${row.name}${SEP}${FAILURE_TEXT[row.reason]}`;
  }
}

/** Whether a row represents a file that ended up attached (counts toward totals). */
export function isAttached(row: ResultRow): boolean {
  return row.kind !== "failed";
}

function attachedBefore(row: ResultRow): number {
  return "originalBytes" in row ? row.originalBytes : 0;
}

function attachedAfter(row: ResultRow): number {
  if (row.kind === "success") return row.compressedBytes;
  return "originalBytes" in row ? row.originalBytes : 0;
}

/**
 * Build the trailing total row, or null when fewer than two files were attached
 * (FR-12). Totals cover every attached file (skipped and incompatible included,
 * failures excluded).
 */
export function buildTotalText(rows: ResultRow[]): string | null {
  const attached = rows.filter(isAttached);
  if (attached.length < 2) return null;
  const before = attached.reduce((sum, r) => sum + attachedBefore(r), 0);
  const after = attached.reduce((sum, r) => sum + attachedAfter(r), 0);
  const diff = Math.max(0, before - after);
  return `合計 ${formatSize(before)} → ${formatSize(after)}（${formatSize(diff)}削減）`;
}
