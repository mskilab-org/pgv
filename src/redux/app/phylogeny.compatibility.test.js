import fs from "fs";
import path from "path";
import { runSaga, stdChannel } from "redux-saga";
import axios from "axios";
import actions from "./actions";
import reducer from "./reducer";
import rootSaga, { launchApplication, loadPhylogenyHeatmap, openPhylogenyCells, loadVisiblePlotData, phylogenyLoader } from "./saga";
import { loadArrowTable, updateChromoBins } from "../../helpers/utility";
import { plotIdentity } from "../../helpers/phylogeny/loaders";

jest.mock("apache-arrow", () => ({ tableFromIPC: jest.fn() }));
jest.mock("axios", () => ({ get: jest.fn(), all: (items) => Promise.all(items), CancelToken: { source: () => ({ token: {}, cancel: jest.fn() }) } }));
jest.mock("../../helpers/utility", () => ({ ...jest.requireActual("../../helpers/utility"), loadArrowTable: jest.fn() }));
const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
const pendingIO = [], running = [];
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); pendingIO.push(resolve); return { promise, resolve }; };
const start = (...args) => { const task = runSaga(...args); running.push(task); return task; };
const publicFile = (source) => fs.readFileSync(path.resolve("public", source), "utf8");
const demo = JSON.parse(publicFile("datafiles0.json"));
const settings = JSON.parse(publicFile("settings.json"));
const genome = { intervals: [], connections: [] };
const info = { name: "Signal from server", tile_size: 1, max_width: 100 };
const tiles = (key = "u.2.0") => ({ data: { [key]: { dense: "AAAAQA==", dtype: "float32" } } });
const bw = { id: "bw", ownerFile: "a", sample: "a", type: "bigwig", server: "server", uuid: "u", tag: "bigwig_atac", visible: true };
function store(extra = {}) {
  const coords = updateChromoBins([{ chromosome: "chr1", startPoint: 1, endPoint: 100 }]);
  let current = { ...reducer(undefined, {}), ...coords, domains: [[1, 100]], maxGenomeLength: 100, ...extra };
  const channel = stdChannel(), events = [];
  const dispatch = (event) => { events.push(event); current = reducer(current, event); channel.put(event); };
  return { channel, events, dispatch, state: () => current, getState: () => ({ App: current }) };
}
function cellState(extraPlots = [], existing = []) {
  const graph = { id: "g", ownerFile: "a", sample: "a", type: "genome", source: "g.json", path: "data/a/g.json", visible: true };
  return { selectedCoordinate: "ref", datafiles: [{ file: "a", reference: "ref", plots: [graph, ...extraPlots] }],
    plots: [{ id: "tree", type: "phylogeny", reference: "ref", data: "(a);" }, ...existing] };
}
async function execute(s, worker, action) {
  s.dispatch(action);
  await start(s, worker, action).toPromise();
}
beforeEach(() => {
  phylogenyLoader.invalidate(); jest.clearAllMocks();
  loadArrowTable.mockResolvedValue({ getChild: () => ({ toArray: () => [] }) });
  axios.get.mockImplementation((source) => Promise.resolve(source.includes("tileset_info") ? { data: { u: info } } : source.includes("tiles/?") ? tiles() : { data: genome }));
});

afterEach(async () => {
  running.splice(0).forEach((task) => task.cancel());
  phylogenyLoader.invalidate();
  pendingIO.splice(0).forEach((resolve) => resolve({ data: genome }));
  await tick(); await tick();
});

test("actual DEMO maps 7E/7G/7K to their own genome, and confirming 7E opens only its detail group", async () => {
  const file = { ...demo.DEMO, file: "DEMO", plots: demo.DEMO.plots.map((plot, i) => ({ ...plot, id: `demo-${i}`, ownerFile: "DEMO", reference: "hg19", path: `data/DEMO/${plot.source}` })) };
  const tree = { ...file.plots[0], data: publicFile("data/DEMO/phylogeny.newick") };
  const s = store({ ...updateChromoBins(settings.coordinates.sets.hg19), selectedCoordinate: "hg19", datafiles: [file], plots: [tree] });
  axios.get.mockImplementation(async (source) => ({ data: JSON.parse(publicFile(source)) }));
  await execute(s, loadPhylogenyHeatmap, actions.loadPhylogenyHeatmap(tree.id));
  expect(s.state().phylogenyHeatmap.status).toBe("ready");
  const expected = { "7E": "genome.json", "7G": "genome2.json", "7K": "genome1.json" };
  Object.entries(expected).forEach(([cell, source]) => {
    const raw = JSON.parse(publicFile(`data/DEMO/${source}`));
    const normalized = s.state().phylogenyHeatmap.cnByCell[cell];
    expect(normalized).toHaveLength(raw.intervals.length);
    const byId = new Map(normalized.map((interval) => [interval.iid, interval]));
    raw.intervals.forEach((interval) => expect(byId.get(interval.iid).cn).toBe(interval.y));
  });
  expect(s.state().phylogenyHeatmap.cnByCell["7E"][0].cn).toBe(2);
  expect(s.state().phylogenyHeatmap.cnByCell["7K"][0].cn).toBe(7);
  await execute(s, openPhylogenyCells, actions.openPhylogenyCells(["7E"], true));
  expect(s.state().plots.slice(1).map((plot) => [plot.sample, plot.source])).toEqual([
    ["7E", "genome.json"], ["7E", "rpkm.arrow"], ["7E", "coverage.arrow"],
  ]);
  expect(axios.get).toHaveBeenCalledTimes(3);
  expect(loadArrowTable).not.toHaveBeenCalled();
  expect(s.state().selectedFiles).toEqual([file]);
  expect(s.state().selectedFiles[0]).toBe(file);
  expect(s.state().phylogenyAddedFiles).toEqual(["DEMO"]);
  await execute(s, openPhylogenyCells, actions.openPhylogenyCells(["7G", "7E"], true));
  expect(s.state().selectedFiles).toEqual([file]);
  expect(s.state().phylogenyAddedFiles).toEqual(["DEMO"]);
  expect(s.state().plots.filter(plot => plot.type === "genome").map(plot => plot.source)).toEqual(["genome.json", "genome2.json"]);
  s.dispatch(actions.clearPhylogenyTracks());
  expect(s.state().selectedFiles).toEqual([]);
  expect(s.state().plots).toEqual([tree]);
});

test("actual DEMO launch preserves both walk views, independent alignment, IDs, and one raw transport cache", async () => {
  const s = store({ settings, datafilesJSON: demo });
  axios.get.mockImplementation(async (source) => ({ data:
    source.includes("tilesets/?") ? { results: [] } :
    source.includes("tileset_info") ? { [new URL(source).searchParams.get("d")]: info } :
    source.includes("tiles/?") ? tiles().data :
    source.endsWith(".newick") ? publicFile(source) :
    source.endsWith(".svg") ? "" : JSON.parse(publicFile(source))
  }));
  await execute(s, launchApplication, actions.launchApp(["DEMO"], []));
  expect(s.state().missingDataFiles).toBe(false);
  expect(s.state().bigwigsYRange).toEqual([2, 2]);
  const views = s.state().plots.filter((plot) => plot.type === "walk");
  expect(views.map((plot) => plot.tag)).toEqual(["walk", "binset"]);
  expect(new Set(views.map((plot) => plot.id)).size).toBe(2);
  const raw = JSON.parse(publicFile("data/DEMO/walks.json"));
  expect(views[1].data).toEqual(raw);
  expect(views[0].data.maximumY).toBeGreaterThan(0);
  expect(views[0].data.walks[0].iids[0].y).not.toBe(raw.walks[0].iids[0].y);
  expect(axios.get.mock.calls.filter(([source]) => source === "data/DEMO/walks.json")).toHaveLength(1);
  const changed = { ...views[0], data: { ...views[0].data, maximumY: 123 } };
  s.dispatch({ type: actions.PLOT_DATA_UPDATED, plots: [changed] });
  expect(s.state().plots.find((plot) => plot.id === views[0].id).data.maximumY).toBe(123);
  expect(s.state().plots.find((plot) => plot.id === views[1].id).data).toBe(views[1].data);
  const before = axios.get.mock.calls.length;
  await execute(s, openPhylogenyCells, actions.openPhylogenyCells(["7K"], true));
  expect(s.state().plots.filter((plot) => plot.type === "walk").map((plot) => plot.id)).toEqual(views.map((plot) => plot.id));
  expect(axios.get).toHaveBeenCalledTimes(before);
  const selected = s.state().selectedFiles;
  expect(selected).toHaveLength(1);
  expect(selected[0]).toBe(s.state().datafiles.find(file => file.file === "DEMO"));
  expect(s.state().phylogenyAddedFiles).toEqual([]);
  expect(s.state().plots.find(plot => plot.type === "phylogeny").title).toBe(demo.DEMO.plots.find(plot => plot.type === "phylogeny").title);
  s.dispatch(actions.clearPhylogenyTracks());
  expect(s.state().selectedFiles).toEqual(selected);
});

test("menu-created Bigwig metadata really adds path and survives cloning, collapse, and concurrent additions", async () => {
  const pending = deferred();
  axios.get.mockReturnValueOnce(pending.promise);
  const s = store({ higlassServer: "server" });
  const task = start(s, rootSaga);
  s.dispatch(actions.addBigwigPlot("u"));
  const identity = plotIdentity(s.state().plots[0]);
  s.dispatch(actions.updatePlots([{ ...s.state().plots[0], visible: false }, { id: "other", type: "genome", data: genome }]));
  pending.resolve({ data: { u: info } });
  await tick(); await tick();
  expect(s.state().plots[0]).toMatchObject({ visible: false, title: info.name, tilesetInfo: info, path: expect.stringContaining("/api/v1/tiles/?") });
  expect(plotIdentity(s.state().plots[0])).toBe(identity);
  expect(s.state().plots[1].id).toBe("other");
  expect(s.state().loading).toBe(false);
  task.cancel(); await task.toPromise();
});

test.each(["collapse", "delete", "remove"])("confirmed open reveals now; later %s and newer zoom data win over deferred coverage", async (edit) => {
  const coverage = { id: "c", ownerFile: "a", sample: "a", type: "scatterplot", source: "c.arrow", path: "data/a/c.arrow", visible: true };
  const graph = { ...cellState().datafiles[0].plots[0], data: genome, visible: false, deleted: true };
  const sibling = { ...graph, id: "sibling", sample: "b", source: "b.json", path: "data/a/b.json", loadStatus: "ready", visible: true, deleted: false };
  const signal = { ...bw, data: [{ x: 1, y: 2 }], tilesetInfo: info, visible: false, deleted: true };
  const s = store(cellState([bw, coverage, sibling], [graph, signal, sibling]));
  const file = s.state().datafiles[0];
  const pending = deferred(); loadArrowTable.mockReturnValueOnce(pending.promise);
  const action = actions.openPhylogenyCells(["a"], true);
  s.dispatch(action);
  const task = start(s, openPhylogenyCells, action);
  await tick();
  expect(s.state().plots.find((plot) => plot.id === "g")).toMatchObject({ visible: true, deleted: false });
  expect(loadArrowTable).toHaveBeenCalledWith(coverage.path);
  expect(s.state().cellTrackLoad.status).toBe("loading");
  expect(s.state().selectedFiles).toEqual([]);
  const requestId = s.state().cellTrackRequest;
  const fresh = [{ x: 25, y: 9 }];
  s.dispatch({ type: actions.HIGLASS_LOADED, properties: { plots: [{ ...signal, data: fresh }] } });
  const plots = s.state().plots;
  s.dispatch(actions.updatePlots(edit === "remove" ? plots.filter((plot) => plot.id !== "g") : plots.map((plot) => plot.id === "g" ? { ...plot, visible: false, deleted: edit === "delete", title: "Edited title" } : plot)));
  pending.resolve({ numRows: 1 });
  await task.toPromise();
  const current = s.state().plots.find((plot) => plot.id === "g");
  if (edit === "remove") expect(current).toBeUndefined();
  else expect(current).toMatchObject({ visible: false, deleted: edit === "delete", title: "Edited title" });
  expect(s.state().plots.find((plot) => plot.id === "bw").data).toBe(fresh);
  expect(s.state().bigwigsYRange).toEqual([9, 9]);
  // The completion is current and successful, but only its own genome counts.
  // A surviving sibling from the same file must not select a phantom owner.
  expect(s.events.find(event => event.type === actions.PHYLOGENY_CELL_PLOTS_LOADED)).toMatchObject({ requestId, loadedFile: "a" });
  expect(s.state().cellTrackRequest).toBe(requestId);
  expect(s.state().cellTrackLoad.status).toBe("ready");
  expect(s.state().plots.find(plot => plot.id === sibling.id)).toEqual(sibling);
  expect(s.state().selectedFiles).toEqual(edit === "collapse" ? [file] : []);
  expect(s.state().phylogenyAddedFiles).toEqual(edit === "collapse" ? [file.file] : []);
  // A NEW confirmation may intentionally reopen the deleted/collapsed panel.
  await execute(s, openPhylogenyCells, actions.openPhylogenyCells(["a"], true));
  expect(s.state().plots.find((plot) => plot.id === "g")).toMatchObject({ visible: true, deleted: false });
  expect(s.state().selectedFiles).toEqual([file]);
  expect(s.state().selectedFiles[0]).toBe(file);
  expect(s.state().phylogenyAddedFiles).toEqual([file.file]);
});

test.each(["confirmed", "lazy", "menu"])("%s Bigwig never publishes old-viewport tiles after a pan during tile I/O", async (mode) => {
  const first = deferred(), second = deferred();
  let tileRequests = 0;
  axios.get.mockImplementation((source) => source.includes("tiles/?") ? (++tileRequests === 1 ? first.promise : second.promise) : Promise.resolve({ data: source.includes("tileset_info") ? { u: info } : genome }));
  const s = store(mode === "confirmed" ? cellState([bw]) : mode === "lazy" ? { plots: [{ ...bw, visible: false }] } : { higlassServer: "server" });
  const task = start(s, rootSaga);
  if (mode === "confirmed") s.dispatch(actions.openPhylogenyCells(["a"], true));
  else if (mode === "lazy") s.dispatch(actions.updatePlots([{ ...bw }]));
  else s.dispatch(actions.addBigwigPlot("u"));
  await tick(); await tick();
  expect(tileRequests).toBe(1);
  s.dispatch(actions.updateDomains([[51, 100]]));
  // Let the zoom worker run while the pending plot is absent or lacks metadata.
  await tick(130);
  first.resolve(tiles("u.2.0"));
  await tick(); await tick();
  const stale = s.state().plots.find((plot) => plot.type === "bigwig");
  expect(stale && stale.data).toBeFalsy();
  expect(tileRequests).toBeGreaterThanOrEqual(2);
  const paths = axios.get.mock.calls.map(([source]) => source).filter((source) => source.includes("tiles/?"));
  expect(paths[paths.length - 1]).not.toBe(paths[0]);
  second.resolve(tiles("u.3.4"));
  await tick(); await tick();
  const current = s.state().plots.find((plot) => plot.type === "bigwig");
  expect(current.data[0]).toEqual({ x: 50, y: 2 });
  if (mode !== "menu") expect(s.state().bigwigsYRange).toEqual([2, 2]); // ignore legacy decoder's NaN padding
  task.cancel(); await task.toPromise();
});

test.each(["confirmed", "lazy"])("%s Bigwig rechecks viewport after metadata I/O and later descriptors finish", async (mode) => {
  const metadata = deferred(), coverageIO = deferred();
  const coverage = { id: "c", ownerFile: "a", type: "scatterplot", source: "c.arrow", path: "data/a/c.arrow", visible: true };
  axios.get.mockImplementation((source) => source.includes("tileset_info") ? metadata.promise : Promise.resolve(source.includes("tiles/?") ? tiles() : { data: genome }));
  loadArrowTable.mockReturnValueOnce(coverageIO.promise);
  const s = store(mode === "confirmed" ? cellState([bw, coverage]) : { plots: [bw, coverage] });
  const action = mode === "confirmed" ? actions.openPhylogenyCells(["a"], true) : actions.updatePlots(s.state().plots);
  s.dispatch(action);
  const task = start(s, mode === "confirmed" ? openPhylogenyCells : loadVisiblePlotData, action);
  await tick();
  s.dispatch(actions.updateDomains([[25, 75]]));
  metadata.resolve({ data: { u: info } });
  await tick();
  s.dispatch(actions.updateDomains([[51, 100]]));
  coverageIO.resolve({ numRows: 1 });
  await task.toPromise();
  const plot = s.state().plots.find((plot) => plot.type === "bigwig");
  expect(plot.path).toContain("d=u.3.4");
  expect(plot.path).not.toContain("d=u.2.0");
  expect(s.state().bigwigsYRange).toEqual([2, 2]);
});

test.each(["confirmed", "lazy"])("%s failed current-view refresh reports its error, not stale tiles or a stuck loading status", async (mode) => {
  const pending = deferred();
  let requests = 0;
  axios.get.mockImplementation((source) => source.includes("tiles/?") ? (++requests === 1 ? pending.promise : Promise.reject(new Error("current tiles unavailable"))) : Promise.resolve({ data: source.includes("tileset_info") ? { u: info } : genome }));
  const s = store(mode === "confirmed" ? cellState([bw]) : { plots: [bw] });
  const action = mode === "confirmed" ? actions.openPhylogenyCells(["a"], true) : actions.updatePlots(s.state().plots);
  s.dispatch(action);
  const task = start(s, mode === "confirmed" ? openPhylogenyCells : loadVisiblePlotData, action);
  await tick();
  s.dispatch(actions.updateDomains([[51, 100]]));
  pending.resolve(tiles());
  await task.toPromise();
  expect(s.state().plots.find((plot) => plot.id === "bw")).toMatchObject({ data: null, loadStatus: "error", loadError: "current tiles unavailable" });
  expect(s.state().bigwigsYRange).toEqual([0, 1]);
  if (mode === "confirmed") {
    expect(s.state().cellTrackLoad.status).toBe("error");
    expect(s.state().selectedFiles).toEqual([s.state().datafiles[0]]);
    expect(s.state().phylogenyAddedFiles).toEqual(["a"]);
  }
});

test("a file-per-cell alias retains its detail group but never loads a wrong-reference genome", async () => {
  const base = cellState();
  base.datafiles[0].plots[0].sample = "donor";
  base.datafiles[0].plots.push({ id: "coverage", type: "scatterplot", sample: "donor", source: "coverage.arrow", visible: false });
  base.datafiles.push({ file: "other", reference: "ref", plots: [{ id: "wrong", type: "genome", sample: "a", reference: "incompatible", source: "wrong.json" }] });
  const s = store(base);
  await execute(s, openPhylogenyCells, actions.openPhylogenyCells(["a"], true));
  expect(s.state().plots.slice(1).map((plot) => plot.id)).toEqual(["g", "coverage"]);
  expect(axios.get.mock.calls.map(([source]) => source)).toEqual(["data/a/g.json"]);
});

test.each(["confirmed", "lazy"])("%s ATAC completion draws on a finite shared scale without requiring any zoom", async (mode) => {
  const existing = { ...bw, id: "other", ownerFile: "other", data: [{ x: 1, y: 0 }, { x: 2, y: 8 }] };
  const s = store(mode === "confirmed" ? cellState([bw], [existing]) : { plots: [existing, bw] });
  await execute(s, mode === "confirmed" ? openPhylogenyCells : loadVisiblePlotData,
    mode === "confirmed" ? actions.openPhylogenyCells(["a"], true) : actions.updatePlots(s.state().plots));
  expect(s.events.some((event) => event.type === actions.DOMAINS_UPDATED)).toBe(false);
  expect(s.state().plots.find((plot) => plot.id === "bw").data[0].y).toBe(2);
  expect(s.state().bigwigsYRange).toEqual([0, 8]);
});

test.each([false, true])("current-view refresh handles a second pan and cancellation=%s without publishing or caching stale results", async (cancelled) => {
  const first = deferred(), second = deferred(), third = deferred();
  const responses = [first.promise, second.promise, third.promise];
  axios.get.mockImplementation((source) => source.includes("tiles/?") ? responses.shift() : Promise.resolve({ data: source.includes("tileset_info") ? { u: info } : genome }));
  const s = store(cellState([bw]));
  const task = start(s, rootSaga);
  s.dispatch(actions.openPhylogenyCells(["a"], true));
  await tick();
  s.dispatch(actions.updateDomains([[51, 100]]));
  first.resolve(tiles());
  await tick(); await tick();
  expect(s.state().plots.some((plot) => plot.type === "bigwig")).toBe(false);
  if (cancelled) s.dispatch(actions.cancelPhylogenyCellLoad());
  else s.dispatch(actions.updateDomains([[1, 25]]));
  second.resolve(tiles("u.3.4"));
  await tick(); await tick();
  expect(s.state().plots.some((plot) => plot.type === "bigwig")).toBe(false);
  const requests = axios.get.mock.calls.map(([source]) => source).filter((source) => source.includes("tiles/?"));
  if (cancelled) {
    expect(requests).toHaveLength(2);
    expect(s.state().cellTrackLoad.status).toBe("cancelled");
    expect(await phylogenyLoader.get(`json:${requests[1]}`, () => "not cached")).toBe("not cached");
  } else {
    expect(requests).toHaveLength(3);
    third.resolve(tiles("u.4.0"));
    await tick(); await tick();
    expect(s.state().plots.find((plot) => plot.id === "bw")).toMatchObject({ dataDomains: [[1, 25]], path: expect.stringContaining("d=u.4.0") });
    expect(s.state().cellTrackLoad.status).toBe("ready");
  }
  task.cancel(); await task.toPromise();
});

test("launch and all load completions derive a finite shared ATAC-only extent from currently merged plots", () => {
  const atac = { ...bw, data: [{ y: 3 }, { y: NaN }, { y: 5 }, { y: Infinity }, { y: null }] };
  const coverage = { ...bw, id: "coverage", tag: "bigwig_coverage", data: [{ y: 900 }] };
  const untagged = { ...bw, id: "menu", tag: undefined, data: [{ y: -900 }] };
  const s = store();
  s.dispatch({ type: actions.LAUNCH_APP_SUCCESS, properties: { plots: [coverage, untagged], bigwigsYRange: [undefined, undefined] } });
  expect(s.state().bigwigsYRange).toEqual([0, 1]);
  s.dispatch({ type: actions.LAUNCH_APP_SUCCESS, properties: { plots: [atac, coverage, untagged] } });
  expect(s.state().bigwigsYRange).toEqual([3, 5]);
  s.dispatch({ type: actions.PLOT_DATA_UPDATED, plots: [{ ...atac, data: [{ y: 1 }, { y: 8 }] }] });
  expect(s.state().bigwigsYRange).toEqual([1, 8]);
  s.dispatch({ type: actions.HIGLASS_LOADED, properties: { plots: [{ ...atac, data: [] }], bigwigsYRange: [undefined, undefined] } });
  expect(s.state().bigwigsYRange).toEqual([0, 1]);
});
