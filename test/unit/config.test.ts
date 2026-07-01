import { describe, expect, it } from "vitest";
import { configSchema, parseConfig, serializeConfig, type Settings } from "../../src/core/config";

const validSettings: Settings = {
  spaceElementId: "compress_space",
  attachmentFieldCode: "photos",
  maxLongEdge: 1920,
  jpegQuality: 0.8,
  skipThresholdKB: 300,
  convertPngToJpeg: true,
  prependDateToFilename: false,
  buttonLabel: "画像を圧縮して添付",
};

describe("configSchema (TC-17)", () => {
  it("accepts a valid config", () => {
    expect(configSchema.safeParse({ version: 1, settings: validSettings }).success).toBe(true);
  });
  it("rejects a jpegQuality below the range", () => {
    const bad = { version: 1, settings: { ...validSettings, jpegQuality: 0.3 } };
    expect(configSchema.safeParse(bad).success).toBe(false);
  });
  it("rejects an unknown version", () => {
    const bad = { version: 2, settings: validSettings };
    expect(configSchema.safeParse(bad).success).toBe(false);
  });
  it("rejects a string maxLongEdge", () => {
    const bad = { version: 1, settings: { ...validSettings, maxLongEdge: "1920" } };
    expect(configSchema.safeParse(bad).success).toBe(false);
  });
});

describe("parseConfig / serializeConfig", () => {
  it("round-trips valid settings", () => {
    const json = serializeConfig(validSettings);
    expect(parseConfig(json)?.settings).toEqual(validSettings);
  });
  it("returns null for missing or malformed input", () => {
    expect(parseConfig(undefined)).toBeNull();
    expect(parseConfig("not json")).toBeNull();
    expect(
      parseConfig(JSON.stringify({ version: 1, settings: { ...validSettings, jpegQuality: 9 } })),
    ).toBeNull();
  });
});
