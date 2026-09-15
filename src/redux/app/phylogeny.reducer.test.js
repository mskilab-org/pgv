import actions from "./actions";
import reducer from "./reducer";

jest.mock("apache-arrow", () => ({ tableFromIPC: jest.fn() }));

const initial = () => reducer(undefined, {});
const loadedGenome = (ownerFile, sample = ownerFile) => ({
  id: `${ownerFile}-${sample}`, ownerFile, sample, type: "genome", source: `${sample}.json`,
  visible: true, loadStatus: "ready", data: { intervals: [], connections: [] },
});

test("public interfaces default to hidden mutations and unconfirmed opening is inert", () => {
  const state = initial();
  expect(state.phylogenyHeatmap).toBeNull();
  expect(state.phylogenyAddedFiles).toEqual([]);
  expect(state.phylogenyPanelHeight).toBe(640);
  expect(state.phylogenyView).toEqual({ gutterWidth: 240, gutterHidden: false, mutationMode: "hidden", selectedRowsOnly: false, selectedTracksOnly: false });
  expect(state.cellTrackLoad).toEqual({ status: "idle", total: 0, completed: 0, errors: [] });
  expect(actions.openPhylogenyCells(["a"])).toEqual({ type: actions.OPEN_PHYLOGENY_CELLS, cellIds: ["a"], confirmed: false });
  expect(reducer(state, actions.openPhylogenyCells(["a"]))).toBe(state);
  expect(reducer(state, actions.openPhylogenyCells(["a", "b"], false))).toBe(state);
  expect(reducer(state, actions.updatePhylogenyView({ mutationMode: "paired" })).phylogenyView).toEqual({ ...state.phylogenyView, mutationMode: "paired" });
});

test('clear tracks removes all detail types including hidden panels, retaining context and rejecting stale work', () => {
  const context = ['phylogeny', 'genes', 'anatomy'].map(type => ({ id: type, type, visible: true }));
  let state = { ...initial(), plots: [...context, ...['genome', 'walk', 'scatterplot', 'barplot', 'bigwig'].map(type => ({ id: type, type, visible: false }))],
    phylogenyHeatmap: { mutations: { values: new Float64Array(92000) } }, domains: [[10, 20]], nodes: [{ id: 'a', selected: true }] };
  state = reducer(state, actions.openPhylogenyCells(['a'], true));
  const requestId = state.cellTrackRequest;
  const next = reducer(state, actions.clearPhylogenyTracks());
  expect(next.plots).toEqual(context);
  expect(next.nodes).toBe(state.nodes);
  expect(next.domains).toBe(state.domains);
  expect(next.phylogenyHeatmap).toBe(state.phylogenyHeatmap);
  expect(next.cellTrackLoad.status).toBe('idle');
  expect(reducer(next, { type: actions.PHYLOGENY_CELL_PLOTS_LOADED, requestId, plots: [{ id: 'late', type: 'genome' }] })).toBe(next);
  expect(reducer(next, { type: actions.CELL_TRACK_LOAD_UPDATED, requestId, properties: { status: 'ready' } })).toBe(next);
  expect(reducer(next, { type: actions.PLOT_DATA_UPDATED, plots: [{ id: 'genome', data: 'late' }] }).plots).toEqual(context);
  expect(reducer(next, actions.openPhylogenyCells(['a']))).toBe(next);
});

test.each([[100, 140], [740, 740], [2000, 1600], [null, 640], [NaN, 640]])('height %s is bounded and invalid values ignored', (input, expected) => {
  expect(reducer(initial(), actions.updatePhylogenyPanelHeight(input)).phylogenyPanelHeight).toBe(expected);
});

test("node selection neither loads tracks nor crashes if a graph or connection is absent", () => {
  const state = { ...initial(), connectionsAssociations: [{ sample: "a", connections: [1] }] };
  const selected = [{ id: "a", selected: true }];
  const next = reducer(state, actions.selectPhylogenyNodes(selected));
  expect(next.nodes).toBe(selected);
  expect(next.selectedConnectionsRange).toEqual([]);
  expect(next.plots).toBe(state.plots);
  expect(next.cellTrackLoad).toBe(state.cellTrackLoad);
  expect(() => reducer({ ...state, plots: [{ type: "genome", sample: "a", data: { connections: [], intervals: [] } }] }, actions.selectPhylogenyNodes(selected))).not.toThrow();
});

test("confirmed intent reveals by stable panel identity; cloned results patch without replacing tree, domains or selection", () => {
  const tree = { id: "tree", type: "phylogeny", visible: true };
  const genome = { id: "genome", ownerFile: "a", type: "genome", source: "g.json", visible: false };
  let state = { ...initial(), plots: [tree, genome], domains: [[1, 100]], nodes: [{ id: "a", selected: true }] };
  state = reducer(state, actions.openPhylogenyCells(["a"], true));
  const previousPlots = state.plots;
  state = reducer(state, { type: actions.PHYLOGENY_CELL_PLOTS_REQUESTED, epoch: state.datasetEpoch, requestId: state.cellTrackRequest, plots: [genome] });
  expect(state.plots[1].visible).toBe(true);
  const plots = [{ ...genome, data: { intervals: [] } }];
  const event = { type: actions.PHYLOGENY_CELL_PLOTS_LOADED, epoch: state.datasetEpoch, requestId: state.cellTrackRequest, previousPlots, plots };
  let next = reducer(state, event);
  expect(next.plots).toHaveLength(2);
  expect(next.plots[0]).toBe(tree);
  expect(next.plots[1]).toMatchObject({ id: "genome", visible: true, data: { intervals: [] } });
  expect(next.domains).toBe(state.domains);
  expect(next.nodes).toBe(state.nodes);
  expect(reducer(next, event).plots).toHaveLength(2);
});

test("cancel and dataset relaunch reject stale progress, heatmaps, data and appends", () => {
  let state = reducer(initial(), actions.openPhylogenyCells(["a"], true));
  const epoch = state.datasetEpoch, requestId = state.cellTrackRequest;
  state = reducer(state, actions.cancelPhylogenyCellLoad());
  expect(state.cellTrackLoad.status).toBe("cancelled");
  expect(reducer(state, { type: actions.CELL_TRACK_LOAD_UPDATED, epoch, requestId, properties: { status: "ready" } })).toBe(state);
  state = reducer(state, actions.launchApp(["new"], []));
  [
    { type: actions.PHYLOGENY_CELL_PLOTS_LOADED, plots: [{ type: "genome" }] },
    { type: actions.PHYLOGENY_HEATMAP_UPDATED, data: { status: "ready" } },
    { type: actions.PLOT_DATA_UPDATED, plots: [{ id: "x", data: "stale" }] },
    { type: actions.LAUNCH_APP_SUCCESS, properties: { plots: ["stale"] } },
    { type: actions.HIGLASS_LOADED, properties: { plots: ["stale"] } },
  ].forEach((event) => expect(reducer(state, { ...event, epoch, requestId })).toBe(state));
});

test("bigwig domain completion patches existing data and preserves newly appended or removed plots", () => {
  const original = { id: "bigwig", type: "bigwig", visible: false, data: [] };
  const added = { id: "new", ownerFile: "a", type: "genome", source: "g.json" };
  const state = { ...initial(), plots: [original, added] };
  const next = reducer(state, { type: actions.HIGLASS_LOADED, epoch: state.datasetEpoch, properties: { plots: [{ ...original, visible: true, data: [1] }, { id: "removed", data: [2] }], bigwigsYRange: [0, 1] } });
  expect(next.plots).toEqual([{ ...original, data: [1] }, added]);
});

test("bigwig metadata completion preserves additions and transfers the new title", () => {
  const bigwig = { type: "bigwig", server: "s", uuid: "u", visible: false };
  const genome = { id: "g", ownerFile: "a", type: "genome", source: "g.json" };
  const state = { ...initial(), plots: [bigwig, genome] };
  const next = reducer(state, { type: actions.BIGWIG_PLOT_ADDED, epoch: state.datasetEpoch,
    properties: { plots: [{ ...bigwig, visible: true, title: "signal", tilesetInfo: { name: "signal" } }] },
  });
  expect(next.plots).toEqual([{ ...bigwig, title: "signal", tilesetInfo: { name: "signal" } }, genome]);
});

test("publication-time viewport guard rejects old tiles for both existing and newly appended Bigwigs", () => {
  const existing = { id: "bw", type: "bigwig", tag: "bigwig_atac", data: [{ y: 9 }], dataDomains: [[51, 100]] };
  const state = { ...initial(), plots: [existing], domains: [[51, 100]] };
  const stale = { ...existing, data: [{ y: 2 }], dataDomains: [[1, 50]], tilesetInfo: {} };
  expect(reducer(state, { type: actions.PLOT_DATA_UPDATED, plots: [stale] }).plots[0]).toBe(existing);
  const next = reducer(state, { type: actions.PHYLOGENY_CELL_PLOTS_LOADED, requestId: state.cellTrackRequest, previousPlots: [existing], plots: [{ ...stale, id: "new" }] });
  expect(next.plots[0]).toBe(existing);
  expect(next.plots[1]).toMatchObject({ id: "new", data: null, tilesetInfo: {}, loadStatus: "loading" });
  expect(next.bigwigsYRange).toEqual([9, 9]);
});

test.each([false, 1, "true", null])("confirmation must be literal true, not %j", (confirmed) => {
  const state = initial();
  expect(reducer(state, actions.openPhylogenyCells(["a"], confirmed))).toBe(state);
});

test("successful file selection merges exact manifest entries once and clear removes only added owners", () => {
  const cohort = { file: "cohort", tags: ["study"], reference: "ref", plots: [] };
  const selectedCell = { file: "explicit-cell", reference: "ref", plots: [loadedGenome("explicit-cell")] };
  const a = { file: "owner-a", tags: ["sample"], reference: "ref", plots: [loadedGenome("owner-a", "a"), loadedGenome("owner-a", "b")] };
  const b = { file: "owner-b", reference: "ref", plots: [loadedGenome("owner-b")] };
  const originals = [cohort, selectedCell];
  // Legacy Jest/embedded state snapshots need not have the new provenance field.
  const legacy = { ...initial() };
  delete legacy.phylogenyAddedFiles;
  let state = { ...legacy, selectedFiles: originals, datafiles: [cohort, selectedCell, a, b], nodes: [{ id: "a", selected: true }] };
  state = reducer(state, actions.openPhylogenyCells(["a", "b"], true));
  const complete = (file, plot = file.plots[0]) => ({ type: actions.PHYLOGENY_CELL_PLOTS_LOADED,
    epoch: state.datasetEpoch, requestId: state.cellTrackRequest, plots: [{ ...plot }], loadedFile: file.file });
  state = reducer(state, complete(a));
  expect(state.selectedFiles).toEqual([...originals, a]);
  expect(state.selectedFiles[2]).toBe(a);
  expect(state.phylogenyAddedFiles).toEqual([a.file]);
  const selectedFiles = state.selectedFiles;
  state = reducer(state, complete(a, a.plots[1])); // Two samples in one owner.
  state = reducer(state, complete(a)); // Retry the same graph.
  expect(state.selectedFiles).toBe(selectedFiles);
  state = reducer(state, complete(selectedCell));
  state = reducer(state, complete(b));
  expect(state.selectedFiles).toEqual([...originals, a, b]);
  expect(state.phylogenyAddedFiles).toEqual([a.file, b.file]);
  const deselected = reducer(state, actions.selectPhylogenyNodes([]));
  expect(deselected.selectedFiles).toBe(state.selectedFiles);
  expect(deselected.phylogenyAddedFiles).toBe(state.phylogenyAddedFiles);
  const cleared = reducer(state, actions.clearPhylogenyTracks());
  expect(cleared.selectedFiles).toEqual(originals);
  expect(cleared.selectedFiles[0]).toBe(cohort);
  expect(cleared.phylogenyAddedFiles).toEqual([]);
  expect(cleared.nodes).toBe(state.nodes);
  expect(reducer(legacy, actions.clearPhylogenyTracks()).selectedFiles).toEqual([]);
});

test("selection publication needs confirmed loading and a real manifest owner; invalidated completions are inert", () => {
  const file = { file: "a", plots: [loadedGenome("a")] };
  const base = { ...initial(), datafiles: [file] };
  const complete = (state, loadedFile = "a") => ({ type: actions.PHYLOGENY_CELL_PLOTS_LOADED,
    epoch: state.datasetEpoch, requestId: state.cellTrackRequest, loadedFile, plots: [loadedGenome(loadedFile)] });
  const unconfirmed = reducer(base, actions.openPhylogenyCells(["a"]));
  expect(reducer(unconfirmed, complete(unconfirmed)).selectedFiles).toEqual([]);
  const confirmed = reducer(base, actions.openPhylogenyCells(["a"], true));
  expect(reducer(confirmed, complete(confirmed, "not-a-manifest-file")).selectedFiles).toEqual([]);
  [actions.cancelPhylogenyCellLoad(), actions.clearPhylogenyTracks(), actions.launchApp(["other"], [])].forEach((action) => {
    const invalidated = reducer(confirmed, action);
    expect(reducer(invalidated, complete(confirmed))).toBe(invalidated);
    expect(invalidated.selectedFiles).toEqual([]);
  });
});

test.each([
  ["empty payload", []],
  ["optional track only", [{ ...loadedGenome("a"), id: "coverage", type: "scatterplot" }]],
  ["failed genome", [{ ...loadedGenome("a"), loadStatus: "error" }]],
  ["missing genome data", [{ ...loadedGenome("a"), data: null }]],
  ["another owner", [loadedGenome("other")]],
])("selection requires a successful incoming genome for the reported owner: %s", (_, plots) => {
  const existing = loadedGenome("a", "already-open");
  const file = { file: "a", plots: [loadedGenome("a"), existing] };
  const state = reducer({ ...initial(), datafiles: [file], plots: [existing] }, actions.openPhylogenyCells(["a"], true));
  const next = reducer(state, { type: actions.PHYLOGENY_CELL_PLOTS_LOADED,
    epoch: state.datasetEpoch, requestId: state.cellTrackRequest, loadedFile: "a", previousPlots: state.plots, plots });
  expect(next.selectedFiles).toBe(state.selectedFiles);
  expect(next.phylogenyAddedFiles).toBe(state.phylogenyAddedFiles);
});

test("successful dataset launch resets added-file provenance, but a failed launch still permits clearing old additions", () => {
  const cohort = { file: "cohort", plots: [] }, added = { file: "a", plots: [] };
  const old = { ...initial(), selectedFiles: [cohort, added], phylogenyAddedFiles: [added.file] };
  const pending = reducer(old, actions.launchApp(["a"], []));
  expect(reducer(pending, actions.clearPhylogenyTracks())).toBe(pending);
  const failed = reducer(pending, { type: actions.LAUNCH_APP_FAILED, epoch: pending.datasetEpoch });
  expect(reducer(failed, actions.clearPhylogenyTracks()).selectedFiles).toEqual([cohort]);
  const launched = reducer(pending, { type: actions.LAUNCH_APP_SUCCESS, epoch: pending.datasetEpoch,
    properties: { selectedFiles: [added], plots: [] } });
  expect(launched.phylogenyAddedFiles).toEqual([]);
  expect(reducer(launched, actions.clearPhylogenyTracks()).selectedFiles).toEqual([added]);
});

test("PLOTS_UPDATED is safe without a genes plot, while lazy data patches preserve collapse state", () => {
  const plot = { id: "a", type: "scatterplot", visible: false };
  const state = reducer(initial(), actions.updatePlots([plot]));
  expect(state.plots).toEqual([plot]);
  expect(reducer(state, { type: actions.PLOT_DATA_UPDATED, epoch: state.datasetEpoch, plots: [{ ...plot, visible: true, data: "arrow" }] }).plots[0]).toMatchObject({ visible: false, data: "arrow" });
});
