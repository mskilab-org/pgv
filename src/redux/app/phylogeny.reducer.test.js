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
  expect(state.phylogenyView).toEqual({ gutterWidth: 240, gutterHidden: false, mutationMode: "hidden", cnMode: "total", mutationMetric: "vaf", fitRows: false, selectedRowsOnly: false, selectedTracksOnly: false });
  expect(state.cellTrackLoad).toEqual({ status: "idle", total: 0, completed: 0, errors: [] });
  expect(actions.openPhylogenyCells(["a"])).toEqual({ type: actions.OPEN_PHYLOGENY_CELLS, cellIds: ["a"], confirmed: false });
  expect(reducer(state, actions.openPhylogenyCells(["a"]))).toBe(state);
  expect(reducer(state, actions.openPhylogenyCells(["a", "b"], false))).toBe(state);
  expect(reducer(state, actions.updatePhylogenyView({ mutationMode: "paired" })).phylogenyView).toEqual({ ...state.phylogenyView, mutationMode: "paired" });
});

test("a cohort tree selector changes one panel's Newick source and invalidates only that panel's heatmap", () => {
  const first = { id: "tree-one", type: "phylogeny", ownerFile: "cohort", source: "one.nwk", path: "data/cohort/one.nwk", data: "(a);", heatmap: { mutationSource: "one.json" } };
  const second = { id: "tree-two", type: "phylogeny", ownerFile: "cohort", source: "two.nwk", path: "data/cohort/two.nwk", data: "(b);", heatmap: { mutationSource: "two.json" } };
  const state = { ...initial(), plots: [{ ...first, treeOptions: [first, second], activeTreeId: first.id }], phylogenyHeatmap: { plotId: first.id, status: "ready" }, phylogenyHeatmaps: { [first.id]: { plotId: first.id, status: "ready" } } };
  const next = reducer(state, actions.selectPhylogenyTree(first.id, second.id));
  expect(next.plots[0]).toMatchObject({ activeTreeId: second.id, source: second.source, path: second.path, data: second.data, heatmap: second.heatmap });
  expect(next.phylogenyHeatmaps[first.id]).toBeNull();
  expect(next.phylogenyHeatmap).toBeNull();
});

test("panel selections retain other cohorts and a tree switch clears only its selection and pending cell request", () => {
  const first = { id: "tree-a", type: "phylogeny", data: "(a);", activeTreeId: "old", treeOptions: [{ id: "new", data: "(new-a);" }] };
  const second = { id: "tree-b", type: "phylogeny", data: "(b);" };
  let state = { ...initial(), plots: [first, second] };
  state = reducer(state, actions.selectPhylogenyNodes([{ id: "a", selected: true }], first.id));
  state = reducer(state, actions.selectPhylogenyNodes([{ id: "b", selected: true }], second.id));
  expect(state.nodes).toEqual([{ id: "a", selected: true }, { id: "b", selected: true }]);
  state = reducer(state, actions.openPhylogenyCells(["a"], true, first.id));
  expect(state.cellTrackLoad.plotId).toBe(first.id);
  const requestId = state.cellTrackRequest;
  const next = reducer(state, actions.selectPhylogenyTree(first.id, "new"));
  expect(next.phylogenyNodes[first.id]).toEqual([]);
  expect(next.phylogenyNodes[second.id]).toBe(state.phylogenyNodes[second.id]);
  expect(next.nodes).toEqual([{ id: "b", selected: true }]);
  expect(next.cellTrackLoad).toMatchObject({ plotId: first.id, status: "cancelled" });
  expect(next.cellTrackRequest).toBe(requestId + 1);
  [
    { type: actions.CELL_TRACK_LOAD_UPDATED, properties: { status: "ready" } },
    { type: actions.PHYLOGENY_CELL_PLOTS_REQUESTED, plots: [loadedGenome("a")] },
    { type: actions.PHYLOGENY_CELL_PLOTS_LOADED, plots: [loadedGenome("a")], loadedFile: "a" },
  ].forEach(event => expect(reducer(next, { ...event, requestId })).toBe(next));
  const otherRequest = reducer(state, actions.openPhylogenyCells(["b"], true, second.id));
  const otherSwitch = reducer(otherRequest, actions.selectPhylogenyTree(first.id, "new"));
  expect(otherSwitch.cellTrackRequest).toBe(otherRequest.cellTrackRequest);
  expect(otherSwitch.cellTrackLoad).toBe(otherRequest.cellTrackLoad);
  const completed = reducer(state, { type: actions.CELL_TRACK_LOAD_UPDATED, requestId, properties: { status: "ready" } });
  const changedAfterCompletion = reducer(completed, actions.selectPhylogenyTree(first.id, "new"));
  expect(reducer(changedAfterCompletion, { type: actions.PHYLOGENY_CELL_PLOTS_LOADED, requestId, plots: [loadedGenome("a")] })).toBe(changedAfterCompletion);
});

test("overlapping stable IDs remain selected in the other panel when one panel clears", () => {
  let state = reducer(initial(), actions.selectPhylogenyNodes([{ id: "shared", selected: true }], "tree-a"));
  state = reducer(state, actions.selectPhylogenyNodes([{ id: "shared", selected: false }, { id: "b", selected: true }], "tree-b"));
  expect(state.nodes).toEqual([{ id: "shared", selected: true }, { id: "b", selected: true }]);
  state = reducer(state, actions.selectPhylogenyNodes([], "tree-b"));
  expect(state.nodes).toEqual([{ id: "shared", selected: true }]);
});

test("legacy global selections synchronize each cohort by cell identity before and after scoped selection", () => {
  const a = { id: "tree-a", type: "phylogeny" }, b = { id: "tree-b", type: "phylogeny" };
  let state = { ...initial(), plots: [a, b], phylogenyHeatmaps: {
    [a.id]: { cellIds: ["a1", "a2"] }, [b.id]: { cellIds: ["b1"] },
  } };
  for (const scoped of [false, true]) {
    if (scoped) state = reducer(state, actions.selectPhylogenyNodes([{ id: "a1", selected: true }], a.id));
    const nodes = [{ id: "a1", selected: false }, { id: "a2", selected: true }, { id: "b1", selected: true }, { id: "unlinked", selected: true }];
    state = reducer(state, actions.selectPhylogenyNodes(nodes));
    expect(state.nodes).toBe(nodes);
    expect(state.phylogenyNodes[a.id]).toEqual(nodes.slice(0, 2));
    expect(state.phylogenyNodes[b.id]).toEqual(nodes.slice(2, 3));
    state = reducer(state, actions.selectPhylogenyNodes([], a.id));
    expect(state.nodes.filter(node => node.selected).map(node => node.id).sort()).toEqual(["b1", "unlinked"]);
    expect(state.phylogenyNodes[b.id]).toEqual(nodes.slice(2, 3));
  }
  state = reducer(state, actions.selectPhylogenyNodes([]));
  expect(state.nodes).toEqual([]);
  expect(state.phylogenyNodes).toEqual({ [a.id]: [], [b.id]: [] });
});

test("legacy selection remains usable for standalone trees and the old single-overview state", () => {
  const tree = { id: "tree", type: "phylogeny" };
  const nodes = [{ id: "a", selected: true }, { id: "outside", selected: true }];
  const state = { ...initial(), plots: [tree] };
  expect(reducer(state, actions.selectPhylogenyNodes(nodes)).phylogenyNodes[tree.id]).toBe(nodes);
  const old = { ...state, phylogenyHeatmap: { plotId: tree.id, cellIds: ["a"] } };
  expect(reducer(old, actions.selectPhylogenyNodes(nodes)).phylogenyNodes[tree.id]).toEqual([nodes[0]]);
});

test("legacy cell opening records the resolved panel before its tree changes", () => {
  const tree = { id: "tree", type: "phylogeny", treeOptions: [{ id: "new", data: "(b);" }] };
  const state = reducer({ ...initial(), plots: [tree] }, actions.openPhylogenyCells(["a"], true));
  expect(state.cellTrackLoad.plotId).toBe(tree.id);
  expect(reducer(state, actions.selectPhylogenyTree(tree.id, "new")).cellTrackLoad.status).toBe("cancelled");
});

test("a panel tree switch rejects its late overview without invalidating a peer overview", () => {
  const tree = { id: "tree-a", type: "phylogeny", treeOptions: [{ id: "new", data: "(b);" }] };
  let state = { ...initial(), plots: [tree] };
  state = reducer(state, actions.loadPhylogenyHeatmap("tree-a"));
  state = reducer(state, actions.loadPhylogenyHeatmap("tree-b"));
  const requests = state.phylogenyHeatmapRequests;
  state = reducer(state, actions.selectPhylogenyTree("tree-a", "new"));
  expect(reducer(state, { type: actions.PHYLOGENY_HEATMAP_UPDATED, plotId: "tree-a", requestId: requests["tree-a"], data: { tree: "stale" } })).toBe(state);
  expect(reducer(state, { type: actions.PHYLOGENY_HEATMAP_UPDATED, plotId: "tree-b", requestId: requests["tree-b"], data: { tree: "current" } }).phylogenyHeatmaps["tree-b"]).toEqual({ tree: "current" });
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
