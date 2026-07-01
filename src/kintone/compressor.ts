import {
  computeResizedDimensions,
  decideOutputFormat,
  type ImageFormat,
  type OutputFormat,
  type Settings,
} from "../core";

export type CompressionFailureReason = "decode-failed" | "device-unsupported";

/** Thrown when a file cannot be decoded or encoded; the caller attaches the original. */
export class CompressionError extends Error {
  constructor(public readonly reason: CompressionFailureReason) {
    super(reason);
    this.name = "CompressionError";
  }
}

export interface CompressionOutcome {
  blob: Blob;
  outputFormat: OutputFormat;
}

/**
 * The canvas-based encoder is kept behind this interface so the pipeline can be
 * exercised in tests with a fake that returns fixed blobs, without a real canvas
 * or createImageBitmap. The pure decision logic (resize dimensions, output
 * format) lives in core/ and is shared by any implementation.
 */
export interface ImageCompressor {
  /** Whether createImageBitmap honors imageOrientation:'from-image' (EC-18). */
  isOrientationSupported(): Promise<boolean>;
  /** Decode, resize, and re-encode a file. Throws CompressionError on failure. */
  compress(file: File, format: ImageFormat, settings: Settings): Promise<CompressionOutcome>;
}

async function toBlobAsync(
  canvas: HTMLCanvasElement,
  mime: string,
  quality?: number,
): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), mime, quality);
    } catch {
      resolve(null);
    }
  });
  if (!blob) {
    // iOS Safari canvas area limit (EC-8) or an unsupported mime.
    throw new CompressionError("device-unsupported");
  }
  return blob;
}

function hasTransparency(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  const data = ctx.getImageData(0, 0, width, height).data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true;
  }
  return false;
}

export class CanvasImageCompressor implements ImageCompressor {
  async isOrientationSupported(): Promise<boolean> {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const probe = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/png");
      });
      if (!probe) return false;
      const bitmap = await createImageBitmap(probe, { imageOrientation: "from-image" });
      bitmap.close();
      return true;
    } catch {
      return false;
    }
  }

  async compress(file: File, format: ImageFormat, settings: Settings): Promise<CompressionOutcome> {
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Broken file, or a decoder the browser lacks (CMYK JPEG etc.): EC-2, EC-16.
      throw new CompressionError("decode-failed");
    }

    const target = computeResizedDimensions(bitmap.width, bitmap.height, settings.maxLongEdge);
    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      throw new CompressionError("device-unsupported");
    }
    ctx.drawImage(bitmap, 0, 0, target.width, target.height);
    bitmap.close();

    // JPEG carries no alpha, so only scan PNG/WebP for transparency (FR-7).
    const hasAlpha = format === "jpeg" ? false : hasTransparency(ctx, target.width, target.height);
    const decision = decideOutputFormat(format, hasAlpha, settings.convertPngToJpeg);

    if (decision.flattenToWhite) {
      // Composite white behind the existing pixels (WebP alpha to JPEG, EC-20).
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, target.width, target.height);
      ctx.globalCompositeOperation = "source-over";
    }

    const blob =
      decision.format === "jpeg"
        ? await toBlobAsync(canvas, "image/jpeg", settings.jpegQuality)
        : await toBlobAsync(canvas, "image/png");

    return { blob, outputFormat: decision.format };
  }
}
