import React from "react";
import { Home } from "./home";

// Inspect Home's panel composition without mounting unrelated plot renderers.
jest.mock("../../components/headerPanel", () => "HeaderPanel");
jest.mock("../../components/legendPanel", () => "LegendPanel");
jest.mock("../../components/phylogenyPanel", () => "PhylogenyPanel");
jest.mock("../../components/scatterPlotPanel", () => "ScatterPlotPanel");
jest.mock("../../components/barPlotPanel", () => "BarPlotPanel");
jest.mock("../../components/genesPanel", () => "GenesPanel");
jest.mock("../../components/genomePanel", () => "GenomePanel");
jest.mock("../../components/walkPanel", () => "WalkPanel");
jest.mock("../../components/anatomyPanel", () => "AnatomyPanel");
jest.mock("../../components/bigwigPlotPanel", () => "BigwigPlotPanel");

const tree = (id, visible = true) => ({ id, type: "phylogeny", title: id, data: `(${id});`, visible });
const track = sample => ({ id: sample, sample, type: "genome", data: { intervals: [], connections: [] }, visible: true });
const heatmap = (plotId, cellIds) => ({ plotId, tree: {}, cellIds, status: "ready" });
function elements(node, predicate) {
  return React.Children.toArray(node).flatMap(child => !React.isValidElement(child) ? [] : [
    ...(predicate(child) ? [child] : []), ...elements(child.props.children, predicate),
  ]);
}
function home(extra = {}) {
  return new Home({ plots: [], chromoBins: {}, phylogenyPanelHeight: 640, ...extra }).render();
}
const shownTracks = output => elements(output, child => child.props["data-plot-type"] === "genome")
  .map(child => child.props["data-cell-id"]);

test("a visible later tree renders even when the first cohort tree is hidden", () => {
  const output = home({ plots: [tree("first", false), tree("second")] });
  expect(elements(output, child => child.type === "PhylogenyPanel").map(child => child.props.plotId)).toEqual(["second"]);
  expect(elements(home({ plots: [tree("first", false), tree("second", false)] }), child => child.type === "PhylogenyPanel")).toEqual([]);
});

test.each(["first", "second"])("selected-track filtering belongs only to the enabled %s cohort", enabled => {
  const props = {
    plots: [tree("first"), tree("second"), ...["a", "a2", "b", "b2", "outside"].map(track)],
    phylogenyHeatmaps: { first: heatmap("first", ["a", "a2"]), second: heatmap("second", ["b", "b2"]) },
    phylogenyViews: { first: { selectedTracksOnly: enabled === "first" }, second: { selectedTracksOnly: enabled === "second" } },
    phylogenyNodes: { first: [{ id: "a", selected: true }], second: [{ id: "b", selected: true }] },
  };
  expect(shownTracks(home(props))).toEqual(enabled === "first" ? ["a", "b", "b2", "outside"] : ["a", "a2", "b", "outside"]);
  props.phylogenyViews = { first: { selectedTracksOnly: true }, second: { selectedTracksOnly: true } };
  expect(shownTracks(home(props))).toEqual(["a", "b", "outside"]);
});

test("a shared cell remains visible when either owning cohort still selects it", () => {
  expect(shownTracks(home({
    plots: [tree("first"), tree("second"), track("shared")],
    phylogenyHeatmaps: { first: heatmap("first", ["shared"]), second: heatmap("second", ["shared"]) },
    phylogenyViews: { first: { selectedTracksOnly: true }, second: { selectedTracksOnly: true } },
    phylogenyNodes: { first: [{ id: "shared", selected: false }], second: [{ id: "shared", selected: true }] },
  }))).toEqual(["shared"]);
});

test("an untouched cohort never borrows global selection from the last overview publisher", () => {
  const output = home({ plots: [tree("first"), tree("second")], nodes: [{ id: "shared", selected: true }],
    phylogenyNodes: { first: [{ id: "shared", selected: true }] }, phylogenyHeatmap: heatmap("second", ["shared"]),
    phylogenyHeatmaps: { first: heatmap("first", ["shared"]), second: heatmap("second", ["shared"]) } });
  const panels = elements(output, child => child.type === "PhylogenyPanel");
  expect(panels[0].props.nodes).toEqual([{ id: "shared", selected: true }]);
  expect(panels[1].props.nodes).toEqual([]);
});

test("removing a selected/filtered cohort does not transfer its global state to the remaining untouched panel", () => {
  const output = home({ plots: [tree("first"), { ...tree("second"), deleted: true, visible: false }],
    nodes: [{ id: "b", selected: true }], phylogenyNodes: { second: [{ id: "b", selected: true }] },
    phylogenyViews: { second: { selectedRowsOnly: true } }, phylogenyView: { selectedRowsOnly: true },
    phylogenyHeatmap: heatmap("second", ["b"]), phylogenyHeatmaps: { first: heatmap("first", ["a"]) } });
  const [panel] = elements(output, child => child.type === "PhylogenyPanel");
  expect(panel.props.nodes).toEqual([]);
  expect(panel.props.view.selectedRowsOnly).toBe(false);
});

test("Home binds selection, view and confirmed opening callbacks to each panel ID", () => {
  const selectPhylogenyNodes = jest.fn(), updatePhylogenyView = jest.fn(), openPhylogenyCells = jest.fn();
  const output = home({ plots: [tree("first"), tree("second")], selectPhylogenyNodes, updatePhylogenyView, openPhylogenyCells });
  const panels = elements(output, child => child.type === "PhylogenyPanel");
  panels.forEach(panel => {
    panel.props.selectPhylogenyNodes([{ id: "cell", selected: true }]);
    panel.props.onUpdatePhylogenyView({ selectedTracksOnly: true });
    panel.props.onOpenPhylogenyCells(["cell"], true);
    expect(selectPhylogenyNodes).toHaveBeenLastCalledWith([{ id: "cell", selected: true }], panel.props.plotId);
    expect(updatePhylogenyView).toHaveBeenLastCalledWith({ selectedTracksOnly: true }, panel.props.plotId);
    expect(openPhylogenyCells).toHaveBeenLastCalledWith(["cell"], true, panel.props.plotId);
  });
});
