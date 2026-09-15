// Detail panels can be closed independently of tree, genes and anatomy context.
export const detailTypes = ["genome", "walk", "barplot", "scatterplot", "bigwig"];
export const isDetailPlot = plot => detailTypes.includes(plot.type);

// Panel identity is not a transport cache key: one source can have several
// intentional views (e.g. DEMO's aligned walk and raw binset). Clones retain IDs.
export function plotIdentity(plot) {
  if (plot.id != null) return `id:${plot.id}`;
  const display = [plot.ownerFile, plot.type, plot.sample, plot.tag, plot.defaultChartType];
  // Menu descriptors have no manifest source or ID. Metadata/zoom adds path and
  // title, neither of which may change their identity.
  if (plot.type === "bigwig") return JSON.stringify([...display, plot.server, plot.uuid]);
  return JSON.stringify([...display, plot.source || plot.path, plot.name || plot.title]);
}

// A single scheduler is shared by overview, confirmed details and lazy coverage.
// Slots remain occupied until cancelled in-flight work actually settles.
export function createBoundedLoader({ concurrency = 3 } = {}) {
  const limit = Math.max(1, Math.min(3, Math.floor(concurrency) || 3));
  const cache = new Map();
  const batches = new Set();
  let generation = 0;
  let active = 0;
  let queue = [];

  function pump() {
    while (active < limit && queue.length) {
      const job = queue.shift();
      if (job.batch.cancelled) continue;
      active++;
      Promise.resolve()
        .then(() => job.token.cancelled ? undefined : job.load(job.item, job.token))
        .then(
          (value) => finish(job, value, null),
          (error) => finish(job, undefined, error)
        );
    }
  }

  function finish(job, value, error) {
    const { batch } = job;
    batch.tokens.delete(job.token);
    if (!job.token.cancelled) {
      batch.completed++;
      if (error) batch.errors.push({ item: job.item, error });
      try {
        batch.onResult({ item: job.item, value, error, completed: batch.completed, total: batch.total });
      } finally {
        if (batch.completed === batch.total) batch.settle();
      }
    }
    active--;
    pump();
  }

  function run(items, load, { key = (item) => item, onResult = () => {} } = {}) {
    const unique = Array.from(new Map(items.map((item) => [key(item), item])).values());
    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    const batch = {
      total: unique.length, completed: 0, errors: [], cancelled: false,
      tokens: new Set(), onResult,
      settle() {
        batches.delete(batch);
        resolve({ total: batch.total, completed: batch.completed, errors: batch.errors, cancelled: batch.cancelled });
      },
      cancel() {
        if (batch.cancelled) return;
        batch.cancelled = true;
        batch.tokens.forEach((token) => token.abort());
        queue = queue.filter((job) => job.batch !== batch);
        batch.settle();
      },
    };
    batches.add(batch);
    unique.forEach((item) => {
      const epoch = generation;
      const callbacks = new Set();
      const token = {
        get cancelled() { return batch.cancelled || epoch !== generation; },
        onCancel(callback) {
          if (token.cancelled) callback();
          else callbacks.add(callback);
          return () => callbacks.delete(callback);
        },
        abort() { callbacks.forEach((callback) => callback()); callbacks.clear(); },
      };
      batch.tokens.add(token);
      queue.push({ batch, token, item, load });
    });
    if (!unique.length) batch.settle();
    pump();
    return { promise, cancel: batch.cancel };
  }

  return {
    run,
    // Cache only successful responses, not failures or cancelled requests.
    async get(key, fetcher, token) {
      if (token && token.cancelled) throw new Error("Request cancelled");
      if (cache.has(key)) return cache.get(key);
      const epoch = generation;
      const value = await fetcher(token);
      if (epoch === generation && !(token && token.cancelled)) cache.set(key, value);
      return value;
    },
    seed(key, value) { cache.set(key, value); },
    // An adapter may reject a transport-successful response; retry that source
    // without throwing away all successfully validated cells in the cohort.
    forget(key) { cache.delete(key); },
    invalidate() {
      generation++;
      Array.from(batches).forEach((batch) => batch.cancel());
      cache.clear();
    },
  };
}
