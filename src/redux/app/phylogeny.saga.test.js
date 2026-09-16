import { runSaga, stdChannel } from "redux-saga";
import axios from "axios";
import actions from "./actions";
import reducer from "./reducer";
import rootSaga, { loadPhylogenyHeatmap, openPhylogenyCells, loadVisiblePlotData, launchApplication, phylogenyLoader } from "./saga";
import { loadArrowTable } from "../../helpers/utility";
import { parsePlotlyMutations } from "../../helpers/phylogeny/data";

jest.mock("apache-arrow", () => ({ tableFromIPC: jest.fn() }));
jest.mock("axios", () => {
  const axios = { get: jest.fn(), all: (items) => Promise.all(items), spread: (fn) => (args) => fn(...args), CancelToken: { source: () => ({ token: {}, cancel: jest.fn() }) } };
  return axios;
});
jest.mock("../../helpers/utility", () => ({ ...jest.requireActual("../../helpers/utility"), loadArrowTable: jest.fn() }));
jest.mock("../../helpers/phylogeny/data", () => ({ ...jest.requireActual("../../helpers/phylogeny/data"), parsePlotlyMutations: jest.fn() }));

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
const genome = { intervals: [{ iid: 1, chromosome: "chr1", startPoint: 1, endPoint: 20, y: 2 }], connections: [] };
const manifest = (file, sample = file, reference = "ref") => ({ file, reference, plots: [
  { id: `${file}-g`, ownerFile: file, sample, reference, type: "genome", source: "g.json", path: `data/${file}/g.json`, visible: true },
  { id: `${file}-c`, ownerFile: file, sample, reference, type: "scatterplot", source: "coverage.arrow", path: `data/${file}/coverage.arrow`, visible: false },
] });
const tree = { id: "tree", ownerFile: "cohort", reference: "ref", type: "phylogeny", path: "data/cohort/tree.nwk", source: "tree.nwk", data: "(a,b,c,d);", visible: true };
const cohortFile = { file: "cohort", tags: ["study"], reference: "ref", plots: [tree] };
function app(extra = {}) {
  return { ...reducer(undefined, {}), selectedCoordinate: "ref", chromoBins: { chr1: { startPlace: 0, endPlace: 100 } }, genomeLength: 100, domains: [[1, 100]], datafiles: [cohortFile, manifest("a"), manifest("b"), manifest("c"), manifest("d"), manifest("wrong", "a", "other"), manifest("outsider")], selectedFiles: [cohortFile], plots: [tree], ...extra };
}
function store(state) {
  let current = state;
  const channel = stdChannel();
  const events = [];
  const dispatch = (action) => { events.push(action); current = reducer(current, action); channel.put(action); };
  return { channel, events, dispatch, getState: () => ({ App: current }), state: () => current };
}
function execute(worker, state, action) {
  const s = store(reducer(state, action));
  const task = runSaga(s, worker, action);
  return { ...s, task };
}

beforeEach(() => {
  phylogenyLoader.invalidate();
  jest.clearAllMocks();
  axios.get.mockResolvedValue({ data: genome });
  loadArrowTable.mockResolvedValue({ numRows: 1 });
});

test.each([[["a"]], [["a", "b"]]])("unconfirmed %j performs no effects", async (ids) => {
  const generator = openPhylogenyCells(actions.openPhylogenyCells(ids));
  expect(generator.next().done).toBe(true);
  expect(axios.get).not.toHaveBeenCalled();
  expect(loadArrowTable).not.toHaveBeenCalled();
});

test("overview merges optional allelic.json channels onto the matching total-CN intervals", async () => {
  const file = manifest("a");
  file.plots.push({ id: "a-allelic", ownerFile: "a", sample: "a", reference: "ref", type: "allelic", source: "allelic.json", path: "data/a/allelic.json", visible: false });
  const oneCellTree = { ...tree, data: "(a);" };
  axios.get.mockImplementation(async source => ({ data: source.endsWith("allelic.json")
    ? { intervals: [{ iid: 1, chromosome: "chr1", startPoint: 1, endPoint: 20, majorCn: 2, minorCn: 0 }] }
    : genome }));
  const s = execute(loadPhylogenyHeatmap, app({ plots: [oneCellTree], datafiles: [cohortFile, file] }), actions.loadPhylogenyHeatmap(oneCellTree.id));
  await s.task.toPromise();
  expect(s.state().phylogenyHeatmap.status).toBe("ready");
  expect(s.state().phylogenyHeatmap.cnByCell.a[0]).toMatchObject({ cn: 2, majorCn: 2, minorCn: 0 });
  expect(axios.get.mock.calls.map(([source]) => source)).toEqual(["data/a/g.json", "data/a/allelic.json"]);
});

test("legacy paired alleles join Total only by coordinates, never drawing IID or color", async () => {
  const file = manifest("a");
  file.plots[0].allelicSource = "allelic.json";
  const second = { ...genome.intervals[0], iid: 2, startPoint: 21, endPoint: 40, y: 3 };
  const alleles = [
    { ...genome.intervals[0], iid: 101, y: 0, metadata: { color: "red" } },
    { ...second, iid: 102, y: 2, metadata: { color: "blue" } },
    { ...genome.intervals[0], iid: 201, y: 2, metadata: { color: "blue" } },
    { ...second, iid: 202, y: null, metadata: { color: "red" } },
  ];
  axios.get.mockImplementation(async path => ({ data: { intervals: path.endsWith("allelic.json") ? alleles : [...genome.intervals, second] } }));
  const s = execute(loadPhylogenyHeatmap, app({ plots: [{ ...tree, data: "(a);" }], datafiles: [file] }), actions.loadPhylogenyHeatmap(tree.id));
  await s.task.toPromise();
  expect(s.state().phylogenyHeatmap.status).toBe("ready");
  expect(s.state().phylogenyHeatmap.cnByCell.a).toEqual([
    { chromosome: "chr1", start: 1, end: 20, startPoint: 1, endPoint: 20, iid: 1, cn: 2, majorCn: 2, minorCn: 0 },
    { chromosome: "chr1", start: 21, end: 40, startPoint: 21, endPoint: 40, iid: 2, cn: 3, majorCn: null, minorCn: null },
  ]);
});

test.each(["exact sample", "genome source", "ambiguous owner"])("allelic descriptor resolution protects multi-genome owners: %s", async match => {
  const file = manifest("multi", "a");
  const ownerAllele = { type: "allelic", sample: "multi", source: "owner-allelic.json" };
  const noSampleAllele = { type: "allelic", source: "unscoped-allelic.json" };
  file.plots.push({ ...file.plots[0], id: "b-g", sample: "b", source: "b.json", path: "data/multi/b.json" }, ownerAllele, noSampleAllele);
  if (match === "exact sample") file.plots.push({ type: "allelic", sample: "a", source: "a-allelic.json" });
  if (match === "genome source") file.plots[0].allelicSource = "a-allelic.json";
  const allele = { intervals: [{ ...genome.intervals[0], majorCn: 2, minorCn: 0 }] };
  axios.get.mockImplementation(async path => ({ data: path.endsWith("allelic.json") ? allele : genome }));
  const s = execute(loadPhylogenyHeatmap, app({ plots: [{ ...tree, data: "(a);" }], datafiles: [file] }), actions.loadPhylogenyHeatmap(tree.id));
  await s.task.toPromise();
  expect(axios.get.mock.calls.map(([path]) => path)).toEqual(match === "ambiguous owner" ? ["data/multi/g.json"] : ["data/multi/g.json", "data/multi/a-allelic.json"]);
  expect(s.state().phylogenyHeatmap.cnByCell.a[0].cn).toBe(2);
  expect(s.state().phylogenyHeatmap.cnByCell.a[0].majorCn).toBe(match === "ambiguous owner" ? undefined : 2);
});

test("single-genome owner fallback remains available for sample aliases", async () => {
  const file = manifest("owner", "a");
  file.plots.push({ type: "allelic", sample: "owner", source: "allelic.json" });
  axios.get.mockImplementation(async path => ({ data: path.endsWith("allelic.json")
    ? { intervals: [{ ...genome.intervals[0], majorCn: 1, minorCn: 1 }] } : genome }));
  const s = execute(loadPhylogenyHeatmap, app({ plots: [{ ...tree, data: "(a);" }], datafiles: [file] }), actions.loadPhylogenyHeatmap(tree.id));
  await s.task.toPromise();
  expect(s.state().phylogenyHeatmap.cnByCell.a[0]).toMatchObject({ cn: 2, majorCn: 1, minorCn: 1 });
});

test("allelic joins require matching coordinates and compatible IDs, and reject ambiguous matches", async () => {
  const file = manifest("a");
  file.plots[0].allelicSource = "allelic.json";
  const intervals = [
    { iid: 1, chromosome: "chr1", startPoint: 1, endPoint: 20, y: 2 },
    { iid: 1, chromosome: "chr1", startPoint: 21, endPoint: 40, y: 3 },
    { chromosome: "chr1", startPoint: 41, endPoint: 60, y: 4 },
    { iid: 4, chromosome: "chr1", startPoint: 61, endPoint: 80, y: 5 },
    { iid: 5, chromosome: "chr1", startPoint: 81, endPoint: 90, y: 6 },
  ];
  const alleles = [
    { ...intervals[1], majorCn: 2, minorCn: 1 },
    { ...intervals[2], majorCn: 3, minorCn: 1 },
    { ...intervals[3], iid: 99, majorCn: 4, minorCn: 1 },
    { ...intervals[4], majorCn: 5, minorCn: 1 },
    { ...intervals[4], majorCn: 4, minorCn: 2 },
  ];
  axios.get.mockImplementation(async path => ({ data: { intervals: path.endsWith("allelic.json") ? alleles : intervals } }));
  const s = execute(loadPhylogenyHeatmap, app({ plots: [{ ...tree, data: "(a);" }], datafiles: [file] }), actions.loadPhylogenyHeatmap(tree.id));
  await s.task.toPromise();
  expect(s.state().phylogenyHeatmap.cnByCell.a.map(({ cn, majorCn, minorCn }) => [cn, majorCn, minorCn])).toEqual([
    [2, undefined, undefined], [3, 2, 1], [4, 3, 1], [5, undefined, undefined], [6, undefined, undefined],
  ]);
});

test.each(["transport", "invalid data"])("allelic %s failure retains every Total value and remains retryable", async failure => {
  const file = manifest("a");
  file.plots[0].allelicSource = "allelic.json";
  axios.get.mockImplementation(path => path.endsWith("allelic.json")
    ? failure === "transport" ? Promise.reject(new Error("missing alleles")) : Promise.resolve({ data: { intervals: [{ ...genome.intervals[0], majorCn: -1 }] } })
    : Promise.resolve({ data: genome }));
  const s = execute(loadPhylogenyHeatmap, app({ plots: [{ ...tree, data: "(a);" }], datafiles: [file] }), actions.loadPhylogenyHeatmap(tree.id));
  await s.task.toPromise();
  const total = s.state().phylogenyHeatmap.cnByCell.a;
  expect(total).toEqual([{ chromosome: "chr1", start: 1, end: 20, cn: 2, iid: 1, startPoint: 1, endPoint: 20 }]);
  expect(s.state().phylogenyHeatmap.errors.join(" ")).toContain("Allelic CN:");
  axios.get.mockResolvedValue({ data: { intervals: [{ ...genome.intervals[0], majorCn: 2, minorCn: 0 }] } });
  const retry = execute(loadPhylogenyHeatmap, s.state(), actions.loadPhylogenyHeatmap(tree.id));
  await retry.task.toPromise();
  expect(retry.state().phylogenyHeatmap.status).toBe("ready");
  expect(retry.state().phylogenyHeatmap.cnByCell.a[0]).toEqual({ ...total[0], majorCn: 2, minorCn: 0 });
  expect(axios.get).toHaveBeenCalledTimes(3);
});

test("overview loads every matched CN with max three cells; full hidden mutations are parsed relative to owner", async () => {
  let active = 0, peak = 0;
  const figure = { allEntries: Array.from({ length: 92000 }, (_, i) => i) };
  const matrix = { stats: { entries: 92000 } };
  parsePlotlyMutations.mockReturnValue(matrix);
  axios.get.mockImplementation(async (path) => {
    peak = Math.max(peak, ++active); await tick(); active--;
    return { data: path.endsWith("mutations.json") ? figure : genome };
  });
  const plot = { ...tree, path: "data/cohort/trees/nested.nwk", heatmap: { mutationSource: "mutations.json", mutationFormat: "plotly" } };
  const s = execute(loadPhylogenyHeatmap, app({ plots: [plot] }), actions.loadPhylogenyHeatmap("tree"));
  await s.task.toPromise();
  expect(peak).toBeLessThanOrEqual(3);
  expect(s.state().phylogenyHeatmap).toMatchObject({ status: "ready", cellIds: ["a", "b", "c", "d"], completed: 4, total: 4, mutations: matrix, errors: [] });
  expect(Object.keys(s.state().phylogenyHeatmap.cnByCell)).toHaveLength(4);
  expect(parsePlotlyMutations).toHaveBeenCalledWith(figure, s.state().chromoBins);
  expect(axios.get.mock.calls.map(([path]) => path)).toContain("data/cohort/mutations.json");
  expect(axios.get.mock.calls.map(([path]) => path)).not.toContain("data/wrong/g.json");
  expect(loadArrowTable).not.toHaveBeenCalled();
  expect(s.state().plots).toEqual([plot]);
  expect(s.state().selectedFiles).toEqual([cohortFile]);
  expect(s.state().phylogenyAddedFiles).toEqual([]);
  // Opening details reuses the raw overview response (normalization never replaces it).
  const open = execute(openPhylogenyCells, s.state(), actions.openPhylogenyCells(["a", "b"], true));
  await open.task.toPromise();
  expect(axios.get).toHaveBeenCalledTimes(5);
  expect(open.state().plots.find((p) => p.ownerFile === "a" && p.type === "genome").data).toBe(genome);
});

test.each([[["a"]], [["a", "b", "c", "d"]]])("confirmed single/bulk %j append details without relaunch; duplicate and unknown IDs ignored", async (chosen) => {
  const initial = app({ nodes: [{ id: "a", selected: true }] });
  window.history.replaceState({}, "", "/?file=cohort&location=chr1:1-100");
  const url = document.location.href;
  const s = execute(openPhylogenyCells, initial, actions.openPhylogenyCells([...chosen, ...chosen, "outsider", "wrong"], true));
  await s.task.toPromise();
  expect(s.state().plots.filter((p) => p.type === "genome")).toHaveLength(chosen.length);
  expect(s.state().plots[0]).toBe(tree);
  expect(s.state().domains).toBe(initial.domains);
  expect(s.state().nodes).toBe(initial.nodes);
  expect(s.state().cellTrackLoad).toMatchObject({ status: "ready", completed: chosen.length, total: chosen.length });
  expect(s.events.some((event) => event.type === actions.LAUNCH_APP)).toBe(false);
  expect(loadArrowTable).not.toHaveBeenCalled();
  const again = execute(openPhylogenyCells, s.state(), actions.openPhylogenyCells(chosen, true));
  await again.task.toPromise();
  expect(again.state().plots).toHaveLength(s.state().plots.length);
  expect(axios.get).toHaveBeenCalledTimes(chosen.length);
  expect(s.state().selectedFiles.map((file) => file.file)).toEqual(["cohort", ...chosen]);
  chosen.forEach((id) => expect(s.state().selectedFiles.find((file) => file.file === id)).toBe(initial.datafiles.find((file) => file.file === id)));
  expect(again.state().selectedFiles).toEqual(s.state().selectedFiles);
  expect(again.state().phylogenyAddedFiles).toEqual(chosen);
  again.dispatch(actions.clearPhylogenyTracks());
  expect(again.state().selectedFiles).toEqual([cohortFile]);
  expect(again.state().phylogenyAddedFiles).toEqual([]);
  expect(again.state().nodes).toBe(initial.nodes);
  // Cell owners are session selection, not launch URLs that reload ALL owner tracks.
  expect(document.location.href).toBe(url);
});

const junctionSource = { schemaVersion: 1, cellIds: ["d", "a"], junctions: [{ id: "2:20+ <-> 1:10-" }, { id: "1:10- <-> 3:30+" }], values: [[null, 2], [3, 0]] };

test.each([true, false])("optional junctions use source order and shared cache/path resolution (owner=%p)", async owner => {
  const plot = { ...tree, ownerFile: owner ? "cohort" : undefined, path: "data/fallback/nested/tree.nwk", heatmap: { junctionSource: "matrices/jcn.json" } };
  const expectedPath = owner ? "data/cohort/matrices/jcn.json" : "data/fallback/nested/matrices/jcn.json";
  axios.get.mockImplementation(async path => ({ data: path.endsWith("jcn.json") ? junctionSource : genome }));
  const s = execute(loadPhylogenyHeatmap, app({ plots: [plot] }), actions.loadPhylogenyHeatmap(tree.id));
  await s.task.toPromise();
  const result = s.state().phylogenyHeatmap;
  expect(result.status).toBe("ready");
  expect(result.mutations).toBeNull();
  expect(result.junctions).toMatchObject({ cellIds: ["d", "a"], variants: junctionSource.junctions, format: "junction" });
  expect(result.junctions.values).toEqual(new Float64Array([NaN, 2, 3, 0]));
  expect(result.junctions.missing).toEqual(new Uint8Array([1, 0, 0, 0]));
  expect(axios.get.mock.calls.map(([path]) => path)).toContain(expectedPath);
  const retry = execute(loadPhylogenyHeatmap, s.state(), actions.loadPhylogenyHeatmap(tree.id));
  await retry.task.toPromise();
  expect(axios.get).toHaveBeenCalledTimes(5);
  expect(parsePlotlyMutations).not.toHaveBeenCalled();
});

test.each(["mutations", "junction transport", "junction dimensions"])("%s failure is independent of the other matrix and only the failed source retries", async failure => {
  const matrix = { stats: { entries: 92000 } };
  parsePlotlyMutations.mockReturnValue(matrix);
  if (failure === "mutations") parsePlotlyMutations.mockImplementationOnce(() => { throw new Error("bad VAF"); });
  const plot = { ...tree, heatmap: { mutationSource: "mutations.json", junctionSource: "junctions.json" } };
  axios.get.mockImplementation(async path => {
    if (path.endsWith("junctions.json")) {
      if (failure === "junction transport") throw new Error("no junctions");
      return { data: failure === "junction dimensions" ? { ...junctionSource, values: [] } : junctionSource };
    }
    return { data: genome };
  });
  const s = execute(loadPhylogenyHeatmap, app({ plots: [plot] }), actions.loadPhylogenyHeatmap(tree.id));
  await s.task.toPromise();
  const first = s.state().phylogenyHeatmap;
  expect(first.status).toBe("error");
  expect(Object.keys(first.cnByCell)).toHaveLength(4);
  expect(first.errors).toHaveLength(1);
  expect(first.errors[0]).toContain(failure === "mutations" ? "Mutations:" : "Junctions:");
  if (failure === "mutations") {
    expect(first.mutations).toBeNull();
    expect(first.junctions.stats.entries).toBe(4);
  } else {
    expect(first.mutations).toBe(matrix);
    expect(first.junctions).toBeNull();
  }
  axios.get.mockImplementation(async path => ({ data: path.endsWith("junctions.json") ? junctionSource : genome }));
  const retry = execute(loadPhylogenyHeatmap, s.state(), actions.loadPhylogenyHeatmap(tree.id));
  await retry.task.toPromise();
  expect(retry.state().phylogenyHeatmap).toMatchObject({ status: "ready", mutations: matrix, errors: [], junctions: { stats: { entries: 4 } } });
  expect(axios.get).toHaveBeenCalledTimes(7);
});

test("loaded mutations publish immediately even while the optional junction request is pending", async () => {
  const pending = deferred();
  const matrix = { stats: { entries: 92000 } };
  parsePlotlyMutations.mockReturnValue(matrix);
  const plot = { ...tree, data: "(a);", heatmap: { mutationSource: "mutations.json", junctionSource: "junctions.json" } };
  axios.get.mockImplementation(path => path.endsWith("junctions.json") ? pending.promise : Promise.resolve({ data: genome }));
  const s = execute(loadPhylogenyHeatmap, app({ plots: [plot] }), actions.loadPhylogenyHeatmap(tree.id));
  await tick();
  expect(s.state().phylogenyHeatmap).toMatchObject({ status: "loading", mutations: matrix, junctions: null });
  pending.resolve({ data: junctionSource });
  await s.task.toPromise();
  expect(s.state().phylogenyHeatmap).toMatchObject({ status: "ready", mutations: matrix, junctions: { stats: { entries: 4 } } });
});

test("cancelling a pending junction load ignores its late result", async () => {
  const pending = deferred();
  const plot = { ...tree, data: "(a);", heatmap: { junctionSource: "junctions.json" } };
  axios.get.mockImplementation(path => path.endsWith("junctions.json") ? pending.promise : Promise.resolve({ data: genome }));
  const s = execute(loadPhylogenyHeatmap, app({ plots: [plot] }), actions.loadPhylogenyHeatmap(tree.id));
  await tick();
  expect(axios.get.mock.calls.map(([path]) => path)).toContain("data/cohort/junctions.json");
  s.task.cancel();
  const count = s.events.length;
  pending.resolve({ data: junctionSource });
  await s.task.toPromise(); await tick();
  expect(s.events).toHaveLength(count);
  expect(s.state().phylogenyHeatmap.junctions).toBeNull();
});

test("manifest sample aliases match exact leaf IDs and reject reference mismatches", async () => {
  const state = app({ datafiles: [manifest("sample-file", "a"), manifest("wrong-reference", "b", "other"), manifest("not-a-leaf")] });
  const s = execute(openPhylogenyCells, state, actions.openPhylogenyCells(["a", "b", "not-a-leaf"], true));
  await s.task.toPromise();
  expect(axios.get.mock.calls.map(([path]) => path)).toEqual(["data/sample-file/g.json"]);
  expect(s.state().plots.find((p) => p.type === "genome")).toMatchObject({ ownerFile: "sample-file", sample: "a" });
  expect(s.state().selectedFiles).toEqual([cohortFile, state.datafiles[0]]);
  expect(s.state().selectedFiles[1]).toBe(state.datafiles[0]);
  expect(s.state().phylogenyAddedFiles).toEqual(["sample-file"]);
  expect(s.state().cellTrackLoad.errors).toEqual(["b: no matching genome dataset for the current reference"]);
});

test("one failed cell does not block peers and can retry without reloading successes", async () => {
  axios.get.mockImplementation((path) => path.includes("/b/") ? Promise.reject(new Error("missing b")) : Promise.resolve({ data: genome }));
  const s = execute(openPhylogenyCells, app(), actions.openPhylogenyCells(["a", "b"], true));
  await s.task.toPromise();
  expect(s.state().cellTrackLoad).toMatchObject({ status: "error", total: 2, completed: 2 });
  expect(s.state().cellTrackLoad.errors.join(" ")).toContain("b");
  expect(s.state().plots.some((p) => p.ownerFile === "a")).toBe(true);
  // Legacy GenomePanel requires a graph even while collapsed: failed graphs
  // must not be mounted, and their manifest descriptor remains retryable.
  expect(s.state().plots.some((p) => p.ownerFile === "b" && p.type === "genome")).toBe(false);
  expect(s.state().selectedFiles.map((file) => file.file)).toEqual(["cohort", "a"]);
  axios.get.mockResolvedValue({ data: genome });
  const next = execute(openPhylogenyCells, s.state(), actions.openPhylogenyCells(["a", "b"], true));
  await next.task.toPromise();
  expect(next.state().cellTrackLoad).toMatchObject({ status: "ready", errors: [] });
  expect(next.state().selectedFiles.map((file) => file.file)).toEqual(["cohort", "a", "b"]);
  expect(axios.get).toHaveBeenCalledTimes(3);
});

test("launch exposes one panel per selected cohort and groups alternate Newicks as a selector", async () => {
  const files = {
    cohortA: { description: [], reference: "ref", plots: [
      { type: "phylogeny", source: "without.newick", title: "Without normal", visible: true },
      { type: "phylogeny", source: "with.newick", title: "With normal", visible: true },
    ] },
    cohortB: { description: [], reference: "ref", plots: [
      { type: "phylogeny", source: "tree.newick", title: "BWH69", visible: true },
    ] },
  };
  const settings = { coordinates: { sets: { ref: [{ chromosome: "chr1", startPoint: 1, endPoint: 100, color: "red" }] }, higlassMap: { ref: "ref" } }, geography: [], geneAnnotations: { ref: "genes" }, higlassServer: "server" };
  axios.get.mockImplementation(async source => ({ data:
    source.includes("tilesets/?") ? { results: [] } : source.endsWith("without.newick") ? "(a);" : source.endsWith("with.newick") ? "(a);" : "(b);" }));
  loadArrowTable.mockResolvedValue({ getChild: () => ({ toArray: () => [] }) });
  const s = execute(launchApplication, app({ settings, datafilesJSON: files }), actions.launchApp(["cohortA", "cohortB"], []));
  await s.task.toPromise();
  const phylogenies = s.state().plots.filter(plot => plot.type === "phylogeny");
  expect(phylogenies).toHaveLength(2);
  expect(phylogenies[0].treeOptions.map(option => option.title)).toEqual(["Without normal", "With normal"]);
  expect(phylogenies[0].activeTreeId).toBe(phylogenies[0].treeOptions[0].id);
  expect(phylogenies[1].treeOptions).toHaveLength(1);
  expect(s.events.filter(event => event.type === actions.LOAD_PHYLOGENY_HEATMAP).map(event => event.plotId)).toEqual(phylogenies.map(plot => plot.id));
});

test("hidden optional Arrow is lazy on explicit expansion, failures surfaced and later expansion retries", async () => {
  const opened = execute(openPhylogenyCells, app(), actions.openPhylogenyCells(["a"], true));
  await opened.task.toPromise();
  expect(loadArrowTable).not.toHaveBeenCalled();
  const plots = opened.state().plots.map((p) => p.type === "scatterplot" ? { ...p, visible: true } : p);
  loadArrowTable.mockRejectedValueOnce(new Error("coverage unavailable"));
  const lazy = execute(loadVisiblePlotData, opened.state(), actions.updatePlots(plots));
  await lazy.task.toPromise();
  expect(loadArrowTable).toHaveBeenCalledWith("data/a/coverage.arrow");
  expect(lazy.state().plots.find((p) => p.type === "scatterplot").loadError).toContain("coverage unavailable");
  const retry = execute(loadVisiblePlotData, lazy.state(), actions.updatePlots(lazy.state().plots));
  await retry.task.toPromise();
  expect(loadArrowTable).toHaveBeenCalledTimes(2);
  expect(retry.state().plots.find((p) => p.type === "scatterplot")).toMatchObject({ data: { numRows: 1 }, loadError: null, loadStatus: "ready" });
});

test("tree-only unmatched datasets retain null legacy fallback; bad trees and mutation errors are explicit", async () => {
  const unmatched = execute(loadPhylogenyHeatmap, app({ datafiles: [] }), actions.loadPhylogenyHeatmap("tree"));
  await unmatched.task.toPromise();
  expect(unmatched.state().phylogenyHeatmap).toBeNull();
  expect(axios.get).not.toHaveBeenCalled();
  const invalid = execute(loadPhylogenyHeatmap, app({ plots: [{ ...tree, data: "(broken" }] }), actions.loadPhylogenyHeatmap("tree"));
  await invalid.task.toPromise();
  expect(invalid.state().phylogenyHeatmap.status).toBe("error");
  parsePlotlyMutations.mockImplementation(() => { throw new Error("invalid matrix"); });
  const badMutation = execute(loadPhylogenyHeatmap, app({ plots: [{ ...tree, heatmap: { mutationSource: "bad.json" } }] }), actions.loadPhylogenyHeatmap("tree"));
  await badMutation.task.toPromise();
  expect(badMutation.state().phylogenyHeatmap).toMatchObject({ status: "error", completed: 4, mutations: null });
  expect(Object.keys(badMutation.state().phylogenyHeatmap.cnByCell)).toHaveLength(4);
});

test("showing hidden phylogenies starts independent overview tasks and does not restart running or loaded panels", async () => {
  const pendingA = deferred(), pendingB = deferred();
  axios.get.mockImplementation(path => path === "data/a/g.json" ? pendingA.promise : pendingB.promise);
  const treeA = { ...tree, id: "tree-a", visible: false, data: "(a);" };
  const treeB = { ...tree, id: "tree-b", visible: false, data: "(b);" };
  const s = store(app({ plots: [treeA, treeB] }));
  const task = runSaga(s, rootSaga);
  s.dispatch(actions.updatePlots([{ ...treeA, visible: true }, treeB]));
  await tick();
  expect(axios.get.mock.calls.map(([path]) => path)).toEqual(["data/a/g.json"]);
  s.dispatch(actions.updatePlots(s.state().plots.map(plot => ({ ...plot, visible: true }))));
  await tick();
  expect(axios.get.mock.calls.map(([path]) => path)).toEqual(["data/a/g.json", "data/b/g.json"]);
  pendingB.resolve({ data: genome });
  await tick(); await tick();
  expect(s.state().phylogenyHeatmaps[treeB.id].status).toBe("ready");
  expect(s.state().phylogenyHeatmaps[treeA.id].status).toBe("loading");
  pendingA.resolve({ data: genome });
  await tick(); await tick();
  expect(s.state().phylogenyHeatmaps[treeA.id].status).toBe("ready");
  const requests = s.state().phylogenyHeatmapRequests;
  s.dispatch(actions.updatePlots(s.state().plots));
  await tick();
  expect(s.state().phylogenyHeatmapRequests).toEqual(requests);
  task.cancel(); await task.toPromise();
});

test("switching a tree cancels its queued overview without cancelling another panel's overview", async () => {
  const pending = deferred();
  axios.get.mockImplementation(path => path.includes("/outsider/") ? Promise.resolve({ data: genome }) : pending.promise);
  const treeA = { ...tree, activeTreeId: "old", treeOptions: [{ id: "new", data: "(b);" }] };
  const treeB = { ...tree, id: "other-tree", data: "(outsider);" };
  const s = store(app({ plots: [treeA, treeB] }));
  const task = runSaga(s, rootSaga);
  s.dispatch(actions.loadPhylogenyHeatmap(treeA.id));
  s.dispatch(actions.loadPhylogenyHeatmap(treeB.id));
  await tick();
  expect(axios.get).toHaveBeenCalledTimes(3);
  s.dispatch(actions.selectPhylogenyTree(treeA.id, "new"));
  pending.resolve({ data: genome });
  await tick(); await tick();
  expect(s.state().phylogenyHeatmaps[treeA.id]).toBeNull();
  expect(s.state().phylogenyHeatmaps[treeB.id]).toMatchObject({ status: "ready", cellIds: ["outsider"] });
  expect(axios.get.mock.calls.some(([path]) => path === "data/d/g.json")).toBe(false);
  task.cancel(); await task.toPromise();
});

test("re-selecting the current tree does not cancel its active overview", async () => {
  const pending = deferred();
  axios.get.mockReturnValue(pending.promise);
  const plot = { ...tree, data: "(a);", activeTreeId: "old", treeOptions: [{ id: "old", data: "(a);" }] };
  const s = store(app({ plots: [plot] }));
  const task = runSaga(s, rootSaga);
  s.dispatch(actions.loadPhylogenyHeatmap(plot.id));
  await tick();
  s.dispatch(actions.selectPhylogenyTree(plot.id, "old"));
  pending.resolve({ data: genome });
  await tick(); await tick();
  expect(s.state().phylogenyHeatmaps[plot.id].status).toBe("ready");
  task.cancel(); await task.toPromise();
});

test.each(["tree", "other-tree"])("switching %s cancels only cell loading originating in that panel", async changedPlot => {
  const pending = deferred();
  axios.get.mockReturnValue(pending.promise);
  const treeA = { ...tree, activeTreeId: "old", treeOptions: [{ id: "new", data: "(b);" }] };
  const treeB = { ...treeA, id: "other-tree" };
  const s = store(app({ plots: [treeA, treeB] }));
  const task = runSaga(s, rootSaga);
  s.dispatch(actions.openPhylogenyCells(["a", "b", "c", "d"], true, treeA.id));
  await tick();
  expect(axios.get).toHaveBeenCalledTimes(3);
  s.dispatch(actions.selectPhylogenyTree(changedPlot, "new"));
  pending.resolve({ data: genome });
  await tick(); await tick(); await tick();
  if (changedPlot === treeA.id) {
    expect(axios.get).toHaveBeenCalledTimes(3);
    expect(s.state().plots.filter(plot => plot.type === "genome")).toHaveLength(0);
    expect(s.state().selectedFiles).toEqual([cohortFile]);
    expect(s.state().cellTrackLoad.status).toBe("cancelled");
  } else {
    expect(axios.get).toHaveBeenCalledTimes(4);
    expect(s.state().plots.filter(plot => plot.type === "genome")).toHaveLength(4);
    expect(s.state().cellTrackLoad.status).toBe("ready");
  }
  task.cancel(); await task.toPromise();
});

test("root watcher: selection and unconfirmed open never cancel active work; explicit cancel stops queue and stale append", async () => {
  const pending = deferred();
  axios.get.mockReturnValue(pending.promise);
  const s = store(app());
  const task = runSaga(s, rootSaga);
  s.dispatch(actions.openPhylogenyCells(["a", "b", "c", "d"], true));
  await tick();
  expect(axios.get).toHaveBeenCalledTimes(3);
  s.dispatch(actions.selectPhylogenyNodes([{ id: "b", selected: true }]));
  s.dispatch(actions.openPhylogenyCells(["b"], false));
  expect(s.state().cellTrackLoad.status).toBe("loading");
  s.dispatch(actions.cancelPhylogenyCellLoad());
  pending.resolve({ data: genome });
  await tick(); await tick();
  expect(axios.get).toHaveBeenCalledTimes(3);
  expect(s.state().plots).toEqual([tree]);
  expect(s.state().cellTrackLoad.status).toBe("cancelled");
  expect(s.state().selectedFiles).toEqual([cohortFile]);
  expect(s.state().phylogenyAddedFiles).toEqual([]);
  task.cancel();
  await task.toPromise();
});

test("cancel after a partial success retains only its accepted owner until tracks are cleared", async () => {
  const pending = deferred();
  axios.get.mockImplementation(path => path === "data/a/g.json" ? Promise.resolve({ data: genome }) : pending.promise);
  const s = store(app());
  const task = runSaga(s, rootSaga);
  s.dispatch(actions.openPhylogenyCells(["a", "b", "c", "d"], true));
  await tick(); await tick();
  expect(s.state().selectedFiles.map(file => file.file)).toEqual(["cohort", "a"]);
  s.dispatch(actions.cancelPhylogenyCellLoad());
  pending.resolve({ data: genome });
  await tick(); await tick();
  expect(s.state().selectedFiles.map(file => file.file)).toEqual(["cohort", "a"]);
  expect(s.state().phylogenyAddedFiles).toEqual(["a"]);
  s.dispatch(actions.clearPhylogenyTracks());
  expect(s.state().selectedFiles).toEqual([cohortFile]);
  expect(s.state().phylogenyAddedFiles).toEqual([]);
  task.cancel(); await task.toPromise();
});

test('clear tracks cancels queued opening, ignores late results, and permits a fresh confirmed open', async () => {
  const pending = deferred();
  axios.get.mockReturnValue(pending.promise);
  const selected = [{ id: 'a', selected: true }];
  const s = store(app({ nodes: selected }));
  const task = runSaga(s, rootSaga);
  s.dispatch(actions.openPhylogenyCells(['a', 'b', 'c', 'd'], true));
  await tick();
  expect(axios.get).toHaveBeenCalledTimes(3);
  s.dispatch(actions.clearPhylogenyTracks());
  pending.resolve({ data: genome });
  await tick(); await tick();
  expect(axios.get).toHaveBeenCalledTimes(3);
  expect(s.state().plots).toEqual([tree]);
  expect(s.state().nodes).toBe(selected);
  expect(s.state().cellTrackLoad.status).toBe('idle');
  expect(s.state().selectedFiles).toEqual([cohortFile]);
  expect(s.state().phylogenyAddedFiles).toEqual([]);
  axios.get.mockResolvedValue({ data: genome });
  s.dispatch(actions.openPhylogenyCells(['d'], false));
  await tick();
  expect(axios.get).toHaveBeenCalledTimes(3);
  s.dispatch(actions.openPhylogenyCells(['d'], true));
  await tick(); await tick();
  expect(s.state().plots.some(p => p.type === 'genome' && p.sample === 'd')).toBe(true);
  expect(s.state().selectedFiles.map(file => file.file)).toEqual(['cohort', 'd']);
  task.cancel(); await task.toPromise();
});

test("a transport-successful HTML/malformed genome is an explicit retryable error, never a mounted graph", async () => {
  axios.get.mockResolvedValueOnce({ data: "<!doctype html>missing source fallback" });
  const first = execute(openPhylogenyCells, app(), actions.openPhylogenyCells(["a"], true));
  await first.task.toPromise();
  expect(first.state().cellTrackLoad.status).toBe("error");
  expect(first.state().plots.some((plot) => plot.type === "genome")).toBe(false);
  expect(first.state().selectedFiles).toEqual([cohortFile]);
  const retry = execute(openPhylogenyCells, first.state(), actions.openPhylogenyCells(["a"], true));
  await retry.task.toPromise();
  expect(retry.state().cellTrackLoad.status).toBe("ready");
  expect(retry.state().plots.find((plot) => plot.type === "genome").data).toBe(genome);
  expect(axios.get).toHaveBeenCalledTimes(2);
});

test("parse failures discard only invalid cached sources so corrected CN and mutations retry", async () => {
  const plot = { ...tree, heatmap: { mutationSource: "mutations.json" } };
  axios.get.mockImplementation((path) => Promise.resolve({ data: path.includes("/b/") ? { intervals: [{ ...genome.intervals[0], chromosome: "absent" }] } : genome }));
  parsePlotlyMutations.mockImplementationOnce(() => { throw new Error("invalid matrix"); }).mockReturnValue({ stats: { entries: 92000 } });
  const first = execute(loadPhylogenyHeatmap, app({ plots: [plot] }), actions.loadPhylogenyHeatmap("tree"));
  await first.task.toPromise();
  expect(first.state().phylogenyHeatmap).toMatchObject({ status: "error", completed: 4, mutations: null });
  axios.get.mockResolvedValue({ data: genome });
  const retry = execute(loadPhylogenyHeatmap, first.state(), actions.loadPhylogenyHeatmap("tree"));
  await retry.task.toPromise();
  expect(retry.state().phylogenyHeatmap).toMatchObject({ status: "ready", completed: 4, errors: [], mutations: { stats: { entries: 92000 } } });
  expect(axios.get).toHaveBeenCalledTimes(7); // successes a/c/d retained; b/matrix retried
});

test("confirmed default-visible Arrow descriptors load sequentially within each of three cells", async () => {
  const files = ["a", "b", "c", "d"].map((id) => {
    const file = manifest(id);
    file.plots[1].visible = true;
    return file;
  });
  let active = 0, peak = 0;
  const started = [], finished = [];
  const load = async (path, value) => {
    started.push(path); peak = Math.max(peak, ++active);
    await tick(); active--; finished.push(path); return value;
  };
  axios.get.mockImplementation((path) => load(path, { data: genome }));
  loadArrowTable.mockImplementation((path) => {
    expect(finished).toContain(path.replace("coverage.arrow", "g.json"));
    return load(path, { numRows: 1 });
  });
  const s = execute(openPhylogenyCells, app({ datafiles: files }), actions.openPhylogenyCells(["a", "b", "c", "d"], true));
  await s.task.toPromise();
  expect(peak).toBe(3);
  expect(started).toHaveLength(8);
  expect(s.state().cellTrackLoad).toMatchObject({ status: "ready", completed: 4 });
});

test("opening an existing collapsed group reveals it without changing its IDs or fetching again", async () => {
  const file = manifest("a");
  const existing = { ...file.plots[0], visible: false, deleted: true, data: genome };
  const s = execute(openPhylogenyCells, app({ plots: [tree, existing] }), actions.openPhylogenyCells(["a"], true));
  await s.task.toPromise();
  expect(s.state().plots.find((p) => p.type === "genome")).toMatchObject({ id: file.plots[0].id, visible: true, deleted: false, data: genome });
  expect(axios.get).not.toHaveBeenCalled();
});

test("confirmed walk/bigwig descriptors use legacy preparation without mutating cached raw walks", async () => {
  const file = manifest("a");
  const rawWalk = { walks: [{ iids: [{ chromosome: "chr1", startPoint: 1, endPoint: 20, y: 99 }] }] };
  file.plots.push(
    { id: "walk", ownerFile: "a", type: "walk", source: "walk.json", path: "data/a/walk.json", visible: true },
    { id: "bw", ownerFile: "a", type: "bigwig", source: "u", uuid: "u", server: "server", visible: true }
  );
  axios.get.mockImplementation((path) => Promise.resolve({ data:
    path.includes("tileset_info") ? { u: { name: "signal", tile_size: 1, max_width: 100 } } :
    path.includes("tiles/?") ? { "u.2.0": { dense: "AAAAQA==", dtype: "float32" } } :
    path.endsWith("walk.json") ? rawWalk : genome
  }));
  const s = execute(openPhylogenyCells, app({ datafiles: [file] }), actions.openPhylogenyCells(["a"], true));
  await s.task.toPromise();
  expect(s.state().cellTrackLoad.status).toBe("ready");
  const walk = s.state().plots.find((p) => p.type === "walk");
  expect(walk.data.maximumY).toBe(1);
  expect(rawWalk.walks[0].iids[0].y).toBe(99);
  const bigwig = s.state().plots.find((p) => p.type === "bigwig");
  expect(bigwig.tilesetInfo.tile_size).toBe(1);
  expect(bigwig.data[0]).toEqual({ x: 0, y: 2 });
  // Existing getFloatArray pads tiles to 1024; retain that legacy behavior.
  expect(bigwig.data).toHaveLength(1024);
});

// Launch is additionally exercised with a minimal genuine manifest; no guessed cell filenames.
test("launch maps owner/sample and retains same-reference trees with multiple files, no eager hidden Arrow", async () => {
  const files = {
    cohort: { description: [], reference: "ref", plots: [{ type: "phylogeny", source: "tree.nwk", title: "tree", visible: true }] },
    a: { description: [], reference: "ref", plots: [{ type: "genome", source: "g.json", title: "CN", visible: true }, { type: "scatterplot", source: "coverage.arrow", title: "coverage", visible: false }] },
  };
  const settings = { coordinates: { sets: { ref: [{ chromosome: "chr1", startPoint: 1, endPoint: 100, color: "red" }] }, higlassMap: { ref: "ref" } }, geography: [], geneAnnotations: { ref: "genes" }, higlassServer: "server" };
  const arrow = { getChild: () => ({ toArray: () => [] }) };
  loadArrowTable.mockResolvedValue(arrow);
  axios.get.mockImplementation((path) => Promise.resolve({ data: path.endsWith("tree.nwk") ? "(a);" : path.includes("tilesets/?") ? { results: [] } : genome }));
  const s = execute(launchApplication, app({ settings, datafilesJSON: files }), actions.launchApp(["cohort", "a"], []));
  await s.task.toPromise();
  expect(s.state().plots.some((p) => p.type === "phylogeny")).toBe(true);
  expect(s.state().plots.find((p) => p.type === "phylogeny").title).toBe("tree");
  expect(s.state().plots.find((p) => p.type === "genome")).toMatchObject({ ownerFile: "a", sample: "a", reference: "ref", title: "a CN" });
  expect(s.state().plots.find((p) => p.type === "scatterplot").title).toBe("a coverage");
  expect(loadArrowTable.mock.calls.map(([path]) => path)).toEqual(["genes/ref.arrow"]);
  expect(s.events.some((event) => event.type === actions.LOAD_PHYLOGENY_HEATMAP)).toBe(true);
  const selectedFiles = s.state().selectedFiles;
  const opened = execute(openPhylogenyCells, s.state(), actions.openPhylogenyCells(["a"], true));
  await opened.task.toPromise();
  expect(opened.state().selectedFiles).toBe(selectedFiles);
  expect(opened.state().phylogenyAddedFiles).toEqual([]);
  opened.dispatch(actions.clearPhylogenyTracks());
  expect(opened.state().selectedFiles).toEqual(selectedFiles);
  expect(new URL(document.location).searchParams.get("file")).toBe("cohort,a");
});

test.each(["coverage", "walk"])("optional %s failure still selects the successfully opened genome owner; retry does not duplicate it", async (optional) => {
  const file = manifest("a");
  if (optional === "coverage") {
    file.plots[1].visible = true;
    loadArrowTable.mockRejectedValueOnce(new Error("coverage failed"));
  } else {
    file.plots.push({ id: "walk", ownerFile: "a", type: "walk", source: "walk.json", path: "data/a/walk.json", visible: true });
    axios.get.mockResolvedValueOnce({ data: genome }).mockRejectedValueOnce(new Error("walk failed"))
      .mockResolvedValue({ data: { walks: [] } });
  }
  const first = execute(openPhylogenyCells, app({ datafiles: [cohortFile, file] }), actions.openPhylogenyCells(["a"], true));
  await first.task.toPromise();
  expect(first.state().cellTrackLoad.status).toBe("error");
  expect(first.state().cellTrackLoad.errors.join(" ")).toContain(`${optional} failed`);
  expect(first.state().plots.find(p => p.type === "genome")).toMatchObject({ loadStatus: "ready", data: genome });
  expect(first.events.find(event => event.type === actions.PHYLOGENY_CELL_PLOTS_LOADED).loadedFile).toBe(file.file);
  expect(first.state().selectedFiles).toEqual([cohortFile, file]);
  expect(first.state().selectedFiles[1]).toBe(file);
  expect(first.state().phylogenyAddedFiles).toEqual([file.file]);
  const retry = execute(openPhylogenyCells, first.state(), actions.openPhylogenyCells(["a"], true));
  await retry.task.toPromise();
  expect(retry.state().cellTrackLoad).toMatchObject({ status: "ready", errors: [] });
  expect(retry.state().selectedFiles).toBe(first.state().selectedFiles);
  expect(retry.state().phylogenyAddedFiles).toEqual([file.file]);
});

test.each(["transport failure", "invalid graph"])("matched primary genome %s cannot borrow success from another genome view or optional track", async (failure) => {
  const file = manifest("multi", "a");
  file.plots[1].visible = true;
  // Both genome views belong to cell a, but findCohort matches the first graph.
  file.plots.push({ ...file.plots[0], id: "alternate", source: "alternate.json", path: "data/multi/alternate.json" });
  axios.get.mockImplementation(path => path.endsWith("/g.json")
    ? failure === "transport failure" ? Promise.reject(new Error("genome unavailable")) : Promise.resolve({ data: "<html>not a genome</html>" })
    : Promise.resolve({ data: genome }));
  const s = execute(openPhylogenyCells, app({ datafiles: [cohortFile, file] }), actions.openPhylogenyCells(["a"], true));
  await s.task.toPromise();
  expect(s.state().cellTrackLoad).toMatchObject({ status: "error", completed: 1 });
  expect(s.state().cellTrackLoad.errors.join(" ")).toContain(failure === "transport failure" ? "genome unavailable" : "Invalid genome graph");
  expect(s.state().plots.some(plot => plot.id === file.plots[0].id)).toBe(false);
  expect(s.state().plots.find(plot => plot.id === "alternate")).toMatchObject({ loadStatus: "ready", data: genome });
  expect(s.state().plots.find(plot => plot.type === "scatterplot")).toMatchObject({ loadStatus: "ready", data: { numRows: 1 } });
  expect(s.events.find(event => event.type === actions.PHYLOGENY_CELL_PLOTS_LOADED).loadedFile).toBeUndefined();
  expect(s.state().selectedFiles).toEqual([cohortFile]);
  expect(s.state().phylogenyAddedFiles).toEqual([]);
});

test("two exact samples in one manifest add its real owner once, never leaf-named files or unrequested sources", async () => {
  const plots = ["c", "a", "b"].map(id => ({ ...manifest("multi", id).plots[0], id, source: `${id}.json`, path: `data/multi/${id}.json` }));
  const file = { file: "multi", reference: "ref", tags: ["multi-sample"], plots };
  const s = execute(openPhylogenyCells, app({ datafiles: [cohortFile, file] }), actions.openPhylogenyCells(["a", "b"], true));
  await s.task.toPromise();
  expect(s.state().plots.filter(p => p.type === "genome").map(p => p.sample)).toEqual(["a", "b"]);
  expect(axios.get.mock.calls.map(([source]) => source)).toEqual(["data/multi/a.json", "data/multi/b.json"]);
  expect(s.state().selectedFiles).toEqual([cohortFile, file]);
  expect(s.state().selectedFiles[1]).toBe(file);
  expect(s.state().phylogenyAddedFiles).toEqual(["multi"]);
});
