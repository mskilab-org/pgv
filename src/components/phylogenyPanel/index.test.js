import React from "react";
import { render, fireEvent, screen, cleanup, within, act } from "@testing-library/react";
import { Modal } from "antd";
import { PhylogenyPanel, mapDispatchToProps } from "./index";

jest.mock("../../helpers/utility", () => ({ downloadCanvasAsPng: jest.fn() }));
jest.mock("react-container-dimensions", () => ({ children }) => children({ width: 1000, height: 320 }));
jest.mock("./heatmap", () => props => <button onClick={() => props.onSelectNodes([{ id: "a", selected: true }])}>Select a row</button>);
jest.mock("./phyloTree", () => () => <div>Legacy phylogeny</div>);

const data = { status: "ready", plotId: "tree", cellIds: ["a", "b"], cnByCell: {}, tree: {}, mutations: { variants: new Array(736), values: new Float64Array(92000) }, errors: [] };
const props = () => ({ phylogeny: "(a,b);", plotId: "tree", height: 320, title: "Tree", t: key => key,
  nodes: [{ id: "a", selected: true }, { id: "b", selected: false }], highlightedNodes: [],
  heatmap: data, datasetEpoch: 1, view: { gutterWidth: 240, gutterHidden: false, mutationMode: "hidden" },
  cellTrackLoad: { status: "idle", total: 0, completed: 0, errors: [] },
  selectPhylogenyNodes: jest.fn(), openPhylogenyCells: jest.fn(), updatePhylogenyView: jest.fn(), clearPhylogenyTracks: jest.fn(),
  updatePhylogenyPin: jest.fn(), updatePhylogenyPanelHeight: jest.fn(), cancelPhylogenyCellLoad: jest.fn(), loadPhylogenyHeatmap: jest.fn(),
  updateDomains: jest.fn(), genomeLength: 1000,
});
let confirm;
beforeEach(() => { confirm = jest.spyOn(Modal, "confirm").mockImplementation(() => ({ destroy: jest.fn() })); });
afterEach(() => { cleanup(); jest.restoreAllMocks(); });

test("one cell always requires confirmation; selection alone never opens tracks", () => {
  const p = props(); render(<PhylogenyPanel {...p} />);
  fireEvent.click(screen.getByText("Select a row"));
  expect(p.selectPhylogenyNodes).toHaveBeenCalledTimes(1);
  expect(p.openPhylogenyCells).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /Open selected/ }));
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(p.openPhylogenyCells).not.toHaveBeenCalled();
  expect(confirm.mock.calls[0][0].autoFocusButton).toBe("cancel");
  confirm.mock.calls[0][0].onOk();
  expect(p.openPhylogenyCells).toHaveBeenCalledWith(["a"], true);
});

test("bulk confirmation uses selection snapshot; cancelling does not open", () => {
  const p = props(); p.nodes = [{ id: "a", selected: true }, { id: "b", selected: true }];
  render(<PhylogenyPanel {...p} />);
  fireEvent.click(screen.getByRole("button", { name: /Open selected/ }));
  confirm.mock.calls[0][0].onCancel();
  // A late callback from a cancelled/destroyed dialog cannot authorize loading.
  confirm.mock.calls[0][0].onOk();
  expect(p.openPhylogenyCells).not.toHaveBeenCalled();
});

test("dataset change invalidates an outstanding confirmation", () => {
  const p = props(); const ui = render(<PhylogenyPanel {...p} />);
  fireEvent.click(screen.getByRole("button", { name: /Open selected/ }));
  const onOk = confirm.mock.calls[0][0].onOk;
  ui.rerender(<PhylogenyPanel {...p} datasetEpoch={2} />);
  onOk();
  expect(p.openPhylogenyCells).not.toHaveBeenCalled();
});

test("confirmed opening keeps the captured cell identities when selection changes", () => {
  const p = props(); p.nodes = data.cellIds.map(id => ({ id, selected: true }));
  const ui = render(<PhylogenyPanel {...p} />);
  fireEvent.click(screen.getByRole("button", { name: /Open selected/ }));
  ui.rerender(<PhylogenyPanel {...p} nodes={[]} />);
  confirm.mock.calls[0][0].onOk();
  expect(p.openPhylogenyCells).toHaveBeenCalledWith(["a", "b"], true);
});

test.each(["plot change", "unmount"])("%s invalidates an outstanding confirmation", change => {
  const p = props(); const ui = render(<PhylogenyPanel {...p} />);
  fireEvent.click(screen.getByRole("button", { name: /Open selected/ }));
  if (change === "unmount") ui.unmount();
  else ui.rerender(<PhylogenyPanel {...p} plotId="other-tree" />);
  expect(confirm.mock.results[0].value.destroy).toHaveBeenCalledTimes(1);
  confirm.mock.calls[0][0].onOk();
  expect(p.openPhylogenyCells).not.toHaveBeenCalled();
});

test("initial mutation mode is Hidden and full matrix count is visible", () => {
  render(<PhylogenyPanel {...props()} />);
  expect(screen.getByRole("button", { name: "Show mutations" }).getAttribute("aria-pressed")).toBe("false");
  expect(screen.queryByRole("combobox", { name: "Mutation display" })).toBeNull();
  expect(screen.getByText(/92,000 values/)).toBeTruthy();
});

test("two compact groups retain filters, actions and singular/plural counts; Display owns Reset zoom", () => {
  const p = props(); p.plots = [{ type: "genome", id: "g" }];
  const ui = render(<PhylogenyPanel {...p} />);
  const displayGroup = screen.getByRole("group", { name: "Display controls" });
  const selectionGroup = screen.getByRole("group", { name: "Selection and tracks controls" });
  expect(Array.from(displayGroup.parentElement.children)).toEqual([displayGroup, selectionGroup]);
  const display = within(displayGroup);
  const selection = within(selectionGroup);
  expect(display.getByRole("button", { name: "Hide tree / labels" })).toBeTruthy();
  expect(display.getByRole("button", { name: "Show mutations" })).toBeTruthy();
  expect(display.getByRole("spinbutton", { name: "Heatmap height" })).toBeTruthy();
  fireEvent.click(display.getByRole("button", { name: "Reset zoom" }));
  expect(p.updateDomains).toHaveBeenCalledWith([[1, 1000]]);
  expect(screen.getAllByRole("button", { name: "Reset zoom" })).toHaveLength(1);
  expect(selection.queryByRole("button", { name: "Reset zoom" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Whole genome" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Clear loaded tracks" })).toBeNull();
  expect(selection.getByText("1 cell selected · 1 panel")).toBeTruthy();
  expect(selection.getByRole("button", { name: "Open selected (1)…" }).disabled).toBe(false);
  expect(selection.getByRole("button", { name: "Clear selection" })).toBeTruthy();
  fireEvent.click(selection.getByRole("checkbox", { name: "Selected rows only" }));
  fireEvent.click(selection.getByRole("checkbox", { name: "Hide unselected tracks" }));
  expect(p.updatePhylogenyView.mock.calls).toEqual([[{ selectedRowsOnly: true }], [{ selectedTracksOnly: true }]]);
  ui.rerender(<PhylogenyPanel {...p} nodes={data.cellIds.map(id => ({ id, selected: true }))}
    plots={[...p.plots, { type: "scatterplot", id: "c", visible: false }]} />);
  expect(selection.getByText("2 cells selected · 2 panels")).toBeTruthy();
  ui.rerender(<PhylogenyPanel {...p} heatmap={{ ...data, cellIds: ["a"] }} />);
  expect(screen.getByText("1 cell")).toBeTruthy();
});

test("Display keeps a single tree selector with its labels toggle and four aligned control rows", () => {
  const p = { ...props(), activeTreeId: "real", treeOptions: [{ id: "real", title: "Real tree" }, { id: "demo", title: "Demo tree" }] };
  render(<PhylogenyPanel {...p} />);
  const display = within(screen.getByRole("group", { name: "Display controls" }));
  expect(display.getAllByRole("group").map(group => group.getAttribute("aria-label"))).toEqual(["Tree", "Copy number", "Right heatmap", "Layout"]);
  const tree = within(display.getByRole("group", { name: "Tree" }));
  expect(tree.getByRole("combobox", { name: "Phylogeny tree" })).toBeTruthy();
  expect(tree.getByRole("button", { name: "Hide tree / labels" })).toBeTruthy();
  expect(screen.getAllByRole("combobox", { name: "Phylogeny tree" })).toHaveLength(1);
  expect(within(display.getByRole("group", { name: "Copy number" })).getByRole("combobox", { name: "Copy-number view" })).toBeTruthy();
  const right = within(display.getByRole("group", { name: "Right heatmap" }));
  expect(right.getByRole("button", { name: "Show mutations" })).toBeTruthy();
  expect(right.queryByRole("combobox")).toBeNull();
  const layout = within(display.getByRole("group", { name: "Layout" }));
  expect(layout.getByRole("button", { name: "Fit rows" })).toBeTruthy();
  expect(layout.getByRole("spinbutton", { name: "Heatmap height" })).toBeTruthy();
  expect(layout.getByRole("button", { name: "Reset zoom" })).toBeTruthy();
  const selection = within(screen.getByRole("group", { name: "Selection and tracks controls" }));
  expect(selection.queryByRole("combobox")).toBeNull();
  expect(selection.getAllByRole("button").map(button => button.textContent)).toEqual(["Open selected (1)…", "Clear selection"]);
  expect(selection.getAllByRole("checkbox")).toHaveLength(2);
});

test("Right heatmap groups only the visible dataset and coloring controls without changing other display state", async () => {
  const p = props();
  const view = { ...p.view, mutationMode: "side", cnMode: "minor", mutationMetric: "alt", fitRows: true };
  const ui = render(<PhylogenyPanel {...p} view={view} />);
  const right = within(screen.getByRole("group", { name: "Right heatmap" }));
  expect(right.getByRole("button", { name: "Hide mutations" })).toBeTruthy();
  expect(right.getByRole("combobox", { name: "Right heatmap data" })).toBeTruthy();
  expect(right.getByRole("combobox", { name: "Mutation color" })).toBeTruthy();
  expect(right.getByText("Alt count")).toBeTruthy();
  expect(within(screen.getByRole("group", { name: "Copy number" })).getByText("Minor")).toBeTruthy();
  await act(async () => { fireEvent.mouseDown(right.getByRole("combobox", { name: "Mutation color" })); });
  await act(async () => { fireEvent.click(screen.getByText("Ref count")); });
  expect(p.updatePhylogenyView).toHaveBeenLastCalledWith({ mutationMetric: "ref" });
  await act(async () => { fireEvent.mouseDown(right.getByRole("combobox", { name: "Right heatmap data" })); });
  await act(async () => { fireEvent.click(screen.getByText("Junction CN")); });
  expect(p.updatePhylogenyView).toHaveBeenLastCalledWith({ matrixKind: "junctions" });
  fireEvent.click(screen.getByRole("button", { name: "Readable rows" }));
  expect(p.updatePhylogenyView).toHaveBeenLastCalledWith({ fitRows: false });
  ui.rerender(<PhylogenyPanel {...p} view={{ ...view, matrixKind: "junctions" }} />);
  expect(right.getByRole("button", { name: "Hide junctions" })).toBeTruthy();
  expect(right.getByRole("combobox", { name: "Right heatmap data" })).toBeTruthy();
  expect(right.queryByRole("combobox", { name: "Mutation color" })).toBeNull();
  fireEvent.click(right.getByRole("button", { name: "Hide junctions" }));
  expect(p.updatePhylogenyView).toHaveBeenLastCalledWith({ mutationMode: "hidden" });
  ui.rerender(<PhylogenyPanel {...p} view={{ ...view, mutationMode: "hidden", matrixKind: "junctions" }} />);
  expect(right.getByRole("button", { name: "Show junctions" })).toBeTruthy();
  expect(right.queryByRole("combobox")).toBeNull();
});

test("clearSelection changes only selection and leaves tracks and confirmation independent", () => {
  const p = props(); const ref = React.createRef();
  render(<PhylogenyPanel {...p} ref={ref} />);
  fireEvent.click(screen.getByRole("button", { name: /Open selected/ }));
  ref.current.clearSelection();
  expect(p.selectPhylogenyNodes).toHaveBeenCalledWith([{ id: "a", selected: false }, { id: "b", selected: false }]);
  expect(p.clearPhylogenyTracks).not.toHaveBeenCalled();
  expect(p.cancelPhylogenyCellLoad).not.toHaveBeenCalled();
  expect(confirm.mock.results[0].value.destroy).not.toHaveBeenCalled();
  confirm.mock.calls[0][0].onOk();
  expect(p.openPhylogenyCells).toHaveBeenCalledWith(["a"], true);
});

test.each([null, { plotId: "other-tree", cellIds: ["unrelated"] }])("clearSelection without a matching heatmap uses only current nodes (%j)", heatmap => {
  const p = props(); const ref = React.createRef();
  const ui = render(<PhylogenyPanel {...p} heatmap={heatmap} ref={ref} />);
  ref.current.clearSelection();
  expect(p.selectPhylogenyNodes).toHaveBeenLastCalledWith([{ id: "a", selected: false }, { id: "b", selected: false }]);
  ui.rerender(<PhylogenyPanel {...p} heatmap={heatmap} nodes={[]} ref={ref} />);
  ref.current.clearSelection();
  expect(p.selectPhylogenyNodes).toHaveBeenLastCalledWith([]);
  expect(p.clearPhylogenyTracks).not.toHaveBeenCalled();
});

test("clearTracks changes only tracks and invalidates an outstanding confirmation", () => {
  const p = props(); const ref = React.createRef();
  render(<PhylogenyPanel {...p} ref={ref} />);
  fireEvent.click(screen.getByRole("button", { name: /Open selected/ }));
  ref.current.clearTracks();
  expect(p.clearPhylogenyTracks).toHaveBeenCalledTimes(1);
  expect(p.selectPhylogenyNodes).not.toHaveBeenCalled();
  expect(confirm.mock.results[0].value.destroy).toHaveBeenCalledTimes(1);
  expect(ref.current.pendingOpen).toBeNull();
  expect(ref.current.openDialog).toBeNull();
  confirm.mock.calls[0][0].onOk();
  expect(p.openPhylogenyCells).not.toHaveBeenCalled();
});

test("the visible Clear selection handler explicitly composes both operations and cancels confirmation", () => {
  const p = props(); const ref = React.createRef();
  p.plots = [{ type: "genome", id: "g" }, { type: "scatterplot", id: "c", visible: false }];
  render(<PhylogenyPanel {...p} ref={ref} />);
  const clearSelection = jest.spyOn(ref.current, "clearSelection");
  const clearTracks = jest.spyOn(ref.current, "clearTracks");
  fireEvent.click(screen.getByRole("button", { name: /Open selected/ }));
  fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
  expect(clearSelection).toHaveBeenCalledTimes(1);
  expect(clearTracks).toHaveBeenCalledTimes(1);
  expect(p.selectPhylogenyNodes).toHaveBeenCalledWith([{ id: "a", selected: false }, { id: "b", selected: false }]);
  expect(p.clearPhylogenyTracks).toHaveBeenCalledTimes(1);
  expect(p.updateDomains).not.toHaveBeenCalled();
  expect(confirm.mock.results[0].value.destroy).toHaveBeenCalledTimes(1);
  confirm.mock.calls[0][0].onOk();
  expect(p.openPhylogenyCells).not.toHaveBeenCalled();
});

test('default height is640 and the shared bottom grip uses the same controlled height callback', () => {
  const p = props(); delete p.height;
  render(<PhylogenyPanel {...p} />);
  expect(screen.getByRole('spinbutton', { name: 'Heatmap height' }).value).toBe('640');
  fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize phylogeny panel height' }), { key: 'ArrowDown' });
  expect(p.updatePhylogenyPanelHeight).toHaveBeenCalledWith(656);
});

const clearButtonStates = [
  { selected: false, tracks: false, pending: false, disabled: true },
  { selected: true, tracks: false, pending: false, disabled: false },
  { selected: false, tracks: true, pending: false, disabled: false },
  { selected: false, tracks: false, pending: true, disabled: false },
  { selected: true, tracks: true, pending: false, disabled: false },
  { selected: true, tracks: false, pending: true, disabled: false },
  { selected: false, tracks: true, pending: true, disabled: false },
  { selected: true, tracks: true, pending: true, disabled: false },
].flatMap(state => [{ ...state, loading: false }, { ...state, loading: true, disabled: true }]);

test.each(clearButtonStates)("clear button state %j", state => {
  const p = { ...PhylogenyPanel.defaultProps, ...props(), loading: state.loading,
    nodes: data.cellIds.map(id => ({ id, selected: state.selected })),
    plots: state.tracks ? [{ type: "scatterplot", id: "hidden", visible: false }] : [],
    cellTrackLoad: { status: state.pending ? "loading" : "idle", total: 125, completed: 0, errors: [] },
  };
  // Isolate the toolbar so we can inspect disabled controls even when Card shows its loading skeleton.
  const card = new PhylogenyPanel(p).render().props.children;
  render(React.Children.toArray(card.props.children).find(child => child.props.className === "phylogeny-toolbar"));
  const clear = screen.getByRole("button", { name: "Clear selection" });
  expect(clear.disabled).toBe(state.disabled);
  fireEvent.click(clear);
  expect(p.selectPhylogenyNodes).toHaveBeenCalledTimes(state.disabled ? 0 : 1);
  expect(p.clearPhylogenyTracks).toHaveBeenCalledTimes(state.disabled ? 0 : 1);
  expect(screen.getByRole("button", { name: /Open selected/ }).disabled).toBe(!state.selected || state.pending);
});

test("deleted details and overview panels do not keep the clear button enabled", () => {
  const p = props();
  render(<PhylogenyPanel {...p} nodes={[]} plots={[
    { type: "genome", id: "deleted", deleted: true }, { type: "genes", id: "genes" },
    { type: "phylogeny", id: "tree" }, { type: "anatomy", id: "anatomy" },
  ]} />);
  expect(screen.getByRole("button", { name: "Clear selection" }).disabled).toBe(true);
  expect(screen.getByText("0 cells selected · 0 panels")).toBeTruthy();
});

test("connected dispatchers preserve panel identity rather than overwriting Home's scoped selection", () => {
  const dispatch = jest.fn();
  const bound = mapDispatchToProps(dispatch, { plotId: "second-cohort" });
  bound.selectPhylogenyNodes([{ id: "b", selected: true }]);
  bound.openPhylogenyCells(["b"], true);
  bound.updatePhylogenyView({ cnMode: "major" });
  expect(dispatch.mock.calls.every(([action]) => action.plotId === "second-cohort")).toBe(true);
});

test.each([null, { ...data, tree: null, cellIds: [], status: "error", errors: ["bad tree"] }])("tree selector survives fallback and errors (%j)", heatmap => {
  const p = { ...props(), heatmap, activeTreeId: "demo", treeOptions: [{ id: "real", title: "Real tree" }, { id: "demo", title: "Demo tree" }], selectPhylogenyTree: jest.fn() };
  const ref = React.createRef();
  const ui = render(<PhylogenyPanel {...p} ref={ref} />);
  expect(screen.getByRole("combobox", { name: "Phylogeny tree" })).toBeTruthy();
  ref.current.onTreeChange("real");
  expect(p.selectPhylogenyTree).toHaveBeenCalledWith("tree", "real");
  expect(p.loadPhylogenyHeatmap).toHaveBeenCalledWith("tree");
  ui.rerender(<PhylogenyPanel {...p} phylogeny={null} />);
  expect(screen.getByRole("combobox", { name: "Phylogeny tree" })).toBeTruthy();
});

test("mutation button toggles only hidden/side and dataset switch leaves CN unchanged", () => {
  const p = props(); const ui = render(<PhylogenyPanel {...p} />);
  fireEvent.click(screen.getByRole("button", { name: "Show mutations" }));
  expect(p.updatePhylogenyView).toHaveBeenLastCalledWith({ mutationMode: "side" });
  ui.rerender(<PhylogenyPanel {...p} view={{ ...p.view, mutationMode: "side", matrixKind: "junctions" }} />);
  expect(screen.getByRole("combobox", { name: "Right heatmap data" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Hide junctions" }));
  expect(p.updatePhylogenyView).toHaveBeenLastCalledWith({ mutationMode: "hidden" });
  expect(screen.queryByText("Overlay")).toBeNull();
  expect(screen.queryByText("Paired")).toBeNull();
});

test("tree switch invalidates the prior tree's outstanding confirmation", () => {
  const p = props(); const ui = render(<PhylogenyPanel {...p} activeTreeId="one" />);
  fireEvent.click(screen.getByRole("button", { name: /Open selected/ }));
  const onOk = confirm.mock.calls[0][0].onOk;
  ui.rerender(<PhylogenyPanel {...p} activeTreeId="two" />);
  onOk();
  expect(p.openPhylogenyCells).not.toHaveBeenCalled();
});

test("gutter hides without losing stored width and legacy tree remains supported", () => {
  const p = props(); const ui = render(<PhylogenyPanel {...p} />);
  fireEvent.click(screen.getByRole("button", { name: /Hide tree/ }));
  expect(p.updatePhylogenyView).toHaveBeenCalledWith({ gutterHidden: true });
  ui.rerender(<PhylogenyPanel {...p} heatmap={null} />);
  expect(screen.getByText("Legacy phylogeny")).toBeTruthy();
});
