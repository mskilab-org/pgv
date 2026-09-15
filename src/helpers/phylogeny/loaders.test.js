import { createBoundedLoader, plotIdentity } from "./loaders";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test("panel identity distinguishes IDs and display variants without depending on mutable transport path", () => {
  const walk = { ownerFile: "DEMO", sample: "7K", type: "walk", source: "walks.json", tag: "walk" };
  expect(plotIdentity(walk)).not.toBe(plotIdentity({ ...walk, tag: "binset" }));
  expect(plotIdentity({ ...walk, id: "one" })).not.toBe(plotIdentity({ ...walk, id: "two" }));
  expect(plotIdentity({ ...walk, id: "one" })).toBe(plotIdentity({ ...walk, id: "one", visible: false, deleted: true, data: {} }));
  const bigwig = { type: "bigwig", server: "s", uuid: "u" };
  expect(plotIdentity(bigwig)).toBe(plotIdentity({ ...bigwig, path: "s/api/v1/tiles/?d=u.2.0", title: "Server name", tilesetInfo: {} }));
  expect(plotIdentity(bigwig)).not.toBe(plotIdentity({ ...bigwig, server: "other" }));
  expect(plotIdentity({ ...walk, defaultChartType: "area" })).not.toBe(plotIdentity({ ...walk, defaultChartType: "scatterplot" }));
});

test("empty and duplicate cells; cap is never above three even across batches", async () => {
  const loader = createBoundedLoader({ concurrency: 20 });
  expect(await loader.run([], jest.fn()).promise).toMatchObject({ total: 0, completed: 0 });
  let active = 0, peak = 0;
  const load = jest.fn(async (item) => {
    peak = Math.max(peak, ++active);
    await tick();
    active--;
    return item;
  });
  const a = loader.run([0, 0, ...Array.from({ length: 125 }, (_, i) => i)], load);
  const b = loader.run(["extra"], load);
  expect(await a.promise).toMatchObject({ total: 125, completed: 125, errors: [] });
  await b.promise;
  expect(load).toHaveBeenCalledTimes(126);
  expect(peak).toBe(3);
});

test("per-cell errors do not stop peers and successful raw values are cached; failures retry", async () => {
  const loader = createBoundedLoader();
  const fetcher = jest.fn().mockRejectedValueOnce(new Error("unavailable")).mockResolvedValue({ intervals: [] });
  const load = (id, token) => loader.get(id, fetcher, token);
  const report = jest.fn();
  expect(await loader.run(["a"], load, { onResult: report }).promise).toMatchObject({ completed: 1, errors: [{ item: "a" }] });
  expect(await loader.run(["a"], load).promise).toMatchObject({ completed: 1, errors: [] });
  await loader.run(["a"], load).promise;
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(report.mock.calls[0][0].error.message).toBe("unavailable");
  const result = await loader.run(["bad", "good"], (id) => id === "bad" ? Promise.reject(new Error("bad")) : id).promise;
  expect(result).toMatchObject({ completed: 2, total: 2, errors: [{ item: "bad" }] });
});

test("cancel stops queued cells, notifies abort, and ignores late results", async () => {
  const loader = createBoundedLoader({ concurrency: 1 });
  const pending = deferred();
  const abort = jest.fn(), report = jest.fn();
  const load = jest.fn((id, token) => { token.onCancel(abort); return pending.promise; });
  const task = loader.run(["a", "b"], load, { onResult: report });
  await tick();
  task.cancel();
  expect(await task.promise).toMatchObject({ cancelled: true, completed: 0, total: 2 });
  expect(abort).toHaveBeenCalledTimes(1);
  pending.resolve("old");
  await tick();
  expect(load).toHaveBeenCalledTimes(1);
  expect(report).not.toHaveBeenCalled();
});

test("epoch invalidation discards stale cache writes and preserves global concurrency", async () => {
  const loader = createBoundedLoader({ concurrency: 1 });
  const pending = deferred();
  const first = loader.run(["a"], (id, token) => loader.get(id, () => pending.promise, token));
  await tick();
  loader.invalidate();
  const fresh = jest.fn().mockResolvedValue("fresh");
  const next = loader.run(["a"], (id, token) => loader.get(id, fresh, token));
  expect(fresh).not.toHaveBeenCalled();
  pending.resolve("stale");
  await first.promise;
  await next.promise;
  expect(fresh).toHaveBeenCalledTimes(1);
  expect(await loader.get("a", () => "wrong")).toBe("fresh");
});

test("cancelled raw requests cannot seed the cache; explicit seed reuses launch data", async () => {
  const loader = createBoundedLoader();
  const pending = deferred();
  const task = loader.run(["a"], (id, token) => loader.get(id, () => pending.promise, token));
  await tick();
  task.cancel();
  pending.resolve("stale");
  await tick();
  expect(await loader.get("a", () => "new")).toBe("new");
  loader.seed("b", { intervals: [] });
  const unused = jest.fn();
  expect(await loader.get("b", unused)).toEqual({ intervals: [] });
  expect(unused).not.toHaveBeenCalled();
});
