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

test("focused heatmap cycles total, major, and minor CN with Left/Right without touching controls", () => {
  const p = props({ cnMode: "total", onCnModeChange: jest.fn() });
  const ui = render(<PhylogenyHeatmap {...p} />);
  fireEvent.keyDown(ui.container.querySelector(".phylogeny-heatmap"), { key: "ArrowRight" });
  ui.rerender(<PhylogenyHeatmap {...p} cnMode="major" />);
  fireEvent.keyDown(ui.container.querySelector(".phylogeny-heatmap"), { key: "ArrowRight" });
  ui.rerender(<PhylogenyHeatmap {...p} cnMode="minor" />);
  fireEvent.keyDown(ui.container.querySelector(".phylogeny-heatmap"), { key: "ArrowLeft" });
  expect(p.onCnModeChange.mock.calls.map(call => call[0])).toEqual(["major", "minor", "major"]);
  fireEvent.keyDown(ui.getByRole("button", { name: /Fit rows/ }), { key: "ArrowRight" });
  expect(p.onCnModeChange).toHaveBeenCalledTimes(3);
});

test("read-count legend explicitly labels log scaling and actual raw-count limits for each metric", () => {
  const p = props({ mutationMode: "side", mutationMetric: "ref" });
  p.data.mutations.refCounts = new Float64Array([6, 184]);
  p.data.mutations.altCounts = new Float64Array([2, 255]);
  const ui = render(<PhylogenyHeatmap {...p} />); flush();
  expect(ui.getByRole("img", { name: "Ref count: logarithmic color scale from 0 to 184; tooltips show raw counts" })).toBeTruthy();
  expect(ui.container.querySelector(".mutation-canvas").dataset.frameScale).toBe("log1p");
  expect(ui.container.querySelector(".heatmap-count-ticks").textContent).toBe("0531184");
  ui.rerender(<PhylogenyHeatmap {...p} mutationMetric="alt" />); flush();
  expect(ui.getByRole("img", { name: "Alt count: logarithmic color scale from 0 to 255; tooltips show raw counts" })).toBeTruthy();
  ui.rerender(<PhylogenyHeatmap {...p} mutationMetric="vaf" />); flush();
  expect(ui.container.querySelector(".heatmap-count-scale")).toBeNull();
  expect(ui.container.querySelector(".mutation-canvas").dataset.frameScale).toBe("linear");
});

test("side matrix uses a viewport-sized canvas and scroll offsets exactly once, even for 10000 columns", () => {
  const p = props({ mutationMode: "side" });
  const matrix = { ...p.data.mutations, variants: Array.from({ length: 10000 }, (_, i) => ({ id: `v${i}`, chromosome: "1", position: i + 1, place: i + 1, ref: "A", alt: "T" })), values: new Float64Array(20000), missing: new Uint8Array(20000) };
  p.data = { ...p.data, mutations: matrix };
  const ref = React.createRef(); const ui = render(<PhylogenyHeatmap {...p} ref={ref} />); flush();
  const side = ui.container.querySelector(".mutation-canvas");
  const scroller = ui.container.querySelector(".mutation-scroll-x");
  expect(side.width).toBeLessThan(1000);
  side.getBoundingClientRect = () => ({ left: 400, top: 0, width: ref.current.mutationWidth(), height: ref.current.viewportHeight() });
  scroller.scrollLeft = 36000;
  fireEvent.scroll(scroller); flush();
  expect(side.dataset.frameFirstColumn).toBe("9000");
  expect(Number(side.dataset.frameColumnsDrawn)).toBeLessThan(80);
  fireEvent.mouseMove(side, { clientX: 406, clientY: 11 }); flush();
  expect(ui.getByRole("tooltip").textContent).toContain("Site: v9001");
  ref.current.scrollTop = 22;
  fireEvent.scroll(scroller); flush();
  expect(ref.current.scrollTop).toBe(22);
  ui.rerender(<PhylogenyHeatmap {...p} data={{ ...p.data, junctions: { cellIds: ["b"], variants: [{ id: "1:10+ <-> 2:20-" }], values: new Float64Array([171]), missing: new Uint8Array(1), format: "junction" } }} matrixKind="junctions" ref={ref} />); flush();
  expect(ui.container.querySelector(".mutation-canvas")).toBe(side);
  expect(scroller.scrollLeft).toBe(0);
  fireEvent.mouseMove(side, { clientX: 401, clientY: 11 }); flush();
  expect(ui.getByRole("tooltip").textContent).toContain("Junction CN: 171");
});

test("Fit rows shows all 10000 mutation sites and supports click, brush, gated wheel and reset without moving genomic domains", () => {
  const p = props({ mutationMode: "side", fitRows: true, zoomedByCmd: true });
  p.data = { ...p.data, mutations: { ...p.data.mutations,
    variants: Array.from({ length: 10000 }, (_, i) => ({ id: `site-${i}`, chromosome: "1", position: i, ref: "A", alt: "T" })),
    values: new Float64Array(20000), missing: new Uint8Array(20000), format: "sparse" } };
  const ref = React.createRef();
  const ui = render(<PhylogenyHeatmap {...p} ref={ref} />); flush();
  const side = ui.container.querySelector(".mutation-canvas"), scroller = ui.container.querySelector(".mutation-scroll-x");
  const width = ref.current.mutationWidth();
  side.getBoundingClientRect = () => ({ left: 400, top: 0, width, height: ref.current.viewportHeight() });
  expect(side.dataset.frameColumns).toBe("10000");
  expect(side.dataset.frameColumnsDrawn).toBe(String(Math.floor(width)));
  expect(side.dataset.frameCellsDrawn).toBe(String(Math.floor(width) * 2));
  expect(side.dataset.frameScale).toBe("positive-fraction");
  expect(scroller.style.overflowX).toBe("hidden");
  expect(side.tabIndex).toBe(0);
  fireEvent.keyDown(side, { key: "+" }); flush();
  expect(ref.current.mutationRange()[1]).toBeLessThan(10000);
  const keyRange = ref.current.mutationRange().slice();
  fireEvent.keyDown(side, { key: "ArrowRight", altKey: true }); flush();
  expect(ref.current.mutationRange()[0]).toBeGreaterThan(keyRange[0]);
  fireEvent.keyDown(side, { key: "Home" }); flush();
  expect(ref.current.state.mutationRange).toBeNull();
  fireEvent.mouseMove(side, { clientX: 400, clientY: 10 }); flush();
  const tooltipLines = Array.from(ui.getByRole("tooltip").children, line => line.textContent);
  expect(tooltipLines).toHaveLength(4);
  expect(tooltipLines[0]).toMatch(/^Cell: /);
  expect(tooltipLines[1]).toMatch(/^Range: site-0–site-\d+$/);
  expect(tooltipLines[2]).toMatch(/^\d+ sites$/);
  expect(tooltipLines[3]).toMatch(/^VAF: 0 positive, \d+ zero, 0 missing$/);
  fireEvent.click(side, { clientX: 400, clientY: 10 }); flush();
  expect(ref.current.state.mutationRange[0]).toBe(0);
  expect(ref.current.state.mutationRange[1]).toBeGreaterThan(1);
  expect(side.dataset.frameSummarized).toBe("false");
  expect(ui.getByRole("button", { name: "Reset mutation zoom" })).toBeTruthy();
  const afterClick = ref.current.mutationRange().slice();
  fireEvent.wheel(side, { clientX: 420, clientY: 10, deltaY: -100 }); flush();
  expect(ref.current.mutationRange()).toEqual(afterClick);
  fireEvent.wheel(side, { clientX: 420, clientY: 10, deltaY: -100, metaKey: true }); flush();
  expect(ref.current.mutationRange()[1] - ref.current.mutationRange()[0]).toBeLessThan(afterClick[1] - afterClick[0]);
  const beforePan = ref.current.mutationRange().slice();
  pointer(side, "pointerdown", { clientX: 460, clientY: 10 });
  pointer(window, "pointermove", { clientX: 430, clientY: 10 });
  pointer(window, "pointerup", { clientX: 430, clientY: 10 }); flush();
  expect(ref.current.mutationRange()[0]).toBeGreaterThan(beforePan[0]);
  expect(ref.current.mutationRange()[1] - ref.current.mutationRange()[0]).toBe(beforePan[1] - beforePan[0]);
  fireEvent.click(ui.getByRole("button", { name: "Reset mutation zoom" })); flush();
  expect(ref.current.state.mutationRange).toBeNull();
  pointer(side, "pointerdown", { clientX: 440, clientY: 10, shiftKey: true });
  pointer(window, "pointermove", { clientX: 480, clientY: 10, shiftKey: true }); flush();
  expect(ctx.fillRect).toHaveBeenCalledWith(40, 0, 40, ref.current.viewportHeight());
  pointer(window, "pointerup", { clientX: 480, clientY: 10, shiftKey: true }); flush();
  expect(ref.current.mutationRange()[0]).toBeGreaterThan(0);
  expect(ref.current.mutationRange()[1]).toBeLessThan(10000);
  expect(p.onDomainsChange).not.toHaveBeenCalled();
  expect(p.onSelectNodes).not.toHaveBeenCalled();
  fireEvent.doubleClick(side, { clientX: 420, clientY: 10 }); flush();
  expect(ref.current.state.mutationRange).toBeNull();
  ui.rerender(<PhylogenyHeatmap {...p} fitRows={false} ref={ref} />); flush();
  expect(scroller.style.overflowX).toBe("auto");
  expect(side.tabIndex).toBe(-1);
  expect(side.dataset.frameColumnsDrawn).toBe(String(Math.ceil(width / 4)));
  const junctions = { format: "junction", cellIds: ["b"], variants: Array.from({ length: 1000 }, (_, i) => ({ id: `j${i}` })),
    values: new Float64Array(1000), missing: new Uint8Array(1000) };
  ui.rerender(<PhylogenyHeatmap {...p} data={{ ...p.data, junctions }} matrixKind="junctions" ref={ref} />); flush();
  expect(scroller.style.overflowX).toBe("auto");
  expect(side.dataset.frameColumnsDrawn).toBe(String(Math.ceil(width / 4)));
  fireEvent.click(side, { clientX: 400, clientY: 10 });
  expect(p.onSelectNodes).toHaveBeenCalledTimes(1);
});

test("tree hover carries node identity for a visible highlight without selecting it", () => {
  const ref = React.createRef(); const p = props();
  const ui = render(<PhylogenyHeatmap {...p} ref={ref} />); flush();
  const root = ref.current.scene.tree[0];
  fireEvent.mouseMove(ui.container.querySelector(".heatmap-canvas"), { clientX: root.x, clientY: root.y }); flush();
  expect(ref.current.hover.nodeId).toBe(root.id);
  expect(ctx.strokeRect).toHaveBeenCalledWith(root.x - 5, root.y - 5, 10, 10);
  expect(p.onSelectNodes).not.toHaveBeenCalled();
});

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
    expect(ctx.strokeRect).toHaveBeenCalledWith(0.5, 0.5, 599, ref.current.scene.rowHeight - 1);
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
  const mutationY = ref.current.scene.rowHeight * 0.75;
  pointer(canvas, "pointerdown", { clientX: x, clientY: mutationY });
  pointer(window, "pointerup", { clientX: x, clientY: mutationY });
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

test.each(["hidden", "overlay", "paired", "side"])("%s rows grow with the viewport; readable mode imposes only a minimum", mutationMode => {
  const cellIds = Array.from({ length: 12 }, (_, i) => `c${i}`);
  const p = props({ mutationMode, selectedRowsOnly: true, nodes: cellIds.slice(0, 4).map(id => ({ id, selected: true })) });
  p.data = { ...p.data, cellIds, tree: parseNewick(`(${cellIds.join(",")});`), mutations: {
    ...p.data.mutations, cellIds, values: new Float64Array(12), missing: new Uint8Array(12),
  } };
  const ref = React.createRef();
  const ui = render(<PhylogenyHeatmap ref={ref} {...p} />);
  const canvas = ui.container.querySelector(".heatmap-canvas");
  for (const fitRows of [undefined, false, true]) for (const height of [140, 160, 200, 300, 600, 140]) {
    ui.rerender(<PhylogenyHeatmap ref={ref} {...p} fitRows={fitRows} height={height} />); flush();
    const viewport = height - 72;
    const expected = Math.max(fitRows ? 0 : mutationMode === "paired" ? 32 : 22, viewport / 4);
    const scene = ref.current.scene;
    expect(scene.rows).toHaveLength(4);
    expect(scene.hiddenCount).toBe(8);
    expect(scene.rowHeight).toBe(expected);
    expect(scene.totalHeight).toBe(expected * 4);
    expect(scene.data).toBe(p.data);
    expect(canvas.height).toBe(viewport);
    expect(canvas.dataset.matrixEntries).toBe("12");
    for (const row of scene.rows) expect(scene.tree.find(node => node.id === row.id).y).toBe(row.y);
    if (mutationMode === "side") {
      const side = ui.container.querySelector(".mutation-canvas");
      expect(side.height).toBe(viewport);
      expect(side.dataset.frameRowsDrawn).toBe(canvas.dataset.frameRowsDrawn);
    }
  }
  expect(p.onSelectNodes).not.toHaveBeenCalled();
});

test.each(["mutations", "junctions"])("filtering or enlarging readable rows resets obsolete scroll and keeps %s aligned", matrixKind => {
  const cellIds = Array.from({ length: 12 }, (_, i) => `c${i}`);
  const p = props({ mutationMode: "side", matrixKind, height: 140, fitRows: false });
  const matrix = { ...p.data.mutations, cellIds, values: new Float64Array(12), missing: new Uint8Array(12) };
  p.data = { ...p.data, cellIds, tree: parseNewick(`(${cellIds.join(",")});`), mutations: matrix, junctions: matrix };
  const ref = React.createRef();
  const ui = render(<PhylogenyHeatmap ref={ref} {...p} />); flush();
  const scroller = ui.container.querySelector(".heatmap-scroll");
  const canvas = ui.container.querySelector(".heatmap-canvas");
  const side = ui.container.querySelector(".mutation-canvas");
  const scrollToBottom = () => {
    fireEvent.scroll(scroller, { target: { scrollTop: 196 } }); flush();
    expect(ref.current.scrollTop).toBe(196);
  };
  const expectFilled = count => {
    expect(ref.current.scene.rowHeight).toBe(ref.current.viewportHeight() / count);
    expect(ref.current.scene.totalHeight).toBeCloseTo(ref.current.viewportHeight());
    expect(ref.current.scrollTop).toBe(0);
    expect(scroller.scrollTop).toBe(0);
    expect(canvas.dataset.frameRowsDrawn).toBe(String(count));
    expect(side.dataset.frameRowsDrawn).toBe(String(count));
  };
  scrollToBottom();
  for (const count of [2, 1]) {
    ui.rerender(<PhylogenyHeatmap ref={ref} {...p} selectedRowsOnly nodes={cellIds.slice(0, count).map(id => ({ id, selected: true }))} />); flush();
    expectFilled(count);
  }
  ui.rerender(<PhylogenyHeatmap ref={ref} {...p} selectedRowsOnly nodes={[]} />); flush();
  expect(ui.getByText("No selected cells")).toBeTruthy();
  expect(Number.isFinite(ref.current.scene.rowHeight)).toBe(true);
  expect(ref.current.scene.totalHeight).toBe(0);
  expect(canvas.dataset.frameRowsDrawn).toBe("0");
  expect(side.dataset.frameRowsDrawn).toBe("0");
  ui.rerender(<PhylogenyHeatmap ref={ref} {...p} />); flush();
  expect(ref.current.scene.rowHeight).toBe(22);
  expect(ref.current.scene.rows).toHaveLength(12);
  scrollToBottom();
  ui.rerender(<PhylogenyHeatmap ref={ref} {...p} height={600} />); flush();
  expectFilled(12);
  expect(ref.current.scene.data).toBe(p.data);
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
