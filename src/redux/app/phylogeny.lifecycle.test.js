import { runSaga, stdChannel } from "redux-saga";
import axios from "axios";
import actions from "./actions";
import reducer from "./reducer";
import rootSaga, { fetchHiglassData, phylogenyLoader } from "./saga";
import { loadArrowTable, updateChromoBins } from "../../helpers/utility";

jest.mock("apache-arrow", () => ({ tableFromIPC: jest.fn() }));
jest.mock("axios", () => ({ get: jest.fn(), all: (items) => Promise.all(items), spread: (fn) => (args) => fn(...args), CancelToken: { source: () => ({ token: {}, cancel: jest.fn() }) } }));
jest.mock("../../helpers/utility", () => ({ ...jest.requireActual("../../helpers/utility"), loadArrowTable: jest.fn().mockResolvedValue({ getChild: () => ({ toArray: () => [] }) }), getFloatArray: () => [2] }));
const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
const deferred = () => { let resolve, reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; };
function createStore(app) {
  let state = { ...reducer(undefined, {}), ...app };
  const channel = stdChannel();
  const events = [];
  const dispatch = (action) => { events.push(action); state = reducer(state, action); channel.put(action); };
  return { channel, dispatch, events, getState: () => ({ App: state }), state: () => state };
}
beforeEach(() => { jest.clearAllMocks(); phylogenyLoader.invalidate(); });

test("domain refresh is detached from live plot objects and merges by identity after cell append", async () => {
  const pending = deferred();
  axios.get.mockReturnValue(pending.promise);
  const bigwig = { id: "bw", type: "bigwig", tag: "bigwig_atac", uuid: "u", server: "s", data: [], visible: true, tilesetInfo: { tile_size: 1, max_width: 100 } };
  const s = createStore({ plots: [bigwig] });
  const task = runSaga(s, fetchHiglassData, actions.updateDomains([[1, 100]]));
  await tick(130);
  s.dispatch(actions.openPhylogenyCells(["a"], true));
  const genome = { id: "g", ownerFile: "a", type: "genome", source: "g.json", data: { intervals: [] } };
  s.dispatch({ type: actions.PHYLOGENY_CELL_PLOTS_LOADED, epoch: s.state().datasetEpoch, requestId: s.state().cellTrackRequest, plots: [genome] });
  pending.resolve({ data: { "u.2.0": { dense: "", dtype: "float32" } } });
  await task.toPromise();
  expect(bigwig.data).toEqual([]);
  expect(s.state().plots.map((plot) => plot.id)).toEqual(["bw", "g"]);
  expect(s.state().plots[0].data).toHaveLength(1);
});

test("a failed zoom patches its error, never its obsolete data snapshot", async () => {
  const pending = deferred();
  axios.get.mockReturnValue(pending.promise);
  const bigwig = { id: "bw", type: "bigwig", uuid: "u", server: "s", data: [], tilesetInfo: { tile_size: 1, max_width: 100 } };
  const s = createStore({ plots: [bigwig] });
  const task = runSaga(s, fetchHiglassData, actions.updateDomains([[1, 100]]));
  await tick(130);
  s.dispatch({ type: actions.PLOT_DATA_UPDATED, epoch: s.state().datasetEpoch, plots: [{ ...bigwig, data: "fresh" }] });
  pending.reject(new Error("tiles unavailable"));
  await task.toPromise();
  expect(s.state().plots[0]).toMatchObject({ data: "fresh", loadStatus: "error", loadError: "tiles unavailable" });
});

test("dataset relaunch invalidates overview/open caches and prevents late cells appearing in replacement plots", async () => {
  const old = deferred();
  const tree = { id: "old-tree", type: "phylogeny", ownerFile: "old", reference: "ref", data: "(a,b,c,d);" };
  const datafiles = ["a", "b", "c", "d"].map((file) => ({ file, reference: "ref", plots: [{ id: file, type: "genome", ownerFile: file, sample: file, path: `data/${file}/g.json`, source: "g.json", visible: true }] }));
  const settings = { coordinates: { sets: { ref: [{ chromosome: "chr1", startPoint: 1, endPoint: 100 }] }, higlassMap: { ref: "ref" } }, geography: [], geneAnnotations: { ref: "genes" }, higlassServer: "server" };
  axios.get.mockImplementation((path) => path.endsWith("/g.json") ? old.promise : Promise.resolve({ data: path.includes("tilesets/?") ? { results: [] } : [] }));
  const s = createStore({ datafiles, selectedCoordinate: "ref", plots: [tree], settings, datafilesJSON: { replacement: { description: [], reference: "ref", plots: [] } } });
  const task = runSaga(s, rootSaga);
  s.dispatch(actions.openPhylogenyCells(["a", "b", "c", "d"], true));
  await tick();
  expect(axios.get).toHaveBeenCalledTimes(3);
  s.dispatch(actions.launchApp(["replacement"], []));
  old.resolve({ data: { intervals: [], connections: [] } });
  await tick(); await tick(); await tick();
  expect(s.state().plots.map((p) => p.type)).toEqual(["genes"]);
  expect(s.state().selectedFiles.map(file => file.file)).toEqual(["replacement"]);
  expect(s.state().phylogenyAddedFiles).toEqual([]);
  expect(s.state().cellTrackLoad.status).toBe("idle");
  expect(axios.get.mock.calls.some(([path]) => path === "data/d/g.json")).toBe(false);
  expect(await phylogenyLoader.get("json:data/a/g.json", () => "fresh")).toBe("fresh");
  task.cancel(); await task.toPromise();
});

test("dataset change cancels the full overview queue, not just detail opening", async () => {
  const old = deferred();
  const tree = { id: "old-tree", type: "phylogeny", ownerFile: "old", reference: "ref", data: "(a,b,c,d);", heatmap: { mutationSource: "never.json" } };
  const datafiles = ["a", "b", "c", "d"].map((file) => ({ file, reference: "ref", plots: [{ id: file, type: "genome", ownerFile: file, sample: file, path: `data/${file}/g.json`, source: "g.json", visible: true }] }));
  axios.get.mockReturnValue(old.promise);
  const s = createStore({ datafiles, selectedCoordinate: "ref", plots: [tree], chromoBins: { chr1: { startPlace: 0 } } });
  const task = runSaga(s, rootSaga);
  s.dispatch(actions.loadPhylogenyHeatmap("old-tree"));
  await tick();
  expect(axios.get).toHaveBeenCalledTimes(3);
  axios.get.mockRejectedValue(new Error("replacement unavailable"));
  s.dispatch(actions.launchApp(["replacement"], []));
  old.resolve({ data: { intervals: [], connections: [] } });
  await tick(); await tick();
  expect(s.state().phylogenyHeatmap).toBeNull();
  expect(axios.get.mock.calls.some(([path]) => path === "data/d/g.json" || path.endsWith("never.json"))).toBe(false);
  expect(await phylogenyLoader.get("json:data/a/g.json", () => "fresh")).toBe("fresh");
  task.cancel(); await task.toPromise();
});

test("in-flight lazy Arrow cannot patch or cache results after changing datasets", async () => {
  const pending = deferred();
  const plot = { id: "coverage", ownerFile: "old", type: "scatterplot", source: "c.arrow", path: "data/old/c.arrow", visible: true };
  loadArrowTable.mockReturnValueOnce(pending.promise);
  axios.get.mockRejectedValue(new Error("replacement unavailable"));
  const s = createStore({ plots: [plot] });
  const task = runSaga(s, rootSaga);
  s.dispatch(actions.updatePlots([plot]));
  await tick();
  expect(loadArrowTable).toHaveBeenCalledWith(plot.path);
  s.dispatch(actions.launchApp(["replacement"], []));
  s.dispatch({ type: actions.LAUNCH_APP_SUCCESS, epoch: s.state().datasetEpoch, properties: { plots: [] } });
  pending.resolve("old Arrow");
  await tick(); await tick();
  expect(s.state().plots).toEqual([]);
  expect(await phylogenyLoader.get(`arrow:${plot.path}`, () => "fresh")).toBe("fresh");
  task.cancel(); await task.toPromise();
});

test("the newest zoom wins and a late cancelled response cannot restore a removed panel", async () => {
  const first = deferred(), second = deferred();
  axios.get.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const bigwig = { id: "bw", type: "bigwig", uuid: "u", server: "s", data: [], visible: true, tilesetInfo: { tile_size: 1, max_width: 100 } };
  const { chromoBins } = updateChromoBins([{ chromosome: "chr1", startPoint: 1, endPoint: 100 }]);
  const s = createStore({ plots: [bigwig], chromoBins });
  const task = runSaga(s, rootSaga);
  s.dispatch(actions.updateDomains([[1, 100]]));
  await tick(130);
  s.dispatch(actions.updateDomains([[1, 50]]));
  await tick(130);
  second.resolve({ data: { "u.3.1": { dense: "", dtype: "float32" } } });
  await tick();
  expect(s.state().plots[0].data[0].x).toBe(12.5);
  s.dispatch(actions.updatePlots([]));
  first.resolve({ data: { "u.2.0": { dense: "", dtype: "float32" } } });
  await tick(); await tick();
  expect(s.state().plots).toEqual([]);
  expect(bigwig.data).toEqual([]);
  task.cancel(); await task.toPromise();
});

test("rapid successive launches use only the latest dataset and errors do not crash launch", async () => {
  const pending = deferred();
  axios.get.mockReturnValue(pending.promise);
  const s = createStore();
  const task = runSaga(s, rootSaga);
  s.dispatch(actions.launchApp(["old"], []));
  await tick();
  axios.get.mockRejectedValue(new Error("settings unavailable"));
  s.dispatch(actions.launchApp(["new"], []));
  await tick();
  expect(s.state().loading).toBe(false);
  expect(s.state().missingDataFiles).toBe(true);
  pending.resolve({ data: {} });
  await tick();
  expect(s.state().files).toEqual(["new"]);
  expect(s.events.some((event) => event.type === actions.LAUNCH_APP_SUCCESS)).toBe(false);
  task.cancel(); await task.toPromise();
});
