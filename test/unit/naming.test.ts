import { describe, expect, it } from "vitest";
import { buildFilename } from "../../src/core/naming";

describe("buildFilename extension change (TC-11)", () => {
  it("changes the extension to match JPEG output", () => {
    expect(
      buildFilename({
        originalName: "photo.png",
        outputFormat: "jpeg",
        datePrefix: null,
        existingNames: [],
      }),
    ).toBe("photo.jpg");
  });
  it("adds an extension when the name has none", () => {
    expect(
      buildFilename({
        originalName: "photo",
        outputFormat: "jpeg",
        datePrefix: null,
        existingNames: [],
      }),
    ).toBe("photo.jpg");
  });
});

describe("buildFilename deduplication (TC-12)", () => {
  it("appends the next available (n), ignoring case", () => {
    expect(
      buildFilename({
        originalName: "photo.jpg",
        outputFormat: "jpeg",
        datePrefix: null,
        existingNames: ["photo.jpg", "photo (2).jpg"],
      }),
    ).toBe("photo (3).jpg");
  });
  it("treats a case-different existing name as a duplicate", () => {
    expect(
      buildFilename({
        originalName: "photo.jpg",
        outputFormat: "jpeg",
        datePrefix: null,
        existingNames: ["PHOTO.JPG"],
      }),
    ).toBe("photo (2).jpg");
  });
});

describe("buildFilename date prefix (TC-13)", () => {
  it("combines date prefix and extension change", () => {
    expect(
      buildFilename({
        originalName: "photo.png",
        outputFormat: "jpeg",
        datePrefix: "20260701",
        existingNames: [],
      }),
    ).toBe("20260701_photo.jpg");
  });
  it("does not change the name of a file attached without re-encoding", () => {
    expect(
      buildFilename({
        originalName: "raw.gif",
        outputFormat: null,
        datePrefix: "20260701",
        existingNames: [],
      }),
    ).toBe("raw.gif");
  });
});
