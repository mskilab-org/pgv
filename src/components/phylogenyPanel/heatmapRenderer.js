import { scaleLinear } from "d3";
import { leafIds } from "../../helpers/phylogeny/data";
import { layoutDomains, groupMutations } from "../../helpers/phylogeny/layout";

export { layoutDomains, groupMutations } from "../../helpers/phylogeny/layout";

const clock = () => typeof performance === "undefined" ? Date.now() : performance.now();
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
// Original Plotly CN palette: 0–10 and 11+. Shared with the component legend.
export const CN_COLORS = ["#168CCB", "#8FD3E8", "#FFFFFF", "#FDBF6F", "#FF8A3D", "#FF5A24", "#EF2B2D", "#D7193F", "#B2184B", "#8C1D40", "#5A2630", "#000000"];
// Allelic channels use CN 1 as their neutral white baseline. The remainder
// keeps the established loss/gain progression without changing Total CN.
export const ALLELIC_CN_COLORS = [CN_COLORS[0], CN_COLORS[2], CN_COLORS[3], CN_COLORS[4], CN_COLORS[5], CN_COLORS[6], CN_COLORS[7], CN_COLORS[8], CN_COLORS[9], CN_COLORS[10], CN_COLORS[11], CN_COLORS[11]];

// Continuous white-to-black interpolation at Canvas RGB precision, not VAF bins.
// Missing stays a distinct crossed gray; source values retain full precision.
export function vafColor(value) {
  if (value == null || !Number.isFinite(value)) return "#adb5bd";
  const channel = Math.round(255 * (1 - clamp(value, 0, 1))).toString(16).padStart(2, "0");
  return `#${channel}${channel}${channel}`;
}
// Read counts are strongly right-skewed. A zero-safe logarithmic COLOR scale
// preserves the full domain without clipping outliers or changing observations.
const countFraction = (value, maximum) => maximum > 0 ? Math.log1p(clamp(value, 0, maximum)) / Math.log1p(maximum) : 0;
export function countColor(value, maximum = 1) {
  if (value == null || !Number.isFinite(value)) return "#adb5bd";
  const ratio = countFraction(value, maximum);
  const red = Math.round(255 * ratio).toString(16).padStart(2, "0");
  const blue = Math.round(255 * (1 - ratio)).toString(16).padStart(2, "0");
  return `#${red}80${blue}`;
}
// Adapters return immutable count arrays. Cache the full-cohort domain so
// scrolling/hover never rescans a million entries or changes a count's color.
const countScales = new WeakMap();
export function mutationCountScale(matrix, metric) {
  const counts = matrix && matrix[metric === "ref" ? "refCounts" : "altCounts"];
  if (counts && countScales.has(counts)) return countScales.get(counts);
  let maximum = 1;
  if (counts) for (const value of counts) if (Number.isFinite(value)) maximum = Math.max(maximum, value);
  const values = [...new Set([0, 1 / 3, 2 / 3, 1].map(fraction => fraction === 1 ? maximum : Math.round(Math.expm1(Math.log1p(maximum) * fraction))))];
  const scale = { maximum, ticks: values.map(value => ({ value, position: countFraction(value, maximum) })) };
  if (counts) countScales.set(counts, scale);
  return scale;
}
export function cnColor(value, mode = "total") {
  if (value == null || !Number.isFinite(value)) return "#eeeeee";
  const colors = mode === "total" ? CN_COLORS : ALLELIC_CN_COLORS;
  return colors[clamp(Math.floor(value), 0, 11)];
}

// Shared by drawing and tooltips: missingness, not numeric truthiness, is authoritative.
function mutationValue(matrix, row, column) {
  const index = row * matrix.variants.length + column;
  return (matrix.missing && matrix.missing[index]) || !Number.isFinite(matrix.values[index]) ? null : matrix.values[index];
}

function mutationMetricValue(matrix, row, column, metric) {
  const index = row * matrix.variants.length + column;
  if (metric === "ref" || metric === "alt") {
    const counts = metric === "ref" ? matrix.refCounts : matrix.altCounts;
    return counts && Number.isFinite(counts[index]) ? counts[index] : matrix.format === "plotly" ? null : 0;
  }
  const value = mutationValue(matrix, row, column);
  return value == null && matrix.format !== "plotly" ? 0 : value;
}

function intervalValue(interval, mode) {
  if (mode === "major") return interval.majorCn;
  if (mode === "minor") return interval.minorCn;
  return interval.cn;
}

// Full 92,000-position browser readback measurements favor 16-circle paths
// over sprites or larger paths. Bound tessellation without sampling any entry.
const CIRCLES_PER_PATH = 16;
const mutationRadius = rowHeight => Math.min(2.85, rowHeight / 4);

// Clip only the display extent, not group membership or the tooltip/zoom bounds.
// Painting and hit testing must use the same visible midpoint in each window.
function groupCenterX(window, group) {
  return window.x + (clamp(group.x1, 0, window.width) + clamp(group.x2, 0, window.width)) / 2;
}

function drawMutationCircles(ctx, batches, radius, plus = false) {
  if (!batches.size) return;
  const lineWidth = Math.min(0.7, radius / 2);
  const arcRadius = radius - lineWidth / 2;
  const cross = arcRadius * 0.55;
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#555555";
  ctx.lineWidth = lineWidth;
  for (const [color, centers] of batches) {
    ctx.fillStyle = color;
    for (let start = 0; start < centers.length; start += CIRCLES_PER_PATH) {
      const end = Math.min(start + CIRCLES_PER_PATH, centers.length);
      ctx.beginPath();
      for (let i = start; i < end; i++) {
        const [x, y] = centers[i];
        // Separate subpaths prevent connecting strokes between circles.
        ctx.moveTo(x + arcRadius, y);
        ctx.arc(x, y, arcRadius, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.stroke();
      // Aggregate pluses and missing diagonal crosses both stay inside the
      // circles and in bounded chunks; plain white singletons still mean zero.
      if (plus || color === vafColor(null)) {
        ctx.beginPath();
        for (let i = start; i < end; i++) {
          const [x, y] = centers[i];
          if (plus) {
            ctx.moveTo(x - cross, y); ctx.lineTo(x + cross, y);
            ctx.moveTo(x, y - cross); ctx.lineTo(x, y + cross);
          } else {
            ctx.moveTo(x - cross, y - cross); ctx.lineTo(x + cross, y + cross);
            ctx.moveTo(x + cross, y - cross); ctx.lineTo(x - cross, y + cross);
          }
        }
        ctx.stroke();
      }
    }
  }
}

/** Preserve the source matrix and ID map; only the row/window projection changes. */
export function prepareHeatmap(options) {
  const { data, width, gutterWidth = 240, domains = [], nodes = [], selectedRowsOnly = false, aggregate = true } = options;
  const mutationMode = ["hidden", "overlay", "paired", "side"].includes(options.mutationMode) ? options.mutationMode : "hidden";
  const cnMode = ["total", "major", "minor"].includes(options.cnMode) ? options.cnMode : "total";
  const mutationMetric = ["vaf", "ref", "alt"].includes(options.mutationMetric) ? options.mutationMetric : "vaf";
  const rowHeight = Number.isFinite(options.rowHeight) && options.rowHeight > 0 ? options.rowHeight : mutationMode === "paired" ? 32 : 22;
  const cellIds = data.cellIds || [];
  const cells = new Set(cellIds);
  const selected = new Set(nodes.filter(n => n.selected).map(n => n.id));
  // The source Plotly axis owns screen order. Without numeric metadata the
  // native tree follows its original bottom-to-top traversal, reversed here.
  const traversal = data.tree ? leafIds(data.tree).reverse() : [];
  const display = data.mutations && data.mutations.displayCellIds;
  const order = [...new Set([...(Array.isArray(display) ? display : []), ...traversal, ...cellIds])].filter(id => cells.has(id));
  const matrixRows = new Map((data.mutations ? data.mutations.cellIds : []).map((id, index) => [id, index]));
  const sideMatrix = options.matrixKind === "junctions" ? data.junctions : data.mutations;
  const sideMatrixRows = new Map((sideMatrix ? sideMatrix.cellIds : []).map((id, index) => [id, index]));
  const rows = order.filter(id => !selectedRowsOnly || selected.has(id)).map((id, index) => ({
    id, index, y: (index + 0.5) * rowHeight, matrixRow: matrixRows.has(id) ? matrixRows.get(id) : -1,
  }));
  const rowById = new Map(rows.map(row => [row.id, row]));
  const tree = [];
  if (gutterWidth > 0 && data.tree) {
    let maxDistance = 0;
    let maxDepth = 0;
    const collect = (node, distance, depth) => {
      maxDistance = Math.max(maxDistance, distance);
      maxDepth = Math.max(maxDepth, depth);
      const children = (node.children || []).map(child => collect(child, distance + Math.max(0, child.length || 0), depth + 1));
      const descendants = children.length ? children.flatMap(child => child.descendants) : cells.has(node.id) ? [node.id] : [];
      const visible = descendants.filter(id => rowById.has(id));
      const geometry = { id: node.id, name: node.name, distance, depth, children, descendants, hiddenCount: descendants.length - visible.length };
      geometry.y = visible.length ? visible.reduce((sum, id) => sum + rowById.get(id).y, 0) / visible.length : null;
      return geometry;
    };
    const root = collect(data.tree, 0, 0);
    // Reserve enough width for complete cell IDs at the 10px label font. Long
    // branches must not consume the label gutter; narrow gutters use maxWidth.
    const labelWidth = Math.max(100, ...rows.map(row => row.id.length * 6 + 12));
    const span = Math.max(0, gutterWidth - labelWidth - 12);
    const place = (node, parent) => {
      if (node.y == null) return;
      node.x = 8 + span * (maxDistance > 0 ? node.distance / maxDistance : node.depth / (maxDepth || 1));
      node.parent = parent;
      tree.push(node);
      node.children.forEach(child => place(child, node));
    };
    place(root, null);
  }
  const windows = layoutDomains(domains, width, gutterWidth).map(window => ({
    ...window,
    groups: data.mutations && ["overlay", "paired"].includes(mutationMode) ? groupMutations(data.mutations.variants, window.domain, window.width, 6, aggregate) : [],
  }));
  return { data, width, gutterWidth, domains, chromoBins: options.chromoBins || {}, mutationMode, cnMode, mutationMetric, rows, rowHeight, totalHeight: rows.length * rowHeight,
    hiddenCount: cellIds.length - rows.length, tree, windows, matrixRows, rowById, aggregate, sideMatrix, sideMatrixRows };
}

/** Paint one viewport. The benchmark calls this same path with culling disabled. */
export function drawHeatmap(ctx, scene, view = {}) {
  const started = clock();
  const height = view.height == null ? scene.totalHeight : view.height;
  const scrollTop = view.scrollTop || 0;
  const first = view.cull === false ? 0 : clamp(Math.floor(scrollTop / scene.rowHeight), 0, scene.rows.length);
  const last = view.cull === false ? scene.rows.length : clamp(Math.ceil((scrollTop + height) / scene.rowHeight), first, scene.rows.length);
  const frame = { visited: 0, drawn: 0, positiveDrawn: 0, zeroDrawn: 0, missingDrawn: 0, groupsDrawn: 0, cnDrawn: 0, rowsDrawn: last - first, ms: 0 };
  const selected = new Set((view.nodes || []).filter(n => n.selected).map(n => n.id));
  const highlighted = new Set(view.highlightedNodes || []);
  ctx.clearRect(0, 0, scene.width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, scene.width, height);
  ctx.save();
  try {
    ctx.beginPath();
    ctx.rect(0, 0, scene.width, height);
    ctx.clip();
    ctx.font = "10px sans-serif";
    ctx.textBaseline = "middle";
    for (let r = first; r < last; r++) {
      const top = r * scene.rowHeight - scrollTop;
      ctx.fillStyle = r % 2 ? "#fafafa" : "#ffffff";
      ctx.fillRect(0, top, scene.width, scene.rowHeight);
    }
    for (const window of scene.windows) {
      ctx.save();
      try {
        ctx.beginPath();
        ctx.rect(window.x, 0, window.width, height);
        ctx.clip();
        const mutationBatches = new Map();
        const cnBatches = new Map();
        const addToBatch = (batches, color, geometry) => {
          if (!batches.has(color)) batches.set(color, []);
          batches.get(color).push(geometry);
        };
        const groupBatches = new Map();
        for (let r = first; r < last; r++) {
          const row = scene.rows[r];
          const top = r * scene.rowHeight - scrollTop;
          const cnHeight = scene.mutationMode === "paired" ? scene.rowHeight / 2 : scene.rowHeight;
          addToBatch(cnBatches, cnColor(null), [window.x, top, window.width, cnHeight]);
          const intervals = (scene.data.cnByCell || {})[row.id] || [];
          for (const interval of intervals) {
            if (interval.start > window.domain[1]) break;
            if (interval.end < window.domain[0]) continue;
            const left = window.x + window.scale(Math.max(interval.start, window.domain[0]));
            const right = window.x + window.scale(Math.min(interval.end, window.domain[1]));
            addToBatch(cnBatches, cnColor(intervalValue(interval, scene.cnMode), scene.cnMode), [left, top, Math.max(0.5, right - left), cnHeight]);
            frame.cnDrawn++;
          }
          if (scene.mutationMode === "hidden" || scene.mutationMode === "side" || row.matrixRow < 0 || !scene.data.mutations) continue;
          const centerY = top + scene.rowHeight * (scene.mutationMode === "paired" ? 0.75 : 0.5);
          for (const group of window.groups) {
            frame.visited += group.indices.length;
            if (group.indices.length > 1) {
              addToBatch(groupBatches, "#ffffff", [groupCenterX(window, group), centerY]);
              frame.groupsDrawn++;
              continue;
            }
            const value = mutationValue(scene.data.mutations, row.matrixRow, group.indices[0]);
            addToBatch(mutationBatches, vafColor(value), [window.x + group.x1, centerY]);
            frame.drawn++;
            if (value == null) frame.missingDrawn++;
            else if (value === 0) frame.zeroDrawn++;
            else frame.positiveDrawn++;
          }
        }
        // CN remains color-batched rectangles; VAF uses bounded circle paths.
        for (const [color, rectangles] of cnBatches) {
          ctx.fillStyle = color;
          rectangles.forEach(rect => ctx.fillRect(...rect));
        }
        // Outer diameter stays below the existing 6px grouping/hit footprint;
        // thin fit rows also keep the outline inside the paired mutation lane.
        const radius = mutationRadius(scene.rowHeight);
        drawMutationCircles(ctx, mutationBatches, radius);
        drawMutationCircles(ctx, groupBatches, radius, true);
      } finally { ctx.restore(); }
    }
    // Separators follow chromosome boundaries, not CN segmentation or mutation
    // columns, and therefore remain stable while a genomic window is panned.
    ctx.save();
    try {
      for (const window of scene.windows) {
        for (const bin of Object.values(scene.chromoBins || {})) {
          if (!Number.isFinite(bin.startPlace) || bin.startPlace <= window.domain[0] || bin.startPlace >= window.domain[1]) continue;
          const x = window.x + window.scale(bin.startPlace);
          ctx.strokeStyle = "#555555"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
        }
      }
    } finally { ctx.restore(); }
    if (scene.gutterWidth > 0) {
      ctx.save();
      try {
        ctx.beginPath(); ctx.rect(0, 0, scene.gutterWidth, height); ctx.clip();
        ctx.strokeStyle = "#777777"; ctx.lineWidth = 1;
        for (const node of scene.tree) {
          const children = node.children.filter(child => child.y != null);
          const hovered = view.hover && view.hover.nodeId === node.id;
          ctx.strokeStyle = hovered ? "#1677ff" : "#777777";
          ctx.lineWidth = hovered ? 2 : 1;
          ctx.beginPath();
          if (children.length) {
            ctx.moveTo(node.x, Math.min(...children.map(child => child.y)) - scrollTop);
            ctx.lineTo(node.x, Math.max(...children.map(child => child.y)) - scrollTop);
          }
          if (node.parent) { ctx.moveTo(node.parent.x, node.y - scrollTop); ctx.lineTo(node.x, node.y - scrollTop); }
          ctx.stroke();
          if (node.y < scrollTop || node.y >= scrollTop + height) continue;
          ctx.fillStyle = hovered || selected.has(node.id) ? "#1677ff" : "#444444";
          ctx.fillRect(node.x - 2, node.y - scrollTop - 2, 4, 4);
          if (hovered) ctx.strokeRect(node.x - 5, node.y - scrollTop - 5, 10, 10);
          // Filtering can collapse many ancestors onto one row. Counts remain
          // in geometry/tooltips/footer, never overlapping inline annotations.
          if (scene.rowHeight >= 12 && !node.children.length && scene.gutterWidth > node.x + 9) {
            ctx.fillText(node.id, node.x + 5, node.y - scrollTop, scene.gutterWidth - node.x - 9);
          }
        }
      } finally { ctx.restore(); }
    }
    if (view.hover && view.hover.windowIndex != null) {
      const window = scene.windows.find(w => w.index === view.hover.windowIndex);
      if (window) {
        ctx.strokeStyle = "#666666"; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(view.hover.x, 0); ctx.lineTo(view.hover.x, height); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    if (view.brush) {
      ctx.fillStyle = "rgba(22,119,255,0.16)";
      ctx.fillRect(Math.min(view.brush.x1, view.brush.x2), 0, Math.abs(view.brush.x2 - view.brush.x1), height);
    }
    // Draw last, across both gutter and genomic windows, without recoloring CN
    // or VAF. Hover is view-only and never changes selection or the source data.
    ctx.strokeStyle = "#1677ff"; ctx.lineWidth = 1;
    const inset = Math.min(0.5, scene.rowHeight / 4);
    for (let r = first; r < last; r++) {
      const id = scene.rows[r].id;
      if (selected.has(id) || highlighted.has(id) || (view.hover && view.hover.rowId === id)) {
        ctx.strokeRect(inset, r * scene.rowHeight - scrollTop + inset, Math.max(0, scene.width - 2 * inset), scene.rowHeight - 2 * inset);
      }
    }
  } finally { ctx.restore(); }
  frame.ms = clock() - started;
  return frame;
}

/** Shared right-hand matrix renderer for mutations and junction CN. Only the
 * visible columns are rasterized; catalog order and all source values remain intact. */
export function drawMutationHeatmap(ctx, scene, view = {}, columnWidth = 4) {
  const matrix = scene.sideMatrix;
  const width = view.width == null ? Math.max(1, matrix ? matrix.variants.length * columnWidth : 1) : view.width;
  const scrollLeft = view.scrollLeft || 0;
  const height = view.height == null ? scene.totalHeight : view.height;
  const scrollTop = view.scrollTop || 0;
  const first = view.cull === false ? 0 : clamp(Math.floor(scrollTop / scene.rowHeight), 0, scene.rows.length);
  const last = view.cull === false ? scene.rows.length : clamp(Math.ceil((scrollTop + height) / scene.rowHeight), first, scene.rows.length);
  const junctions = matrix && matrix.format === "junction";
  const metric = junctions ? "jcn" : scene.mutationMetric || "vaf";
  const isCount = metric === "ref" || metric === "alt";
  const max = isCount ? mutationCountScale(matrix, metric).maximum : 1;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, width, height);
  if (!matrix) return { rowsDrawn: 0, columns: 0, cellsDrawn: 0, metric };
  const firstColumn = Math.max(0, Math.floor(scrollLeft / columnWidth));
  const lastColumn = Math.min(matrix.variants.length, Math.ceil((scrollLeft + width) / columnWidth));
  const selected = new Set((view.nodes || []).filter(node => node.selected).map(node => node.id));
  for (let r = first; r < last; r++) {
    const row = scene.rows[r];
    const top = r * scene.rowHeight - scrollTop;
    const rowIndex = scene.sideMatrixRows.get(row.id);
    for (let column = firstColumn; column < lastColumn; column++) {
      const value = rowIndex == null ? (junctions || matrix.format === "plotly" ? null : 0) : junctions ? mutationValue(matrix, rowIndex, column) : mutationMetricValue(matrix, rowIndex, column, metric);
      ctx.fillStyle = junctions ? cnColor(value) : metric === "vaf" ? vafColor(value) : countColor(value, max);
      ctx.fillRect(column * columnWidth - scrollLeft, top, Math.max(1, columnWidth), scene.rowHeight);
    }
    if (selected.has(row.id) || (view.hover && view.hover.rowId === row.id)) {
      ctx.strokeStyle = "#1677ff"; ctx.lineWidth = 1;
      ctx.strokeRect(0.5, top + 0.5, width - 1, Math.max(0, scene.rowHeight - 1));
    }
  }
  return { rowsDrawn: last - first, columns: matrix.variants.length, firstColumn, columnsDrawn: lastColumn - firstColumn,
    cellsDrawn: (last - first) * (lastColumn - firstColumn), metric, maximum: max, scale: isCount ? "log1p" : junctions ? "categorical" : "linear" };
}

export function hitTestMutationHeatmap(scene, x, y, scrollTop = 0, columnWidth = 4) {
  const matrix = scene.sideMatrix;
  const absoluteY = y + scrollTop;
  if (!matrix || x < 0 || y < 0 || absoluteY < 0 || absoluteY >= scene.totalHeight) return null;
  const row = scene.rows[Math.floor(absoluteY / scene.rowHeight)];
  if (!row) return null;
  const column = Math.floor(x / columnWidth);
  if (column < 0 || column >= matrix.variants.length) return null;
  return { type: "sideMutation", row, column, ids: [row.id] };
}

export function hitTestHeatmap(scene, x, y, scrollTop = 0) {
  const absoluteY = y + scrollTop;
  if (y < 0 || absoluteY < 0 || absoluteY >= scene.totalHeight) return null;
  const row = scene.rows[Math.floor(absoluteY / scene.rowHeight)];
  if (x >= 0 && x < scene.gutterWidth) {
    // Nodes and branches win over labels, including trunk context in a row filter.
    for (const node of scene.tree) {
      const children = node.children.filter(child => child.y != null);
      const nearNode = Math.abs(x - node.x) <= 5 && Math.abs(absoluteY - node.y) <= 5;
      const horizontal = node.parent && x >= node.parent.x && x <= node.x && Math.abs(absoluteY - node.y) <= 4;
      const vertical = children.length && Math.abs(x - node.x) <= 4 && absoluteY >= Math.min(...children.map(c => c.y)) && absoluteY <= Math.max(...children.map(c => c.y));
      if (nearNode || horizontal || vertical) return { type: node.descendants.length > 1 ? "branch" : "row", row, node, ids: node.descendants };
    }
    return { type: "row", row, ids: [row.id] };
  }
  const window = scene.windows.find(w => x >= w.x && x <= w.x + w.width);
  if (!window) return null;
  const place = window.invert(x - window.x);
  const hit = { type: "cn", row, ids: [row.id], place, windowIndex: window.index };
  const laneY = absoluteY - row.index * scene.rowHeight;
  const center = scene.rowHeight * (scene.mutationMode === "paired" ? 0.75 : 0.5);
  if (scene.mutationMode !== "hidden" && row.matrixRow >= 0 && Math.abs(laneY - center) <= Math.min(6, scene.rowHeight / 4)) {
    const group = window.groups.find(g => g.indices.length > 1
      ? Math.hypot(x - groupCenterX(window, g), laneY - center) <= mutationRadius(scene.rowHeight)
      : x >= window.x + g.x1 - 3 && x <= window.x + g.x2 + 3);
    if (group) return { ...hit, type: group.indices.length > 1 ? "group" : "mutation", group };
  }
  return hit;
}

export function selectionNodes(scene, ids, nodes = [], additive = false) {
  const selected = new Set(additive ? nodes.filter(n => n.selected).map(n => n.id) : []);
  const remove = additive && ids.length > 0 && ids.every(id => selected.has(id));
  ids.forEach(id => remove ? selected.delete(id) : selected.add(id));
  return (scene.data.cellIds || []).map(id => ({ id, selected: selected.has(id) }));
}

export function describeHit(scene, hit) {
  if (!hit) return [];
  if (hit.type === "sideMutation") {
    const matrix = scene.sideMatrix;
    const variant = matrix.variants[hit.column];
    const row = scene.sideMatrixRows.get(hit.row.id);
    if (matrix.format === "junction") {
      const value = row == null ? null : mutationValue(matrix, row, hit.column);
      return [`Cell: ${hit.row.id}`, `Junction: ${variant.id}`, `Junction CN: ${value == null ? "missing" : value}`];
    }
    const display = metric => {
      const value = row == null ? matrix.format === "plotly" ? null : 0 : mutationMetricValue(matrix, row, hit.column, metric);
      return value == null ? "missing" : value;
    };
    return [`Cell: ${hit.row.id}`, `Site: ${variant.id}`, `${variant.chromosome}:${variant.position} ${variant.ref} → ${variant.alt}`,
      `VAF: ${display("vaf")}`, `ref count: ${display("ref")}`, `alt count: ${display("alt")}`];
  }
  if (hit.type === "branch") return [`Branch: ${hit.node.name || hit.node.id}`, `${hit.ids.length} cells (${hit.node.hiddenCount} hidden)`, "Click to select descendants; no tracks opened"];
  const lines = [`Cell: ${hit.row.id}`];
  const intervals = (scene.data.cnByCell || {})[hit.row.id] || [];
  const place = hit.type === "mutation" ? scene.data.mutations.variants[hit.group.indices[0]].place : hit.place;
  const interval = intervals.find(cn => cn.start <= place && cn.end >= place);
  if (hit.type === "mutation") {
    const column = hit.group.indices[0];
    const variant = scene.data.mutations.variants[column];
    const value = mutationValue(scene.data.mutations, hit.row.matrixRow, column);
    const ref = mutationMetricValue(scene.data.mutations, hit.row.matrixRow, column, "ref");
    const alt = mutationMetricValue(scene.data.mutations, hit.row.matrixRow, column, "alt");
    lines.push(`Site: ${variant.id}`, `${variant.chromosome}:${variant.position} ${variant.ref} → ${variant.alt}`, `VAF: ${value == null || !Number.isFinite(value) ? "missing" : String(value)}`, `ref count: ${ref == null ? "missing" : ref}`, `alt count: ${alt == null ? "missing" : alt}`);
  } else if (hit.type === "group") {
    let positive = 0; let zero = 0; let missing = 0;
    const matrix = scene.data.mutations;
    hit.group.indices.forEach(column => {
      const value = mutationValue(matrix, hit.row.matrixRow, column);
      if (value == null) missing++;
      else if (value === 0) zero++;
      else positive++;
    });
    const first = matrix.variants[hit.group.indices[0]];
    const last = matrix.variants[hit.group.indices[hit.group.indices.length - 1]];
    lines.push(`${hit.group.indices.length} sites: ${positive} positive, ${zero} zero, ${missing} missing`, `${first.chromosome}:${first.position}–${last.position}`, "Display overlap group — no mean VAF", "Click to zoom to these sites");
  }
  const cnMode = scene.cnMode || "total";
  const cnLabel = cnMode === "major" ? "Major CN" : cnMode === "minor" ? "Minor CN" : "CN";
  const cn = interval && intervalValue(interval, cnMode);
  lines.push(`${cnLabel}: ${cn == null || !Number.isFinite(cn) ? "missing" : String(cn)}`);
  if (interval) lines.push(`${interval.chromosome}:${interval.startPoint == null ? interval.start : interval.startPoint}–${interval.endPoint == null ? interval.end : interval.endPoint}`);
  return lines;
}

/** Clamp one domain without changing the order or values of its neighbors. */
export function changeDomain(scene, index, range, genomeLength) {
  const result = scene.domains.map(domain => domain.slice());
  if (!result[index] || !range || !range.every(Number.isFinite)) return result;
  const original = result[index];
  // PGV location URLs start at place 1; place 0 cannot round-trip through
  // domainsToLocation and previously produced an incomplete location on reset.
  let low = 1;
  let high = Number.isFinite(genomeLength) && genomeLength > 0 ? genomeLength : Math.max(...result.map(d => d[1]), ...range);
  result.forEach((domain, i) => {
    if (i === index) return;
    if (domain[1] <= original[0]) low = Math.max(low, domain[1]);
    if (domain[0] >= original[1]) high = Math.min(high, domain[0]);
  });
  if (high <= low) return result;
  const span = Math.min(high - low, Math.max(Math.min(1, high - low), Math.abs(range[1] - range[0])));
  const start = clamp(Math.min(...range), low, high - span);
  result[index] = [start, start + span];
  return result;
}

/** Small axis using the same D3 local scales as the canvas and legacy Grid. */
export function drawHeatmapAxis(ctx, scene, chromoBins = {}, height = 36) {
  ctx.clearRect(0, 0, scene.width, height);
  ctx.font = "10px sans-serif"; ctx.textBaseline = "middle";
  const bins = Object.values(chromoBins);
  for (const window of scene.windows) {
    ctx.save();
    try {
      ctx.beginPath(); ctx.rect(window.x, 0, window.width, height); ctx.clip();
      const visible = bins.filter(bin => bin.endPlace >= window.domain[0] && bin.startPlace <= window.domain[1]);
      const segments = visible.length ? visible : [{ startPlace: window.domain[0], endPlace: window.domain[1], chromosome: "Genome", startPoint: window.domain[0] }];
      for (const bin of segments) {
        const start = Math.max(window.domain[0], bin.startPlace);
        const end = Math.min(window.domain[1], bin.endPlace);
        const left = window.x + window.scale(start);
        const right = window.x + window.scale(end);
        ctx.strokeStyle = bin.color || "#999999"; ctx.fillStyle = "#555555";
        ctx.beginPath(); ctx.moveTo(left, 17); ctx.lineTo(right, 17); ctx.stroke();
        if (right - left > 14) ctx.fillText(String(bin.chromosome), left + 2, 7);
        const scale = scaleLinear().domain([start - bin.startPlace + (bin.startPoint || 0), end - bin.startPlace + (bin.startPoint || 0)]).range([left, right]);
        const count = Math.max(1, Math.floor((right - left) / 75));
        const format = scale.tickFormat(count, "~s");
        scale.ticks(count).forEach(tick => {
          const x = scale(tick);
          ctx.beginPath(); ctx.moveTo(x, 17); ctx.lineTo(x, 21); ctx.stroke(); ctx.fillText(format(tick), x + 2, 28);
        });
      }
    } finally { ctx.restore(); }
  }
}

/** Actual full-source drawing, including zero/missing; restore even on context failure. */
export function benchmarkFullMatrix(canvas, options, iterations = 12) {
  if (!Number.isInteger(iterations) || iterations < 1) throw new Error("Benchmark iterations must be a positive integer");
  const matrix = options.data.mutations;
  const places = matrix ? matrix.variants.map(v => v.place) : [];
  const low = Math.min(0, ...places);
  const high = Math.max(1, options.genomeLength || 0, ...places);
  const preparationStarted = clock();
  const scene = prepareHeatmap({ ...options, width: Math.max(options.width || 600, (options.gutterWidth == null ? 240 : options.gutterWidth) + 49), domains: [[low, high]], selectedRowsOnly: false, aggregate: false, mutationMode: options.mutationMode === "overlay" ? "overlay" : "paired", rowHeight: 32 });
  const initialPreparationMs = clock() - preparationStarted;
  const original = { width: canvas.width, height: canvas.height };
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas2D is unavailable");
  const frames = [];
  const readback = typeof ctx.getImageData === "function";
  // Snapshot fallback makes the exported utility safe without a mounted component.
  const image = !options.restore && readback ? ctx.getImageData(0, 0, canvas.width, canvas.height) : null;
  try {
    canvas.width = Math.max(1, Math.ceil(scene.width));
    canvas.height = Math.max(1, Math.ceil(scene.totalHeight));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (let iteration = 0; iteration < iterations; iteration++) {
      // Vary the projection without excluding any site: repeated identical
      // coordinates can hide cold tessellation/cache costs in browser engines.
      const started = clock();
      const frameScene = iteration === 0 ? scene : prepareHeatmap({ ...options, width: scene.width,
        domains: [[low, high * (1 + (iteration % 4) * 0.02)]], selectedRowsOnly: false,
        aggregate: false, mutationMode: scene.mutationMode, rowHeight: 32 });
      const frame = drawHeatmap(ctx, frameScene, { height: frameScene.totalHeight, scrollTop: 0, cull: false });
      // Force pending raster work before the next clear/resize can replace it.
      // Keep draw submission separate from preparation and full-image readback.
      if (readback) ctx.getImageData(0, 0, canvas.width, canvas.height);
      // Frame 0 was prepared before resizing; count that work, but not setup or restoration.
      frames.push({ ...frame, submissionMs: frame.ms, ms: clock() - started + (iteration === 0 ? initialPreparationMs : 0) });
    }
    const elapsed = frames.reduce((sum, frame) => sum + frame.ms, 0);
    return { iterations, cells: scene.rows.length, sites: places.length, entries: matrix ? matrix.values.length : 0,
      visited: frames[0].visited, drawn: frames[0].drawn, totalVisited: frames.reduce((sum, f) => sum + f.visited, 0), totalDrawn: frames.reduce((sum, f) => sum + f.drawn, 0),
      aggregate: false, culling: false, varyingProjection: true, pixelRatio: 1, width: scene.width, height: scene.totalHeight,
      readback, timing: `Synchronous per-frame preparation and Canvas draw submission; ${readback ? "includes full-canvas raster/readback" : "rasterization not forced (readback unavailable)"}; excludes canvas setup, restoration and presentation; not end-to-end frame latency`,
      domains: scene.domains, frames, meanMs: elapsed / iterations, minMs: Math.min(...frames.map(f => f.ms)), maxMs: Math.max(...frames.map(f => f.ms)) };
  } finally {
    canvas.width = original.width; canvas.height = original.height;
    if (options.restore) options.restore();
    else if (image && ctx.putImageData) ctx.putImageData(image, 0, 0);
  }
}
