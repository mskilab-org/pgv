import React from "react";
import { render, fireEvent, screen, cleanup, within } from "@testing-library/react";
import { Modal } from "antd";
import { PhylogenyPanel } from "./index";

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
  expect(screen.getByText("Hidden")).toBeTruthy();
  expect(screen.getByText(/92,000 values/)).toBeTruthy();
});

test("two compact groups retain filters, actions and singular/plural counts; Display owns Reset zoom", () => {
  const p = props(); p.plots = [{ type: "genome", id: "g" }];
  const ui = render(<PhylogenyPanel {...p} />);
  expect(screen.getAllByRole("group")).toHaveLength(2);
  const display = within(screen.getByRole("group", { name: "Display controls" }));
  const selection = within(screen.getByRole("group", { name: "Selection and tracks controls" }));
  expect(display.getByRole("button", { name: "Hide tree / labels" })).toBeTruthy();
  expect(display.getByRole("combobox", { name: "Mutation display" })).toBeTruthy();
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

test("gutter hides without losing stored width and legacy tree remains supported", () => {
  const p = props(); const ui = render(<PhylogenyPanel {...p} />);
  fireEvent.click(screen.getByRole("button", { name: /Hide tree/ }));
  expect(p.updatePhylogenyView).toHaveBeenCalledWith({ gutterHidden: true });
  ui.rerender(<PhylogenyPanel {...p} heatmap={null} />);
  expect(screen.getByText("Legacy phylogeny")).toBeTruthy();
});
