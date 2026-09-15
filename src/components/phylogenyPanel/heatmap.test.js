import React from "react";
import { render, fireEvent, act, cleanup } from "@testing-library/react";
import PhylogenyHeatmap from "./heatmap";
import { parseNewick } from "../../helpers/phylogeny/data";

let ctx;
beforeEach(() => {
  jest.useFakeTimers();
  ctx = {};
  ["save", "restore", "clip", "clearRect", "setTransform", "moveTo", "lineTo", "stroke", "fillText", "strokeRect", "setLineDash", "beginPath", "rect", "fill", "fillRect", "arc"].forEach(k => { ctx[k] = jest.fn(); });
  jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx);
  jest.spyOn(window, "requestAnimationFrame").mockImplementation(cb => setTimeout(cb, 0));
  jest.spyOn(window, "cancelAnimationFrame").mockImplementation(id => clearTimeout(id));
});
afterEach(() => { cleanup(); jest.restoreAllMocks(); jest.useRealTimers(); });
const flush = () => act(() => { jest.runOnlyPendingTimers(); });
function props(extra = {}) {
  const cellIds = ["<img onerror=alert(1)>", "b"];
  return {
    width: 600, height: 300, gutterWidth: 180, genomeLength: 100,
    domains: [[0, 100]], chromoBins: {}, nodes: [], highlightedNodes: [],
    data: { status: "ready", tree: parseNewick(`('${cellIds[0]}',b);`), cellIds, cnByCell: {}, mutations: {
      cellIds, variants: [{ id: "v1", chromosome: "1", place: 20, position: 20, ref: "A", alt: "T" }], values: new Float64Array([0, NaN]), missing: new Uint8Array([0, 1]),
    } },
    onSelectNodes: jest.fn(), onDomainsChange: jest.fn(), onHoverLocation: jest.fn(), onGutterWidthChange: jest.fn(), ...extra,
  };
}

test("controlled child defaults mutations Hidden, exposes complete counts and keyboard cell selection without HTML", () => {
  const p = props();
  const ui = render(<PhylogenyHeatmap {...p} />);
  flush();
  const canvas = ui.container.querySelector("canvas[data-matrix-entries]");
  expect(canvas.getAttribute("data-matrix-entries")).toBe("2");
  expect(canvas.getAttribute("data-cell-count")).toBe("2");
  expect(canvas.getAttribute("data-site-count")).toBe("1");
  expect(canvas.getAttribute("data-frame-drawn")).toBe("0");
  const cell = ui.getByRole("button", { name: /Select cell <img/ });
  fireEvent.keyDown(cell, { key: "Enter" });
  expect(p.onSelectNodes).toHaveBeenCalledWith([{ id: p.data.cellIds[0], selected: true }, { id: "b", selected: false }]);
  expect(ui.container.querySelector("img")).toBeNull();
  expect(p.onDomainsChange).not.toHaveBeenCalled();
});

test("external mode switch, zero-width gutter, selected rows context, resize callback and benchmark cleanup", () => {
  const p = props({ mutationMode: "paired" });
  const ui = render(<PhylogenyHeatmap {...p} />);
  flush();
  const canvas = ui.container.querySelector("canvas[data-matrix-entries]");
  expect(canvas.getAttribute("data-frame-drawn")).toBe("2");
  expect(typeof canvas.benchmarkFullMatrix).toBe("function");
  const separator = ui.getByRole("separator", { name: /Resize tree gutter/ });
  fireEvent.keyDown(separator, { key: "ArrowRight" });
  expect(p.onGutterWidthChange).toHaveBeenCalledWith(196);
  ui.rerender(<PhylogenyHeatmap {...p} gutterWidth={0} selectedRowsOnly nodes={[{ id: "b", selected: true }]} />);
  flush();
  expect(ui.queryByRole("separator")).toBeNull();
  expect(ui.getByText(/1 hidden cell/)).toBeTruthy();
  expect(canvas.getAttribute("data-cell-count")).toBe("2");
  expect(canvas.benchmarkFullMatrix(1)).toMatchObject({ visited: 2, drawn: 2 });
  ui.unmount();
  expect(canvas.benchmarkFullMatrix).toBeUndefined();
});

test("wheel honors command modifier and edits only the pointed genomic domain; hover callback uses genomic coordinates", () => {
  const p = props({ domains: [[0, 40], [60, 100]], zoomedByCmd: true });
  const ui = render(<PhylogenyHeatmap {...p} />);
  flush();
  const canvas = ui.container.querySelector("canvas[data-matrix-entries]");
  fireEvent.wheel(canvas, { clientX: 250, clientY: 10, deltaY: -100 });
  expect(p.onDomainsChange).not.toHaveBeenCalled();
  fireEvent.wheel(canvas, { clientX: 250, clientY: 10, deltaY: -100, metaKey: true });
  expect(p.onDomainsChange).toHaveBeenCalledTimes(1);
  expect(p.onDomainsChange.mock.calls[0][0][1]).toEqual([60, 100]);
  fireEvent.mouseMove(canvas, { clientX: 250, clientY: 10 });
  flush();
  expect(p.onHoverLocation).toHaveBeenCalledWith(expect.any(Number), 0);
});

test('legend exposes twelve CN categories and a continuous VAF scale with distinct missingness', () => {
  const ui = render(<PhylogenyHeatmap {...props({ mutationMode: 'overlay' })} />); flush();
  const cn = ui.getByLabelText('Copy number legend');
  expect(Array.from(cn.querySelectorAll('.heatmap-swatch')).map(swatch => swatch.parentElement.textContent.trim()))
    .toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11+', 'missing']);
  expect(ui.getByRole('img', { name: /VAF: continuous grayscale/ })).toBeTruthy();
  expect(ui.container.querySelector('.heatmap-vaf-ticks').textContent).toBe('00.250.50.751');
  expect(ui.getByText('× missing')).toBeTruthy();
  expect(ui.queryByText(/overlap count/)).toBeNull();
});

test('hover outlines the pointed row in the gutter and heatmap without selecting, then clears on leave', () => {
  const p = props(); const ref = React.createRef();
  const ui = render(<PhylogenyHeatmap ref={ref} {...p} />); flush();
  const canvas = ui.container.querySelector('canvas[data-matrix-entries]');
  ctx.strokeRect.mockImplementation(() => expect(ctx.strokeStyle).toBe('#1677ff'));
  for (const x of [150, 250]) {
    ctx.strokeRect.mockClear();
    fireEvent.mouseMove(canvas, { clientX: x, clientY: 11 }); flush();
    expect(ref.current.hover.rowId).toBe('b');
    expect(ctx.strokeRect).toHaveBeenCalledWith(0.5, 0.5, 599, 21);
  }
  expect(p.onSelectNodes).not.toHaveBeenCalled();
  fireEvent.mouseLeave(canvas); flush();
  expect(ref.current.hover).toBeNull();
});

test("accessible row buttons stay O(cells), not O(matrix entries)", () => {
  const p = props();
  const cellIds = Array.from({ length: 125 }, (_, i) => `c${i}`);
  p.data = { ...p.data, cellIds, tree: parseNewick(`(${cellIds.join(",")});`), mutations: {
    cellIds, variants: Array.from({ length: 736 }, (_, i) => ({ id: `v${i}`, chromosome: "1", position: i, place: i, ref: "A", alt: "C" })), values: new Float64Array(92000), missing: new Uint8Array(92000),
  } };
  const ui = render(<PhylogenyHeatmap {...p} />);
  flush();
  expect(ui.getAllByRole("button", { name: /Select cell/ })).toHaveLength(125);
  expect(ui.container.querySelectorAll("svg")).toHaveLength(0);
  expect(ui.container.querySelector("canvas[data-matrix-entries]").dataset.matrixEntries).toBe("92000");
});

test("all external mutation modes redraw the retained matrix; absent data is safe", () => {
  const p = props();
  const ui = render(<PhylogenyHeatmap {...p} />);
  const canvas = ui.container.querySelector("canvas[data-matrix-entries]");
  for (const mode of ["hidden", "overlay", "paired", "hidden"]) {
    ui.rerender(<PhylogenyHeatmap {...p} mutationMode={mode} />);
    flush();
    expect(canvas.dataset.frameDrawn).toBe(mode === "hidden" ? "0" : "2");
    expect(canvas.dataset.matrixEntries).toBe("2");
    expect(p.onSelectNodes).not.toHaveBeenCalled();
    expect(p.onDomainsChange).not.toHaveBeenCalled();
  }
  ui.rerender(<PhylogenyHeatmap {...p} data={null} />);
  flush();
  expect(ui.getByText("No cells available")).toBeTruthy();
  expect(canvas.dataset.matrixEntries).toBe("0");
});

// jsdom's legacy PointerEvent constructor lacks coordinates; native MouseEvent
// carries the same fields our pointer boundary consumes (and real DOM bubbling).
const pointer = (target, type, init) => fireEvent(target, new MouseEvent(type, { bubbles: true, cancelable: true, ...init }));

test("leaf/trunk hit tests only select; cluster click zooms instead, with scoped escaped tooltip", () => {
  const ref = React.createRef();
  const p = props({ mutationMode: "paired" });
  const ui = render(<PhylogenyHeatmap ref={ref} {...p} />);
  flush();
  const canvas = ui.container.querySelector("canvas[data-matrix-entries]");
  const root = ref.current.scene.tree[0];
  pointer(canvas, "pointerdown", { clientX: root.x, clientY: root.y });
  pointer(window, "pointerup", { clientX: root.x, clientY: root.y });
  expect(p.onSelectNodes).toHaveBeenCalledWith(p.data.cellIds.map(id => ({ id, selected: true })));
  expect(p.onDomainsChange).not.toHaveBeenCalled();
  const domainWindow = ref.current.scene.windows[0];
  const x = domainWindow.x + domainWindow.scale(20);
  const zeroRow = ref.current.scene.rowById.get(p.data.cellIds[0]);
  fireEvent.mouseMove(canvas, { clientX: x, clientY: zeroRow.y + ref.current.scene.rowHeight / 4 });
  expect(ui.getByRole("tooltip").textContent).toContain("VAF: 0");
  expect(ui.getByRole("tooltip").textContent).toContain("<img onerror=alert(1)>");
  expect(ui.container.querySelector("img")).toBeNull();
  fireEvent.mouseLeave(canvas);
  expect(ui.queryByRole("tooltip")).toBeNull();

  const next = { ...p.data, mutations: { ...p.data.mutations, variants: [p.data.mutations.variants[0], { ...p.data.mutations.variants[0], id: "v2", place: 20.01 }],
    values: new Float64Array([0, 0.125, NaN, 1]), missing: new Uint8Array([0, 0, 1, 0]) } };
  ui.rerender(<PhylogenyHeatmap ref={ref} {...p} data={next} />);
  flush();
  p.onSelectNodes.mockClear();
  pointer(canvas, "pointerdown", { clientX: x, clientY: 24 });
  pointer(window, "pointerup", { clientX: x, clientY: 24 });
  expect(p.onSelectNodes).not.toHaveBeenCalled();
  expect(p.onDomainsChange).toHaveBeenCalledWith([[19, 21.01]]);
});

test("plain drag and Shift brush clamp to their original window without Command; double-click resets",  () => {
  const p = props({ domains: [[0, 40], [60, 100]], zoomedByCmd: true });
  const ui = render(<PhylogenyHeatmap {...p} />);
  flush();
  const canvas = ui.container.querySelector("canvas[data-matrix-entries]");
  pointer(canvas, "pointerdown", { clientX: 240, clientY: 12, shiftKey: true });
  pointer(window, "pointermove", { clientX: 300, clientY: 12, shiftKey: true });
  pointer(window, "pointerup", { clientX: 300, clientY: 12, shiftKey: true });
  expect(p.onDomainsChange).toHaveBeenCalledTimes(1);
  expect(p.onSelectNodes).not.toHaveBeenCalled();
  p.onDomainsChange.mockClear();

  pointer(canvas, "pointerdown", { clientX: 240, clientY: 12, shiftKey: true, metaKey: true });
  pointer(window, "pointermove", { clientX: 550, clientY: 12, shiftKey: true, metaKey: true });
  flush();
  pointer(window, "pointerup", { clientX: 550, clientY: 12, shiftKey: true, metaKey: true });
  const brushed = p.onDomainsChange.mock.calls[0][0];
  expect(brushed[0][0]).toBeGreaterThan(0);
  expect(brushed[0][1]).toBe(40);
  expect(brushed[1]).toEqual([60, 100]);
  expect(p.onSelectNodes).not.toHaveBeenCalled();

  p.onDomainsChange.mockClear();
  pointer(canvas, "pointerdown", { clientX: 300, clientY: 12 });
  pointer(window, "pointermove", { clientX: 250, clientY: 12 });
  pointer(window, "pointerup", { clientX: 250, clientY: 12 });
  expect(p.onDomainsChange.mock.calls[0][0][0][0]).toBeGreaterThan(0);
  expect(p.onDomainsChange.mock.calls[0][0][1]).toEqual([60, 100]);
  p.onDomainsChange.mockClear();
  fireEvent.doubleClick(canvas, { clientX: 250, clientY: 12 });
  expect(p.onDomainsChange).toHaveBeenCalledWith([[1, 60], [60, 100]]);
  fireEvent.doubleClick(canvas, { clientX: 250, clientY: 12, metaKey: true });
  expect(p.onDomainsChange).toHaveBeenCalledWith([[1, 60], [60, 100]]);
});

test('macOS Control-click may report secondary button; plain secondary and middle clicks never select', () => {
  const p = props();
  const ui = render(<PhylogenyHeatmap {...p} />); flush();
  const canvas = ui.container.querySelector('canvas[data-matrix-entries]');
  for (const button of [1, 2]) {
    pointer(canvas, 'pointerdown', { button, clientX: 175, clientY: 11 });
    pointer(window, 'pointerup', { button, clientX: 175, clientY: 11 });
  }
  expect(p.onSelectNodes).not.toHaveBeenCalled();
  pointer(canvas, 'pointerdown', { button: 2, ctrlKey: true, clientX: 175, clientY: 11 });
  pointer(window, 'pointerup', { button: 2, ctrlKey: true, clientX: 175, clientY: 11 });
  expect(p.onSelectNodes).toHaveBeenCalledWith([{ id: p.data.cellIds[0], selected: false }, { id: 'b', selected: true }]);
});

test('shift-click extends a visible tree range, Ctrl toggles, and clearing invalidates the anchor', () => {
  const cellIds = ['a', 'b', 'c', 'd', 'e'];
  const p = props();
  p.data = { ...p.data, cellIds, tree: parseNewick('(a,b,c,d,e);') };
  const ref = React.createRef();
  let nodes = [];
  const ui = render(<PhylogenyHeatmap ref={ref} {...p} nodes={nodes} />);
  flush();
  const canvas = ui.container.querySelector('canvas[data-matrix-entries]');
  const click = (row, modifiers = {}) => {
    const point = { clientX: 175, clientY: ref.current.scene.rows[row].y, ...modifiers };
    pointer(canvas, 'pointerdown', point); pointer(window, 'pointerup', point);
    nodes = p.onSelectNodes.mock.calls.slice(-1)[0][0];
    ui.rerender(<PhylogenyHeatmap ref={ref} {...p} nodes={nodes} />); flush();
    return nodes.filter(n => n.selected).map(n => n.id);
  };
  expect(ref.current.scene.rows.map(row => row.id)).toEqual(['e', 'd', 'c', 'b', 'a']);
  expect(click(1)).toEqual(['d']);
  expect(click(4, { shiftKey: true })).toEqual(['a', 'b', 'c', 'd']);
  expect(click(2, { shiftKey: true })).toEqual(['c', 'd']);
  expect(click(4, { ctrlKey: true })).toEqual(['a', 'c', 'd']);
  expect(click(2, { ctrlKey: true })).toEqual(['a', 'd']);
  ui.rerender(<PhylogenyHeatmap ref={ref} {...p} nodes={[]} />); flush();
  expect(click(4, { shiftKey: true })).toEqual(['a']);
  expect(p.onDomainsChange).not.toHaveBeenCalled();
});

test("hover/selection reuse projection, fit/scroll keep all rows and benchmark restores DPR/live frame", () => {
  const ref = React.createRef();
  const p = props({ mutationMode: "paired" });
  const cellIds = Array.from({ length: 125 }, (_, i) => `c${i}`);
  p.data = { ...p.data, cellIds, tree: parseNewick(`(${cellIds.join(",")});`), mutations: {
    ...p.data.mutations, cellIds, values: new Float64Array(125), missing: new Uint8Array(125),
  } };
  const oldDpr = window.devicePixelRatio;
  Object.defineProperty(window, "devicePixelRatio", { value: 2, configurable: true });
  try {
    const ui = render(<PhylogenyHeatmap ref={ref} {...p} />);
    flush();
    const canvas = ui.container.querySelector("canvas[data-matrix-entries]");
    expect(canvas.width).toBe(1200);
    const scene = ref.current.scene;
    const groups = scene.windows[0].groups;
    fireEvent.mouseMove(canvas, { clientX: 300, clientY: 12 });
    flush();
    ui.rerender(<PhylogenyHeatmap ref={ref} {...p} nodes={[{ id: "c1", selected: true }]} highlightedNodes={["c2"]} />);
    flush();
    expect(ref.current.scene).toBe(scene);
    expect(ref.current.scene.windows[0].groups).toBe(groups);
    const scroller = ui.container.querySelector(".heatmap-scroll");
    fireEvent.scroll(scroller, { target: { scrollTop: 120 * 32 } });
    flush();
    expect(canvas.dataset.frameRowsDrawn).toBe("5");
    expect(canvas.dataset.frameDrawn).toBe("5");
    const result = canvas.benchmarkFullMatrix(2);
    expect(result).toMatchObject({ visited: 125, drawn: 125, totalDrawn: 250 });
    expect(canvas.width).toBe(1200);
    expect(canvas.dataset.frameDrawn).toBe("5");
    expect(ref.current.scrollTop).toBe(120 * 32);
    fireEvent.click(ui.getByRole("button", { name: "Fit rows" }));
    flush();
    expect(canvas.dataset.frameRowsDrawn).toBe("125");
    expect(canvas.dataset.matrixEntries).toBe("125");
    expect(ref.current.scrollTop).toBe(0);
    fireEvent.click(ui.getByRole("button", { name: "Readable rows" }));
    flush();
    expect(Number(canvas.dataset.frameRowsDrawn)).toBeLessThan(125);
  } finally { Object.defineProperty(window, "devicePixelRatio", { value: oldDpr, configurable: true }); }
});

test("gutter pointer resize is bounded; cancellation/unmount removes native listeners and pending RAF", () => {
  const p = props();
  const remove = jest.spyOn(window, "removeEventListener");
  const ui = render(<PhylogenyHeatmap {...p} />);
  const canvas = ui.container.querySelector("canvas[data-matrix-entries]");
  const separator = ui.getByRole("separator");
  pointer(separator, "pointerdown", { clientX: 180, clientY: 20 });
  pointer(window, "pointermove", { clientX: 2000, clientY: 20 });
  expect(p.onGutterWidthChange).toHaveBeenCalledWith(528);
  pointer(window, "pointercancel", { clientX: 2000, clientY: 20 });
  p.onGutterWidthChange.mockClear();
  pointer(window, "pointermove", { clientX: 10, clientY: 20 });
  expect(p.onGutterWidthChange).not.toHaveBeenCalled();
  ui.unmount();
  expect(window.cancelAnimationFrame).toHaveBeenCalled();
  expect(remove).toHaveBeenCalledWith("pointermove", expect.any(Function));
  expect(remove).toHaveBeenCalledWith("pointerup", expect.any(Function));
  expect(remove).toHaveBeenCalledWith("pointercancel", expect.any(Function));
  expect(canvas.benchmarkFullMatrix).toBeUndefined();
  fireEvent.wheel(canvas, { clientX: 250, clientY: 10, deltaY: -100 });
  expect(p.onDomainsChange).not.toHaveBeenCalled();
});
