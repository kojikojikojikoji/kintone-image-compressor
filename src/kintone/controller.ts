import {
  HEADER_BYTES,
  buildFilename,
  buildRowText,
  buildTotalText,
  isApng,
  precheck,
  processInOrder,
  readDimensions,
  readExifDateTimeOriginal,
  sniffFormat,
  type IncompatibleReason,
  type OutputFormat,
  type ResultRow,
  type Settings,
  type SkipReason,
} from "../core";
import { CompressionError, type ImageCompressor } from "./compressor";
import { RecordAppender } from "./uploader";
import { KintoneGateway } from "./rest";
import { RESULT_ID, buttonIcon, el, injectStyles } from "./dom-map";

export interface Platform {
  kind: "desktop" | "mobile";
  recordApi: KintoneRecordApi;
  enableDragDrop: boolean;
}

const CONCURRENCY = 2;
const DRAG_LABEL = "ドロップして添付";
const warnedSpaces = new Set<string>();

// Attaching the original file (not re-encoded). The kind decides the row shown.
interface AttachPlan {
  kind: "attach";
  originalName: string;
  blob: Blob;
  reencoded: boolean;
  outputFormat: OutputFormat | null;
  datePrefix: string | null;
  originalBytes: number;
  rowKind: "success" | "skipped" | "size-increased" | "incompatible";
  thresholdKB?: number;
  incompatibleReason?: IncompatibleReason;
  compressedBytes?: number;
}

interface FailPlan {
  kind: "fail";
  name: string;
  reason: "empty" | "too-large" | "not-image";
}

type Plan = AttachPlan | FailPlan;

function localDate(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

function incompatibleReasonFor(reason: SkipReason): IncompatibleReason {
  switch (reason) {
    case "incompatible-gif":
      return "incompatible-gif";
    case "incompatible-svg":
      return "incompatible-svg";
    case "incompatible-heic":
      return "incompatible-heic";
    case "incompatible-unknown":
      return "incompatible-unknown";
    case "apng":
      return "apng";
    case "too-many-pixels":
      return "too-many-pixels";
    case "below-threshold":
      // Handled as a "skipped" row before reaching here.
      return "incompatible-unknown";
  }
}

/**
 * Insert the compress button into the configured space element and wire the
 * pick / drop pipeline (FR-1..FR-13). Idempotent: re-running on a later show
 * event does not add a second button.
 */
export function mountButton(
  platform: Platform,
  settings: Settings,
  compressor: ImageCompressor,
  gateway: KintoneGateway,
): void {
  const space = platform.recordApi.getSpaceElement(settings.spaceElementId);
  if (!space) {
    if (!warnedSpaces.has(settings.spaceElementId)) {
      warnedSpaces.add(settings.spaceElementId);
      console.warn(
        `kintone-image-compressor: space element "${settings.spaceElementId}" was not found. Check the plugin settings.`,
      );
    }
    return;
  }
  if (space.querySelector(".kp-imgc-btn")) return; // already mounted (二重挿入ガード)

  injectStyles();
  if (platform.kind === "mobile") space.classList.add("kp-imgc-mobile");

  const input = el("input", { type: "file", multiple: "", accept: "image/*" }) as HTMLInputElement;
  input.style.display = "none";

  const button = el("button", { type: "button", class: "kp-imgc-btn" });
  const iconSlot = el("span", { class: "kp-imgc-icon-slot" });
  iconSlot.appendChild(buttonIcon());
  const label = el("span", {}, settings.buttonLabel);
  button.appendChild(iconSlot);
  button.appendChild(label);

  const result = el("div", { class: "kp-imgc-result", id: RESULT_ID });

  space.appendChild(input);
  space.appendChild(button);
  space.appendChild(result);

  let busy = false;
  const appender = () =>
    new RecordAppender(gateway, platform.recordApi, settings.attachmentFieldCode);

  function setLabel(text: string): void {
    label.textContent = text;
  }
  function showSpinner(on: boolean): void {
    iconSlot.textContent = "";
    if (on) {
      iconSlot.appendChild(el("span", { class: "kp-imgc-spinner" }));
    } else {
      iconSlot.appendChild(buttonIcon());
    }
  }

  async function run(files: File[]): Promise<void> {
    if (busy || files.length === 0) return;
    busy = true;
    button.disabled = true;
    showSpinner(true);
    result.textContent = "";

    const total = files.length;
    let completed = 0;
    const rows: (ResultRow | null)[] = new Array(total).fill(null);
    const orientationSupported = await compressor.isOrientationSupported();

    const app = appender();
    const takenNames = app.getExistingFileNames();

    const count = el("div", { class: "kp-imgc-count" });
    const progress = el("div", { class: "kp-imgc-progress" });
    const bar = el("div", { class: "kp-imgc-progress-bar" });
    progress.appendChild(bar);
    const rowsWrap = el("div");
    result.appendChild(count);
    result.appendChild(progress);
    result.appendChild(rowsWrap);

    function renderRows(): void {
      rowsWrap.textContent = "";
      const present: ResultRow[] = [];
      for (const row of rows) {
        if (!row) continue;
        present.push(row);
        const line = el("div", {
          class: row.kind === "failed" ? "kp-imgc-row kp-imgc-row-failed" : "kp-imgc-row",
        });
        line.textContent = buildRowText(row);
        rowsWrap.appendChild(line);
      }
      const totalText = buildTotalText(present);
      if (totalText) {
        const totalLine = el("div", { class: "kp-imgc-total" });
        totalLine.textContent = totalText;
        rowsWrap.appendChild(totalLine);
      }
    }

    function bumpProgress(): void {
      completed += 1;
      bar.style.width = `${Math.round((completed / total) * 100)}%`;
      count.textContent = `${completed}/${total} 件目を処理中`;
      if (completed >= total) {
        count.remove();
        progress.remove();
      }
    }

    async function process(index: number): Promise<Plan> {
      const file = files[index];
      try {
        const header = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer());
        const format = sniffFormat(header);
        if (format === "unknown" && !file.type.startsWith("image/")) {
          return { kind: "fail", name: file.name, reason: "not-image" };
        }
        const dims = readDimensions(format, header);
        const pixels = dims ? dims.width * dims.height : null;
        const apng = format === "png" && isApng(header);
        const decision = precheck({
          sizeBytes: file.size,
          format,
          isApng: apng,
          pixels,
          skipThresholdBytes: settings.skipThresholdKB * 1024,
        });

        if (decision.action === "reject") {
          return { kind: "fail", name: file.name, reason: decision.reason };
        }
        if (decision.action === "attach-original") {
          if (decision.reason === "below-threshold") {
            return attachOriginal(file, {
              rowKind: "skipped",
              thresholdKB: settings.skipThresholdKB,
            });
          }
          return attachOriginal(file, {
            rowKind: "incompatible",
            incompatibleReason: incompatibleReasonFor(decision.reason),
          });
        }
        // compress
        if (!orientationSupported) {
          return attachOriginal(file, {
            rowKind: "incompatible",
            incompatibleReason: "device-unsupported",
          });
        }
        const exifDate = format === "jpeg" ? readExifDateTimeOriginal(header) : null;
        try {
          const outcome = await compressor.compress(file, format, settings);
          if (outcome.blob.size >= file.size) {
            return attachOriginal(file, { rowKind: "size-increased" });
          }
          const datePrefix = settings.prependDateToFilename
            ? (exifDate ?? localDate(file.lastModified))
            : null;
          return {
            kind: "attach",
            originalName: file.name,
            blob: outcome.blob,
            reencoded: true,
            outputFormat: outcome.outputFormat,
            datePrefix,
            originalBytes: file.size,
            rowKind: "success",
            compressedBytes: outcome.blob.size,
          };
        } catch (err) {
          const reason: IncompatibleReason =
            err instanceof CompressionError && err.reason === "device-unsupported"
              ? "device-unsupported"
              : "decode-failed";
          return attachOriginal(file, { rowKind: "incompatible", incompatibleReason: reason });
        }
      } catch {
        return attachOriginal(file, {
          rowKind: "incompatible",
          incompatibleReason: "decode-failed",
        });
      }
    }

    async function append(index: number, plan: Plan): Promise<void> {
      if (plan.kind === "fail") {
        rows[index] = { kind: "failed", name: plan.name, reason: plan.reason };
        renderRows();
        bumpProgress();
        return;
      }
      const finalName = buildFilename({
        originalName: plan.originalName,
        outputFormat: plan.reencoded ? plan.outputFormat : null,
        datePrefix: plan.datePrefix,
        existingNames: takenNames,
      });
      takenNames.push(finalName);
      let fileKey: string;
      try {
        fileKey = await app.upload(finalName, plan.blob);
      } catch {
        rows[index] = { kind: "failed", name: finalName, reason: "upload-failed" };
        renderRows();
        bumpProgress();
        return;
      }
      if (!app.append(fileKey)) {
        rows[index] = { kind: "failed", name: finalName, reason: "write-failed" };
        renderRows();
        bumpProgress();
        return;
      }
      rows[index] = buildAttachedRow(plan, finalName);
      renderRows();
      bumpProgress();
    }

    try {
      await processInOrder(total, CONCURRENCY, process, append);
    } finally {
      busy = false;
      button.disabled = false;
      showSpinner(false);
      setLabel(settings.buttonLabel);
    }
  }

  button.addEventListener("click", () => {
    if (busy) return;
    input.value = "";
    input.click();
  });
  input.addEventListener("change", () => {
    const files = input.files ? Array.from(input.files) : [];
    void run(files);
  });

  if (platform.enableDragDrop) {
    button.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (busy) return;
      button.classList.add("kp-imgc-dragover");
      setLabel(DRAG_LABEL);
    });
    button.addEventListener("dragleave", (e) => {
      e.preventDefault();
      e.stopPropagation();
      button.classList.remove("kp-imgc-dragover");
      setLabel(settings.buttonLabel);
    });
    button.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      button.classList.remove("kp-imgc-dragover");
      setLabel(settings.buttonLabel);
      if (busy || !e.dataTransfer) return;
      const files = collectDroppedFiles(e.dataTransfer);
      void run(files);
    });
  }
}

function attachOriginal(
  file: File,
  opts: {
    rowKind: "skipped" | "size-increased" | "incompatible";
    thresholdKB?: number;
    incompatibleReason?: IncompatibleReason;
  },
): AttachPlan {
  return {
    kind: "attach",
    originalName: file.name,
    blob: file,
    reencoded: false,
    outputFormat: null,
    datePrefix: null,
    originalBytes: file.size,
    rowKind: opts.rowKind,
    thresholdKB: opts.thresholdKB,
    incompatibleReason: opts.incompatibleReason,
  };
}

function buildAttachedRow(plan: AttachPlan, name: string): ResultRow {
  switch (plan.rowKind) {
    case "success":
      return {
        kind: "success",
        name,
        originalBytes: plan.originalBytes,
        compressedBytes: plan.compressedBytes ?? plan.originalBytes,
      };
    case "skipped":
      return {
        kind: "skipped",
        name,
        originalBytes: plan.originalBytes,
        thresholdKB: plan.thresholdKB ?? 0,
      };
    case "size-increased":
      return { kind: "size-increased", name, originalBytes: plan.originalBytes };
    case "incompatible":
      return {
        kind: "incompatible",
        name,
        originalBytes: plan.originalBytes,
        reason: plan.incompatibleReason ?? "decode-failed",
      };
  }
}

/** Collect dropped files, ignoring dropped folders (FR-3). */
function collectDroppedFiles(dt: DataTransfer): File[] {
  const files: File[] = [];
  if (dt.items && dt.items.length > 0) {
    for (const item of Array.from(dt.items)) {
      if (item.kind !== "file") continue;
      const entry = item.webkitGetAsEntry?.();
      if (entry && entry.isDirectory) continue;
      const file = item.getAsFile();
      if (file) files.push(file);
    }
    return files;
  }
  return Array.from(dt.files);
}
