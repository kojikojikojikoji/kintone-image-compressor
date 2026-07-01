import { describe, expect, it } from "vitest";
import { formatSize, reductionRate } from "../../src/core/format";
import { buildRowText, buildTotalText, type ResultRow } from "../../src/core/messages";

describe("formatSize (TC-14)", () => {
  it("formats MB with one decimal and KB as an integer", () => {
    expect(formatSize(1048576)).toBe("1.0MB");
    expect(formatSize(409600)).toBe("400KB");
    expect(formatSize(1023)).toBe("1KB");
  });
});

describe("reductionRate (TC-15)", () => {
  it("rounds the percent reduction", () => {
    // 8.4 MB -> 412 KB is about a 95% reduction.
    expect(reductionRate(8.4 * 1024 * 1024, 412 * 1024)).toBe(95);
  });
});

describe("result-row text (section 6)", () => {
  it("builds the success row with reduction rate", () => {
    const row: ResultRow = {
      kind: "success",
      name: "IMG_0012.jpg",
      originalBytes: 8.4 * 1024 * 1024,
      compressedBytes: 412 * 1024,
    };
    expect(buildRowText(row)).toBe("IMG_0012.jpg　8.4MB → 412KB（95%削減）");
  });
  it("builds the incompatible row with a reason", () => {
    const row: ResultRow = {
      kind: "incompatible",
      name: "anim.gif",
      originalBytes: 2.1 * 1024 * 1024,
      reason: "incompatible-gif",
    };
    expect(buildRowText(row)).toBe("anim.gif　2.1MB（圧縮対象外: GIF）");
  });
  it("omits the total for fewer than two attached files", () => {
    expect(buildTotalText([{ kind: "failed", name: "x", reason: "empty" }])).toBeNull();
  });
  it("builds a total across attached files (skips failures)", () => {
    const rows: ResultRow[] = [
      {
        kind: "success",
        name: "a.jpg",
        originalBytes: 8 * 1024 * 1024,
        compressedBytes: 400 * 1024,
      },
      {
        kind: "success",
        name: "b.jpg",
        originalBytes: 4 * 1024 * 1024,
        compressedBytes: 300 * 1024,
      },
      { kind: "failed", name: "c.jpg", reason: "upload-failed" },
    ];
    expect(buildTotalText(rows)).toBe("合計 12.0MB → 700KB（11.3MB削減）");
  });
});
