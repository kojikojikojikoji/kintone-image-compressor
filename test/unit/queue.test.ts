import { describe, expect, it } from "vitest";
import { processInOrder } from "../../src/core/queue";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("processInOrder (TC-18)", () => {
  it("keeps concurrency <= 2 and appends in submission order even when completion order differs", async () => {
    let active = 0;
    let maxActive = 0;
    const appended: number[] = [];

    await processInOrder(
      6,
      2,
      async (index) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        // Earlier indexes finish later, so completion order is not submission order.
        await wait((6 - index) * 5);
        active -= 1;
        return index * 10;
      },
      async (index, result) => {
        expect(result).toBe(index * 10);
        appended.push(index);
      },
    );

    expect(maxActive).toBeLessThanOrEqual(2);
    expect(appended).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("serializes appends (never two at once)", async () => {
    let appendActive = 0;
    let appendMax = 0;
    await processInOrder(
      5,
      2,
      async (index) => index,
      async () => {
        appendActive += 1;
        appendMax = Math.max(appendMax, appendActive);
        await wait(3);
        appendActive -= 1;
      },
    );
    expect(appendMax).toBe(1);
  });
});
