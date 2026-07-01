import { z } from "zod";

// The settings screen writes a single JSON string under this key (common spec 4).
export const CONFIG_KEY = "config";

export const MAX_LONG_EDGE_CHOICES = [1280, 1920, 2560, 4096] as const;

const settingsSchema = z.object({
  spaceElementId: z.string().min(1),
  attachmentFieldCode: z.string().min(1),
  maxLongEdge: z.union([z.literal(1280), z.literal(1920), z.literal(2560), z.literal(4096)]),
  jpegQuality: z.number().min(0.5).max(0.95),
  skipThresholdKB: z.number().int().min(0).max(10240),
  convertPngToJpeg: z.boolean(),
  prependDateToFilename: z.boolean(),
  buttonLabel: z.string().min(1).max(30),
});

export const configSchema = z.object({
  version: z.literal(1),
  settings: settingsSchema,
});

export type Settings = z.infer<typeof settingsSchema>;
export type PluginConfig = z.infer<typeof configSchema>;

export const DEFAULT_SETTINGS: Settings = {
  spaceElementId: "",
  attachmentFieldCode: "",
  maxLongEdge: 1920,
  jpegQuality: 0.8,
  skipThresholdKB: 300,
  convertPngToJpeg: true,
  prependDateToFilename: false,
  buttonLabel: "画像を圧縮して添付",
};

/**
 * Parse the stored config JSON into a full PluginConfig, or null when the value
 * is missing, malformed, an unknown version, or fails schema validation. A null
 * result means "not configured yet"; the plugin then does nothing on record
 * screens (common spec 4).
 */
export function parseConfig(configString: string | undefined | null): PluginConfig | null {
  if (!configString) {
    return null;
  }
  let data: unknown;
  try {
    data = JSON.parse(configString);
  } catch {
    return null;
  }
  const result = configSchema.safeParse(data);
  return result.success ? result.data : null;
}

/** Serialize settings to the JSON string stored under the single config key. */
export function serializeConfig(settings: Settings): string {
  return JSON.stringify({ version: 1, settings });
}
