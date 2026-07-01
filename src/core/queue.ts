/**
 * Run `count` tasks with at most `concurrency` in flight, and call `append` in
 * strict index order as each contiguous run of tasks finishes (FR-10, FR-11).
 *
 * `process(index)` does the per-file work (compress then upload); it must
 * resolve rather than reject (callers catch their own errors and return a result
 * value). `append(index, result)` writes the finished file into the record and
 * is always serialized: it never runs for index n+1 before index n, and never
 * two at once. Completion order of `process` may differ from index order; append
 * order does not.
 */
export async function processInOrder<R>(
  count: number,
  concurrency: number,
  process: (index: number) => Promise<R>,
  append: (index: number, result: R) => Promise<void>,
): Promise<void> {
  const results = new Array<R>(count);
  const done = new Array<boolean>(count).fill(false);
  let nextToStart = 0;
  let nextToAppend = 0;
  let appendChain: Promise<void> = Promise.resolve();

  async function flushAppends(): Promise<void> {
    while (nextToAppend < count && done[nextToAppend]) {
      const index = nextToAppend;
      await append(index, results[index]);
      nextToAppend += 1;
    }
  }

  function scheduleFlush(): Promise<void> {
    appendChain = appendChain.then(flushAppends);
    return appendChain;
  }

  async function worker(): Promise<void> {
    for (;;) {
      const index = nextToStart;
      if (index >= count) return;
      nextToStart += 1;
      results[index] = await process(index);
      done[index] = true;
      await scheduleFlush();
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, count));
  const workers: Promise<void>[] = [];
  for (let i = 0; i < workerCount; i += 1) {
    workers.push(worker());
  }
  await Promise.all(workers);
  await scheduleFlush();
}
