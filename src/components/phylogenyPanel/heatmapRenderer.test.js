import fs from "fs";
import path from "path";
import {
  prepareHeatmap, drawHeatmap, hitTestHeatmap, selectionNodes,
  describeHit, benchmarkFullMatrix, changeDomain, vafColor, cnColor, CN_COLORS, drawHeatmapAxis,
} from "./heatmapRenderer";
import { parseNewick, parsePlotlyMutations, normalizeCopyNumber } from "../../helpers/phylogeny/data";

function context() {
  const ctx = { filledRects: [], circles: [], strokes: [], outlinedRects: [], arcCount: 0, path: [], fillStyle: "", strokeStyle: "", globalAlpha: 1 };
  ["save", "restore", "clip", "clearRect", "fillText", "strokeRect", "setLineDash"].forEach(k => { ctx[k] = jest.fn(); });
  let transform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  ctx.setTransform = jest.fn((a, b, c, d, e, f) => { transform = { a, b, c, d, e, f }; });
  ctx.getTransform = jest.fn(() => transform);
  ctx.beginPath = () => { ctx.path = []; };
  ctx.rect = (...args) => ctx.path.push({ type: "rect", args });
  ctx.arc = (...args) => { ctx.arcCount++; ctx.path.push({ type: "arc", args }); };
  ctx.moveTo = (...args) => ctx.path.push({ type: "moveTo", args });
  ctx.lineTo = (...args) => ctx.path.push({ type: "lineTo", args });
  ctx.fill = () => {
    ctx.path.forEach(({ type, args }) => {
      if (type === "rect") ctx.filledRects.push({ rect: args, color: ctx.fillStyle });
      if (type === "arc") ctx.circles.push({ args, color: ctx.fillStyle, alpha: ctx.globalAlpha });
    });
  };
  ctx.stroke = () => ctx.strokes.push({ path: ctx.path.slice(), fillColor: ctx.fillStyle, color: ctx.strokeStyle, width: ctx.lineWidth, alpha: ctx.globalAlpha });
  ctx.fillRect = (...rect) => ctx.filledRects.push({ rect, color: ctx.fillStyle });
  ctx.strokeRect.mockImplementation((...rect) => ctx.outlinedRects.push({ rect, color: ctx.strokeStyle, width: ctx.lineWidth }));
  return ctx;
}

// Check every path, not a sample: isolated subpaths, one arc per entry, opaque
// contrasting outlines, and a bounded cross path immediately after each gray chunk.
function assertCirclePaths(ctx) {
  const outlines = ctx.strokes.filter(s => s.path.some(p => p.type === "arc"));
  expect(ctx.arcCount).toBe(ctx.circles.length);
  expect(outlines.reduce((sum, s) => sum + s.path.length / 2, 0)).toBe(ctx.arcCount);
  expect(outlines.every(s => s.path.length <= 32 && s.color === "#555555" && s.alpha === 1)).toBe(true);
  expect(outlines.every(s => s.path.every((part, index) => {
    if (index % 2 === 0) {
      const next = s.path[index + 1];
      return part.type === "moveTo" && next.type === "arc" &&
        part.args[0] === next.args[0] + next.args[2] && part.args[1] === next.args[1];
    }
    return part.type === "arc" && part.args[3] === 0 && part.args[4] === Math.PI * 2;
  }))).toBe(true);
  expect(ctx.circles.every(c => c.alpha === 1 && !c.color.includes("rgba"))).toBe(true);
  const crosses = ctx.strokes.filter(s => s.color === "#555555" && s.fillColor === vafColor(null) && s.path.length && s.path.every(p => p.type === "moveTo" || p.type === "lineTo"));
  // Missing crosses immediately follow their circle chunk; aggregate pluses are white.
  const missingChunks = outlines.filter(s => s.fillColor === vafColor(null));
  expect(crosses).toHaveLength(missingChunks.length);
  expect(missingChunks.every((outline, chunkIndex) => {
    const cross = ctx.strokes[ctx.strokes.indexOf(outline) + 1];
    const arcs = outline.path.filter(p => p.type === "arc");
    return cross === crosses[chunkIndex] && cross.color === outline.color && cross.alpha === 1 &&
      cross.path.length === arcs.length * 4 && cross.path.every((part, index) => {
        const [x, y, radius] = arcs[Math.floor(index / 4)].args;
        const [dx, dy] = [[-1, -1], [1, 1], [1, -1], [-1, 1]][index % 4];
        return part.type === (index % 2 ? "lineTo" : "moveTo") &&
          part.args[0] === x + dx * radius * 0.55 && part.args[1] === y + dy * radius * 0.55 &&
          Math.hypot(part.args[0] - x, part.args[1] - y) + cross.width / 2 <= radius + outline.width / 2 + 1e-9;
      });
  })).toBe(true);
  return outlines;
}
// Aggregate circles share the bounded outline helper, but their white fill is
// neutral and the following mark is an orthogonal plus, never a missing cross.
function assertPlusPaths(ctx) {
  const outlines = assertCirclePaths(ctx).filter(s => s.fillColor === "#ffffff");
  outlines.forEach(outline => {
    const plus = ctx.strokes[ctx.strokes.indexOf(outline) + 1];
    const arcs = outline.path.filter(p => p.type === "arc");
    expect(plus).toMatchObject({ color: "#555555", fillColor: "#ffffff", width: outline.width, alpha: 1 });
    expect(plus.path).toHaveLength(arcs.length * 4);
    expect(plus.path.length).toBeLessThanOrEqual(64);
    expect(plus.path.every((part, index) => {
      const [x, y, radius] = arcs[Math.floor(index / 4)].args;
      const [dx, dy] = [[-1, 0], [1, 0], [0, -1], [0, 1]][index % 4];
      return part.type === (index % 2 ? "lineTo" : "moveTo") &&
        part.args[0] === x + dx * radius * 0.55 && part.args[1] === y + dy * radius * 0.55 &&
        Math.hypot(part.args[0] - x, part.args[1] - y) + plus.width / 2 <= radius + outline.width / 2 + 1e-9;
    })).toBe(true);
  });
  return outlines;
}

function overlapData(places, cellCount = 1) {
  const cellIds = Array.from({ length: cellCount }, (_, i) => `cell${i}`);
  const values = Float64Array.from({ length: cellCount * places.length }, (_, i) => [0, NaN, 0.123456789012345][i % 3]);
  return { cellIds, mutations: { cellIds,
    variants: places.map((place, i) => ({ id: `v${i}`, place, position: place, chromosome: "1", ref: "A", alt: "T" })),
    values, missing: Uint8Array.from(values, value => Number.isNaN(value) ? 1 : 0),
  } };
}

function data() {
  return {
    tree: parseNewick("((b:1,a:1)x:1,c:2)root;"), cellIds: ["a", "b", "c"],
    cnByCell: { a: [{ chromosome: "1", start: 0, end: 100, cn: null }], b: [{ chromosome: "1", start: 0, end: 100, cn: 2 }] },
    mutations: {
      cellIds: ["c", "a", "b"],
      variants: [20, 50, 80].map((place, i) => ({ id: `v${i}`, chromosome: "1", position: place, place, ref: "A", alt: "T" })),
      values: new Float64Array([0, NaN, 1, 0.125, 0, NaN, 1, 0.5, 0]),
      missing: new Uint8Array([0, 1, 0, 0, 0, 1, 0, 0, 0]),
    },
  };
}
const options = (extra = {}) => ({ data: data(), width: 600, gutterWidth: 160, domains: [[0, 100]], mutationMode: "paired", ...extra });

test("reverse tree traversal rows map matrix IDs rather than row offsets; filter retains ancestors", () => {
  const scene = prepareHeatmap(options());
  expect(scene.rows.map(r => r.id)).toEqual(["c", "a", "b"]);
  expect(scene.rows.map(r => r.matrixRow)).toEqual([0, 1, 2]);
  const filtered = prepareHeatmap(options({ selectedRowsOnly: true, nodes: [{ id: "a", selected: true }] }));
  expect(filtered.rows.map(r => r.id)).toEqual(["a"]);
  expect(filtered.hiddenCount).toBe(2);
  expect(filtered.tree.find(n => n.descendants.length === 3).hiddenCount).toBe(2);
  expect(filtered.tree.find(n => n.descendants.length === 2).hiddenCount).toBe(1);
  expect(filtered.data.mutations.values.length).toBe(9);
  expect(prepareHeatmap(options({ gutterWidth: 0 })).tree).toEqual([]);
});

// plotlyProjectionAndStyle: metadata order -> identity-based scene; paint full
// intervals, neutral glyphs/groups and finally blue row outlines. No source edits.
test("display metadata takes priority, filters by identity, and never changes matrix storage", () => {
  const source = data();
  source.mutations.displayCellIds = ["a", "b", "c"];
  const original = new Float64Array(source.mutations.values);
  const scene = prepareHeatmap(options({ data: source }));
  expect(scene.rows.map(r => [r.id, r.matrixRow])).toEqual([["a", 1], ["b", 2], ["c", 0]]);
  scene.rows.forEach(row => {
    const hit = hitTestHeatmap(scene, scene.windows[0].x + scene.windows[0].scale(20), row.y + scene.rowHeight / 4);
    expect(hit.row.id).toBe(row.id);
    expect(describeHit(scene, hit)).toContain(`VAF: ${source.mutations.values[row.matrixRow * 3]}`);
  });
  const filtered = prepareHeatmap(options({ data: source, selectedRowsOnly: true, nodes: [{ id: "c", selected: true }, { id: "b", selected: true }] }));
  expect(filtered.rows.map(r => r.id)).toEqual(["b", "c"]);
  expect(source.mutations.values).toEqual(original);
  expect(source.mutations.cellIds).toEqual(["c", "a", "b"]);
  expect(source.mutations.displayCellIds).toEqual(["a", "b", "c"]);
  expect(scene.data).toBe(source);
});

test("partial display metadata cannot drop, duplicate or invent cohort rows", () => {
  const source = data();
  source.cellIds.push("d");
  source.mutations.displayCellIds = ["b", "unknown", "b"];
  const scene = prepareHeatmap(options({ data: source }));
  expect(scene.rows.map(r => r.id)).toEqual(["b", "c", "a", "d"]);
  expect(scene.rowById.get("d").matrixRow).toBe(-1);
  delete source.mutations.displayCellIds;
  expect(prepareHeatmap(options({ data: source })).rows.map(r => r.id)).toEqual(["c", "a", "b", "d"]);
  delete source.tree;
  expect(prepareHeatmap(options({ data: source })).rows.map(r => r.id)).toEqual(source.cellIds);
});

test("all12 original CN colors, 11+ saturation and missing are distinct", () => {
  expect(CN_COLORS).toEqual(["#168CCB", "#8FD3E8", "#FFFFFF", "#FDBF6F", "#FF8A3D", "#FF5A24", "#EF2B2D", "#D7193F", "#B2184B", "#8C1D40", "#5A2630", "#000000"]);
  expect(CN_COLORS.map((_, value) => cnColor(value))).toEqual(CN_COLORS);
  expect(new Set(CN_COLORS).size).toBe(12);
  expect(cnColor(12)).toBe(CN_COLORS[11]);
  expect(cnColor(300)).toBe(CN_COLORS[11]);
  expect(cnColor(4.9)).toBe(CN_COLORS[4]);
  expect(cnColor(-1)).toBe(CN_COLORS[0]);
  [null, undefined, NaN, Infinity].forEach(value => expect(cnColor(value)).toBe(cnColor(null)));
  expect(CN_COLORS).not.toContain(cnColor(null));
});

test("VAF is continuous white-to-black grayscale (not bins), preserving nearby values and distinct missing", () => {
  expect(vafColor(0)).toBe("#ffffff");
  expect(vafColor(1)).toBe("#000000");
  expect(vafColor(0.5)).toBe("#808080");
  expect(new Set([0.101, 0.105, 0.109, 0.501, 0.505, 0.509].map(vafColor)).size).toBe(6);
  const ramp = Array.from({ length: 101 }, (_, i) => vafColor(i / 100));
  expect(new Set(ramp).size).toBe(101);
  ramp.forEach((color, i) => {
    expect(color.slice(1, 3)).toBe(color.slice(3, 5));
    expect(color.slice(3, 5)).toBe(color.slice(5, 7));
    expect(parseInt(color.slice(1, 3), 16)).toBe(Math.round(255 * (1 - i / 100)));
    expect(color).not.toBe(vafColor(null));
  });
  [null, undefined, NaN, Infinity].forEach(value => expect(vafColor(value)).toBe(vafColor(null)));
});

test.each(["hidden", "overlay", "paired"])("%s CN paints every source level at full lane height with seamless shared boundaries", mutationMode => {
  const source = { cellIds: Array.from({ length: 13 }, (_, i) => `cell${i}`), cnByCell: {} };
  source.cellIds.forEach((id, i) => { source.cnByCell[id] = [
    { start: 0, end: 50, cn: i === 12 ? null : i }, { start: 50, end: 100, cn: i === 12 ? null : i },
  ]; });
  for (const rowHeight of [22, 0.2]) {
    const scene = prepareHeatmap(options({ data: source, mutationMode, rowHeight }));
    const ctx = context();
    expect(drawHeatmap(ctx, scene, { cull: false }).cnDrawn).toBe(26);
    const window = scene.windows[0];
    const laneHeight = mutationMode === "paired" ? rowHeight / 2 : rowHeight;
    source.cellIds.forEach((id, i) => {
      const color = i === 12 ? cnColor(null) : CN_COLORS[i];
      const halves = ctx.filledRects.filter(r => r.color === color && r.rect[1] === i * rowHeight && r.rect[2] === window.width / 2);
      expect(halves.map(r => r.rect)).toEqual([
        [window.x, i * rowHeight, window.width / 2, laneHeight],
        [window.x + window.width / 2, i * rowHeight, window.width / 2, laneHeight],
      ]);
      expect(halves[0].rect[0] + halves[0].rect[2]).toBe(halves[1].rect[0]);
      if (mutationMode !== "paired") expect(halves[0].rect[1] + halves[0].rect[3]).toBeCloseTo((i + 1) * rowHeight);
    });
  }
});

test.each(["hidden", "overlay", "paired"])("%s selected, highlighted and hovered rows have blue outlines across gutter and genome, never recolored data", mutationMode => {
  const scene = prepareHeatmap(options({ mutationMode }));
  const before = context();
  drawHeatmap(before, scene);
  const after = context();
  drawHeatmap(after, scene, { nodes: [{ id: "b", selected: true }], highlightedNodes: ["c"], hover: { rowId: "a" } });
  expect(after.outlinedRects).toEqual(scene.rows.map(row => ({
    rect: [0.5, row.index * scene.rowHeight + 0.5, scene.width - 1, scene.rowHeight - 1], color: "#1677ff", width: 1,
  })));
  expect(after.circles).toEqual(before.circles);
  expect(after.filledRects.filter(r => r.rect[0] >= scene.windows[0].x)).toEqual(before.filledRects.filter(r => r.rect[0] >= scene.windows[0].x));
  const scrolled = context();
  drawHeatmap(scrolled, scene, { height: scene.rowHeight, scrollTop: scene.rowHeight, hover: { rowId: "a" } });
  expect(scrolled.outlinedRects).toEqual([{ rect: [0.5, 0.5, scene.width - 1, scene.rowHeight - 1], color: "#1677ff", width: 1 }]);
  const cleared = context();
  drawHeatmap(cleared, scene, { hover: null });
  expect(cleared.outlinedRects).toEqual([]);
});

test("filtered deep ancestry retains hidden counts/tooltips but labels only leaves in reserved gutter space", () => {
  const id = "BWH70_MR_1_pl1_10a";
  const source = { tree: parseNewick(`((((${id}:1,b:1):1,c:1):1,d:1):1,e:1);`), cellIds: [id, "b", "c", "d", "e"] };
  for (const gutterWidth of [160, 240, 400]) {
    const scene = prepareHeatmap(options({ data: source, gutterWidth, selectedRowsOnly: true, nodes: [{ id, selected: true }] }));
    const ctx = context();
    drawHeatmap(ctx, scene);
    expect(scene.hiddenCount).toBe(4);
    expect(scene.tree).toHaveLength(5);
    const root = scene.tree[0];
    expect(describeHit(scene, { type: "branch", node: root, ids: root.descendants })).toContain("5 cells (4 hidden)");
    expect(ctx.fillText).toHaveBeenCalledTimes(1);
    const [label, x, y, maxWidth] = ctx.fillText.mock.calls[0];
    expect(label).toBe(id);
    expect(x).toBeGreaterThan(scene.tree[scene.tree.length - 1].x);
    expect(y).toBe(scene.rowHeight / 2);
    expect(maxWidth).toBeGreaterThanOrEqual(id.length * 6);
    expect(x + maxWidth).toBeLessThanOrEqual(gutterWidth);
  }
});

test("windows use the shared 24px margins; empty/narrow layouts and empty selections are safe", () => {
  const scene = prepareHeatmap(options({ domains: [[0, 30], [70, 100]] }));
  expect(scene.windows.map(w => [w.x, w.width])).toEqual([[184, 184], [392, 184]]);
  expect(prepareHeatmap(options({ width: 20 })).windows).toEqual([]);
  const empty = prepareHeatmap(options({ selectedRowsOnly: true, nodes: [] }));
  expect(drawHeatmap(context(), empty, { height: 100 }).drawn).toBe(0);
});

test.each(["hidden", "overlay", "paired"])("%s mode draws correct full values, zero and missing distinctly", mode => {
  const scene = prepareHeatmap(options({ mutationMode: mode, gutterWidth: 0 }));
  const ctx = context();
  const frame = drawHeatmap(ctx, scene, { height: 200 });
  expect(frame.drawn).toBe(mode === "hidden" ? 0 : 9);
  expect(frame.visited).toBe(mode === "hidden" ? 0 : 9);
  if (mode !== "hidden") {
    expect(frame.zeroDrawn).toBe(3);
    expect(frame.missingDrawn).toBe(2);
    expect(frame.positiveDrawn).toBe(4);
    expect(ctx.circles).toHaveLength(9);
    const outlines = assertCirclePaths(ctx);
    expect(outlines).toHaveLength(5);
    expect(outlines.every(s => s.color === "#555555" && s.alpha === 1)).toBe(true);
    expect(ctx.circles.filter(c => c.color === vafColor(0))).toHaveLength(3);
    expect(ctx.circles.filter(c => c.color === vafColor(null))).toHaveLength(2);
    expect(ctx.circles.every(c => c.alpha === 1 && c.args[3] === 0 && c.args[4] === Math.PI * 2)).toBe(true);
  } else {
    expect(ctx.circles).toHaveLength(0);
  }
  expect(new Set([vafColor(0), vafColor(null), vafColor(1)]).size).toBe(3);
  expect(cnColor(null)).not.toBe(cnColor(0));
  expect(vafColor(0.5)).not.toContain("rgba");
});

// circleMarkers: scene + Canvas context -> same frame counts and positions.
// Template: collect singleton centers by color; loop over chunks of at most 16;
// moveTo/arc each entry, fill/stroke, then cross gray entries in that chunk.
// Empty/single/full/remainder chunks exercise every color, including zero/missing.
test.each([0, 1, 16, 17, 32, 33])("paths cap each color at 16 circles (%i entries per color)", count => {
  const values = [0, 0.1, 0.3, 0.5, 0.7, 1, NaN].flatMap(value => Array(count).fill(value));
  const variants = values.map((value, i) => ({ place: i + 1, chromosome: "1" }));
  const source = { cellIds: ["a"], mutations: { cellIds: ["a"], variants, values: new Float64Array(values), missing: new Uint8Array(values.length) } };
  const scene = prepareHeatmap(options({ data: source, gutterWidth: 0, aggregate: false, domains: [[0, values.length + 1]] }));
  const ctx = context();
  ctx.globalAlpha = 0.2;
  const frame = drawHeatmap(ctx, scene);
  expect(frame).toMatchObject({ drawn: values.length, visited: values.length, positiveDrawn: 5 * count, zeroDrawn: count, missingDrawn: count, groupsDrawn: 0 });
  const outlines = assertCirclePaths(ctx);
  expect(outlines).toHaveLength(7 * Math.ceil(count / 16));
  for (const value of [0, 0.1, 0.3, 0.5, 0.7, 1, null]) {
    const chunks = outlines.filter(s => s.fillColor === vafColor(value));
    expect(chunks.map(s => s.path.length / 2)).toEqual(Array.from({ length: Math.ceil(count / 16) }, (_, i) => Math.min(16, count - i * 16)));
    expect(ctx.circles.filter(c => c.color === vafColor(value))).toHaveLength(count);
  }
});

test.each(["overlay", "paired"])("%s circle radii at DPR1/2 fit thin rows, retain centers and hit footprints", mutationMode => {
  for (const rowHeight of [32, 12, 1, 0.1]) for (const dpr of [1, 2]) {
    const scene = prepareHeatmap(options({ mutationMode, rowHeight, gutterWidth: 0 }));
    const ctx = context();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    expect(drawHeatmap(ctx, scene, { cull: false }).drawn).toBe(9);
    const outlines = assertCirclePaths(ctx);
    expect(ctx.getTransform()).toEqual({ a: dpr, b: 0, c: 0, d: dpr, e: 0, f: 0 });
    ctx.circles.forEach(({ args: [centerX, centerY, radius], color }) => {
      const outerRadius = radius + outlines.find(s => s.fillColor === color).width / 2;
      expect(outerRadius).toBe(Math.min(2.85, rowHeight / 4));
      const hit = hitTestHeatmap(scene, centerX, centerY);
      expect(hit.type).toBe("mutation");
      expect(centerX).toBe(scene.windows[0].x + hit.group.x1);
      expect(centerY).toBe(hit.row.index * rowHeight + rowHeight * (mutationMode === "paired" ? 0.75 : 0.5));
      const laneTop = hit.row.index * rowHeight + (mutationMode === "paired" ? rowHeight / 2 : 0);
      expect(centerY - outerRadius).toBeGreaterThanOrEqual(laneTop - 1e-9);
      expect(centerY + outerRadius).toBeLessThanOrEqual((hit.row.index + 1) * rowHeight + 1e-9);
    });
  }
});

test("DOM and non-DOM contexts use the same bounded paths without scratch canvases or images", () => {
  const plain = context();
  delete plain.getTransform;
  const dom = context();
  dom.canvas = { ownerDocument: { createElement: jest.fn() } };
  dom.drawImage = jest.fn();
  for (const ctx of [plain, dom]) {
    expect(drawHeatmap(ctx, prepareHeatmap(options({ gutterWidth: 0 }))).drawn).toBe(9);
    assertCirclePaths(ctx);
  }
  expect(dom.circles).toEqual(plain.circles);
  expect(dom.strokes).toEqual(plain.strokes);
  expect(dom.canvas.ownerDocument.createElement).not.toHaveBeenCalled();
  expect(dom.drawImage).not.toHaveBeenCalled();
});

test("CN changes never alter mutation fills, outlines or missing crosses; the missing mask overrides finite values", () => {
  const source = data();
  source.mutations.values[1] = 0;
  source.mutations.values[5] = 0.7;
  source.mutations.values[6] = Infinity;
  source.mutations.values[7] = -Infinity;
  const before = context();
  drawHeatmap(before, prepareHeatmap(options({ data: source, gutterWidth: 0 })));
  Object.values(source.cnByCell).forEach(intervals => intervals.forEach(interval => { interval.cn = 6; }));
  const after = context();
  const frame = drawHeatmap(after, prepareHeatmap(options({ data: source, gutterWidth: 0 })));
  expect(frame).toMatchObject({ drawn: 9, missingDrawn: 4, zeroDrawn: 3, positiveDrawn: 2 });
  assertCirclePaths(after);
  expect(after.circles).toEqual(before.circles);
  expect(after.strokes).toEqual(before.strokes);
  expect(after.filledRects).not.toEqual(before.filledRects);
});

test("normal frames cull rows only, retain complete matrix, and hit test original values", () => {
  const scene = prepareHeatmap(options());
  const frame = drawHeatmap(context(), scene, { height: scene.rowHeight, scrollTop: scene.rowHeight });
  expect(frame.rowsDrawn).toBe(1);
  expect(frame.drawn).toBe(3);
  const hit = hitTestHeatmap(scene, scene.windows[0].x + scene.windows[0].scale(20), scene.rowHeight * 0.75, scene.rowHeight);
  expect(hit.type).toBe("mutation");
  expect(describeHit(scene, hit).join(" ")).toContain("0.125");
  expect(describeHit(scene, hit).join(" ")).toContain("CN: missing");
  expect(scene.data.mutations.values.length).toBe(9);
  const hidden = prepareHeatmap(options({ mutationMode: "hidden" }));
  expect(hitTestHeatmap(hidden, hidden.windows[0].x + hidden.windows[0].scale(20), 8, 0).type).not.toBe("mutation");
});

test("overlap groups shared across rows are neutral with exact tooltip counts; hits obey windows", () => {
  const source = data();
  source.mutations.variants.forEach((v, i) => { v.place = 20 + i * 0.1; });
  const scene = prepareHeatmap(options({ data: source }));
  expect(scene.windows[0].groups).toHaveLength(1);
  const ctx = context();
  const frame = drawHeatmap(ctx, scene, { height: 200 });
  expect(ctx.circles).toHaveLength(3);
  expect(ctx.arcCount).toBe(3);
  expect(assertPlusPaths(ctx)).toHaveLength(1);
  expect(frame.visited).toBe(9);
  expect(frame.groupsDrawn).toBe(3);
  expect(frame.drawn).toBe(0);
  const hit = hitTestHeatmap(scene, scene.windows[0].x + scene.windows[0].scale(20), scene.rowById.get("c").y + scene.rowHeight / 4, 0);
  expect(hit.type).toBe("group");
  expect(describeHit(scene, hit).join(" ")).toMatch(/3 sites.*1 positive.*1 zero.*1 missing/);
  expect(hitTestHeatmap(scene, 170, 5, 0)).toBeNull();
});

// aggregateCirclePlus: group indices > 1 -> clipped extent midpoint -> neutral
// circle/plus batches; singleton path unchanged. Hit testing uses that same
// center and the circle's outer radius; the returned group is still the source
// for exact tooltip counts and existing zoom bounds, never a clipped regrouping.
test.each(["hidden", "overlay", "paired"])("%s two-site groups use pluses only when aggregation is enabled", mutationMode => {
  const source = overlapData([20, 20.1]);
  for (const aggregate of [true, false]) {
    const scene = prepareHeatmap(options({ data: source, gutterWidth: 0, mutationMode, aggregate }));
    const ctx = context();
    const frame = drawHeatmap(ctx, scene);
    const visible = mutationMode !== "hidden";
    expect(frame).toMatchObject({ visited: visible ? 2 : 0, drawn: visible && !aggregate ? 2 : 0, groupsDrawn: visible && aggregate ? 1 : 0 });
    expect(ctx.circles).toHaveLength(visible ? aggregate ? 1 : 2 : 0);
    expect(ctx.fillText).not.toHaveBeenCalled();
    const centerY = scene.rowHeight * (mutationMode === "paired" ? 0.75 : 0.5);
    const centerX = scene.windows[0].x + scene.windows[0].scale(20.05);
    const hit = hitTestHeatmap(scene, centerX, centerY);
    expect(hit.type).toBe(visible ? aggregate ? "group" : "mutation" : "cn");
    if (visible && aggregate) {
      expect(assertPlusPaths(ctx)).toHaveLength(1);
      expect(ctx.circles[0].color).toBe("#ffffff");
      expect(hit.group).toBe(scene.windows[0].groups[0]);
      expect(hit.group).toMatchObject({ indices: [0, 1], start: 20, end: 20.1 });
      expect(describeHit(scene, hit)).toContain("2 sites: 0 positive, 1 zero, 1 missing");
      expect(describeHit(scene, hit)).toContain("Click to zoom to these sites");
    } else {
      assertCirclePaths(ctx);
      const marks = ctx.strokes.filter(s => s.path.length && s.path.every(p => p.type === "moveTo" || p.type === "lineTo"));
      expect(marks.every(s => s.fillColor === vafColor(null))).toBe(true);
    }
  }
});

test("aggregate pluses stay neutral across CN/VAF changes and differ from diagonal missing crosses", () => {
  const source = overlapData([20, 20.1, 80]);
  source.mutations.values.set([0, 1, NaN]);
  source.mutations.missing.set([0, 0, 1]);
  source.cnByCell = { cell0: [{ start: 0, end: 100, cn: 0 }] };
  const before = context();
  drawHeatmap(before, prepareHeatmap(options({ data: source, gutterWidth: 0 })));
  expect(before.circles.map(circle => circle.color).sort()).toEqual(["#ffffff", vafColor(null)].sort());
  expect(assertPlusPaths(before)).toHaveLength(1);
  source.cnByCell.cell0[0].cn = 11;
  source.mutations.values.set([NaN, 0.123456789012345, NaN]);
  source.mutations.missing[0] = 1;
  const after = context();
  drawHeatmap(after, prepareHeatmap(options({ data: source, gutterWidth: 0 })));
  expect(assertPlusPaths(after)).toHaveLength(1);
  expect(after.circles).toEqual(before.circles);
  expect(after.strokes).toEqual(before.strokes);
  expect(after.filledRects).not.toEqual(before.filledRects);
});

test.each([[40, 120, 110], [180, 260, 190], [40, 260, 150], [100, 100, 100], [200, 200, 200]])(
  "extent %s–%s draws and hits at clipped midpoint %s, not the invisible extent",
  (start, end, midpoint) => {
    const places = start === end ? [start, start] : Array.from({ length: end - start + 1 }, (_, i) => start + i);
    const source = overlapData(places);
    const scene = prepareHeatmap(options({ data: source, gutterWidth: 0, domains: [[100, 200]] }));
    const window = scene.windows[0];
    expect(window.groups).toHaveLength(1);
    const group = window.groups[0];
    const ctx = context();
    const frame = drawHeatmap(ctx, scene);
    expect(frame).toMatchObject({ visited: places.length, groupsDrawn: 1, drawn: 0 });
    expect(ctx.circles).toHaveLength(1);
    expect(assertPlusPaths(ctx)).toHaveLength(1);
    const [x, y, radius] = ctx.circles[0].args;
    expect(x).toBeCloseTo(window.x + window.scale(midpoint));
    expect(radius + 0.35).toBe(2.85);
    const hit = hitTestHeatmap(scene, x, y);
    expect(hit.type).toBe("group");
    expect(hit.group).toBe(group);
    expect(hit.group).toMatchObject({ start, end, indices: places.map((_, i) => i) });
    for (const edge of [window.x, window.x + window.width]) {
      expect(hitTestHeatmap(scene, edge, y).type).toBe(Math.abs(edge - x) <= 2.85 ? "group" : "cn");
    }
    const direction = midpoint === 200 ? -1 : 1;
    expect(hitTestHeatmap(scene, x + direction * 2.84, y).type).toBe("group");
    expect(hitTestHeatmap(scene, x + direction * 2.86, y).type).toBe("cn");
    expect(hitTestHeatmap(scene, x + direction * 2.5, y + 2.5).type).toBe("cn");
    expect(hitTestHeatmap(scene, window.x - 0.01, y)).toBeNull();
    expect(hitTestHeatmap(scene, window.x + window.width + 0.01, y)).toBeNull();
    expect(ctx.clip).toHaveBeenCalledTimes(2);
    expect(ctx.fillText).not.toHaveBeenCalled();
  }
);

test("disjoint windows center their own visible slice without changing the shared full group or zoom payload", () => {
  const source = overlapData(Array.from({ length: 201 }, (_, i) => i / 2));
  const originalValues = new Float64Array(source.mutations.values);
  const originalMissing = new Uint8Array(source.mutations.missing);
  const scene = prepareHeatmap(options({ data: source, gutterWidth: 0, domains: [[10, 40], [60, 90]] }));
  const ctx = context();
  expect(drawHeatmap(ctx, scene)).toMatchObject({ groupsDrawn: 2, visited: 402, drawn: 0 });
  expect(ctx.circles).toHaveLength(2);
  expect(assertPlusPaths(ctx)).toHaveLength(2);
  scene.windows.forEach((window, index) => {
    const [x, y] = ctx.circles[index].args;
    expect(x).toBe(window.x + window.width / 2);
    const hit = hitTestHeatmap(scene, x, y);
    expect(hit.type).toBe("group");
    expect(hit.windowIndex).toBe(index);
    expect(hit.group).toBe(window.groups[0]);
    expect(hit.group).toMatchObject({ indices: Array.from({ length: 201 }, (_, i) => i), start: 0, end: 100 });
    expect(describeHit(scene, hit)).toContain("201 sites: 67 positive, 67 zero, 67 missing");
    expect(describeHit(scene, hit)).toContain("1:0–100");
    expect(describeHit(scene, hit)).toContain("Display overlap group — no mean VAF");
    expect(hitTestHeatmap(scene, window.x + 1, y).type).toBe("cn");
  });
  expect(hitTestHeatmap(scene, scene.windows[0].x + scene.windows[0].width + 12, 24)).toBeNull();
  expect(source.mutations.values).toEqual(originalValues);
  expect(source.mutations.missing).toEqual(originalMissing);
});

test.each(["overlay", "paired"])("%s aggregate pluses fit thin lanes at DPR1/2 and hit only their circular footprint while scrolling", mutationMode => {
  for (const rowHeight of [32, 12, 1, 0.1]) for (const dpr of [1, 2]) {
    const source = overlapData([20, 20.1], 3);
    const scene = prepareHeatmap(options({ data: source, gutterWidth: 0, mutationMode, rowHeight }));
    const ctx = context();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const scrollTop = rowHeight;
    expect(drawHeatmap(ctx, scene, { height: rowHeight, scrollTop })).toMatchObject({ rowsDrawn: 1, groupsDrawn: 1, visited: 2, drawn: 0 });
    expect(ctx.circles).toHaveLength(1);
    const outlines = assertPlusPaths(ctx);
    const [x, y, radius] = ctx.circles[0].args;
    const outerRadius = radius + outlines[0].width / 2;
    expect(outerRadius).toBe(Math.min(2.85, rowHeight / 4));
    expect(y).toBe(rowHeight * (mutationMode === "paired" ? 0.75 : 0.5));
    expect(y - outerRadius).toBeGreaterThanOrEqual((mutationMode === "paired" ? rowHeight / 2 : 0) - 1e-9);
    expect(y + outerRadius).toBeLessThanOrEqual(rowHeight + 1e-9);
    expect(hitTestHeatmap(scene, x, y, scrollTop)).toMatchObject({ type: "group", row: { id: "cell1" } });
    expect(hitTestHeatmap(scene, x + outerRadius * 0.99, y, scrollTop).type).toBe("group");
    expect(hitTestHeatmap(scene, x + outerRadius * 1.01, y, scrollTop).type).toBe("cn");
    expect(hitTestHeatmap(scene, x + outerRadius * 0.8, y + outerRadius * 0.8, scrollTop).type).toBe("cn");
    expect(ctx.getTransform()).toEqual({ a: dpr, b: 0, c: 0, d: dpr, e: 0, f: 0 });
  }
});

test.each([0, 1, 16, 17, 32, 33, 500])("%i aggregate icons use bounded circle AND plus paths, never a giant extent path", count => {
  const scene = prepareHeatmap(options({ data: overlapData([20, 20.1], count), gutterWidth: 0 }));
  const ctx = context();
  ctx.globalAlpha = 0.2;
  expect(drawHeatmap(ctx, scene, { cull: false })).toMatchObject({ groupsDrawn: count, visited: count * 2, drawn: 0 });
  expect(ctx.circles).toHaveLength(count);
  const outlines = assertPlusPaths(ctx);
  expect(outlines.map(outline => outline.path.length / 2)).toEqual(Array.from({ length: Math.ceil(count / 16) }, (_, i) => Math.min(16, count - i * 16)));
  expect(ctx.strokes.every(stroke => stroke.path.length <= 64)).toBe(true);
  expect(ctx.fillText).not.toHaveBeenCalled();
});

test("branch and leaf selection return all cell IDs, selecting descendants without I/O", () => {
  const scene = prepareHeatmap(options());
  const root = scene.tree.find(n => n.descendants.length === 3);
  expect(hitTestHeatmap(scene, root.x, root.y, 0).type).toBe("branch");
  expect(selectionNodes(scene, root.descendants, [], false)).toEqual(data().cellIds.map(id => ({ id, selected: true })));
  expect(selectionNodes(scene, ["b"], [], false)).toEqual([{ id: "a", selected: false }, { id: "b", selected: true }, { id: "c", selected: false }]);
  expect(selectionNodes(scene, ["a"], [{ id: "b", selected: true }], true).filter(n => n.selected).map(n => n.id)).toEqual(["a", "b"]);
  expect(selectionNodes(scene, ["a"], [{ id: "a", selected: true }, { id: "b", selected: true }], true).filter(n => n.selected).map(n => n.id)).toEqual(["b"]);
  expect(selectionNodes(scene, root.descendants, root.descendants.map(id => ({ id, selected: true })), true).every(n => !n.selected)).toBe(true);
});

test("missing mutation sources and CN gaps remain missing, not zero", () => {
  const scene = prepareHeatmap(options({ data: { ...data(), mutations: null } }));
  expect(drawHeatmap(context(), scene, { height: 200 }).drawn).toBe(0);
  const hit = hitTestHeatmap(scene, scene.windows[0].x + 10, scene.rowById.get("c").index * scene.rowHeight + 5, 0);
  expect(describeHit(scene, hit).join(" ")).toContain("CN: missing");
});

test("domain changes preserve untouched disjoint windows and clip at neighbor/genome bounds", () => {
  const scene = prepareHeatmap(options({ domains: [[10, 30], [70, 90]] }));
  const result = changeDomain(scene, 0, [-10, 80], 100);
  expect(result[0][0]).toBeGreaterThanOrEqual(0);
  expect(result[0][1]).toBeLessThanOrEqual(70);
  expect(result[1]).toEqual([70, 90]);
  expect(changeDomain(prepareHeatmap(options()), 0, [-50, 50], 100)[0][0]).toBe(1);
});

function stressData() {
  const cellIds = Array.from({ length: 125 }, (_, i) => `cell${i}`);
  const variants = Array.from({ length: 736 }, (_, i) => ({ id: `v${i}`, chromosome: "1", place: i + 1, position: i + 1, ref: "A", alt: "C" }));
  return { cellIds, cnByCell: {}, tree: parseNewick(`(${cellIds.join(",")});`), mutations: { cellIds, variants, values: Float64Array.from({ length: 92000 }, (_, i) => i % 3 === 0 ? NaN : i % 3 === 1 ? 0 : 0.5), missing: Uint8Array.from({ length: 92000 }, (_, i) => +(i % 3 === 0)) } };
}
function assertBenchmark(source, genomeLength, mutationMode = "paired", iterations = 1, readback = false) {
  const ctx = context();
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  const canvas = { width: 600, height: 200, getContext: () => ctx };
  const restore = jest.fn();
  if (readback) ctx.getImageData = jest.fn((...args) => {
    expect(args).toEqual([0, 0, canvas.width, canvas.height]);
    expect(args).toEqual([0, 0, 600, 4000]);
    expect(ctx.arcCount).toBe(92000 * ctx.getImageData.mock.calls.length);
    return { data: new Uint8Array(4) };
  });
  const result = benchmarkFullMatrix(canvas, options({ data: source, genomeLength, mutationMode, restore }), iterations);
  if (readback) expect(ctx.getImageData).toHaveBeenCalledTimes(iterations);
  expect(result.visited).toBe(92000);
  expect(result.drawn).toBe(92000);
  expect(result.frames[0].rowsDrawn).toBe(125);
  expect(result.frames[0].zeroDrawn).toBeGreaterThan(0);
  expect(result.frames[0].missingDrawn).toBeGreaterThan(0);
  expect(ctx.circles).toHaveLength(92000 * iterations);
  assertCirclePaths(ctx);
  expect(result.frames.every(frame => frame.visited === 92000 && frame.drawn === 92000 && frame.groupsDrawn === 0)).toBe(true);
  expect(result).toMatchObject({ varyingProjection: true, pixelRatio: 1, totalDrawn: 92000 * iterations, readback });
  expect(result.frames.every(frame => frame.submissionMs >= 0 && frame.ms >= frame.submissionMs)).toBe(true);
  expect(ctx.getTransform().a).toBe(1);
  // Verify every actual source value and projected center, across every frame.
  for (let iteration = 0; iteration < iterations; iteration++) {
    const scene = prepareHeatmap(options({ data: source, mutationMode, rowHeight: 32, aggregate: false,
      domains: [[result.domains[0][0], result.domains[0][1] * (1 + (iteration % 4) * 0.02)]] }));
    const expectedByColor = new Map();
    scene.rows.forEach(row => scene.windows[0].groups.forEach(group => {
      const index = row.matrixRow * source.mutations.variants.length + group.indices[0];
      const value = source.mutations.values[index];
      const color = vafColor(source.mutations.missing[index] || !Number.isFinite(value) ? null : value);
      if (!expectedByColor.has(color)) expectedByColor.set(color, []);
      expectedByColor.get(color).push([scene.windows[0].x + group.x1, row.index * 32 + 32 * (mutationMode === "paired" ? 0.75 : 0.5)]);
    }));
    let index = iteration * 92000;
    const matches = [];
    for (const [color, centers] of expectedByColor) for (const [x, y] of centers) {
      const circle = ctx.circles[index++];
      matches.push(circle.color === color && circle.args[0] === x && circle.args[1] === y && circle.args[2] === 2.5);
    }
    expect(matches).toHaveLength(92000);
    expect(matches.every(Boolean)).toBe(true);
  }
  if (iterations > 1) expect(ctx.circles[0].args).not.toEqual(ctx.circles[92000].args);
  expect(canvas.width).toBe(600);
  expect(canvas.height).toBe(200);
  expect(restore).toHaveBeenCalledTimes(1);
  expect(result.meanMs).toBeGreaterThanOrEqual(0);
  return result;
}
test("same-code generated 125×736 benchmark actually paints all 92,000 entries without culling or aggregation", () => { assertBenchmark(stressData(), 1000); });

test("benchmark restores the live canvas even if painting fails", () => {
  const ctx = context();
  ctx.fillRect = () => { throw new Error("lost context"); };
  const canvas = { width: 600, height: 200, getContext: () => ctx };
  const restore = jest.fn();
  expect(() => benchmarkFullMatrix(canvas, options({ restore }), 1)).toThrow("lost context");
  expect([canvas.width, canvas.height]).toEqual([600, 200]);
  expect(restore).toHaveBeenCalledTimes(1);
});

const fixturePath = path.join(process.cwd(), "public/data/BWH70_phylogeny/mutations.plotly.json");
(fs.existsSync(fixturePath) ? test : test.skip).each(["overlay", "paired"])("actual full fixture %s circles paint all 92,000 entries over varying projections (including all 1,081 missing)", mutationMode => {
  const settings = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/settings.json"), "utf8"));
  let start = 0;
  const bins = {};
  settings.coordinates.sets.hg38.forEach(bin => {
    const length = bin.endPoint - bin.startPoint + 1;
    bins[bin.chromosome] = { ...bin, startPlace: start, endPlace: start + length };
    start += length;
  });
  const figure = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const mutations = parsePlotlyMutations(figure, bins);
  expect(mutations.stats).toMatchObject({ cells: 125, variants: 736, entries: 92000, missing: 1081 });
  const tree = parseNewick(fs.readFileSync(path.join(path.dirname(fixturePath), "BWH70_phylogeny_without_normal.newick"), "utf8"));
  const cnByCell = {};
  mutations.cellIds.forEach(id => {
    cnByCell[id] = normalizeCopyNumber(JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/data", id, "genome.json"), "utf8")), bins);
  });
  const source = { mutations, cellIds: mutations.cellIds, cnByCell, tree };
  const projected = prepareHeatmap(options({ data: source, gutterWidth: 240 }));
  // Every projected fixture row is checked against source numeric screen order;
  // removing mutation metadata must reproduce it from the complete Newick tree.
  const screenOrder = figure.layout.yaxis.tickvals.map((tick, i) => ({ tick, id: figure.layout.yaxis.ticktext[i] }))
    .sort((a, b) => b.tick - a.tick).map(({ id }) => id);
  expect(projected.rows.map(row => row.id)).toEqual(screenOrder);
  expect(projected.rows[0].id).toBe("BWH70_MR_1_pl1_10a");
  expect(projected.rows[124].id).toBe("BWH70_MR_3_pl1_11g");
  expect(prepareHeatmap(options({ data: { ...source, mutations: null } })).rows.map(row => row.id)).toEqual(screenOrder);
  projected.rows.forEach(row => {
    expect(mutations.cellIds[row.matrixRow]).toBe(row.id);
    expect(hitTestHeatmap(projected, 235, row.y).row.id).toBe(row.id);
    const tip = projected.tree.find(node => node.id === row.id);
    expect(projected.gutterWidth - tip.x - 9).toBeGreaterThanOrEqual(row.id.length * 6);
  });
  const originalValues = new Float64Array(mutations.values);
  const originalMissing = new Uint8Array(mutations.missing);
  const result = assertBenchmark(source, start, mutationMode, 3, true);
  result.frames.forEach(frame => expect(frame).toMatchObject({ visited: 92000, drawn: 92000, zeroDrawn: 58632, positiveDrawn: 32287, missingDrawn: 1081, cnDrawn: 15834, groupsDrawn: 0 }));
  expect(mutations.values).toEqual(originalValues);
  expect(mutations.missing).toEqual(originalMissing);
  expect(prepareHeatmap(options({ data: source })).data).toBe(source);
});

test("neutral circle pluses never add numeric text even for coincident groups; exact values and row maps survive", () => {
  const source = data();
  source.mutations.variants.forEach(v => { v.place = 20; });
  const scene = prepareHeatmap(options({ data: source }));
  const ctx = context();
  const groups = scene.windows[0].groups;
  drawHeatmap(ctx, scene, { height: 200 });
  expect(ctx.fillText.mock.calls.map(call => call[0]).sort()).toEqual(["a", "b", "c"]);
  expect(ctx.circles).toHaveLength(3);
  expect(assertPlusPaths(ctx)).toHaveLength(1);
  expect(ctx.circles.every(circle => circle.color === "#ffffff")).toBe(true);
  expect(scene.windows[0].groups).toBe(groups);
  expect(scene.matrixRows.get("a")).toBe(1);
  expect(scene.data).toBe(source);
  expect(source.mutations.values[3]).toBe(0.125);
});

test("axis uses the exact shared genomic windows, clips at each inset and reuses D3 ticks", () => {
  const scene = prepareHeatmap(options({ domains: [[0, 30], [70, 100]] }));
  const ctx = context();
  drawHeatmapAxis(ctx, scene, { "1": { chromosome: "1", startPlace: 0, endPlace: 100 } });
  expect(ctx.clip).toHaveBeenCalledTimes(2);
  expect(ctx.fillText).toHaveBeenCalledWith("1", 186, 7);
  expect(ctx.fillText).toHaveBeenCalledWith("1", 394, 7);
  expect(ctx.save).toHaveBeenCalledTimes(2);
  expect(ctx.restore).toHaveBeenCalledTimes(2);
});

test("benchmark repeats complete frames even when live view is hidden, filtered, narrow or zoomed", () => {
  const source = data();
  const ctx = context();
  const canvas = { width: 40, height: 50, getContext: () => ctx };
  const restore = jest.fn();
  const result = benchmarkFullMatrix(canvas, options({ data: source, width: 40, mutationMode: "hidden", selectedRowsOnly: true, nodes: [], domains: [[49, 51]], genomeLength: 100, restore }), 3);
  expect(result).toMatchObject({ drawn: 9, visited: 9, iterations: 3, totalVisited: 27, totalDrawn: 27, aggregate: false, culling: false, domains: [[0, 100]] });
  expect(result.frames.every(frame => frame.rowsDrawn === 3 && frame.drawn === 9)).toBe(true);
  expect(ctx.circles).toHaveLength(27);
  expect([canvas.width, canvas.height]).toEqual([40, 50]);
  expect(restore).toHaveBeenCalledTimes(1);
  expect(() => benchmarkFullMatrix(canvas, options(), 0)).toThrow(/positive integer/);
});

// benchmarkFullMatrix: canvas + options + iterations -> full-frame counts/timings.
// Template: preserve dimensions/snapshot; prepare each complete projection; draw;
// if getImageData exists, flush the entire canvas before the next frame; finally restore.
// A controlled clock charges preparation (including frame 0), submission and readback
// separately. No readback is supported but must never imply raster/presentation timing.
test.each([false, true])("benchmark timing includes every preparation and flush, reports submission separately (readback=%s)", readback => {
  let now = 0;
  const timer = jest.spyOn(performance, "now").mockImplementation(() => now);
  try {
    const events = [];
    const source = data();
    const cellIds = source.cellIds;
    Object.defineProperty(source, "cellIds", { get: () => { events.push("prepare"); now += 3; return cellIds; } });
    const ctx = context();
    ctx.clearRect.mockImplementation(() => { events.push("draw"); now += 5; });
    const canvas = { width: 600, height: 200, getContext: () => ctx };
    if (readback) ctx.getImageData = jest.fn((...args) => {
      events.push("readback");
      expect(args).toEqual([0, 0, canvas.width, canvas.height]);
      expect(args).toEqual([0, 0, 600, 96]);
      expect(ctx.arcCount).toBe(9 * ctx.getImageData.mock.calls.length);
      now += 7;
      return { data: new Uint8Array(4) };
    });
    const restore = jest.fn(() => { events.push("restore"); now += 100; });
    const result = benchmarkFullMatrix(canvas, options({ data: source, restore }), 3);
    expect(events).toEqual([...Array.from({ length: 3 }, () => readback ? ["prepare", "draw", "readback"] : ["prepare", "draw"]).flat(), "restore"]);
    expect(result).toMatchObject({ readback, meanMs: readback ? 15 : 8, minMs: readback ? 15 : 8, maxMs: readback ? 15 : 8 });
    expect(result.frames.map(frame => ({ ms: frame.ms, submissionMs: frame.submissionMs }))).toEqual(Array(3).fill({ ms: readback ? 15 : 8, submissionMs: 5 }));
    expect(result.timing).toContain(readback ? "full-canvas raster/readback" : "rasterization not forced (readback unavailable)");
    expect(result.timing).toContain("not end-to-end frame latency");
    expect(result.timing).toContain("excludes canvas setup, restoration and presentation");
    if (readback) expect(ctx.getImageData).toHaveBeenCalledTimes(3);
    expect([canvas.width, canvas.height]).toEqual([600, 200]);
    expect(restore).toHaveBeenCalledTimes(1);
  } finally { timer.mockRestore(); }
});

test("public benchmark reads every complete frame and restores the original pixel snapshot, not a benchmark frame", () => {
  const ctx = context();
  const snapshot = { data: new Uint8Array([1, 2, 3, 4]) };
  const benchmarkImage = { data: new Uint8Array(4) };
  ctx.getImageData = jest.fn().mockReturnValue(benchmarkImage).mockReturnValueOnce(snapshot);
  ctx.putImageData = jest.fn();
  const canvas = { width: 600, height: 200, getContext: () => ctx };
  const result = benchmarkFullMatrix(canvas, options(), 3);
  expect(result.readback).toBe(true);
  expect(ctx.getImageData.mock.calls).toEqual([[0, 0, 600, 200], ...Array(3).fill([0, 0, 600, 96])]);
  expect(ctx.putImageData).toHaveBeenCalledTimes(1);
  expect(ctx.putImageData).toHaveBeenCalledWith(snapshot, 0, 0);
  expect([canvas.width, canvas.height]).toEqual([600, 200]);
});

test.each([false, true])("benchmark restores dimensions and live view/snapshot after readback failure (callback=%s)", callback => {
  const ctx = context();
  const snapshot = { data: new Uint8Array(4) };
  ctx.getImageData = jest.fn(() => { throw new Error("readback failed"); });
  if (!callback) ctx.getImageData.mockReturnValueOnce(snapshot);
  ctx.putImageData = jest.fn();
  const canvas = { width: 600, height: 200, getContext: () => ctx };
  const restore = callback ? jest.fn() : undefined;
  expect(() => benchmarkFullMatrix(canvas, options({ restore }), 3)).toThrow("readback failed");
  expect([canvas.width, canvas.height]).toEqual([600, 200]);
  expect(ctx.clearRect).toHaveBeenCalledTimes(1);
  if (callback) {
    expect(restore).toHaveBeenCalledTimes(1);
    expect(ctx.putImageData).not.toHaveBeenCalled();
  } else expect(ctx.putImageData).toHaveBeenCalledWith(snapshot, 0, 0);
});
