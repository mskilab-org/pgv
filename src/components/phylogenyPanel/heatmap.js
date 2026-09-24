import React, { Component } from "react";
import Wrapper from "./heatmap.style";
import { prepareHeatmap, drawHeatmap, drawMutationHeatmap, drawHeatmapAxis, hitTestHeatmap, hitTestMutationHeatmap, describeHit, changeDomain, benchmarkFullMatrix, CN_COLORS, ALLELIC_CN_COLORS, cnColor, vafColor, mutationCountScale } from "./heatmapRenderer";

import { allowPlotNavigation } from "../../helpers/plotNavigation";
import { selectCellRange } from "../../helpers/phylogeny/selection";

const EMPTY_DATA = { cellIds: [], cnByCell: {}, mutations: null, tree: null };
const EMPTY = [];
const AXIS_HEIGHT = 36;

/** Controlled PGV child: callbacks are the only selection/domain effects; no I/O. */
export default class PhylogenyHeatmap extends Component {
  static defaultProps = {
    width: 600, height: 640, gutterWidth: 240, mutationMode: "hidden", cnMode: "total", mutationMetric: "vaf", nodes: EMPTY,
    highlightedNodes: EMPTY, domains: EMPTY, chromoBins: {}, selectedRowsOnly: false, zoomedByCmd: false,
    fitRows: undefined, showFitControl: true, matrixKind: "mutations", availableCnModes: ["total", "major", "minor"],
  };

  state = { tooltip: null, fitRows: false, mutationRange: null };
  canvas = null;
  axis = null;
  mutationCanvas = null;
  scroller = null;
  mutationScroller = null;
  scene = null;
  scrollTop = 0;
  raf = null;
  hover = null;
  drag = null;
  brush = null;
  mutationBrush = null;
  suppressMutationClick = false;
  disposed = false;
  selectionAnchor = null;

  viewportHeight = () => Math.max(48, this.props.height - AXIS_HEIGHT - 36);
  sideMatrix = () => (this.props.data || EMPTY_DATA)[this.props.matrixKind === "junctions" ? "junctions" : "mutations"];
  mutationVisible = () => this.props.mutationMode === "side" && !!this.sideMatrix();
  mutationWidth = () => Math.min(280, Math.max(80, this.props.width * 0.35));
  mutationColumnWidth = 4;
  rowsFitted = () => this.props.fitRows == null ? this.state.fitRows : this.props.fitRows;
  mutationFitted = () => this.mutationVisible() && this.props.matrixKind !== "junctions" && this.rowsFitted();
  mutationRange = () => this.state.mutationRange || [0, this.sideMatrix().variants.length];
  mutationView = () => this.mutationFitted() ? { width: this.mutationWidth(), range: this.mutationRange() } : {};
  mainWidth = () => this.mutationVisible() ? Math.max(96, this.props.width - this.mutationWidth() - 12) : this.props.width;

  prepare = () => {
    const { data, gutterWidth, domains, mutationMode, cnMode, mutationMetric, nodes, selectedRowsOnly, chromoBins, fitRows } = this.props;
    const visibleCount = selectedRowsOnly ? (data || EMPTY_DATA).cellIds.filter(id => nodes.some(n => n.id === id && n.selected)).length : (data || EMPTY_DATA).cellIds.length;
    const fittedHeight = this.viewportHeight() / Math.max(1, visibleCount);
    // Both modes fill spare space; readable mode only limits how small rows get.
    const minimumHeight = (fitRows == null ? this.state.fitRows : fitRows) ? 0 : mutationMode === "paired" ? 32 : 22;
    return prepareHeatmap({ data: data || EMPTY_DATA, width: this.mainWidth(), gutterWidth, domains, mutationMode, cnMode, mutationMetric, chromoBins, nodes, selectedRowsOnly, matrixKind: this.props.matrixKind,
      rowHeight: Math.max(minimumHeight, fittedHeight) });
  };

  componentDidMount() {
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    this.scroller.addEventListener("wheel", this.onMutationWheel, { passive: false });
    window.addEventListener("pointermove", this.onDragMove);
    window.addEventListener("pointerup", this.onDragEnd);
    window.addEventListener("pointercancel", this.onDragCancel);
    window.addEventListener("blur", this.onDragCancel);
    window.addEventListener("resize", this.scheduleDraw);
    if (process.env.NODE_ENV !== "production") this.canvas.benchmarkFullMatrix = this.benchmark;
    this.scheduleDraw();
  }

  componentDidUpdate(previous, previousState) {
    if ((previous.data && previous.data.tree) !== (this.props.data && this.props.data.tree) ||
        (previous.data && previous.data.cellIds) !== (this.props.data && this.props.data.cellIds) ||
        (previous.nodes !== this.props.nodes && !this.props.nodes.some(node => node.selected))) this.selectionAnchor = null;
    if (previous.data !== this.props.data || previous.width !== this.props.width || previous.gutterWidth !== this.props.gutterWidth || previous.matrixKind !== this.props.matrixKind) {
      if (!this.drag || this.drag.type !== "resize") this.drag = null;
      this.brush = null;
      this.mutationBrush = null;
      this.suppressMutationClick = false;
    }
    const changed = previous.data !== this.props.data || previous.width !== this.props.width || previous.height !== this.props.height ||
      previous.gutterWidth !== this.props.gutterWidth || previous.domains !== this.props.domains || previous.mutationMode !== this.props.mutationMode ||
      previous.cnMode !== this.props.cnMode || previous.mutationMetric !== this.props.mutationMetric || previous.fitRows !== this.props.fitRows || previous.matrixKind !== this.props.matrixKind ||
      previous.selectedRowsOnly !== this.props.selectedRowsOnly || previousState.fitRows !== this.state.fitRows ||
      (this.props.selectedRowsOnly && previous.nodes !== this.props.nodes);
    if (this.mutationScroller && (previous.matrixKind !== this.props.matrixKind || this.mutationFitted())) this.mutationScroller.scrollLeft = 0;
    if ((previous.matrixKind !== this.props.matrixKind || (previous.data && previous.data.mutations) !== (this.props.data && this.props.data.mutations) ||
        (!this.rowsFitted() && (previous.fitRows == null ? previousState.fitRows : previous.fitRows) !== this.rowsFitted())) && this.state.mutationRange) {
      this.setState({ mutationRange: null });
    }
    if (changed) {
      this.scrollTop = Math.min(this.scrollTop, Math.max(0, this.scene.totalHeight - this.viewportHeight()));
      if (this.scroller) this.scroller.scrollTop = this.scrollTop;
      this.hover = null;
      if (this.state.tooltip) this.setState({ tooltip: null });
    }
    this.scheduleDraw();
  }

  componentWillUnmount() {
    this.disposed = true;
    if (this.raf !== null) window.cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.scroller.removeEventListener("wheel", this.onMutationWheel);
    delete this.canvas.benchmarkFullMatrix;
    window.removeEventListener("pointermove", this.onDragMove);
    window.removeEventListener("pointerup", this.onDragEnd);
    window.removeEventListener("pointercancel", this.onDragCancel);
    window.removeEventListener("blur", this.onDragCancel);
    window.removeEventListener("resize", this.scheduleDraw);
    this.drag = null; this.hover = null; this.brush = null; this.scene = null;
  }

  scheduleDraw = () => {
    if (this.disposed || this.raf !== null) return;
    this.raf = window.requestAnimationFrame(() => { this.raf = null; if (!this.disposed) this.draw(); });
  };

  canvasContext = (canvas, height, logicalWidth = this.props.width) => {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(logicalWidth * dpr));
    const pixels = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== pixels) canvas.height = pixels;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  };

  draw = () => {
    const ctx = this.canvasContext(this.canvas, this.viewportHeight(), this.mainWidth());
    if (!ctx) return;
    const frame = drawHeatmap(ctx, this.scene, { height: this.viewportHeight(), scrollTop: this.scrollTop,
      nodes: this.props.nodes, highlightedNodes: this.props.highlightedNodes, hover: this.hover, brush: this.brush });
    if (this.mutationCanvas && this.mutationVisible()) {
      const mutationContext = this.canvasContext(this.mutationCanvas, this.viewportHeight(), this.mutationWidth());
      if (mutationContext) {
        const mutationFrame = drawMutationHeatmap(mutationContext, this.scene, { height: this.viewportHeight(), scrollTop: this.scrollTop,
          width: this.mutationWidth(), scrollLeft: this.mutationScroller ? this.mutationScroller.scrollLeft : 0,
          ...this.mutationView(), nodes: this.props.nodes, hover: this.hover });
        if (this.mutationBrush) {
          const left = Math.min(this.mutationBrush.start, this.mutationBrush.end);
          mutationContext.fillStyle = "rgba(22,119,255,0.16)";
          mutationContext.fillRect(left, 0, Math.abs(this.mutationBrush.end - this.mutationBrush.start), this.viewportHeight());
          mutationContext.strokeStyle = "#1677ff";
          mutationContext.strokeRect(left, 0.5, Math.abs(this.mutationBrush.end - this.mutationBrush.start), this.viewportHeight() - 1);
        }
        Object.entries(mutationFrame).forEach(([key, value]) => this.mutationCanvas.setAttribute(`data-frame-${key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}`, String(value)));
      }
    }
    const mainWidth = this.mainWidth();
    Object.entries(frame).forEach(([key, value]) => {
      this.canvas.setAttribute(`data-frame-${key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}`, String(value));
    });
    const axisContext = this.canvasContext(this.axis, AXIS_HEIGHT, mainWidth);
    if (axisContext) drawHeatmapAxis(axisContext, this.scene, this.props.chromoBins, AXIS_HEIGHT);
  };

  benchmark = (iterations = 12) => benchmarkFullMatrix(this.canvas, { ...this.props, data: this.props.data || EMPTY_DATA, width: this.mainWidth(), restore: this.draw }, iterations);

  point = event => {
    const rect = this.canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * (rect.width ? this.mainWidth() / rect.width : 1),
      y: (event.clientY - rect.top) * (rect.height ? this.viewportHeight() / rect.height : 1) };
  };
  windowAt = x => this.scene.windows.find(window => x >= window.x && x <= window.x + window.width);
  wheelAllowed = event => allowPlotNavigation(event, this.props.zoomedByCmd);
  emitDomain = (scene, index, range) => {
    if (this.props.onDomainsChange) this.props.onDomainsChange(changeDomain(scene, index, range, this.props.genomeLength));
  };
  select = (ids, event) => {
    const result = selectCellRange({ cellIds: this.scene.data.cellIds, order: this.scene.rows.map(row => row.id),
      ids, nodes: this.props.nodes, anchor: this.selectionAnchor,
      shift: !!(event && event.shiftKey), additive: !!(event && (event.ctrlKey || event.metaKey)) });
    this.selectionAnchor = result.anchor;
    if (this.props.onSelectNodes) this.props.onSelectNodes(result.nodes);
  };

  onScroll = event => {
    if (event.target !== event.currentTarget) return; // Horizontal child scroll must not reset vertical row offset.
    this.scrollTop = event.currentTarget.scrollTop;
    this.hover = null;
    if (this.state.tooltip) this.setState({ tooltip: null });
    this.scheduleDraw();
  };

  onHover = event => {
    if (this.drag) return;
    const { x, y } = this.point(event);
    const window = this.windowAt(x);
    const hit = hitTestHeatmap(this.scene, x, y, this.scrollTop);
    this.hover = window || hit ? { x, windowIndex: window ? window.index : null, rowId: hit ? hit.row.id : null, nodeId: hit && hit.node ? hit.node.id : null } : null;
    if (this.props.onHoverLocation) this.props.onHoverLocation(window ? window.invert(x - window.x) : null, window ? window.index : null);
    const lines = describeHit(this.scene, hit);
    this.setState({ tooltip: lines.length ? { x, y, lines } : null });
    this.scheduleDraw();
  };
  onLeave = () => {
    if (this.drag) return;
    this.hover = null;
    this.setState({ tooltip: null });
    if (this.props.onHoverLocation) this.props.onHoverLocation(null, null);
    this.scheduleDraw();
  };

  mutationPoint = event => {
    const rect = this.mutationCanvas.getBoundingClientRect();
    const horizontal = this.mutationScroller ? this.mutationScroller.scrollLeft : 0;
    return { x: (event.clientX - rect.left) * (rect.width ? this.mutationWidth() / rect.width : 1) + horizontal,
      y: (event.clientY - rect.top) * (rect.height ? this.viewportHeight() / rect.height : 1) };
  };

  onMutationHover = event => {
    if (this.drag || !this.scene) return;
    const { x, y } = this.mutationPoint(event);
    const hit = hitTestMutationHeatmap(this.scene, x, y, this.scrollTop, this.mutationColumnWidth, this.mutationView());
    this.hover = hit ? { x: this.mainWidth() + 12 + x, rowId: hit.row.id, windowIndex: null } : null;
    const lines = describeHit(this.scene, hit);
    this.setState({ tooltip: lines.length ? { x: this.mainWidth() + 12 + x - (this.mutationScroller ? this.mutationScroller.scrollLeft : 0), y, lines } : null });
    this.scheduleDraw();
  };

  onMutationScroll = event => {
    event.stopPropagation();
    this.hover = null;
    if (this.state.tooltip) this.setState({ tooltip: null });
    this.scheduleDraw();
  };

  focusHeatmap = event => {
    const root = event.currentTarget.closest(".phylogeny-heatmap");
    if (root) root.focus({ preventScroll: true });
  };

  onMutationClick = event => {
    if (event.detail > 1) return;
    if (this.suppressMutationClick) { this.suppressMutationClick = false; return; }
    if (!this.scene) return;
    this.focusHeatmap(event);
    const { x, y } = this.mutationPoint(event);
    const hit = hitTestMutationHeatmap(this.scene, x, y, this.scrollTop, this.mutationColumnWidth, this.mutationView());
    if (hit && this.mutationFitted() && hit.columnEnd > hit.column + 1) this.setState({ mutationRange: [hit.column, hit.columnEnd] });
    else if (hit) this.select([hit.row.id], event);
  };

  // The catalog viewport is independent of genomic domains (catalog order need
  // not be genomic order). Fit mode uses the same gestures as the CN canvas.
  setMutationRange = (start, span) => {
    const total = this.sideMatrix().variants.length;
    if (!total) return;
    const size = Math.max(1, Math.min(total, Math.round(span)));
    const left = Math.max(0, Math.min(total - size, Math.round(start)));
    this.setState({ mutationRange: left === 0 && size === total ? null : [left, left + size] });
  };
  onMutationWheel = event => {
    if (!this.mutationFitted() || !event.target.closest(".mutation-scroll-x") || !this.wheelAllowed(event)) return;
    event.preventDefault();
    const width = this.mutationWidth(), x = Math.max(0, Math.min(width, this.mutationPoint(event).x));
    const [start, end] = this.mutationRange(), span = end - start;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.viewportHeight() : 1;
    if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      this.setMutationRange(start + (event.deltaX || event.deltaY) * unit * span / width, span);
    } else {
      const factor = Math.exp(Math.max(-2, Math.min(2, event.deltaY * unit * 0.002)));
      const size = Math.max(1, Math.min(this.sideMatrix().variants.length, Math.round(span * factor)));
      this.setMutationRange(start + x / width * (span - size), size);
    }
  };
  onMutationPointerDown = event => {
    if (!this.mutationFitted() || (event.button && !(event.button === 2 && event.ctrlKey))) return;
    this.suppressMutationClick = false;
    this.focusHeatmap(event);
    this.drag = { type: "mutation", gesture: event.shiftKey ? "brush" : "pan", startX: this.mutationPoint(event).x,
      range: this.mutationRange().slice(), pointerId: event.pointerId, moved: false };
    if (event.currentTarget.setPointerCapture && event.pointerId != null) event.currentTarget.setPointerCapture(event.pointerId);
  };
  onMutationDoubleClick = event => { if (this.mutationFitted() && !event.button) this.setState({ mutationRange: null }); };
  onMutationKeyDown = event => {
    if (!this.mutationFitted()) return;
    const [start, end] = this.mutationRange(), span = end - start;
    if (event.key === "+" || event.key === "=" || event.key === "-") {
      const size = Math.max(1, Math.round(span * (event.key === "-" ? 1.5 : 0.6)));
      this.setMutationRange(start + (span - size) / 2, size);
    } else if (event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      this.setMutationRange(start + (event.key === "ArrowRight" ? 1 : -1) * Math.max(1, Math.round(span * 0.15)), span);
    } else if (event.key === "Home" || event.key === "Escape") this.setState({ mutationRange: null });
    else return;
    event.preventDefault(); event.stopPropagation();
  };

  onKeyDown = event => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const target = event.target;
    if (target && ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName)) return;
    if (target && target.closest && target.closest(".heatmap-gutter-resize, [contenteditable=true], [role=combobox]")) return;
    event.preventDefault();
    const modes = this.props.availableCnModes;
    if (!modes.length) return;
    const current = modes.indexOf(this.props.cnMode || "total");
    const next = (current + (event.key === "ArrowRight" ? 1 : modes.length - 1)) % modes.length;
    if (this.props.onCnModeChange) this.props.onCnModeChange(modes[next]);
  };

  onWheel = event => {
    if (!this.wheelAllowed(event)) return;
    const { x } = this.point(event);
    const window = this.windowAt(x);
    if (!window) return; // Tree wheel remains native vertical scrolling.
    event.preventDefault();
    const [start, end] = window.domain;
    const span = end - start;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.viewportHeight() : 1;
    if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      const delta = (event.deltaX || event.deltaY) * unit * span / window.width;
      this.emitDomain(this.scene, window.index, [start + delta, end + delta]);
    } else {
      const place = window.invert(x - window.x);
      const factor = Math.exp(Math.max(-2, Math.min(2, event.deltaY * unit * 0.002)));
      this.emitDomain(this.scene, window.index, [place - (place - start) * factor, place + (end - place) * factor]);
    }
  };

  onPointerDown = event => {
    // macOS can report Control-primary-click as a secondary button.
    if (event.button && !(event.button === 2 && event.ctrlKey)) return;
    this.focusHeatmap(event);
    const point = this.point(event);
    const window = this.windowAt(point.x);
    this.drag = { type: window ? event.shiftKey ? "brush" : "pan" : "select",
      start: point, last: point, window, scene: this.scene, moved: false,
      modifiers: { shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey }, pointerId: event.pointerId };
    if (event.currentTarget.setPointerCapture && event.pointerId != null) event.currentTarget.setPointerCapture(event.pointerId);
  };

  onDragMove = event => {
    const drag = this.drag;
    if (!drag || (drag.pointerId != null && event.pointerId !== drag.pointerId)) return;
    if (drag.type === "mutation") {
      const x = Math.max(0, Math.min(this.mutationWidth(), this.mutationPoint(event).x));
      drag.moved = drag.moved || Math.abs(x - drag.startX) > 3;
      if (!drag.moved) return;
      event.preventDefault();
      if (drag.gesture === "brush") this.mutationBrush = { start: Math.max(0, Math.min(this.mutationWidth(), drag.startX)), end: x };
      else this.setMutationRange(drag.range[0] + (drag.startX - x) * (drag.range[1] - drag.range[0]) / this.mutationWidth(), drag.range[1] - drag.range[0]);
      this.scheduleDraw();
      return;
    }
    if (drag.type === "resize") {
      if (this.props.onGutterWidthChange) this.props.onGutterWidthChange(Math.max(0, Math.min(Math.max(0, this.mainWidth() - 72), drag.gutter + event.clientX - drag.clientX)));
      return;
    }
    const point = this.point(event);
    drag.last = point;
    drag.moved = drag.moved || Math.abs(point.x - drag.start.x) > 3 || Math.abs(point.y - drag.start.y) > 3;
    if (!drag.moved || drag.type === "select") return;
    event.preventDefault();
    const window = drag.window;
    const x = Math.max(window.x, Math.min(window.x + window.width, point.x));
    if (drag.type === "brush") this.brush = { x1: drag.start.x, x2: x };
    else {
      const delta = (drag.start.x - x) * (window.domain[1] - window.domain[0]) / window.width;
      this.emitDomain(drag.scene, window.index, window.domain.map(value => value + delta));
    }
    this.scheduleDraw();
  };

  onDragEnd = event => {
    const drag = this.drag;
    if (!drag || (drag.pointerId != null && event.pointerId !== drag.pointerId)) return;
    this.drag = null;
    if (drag.type === "mutation") {
      if (drag.moved && this.mutationBrush) {
        const [start, end] = drag.range, span = end - start, width = this.mutationWidth();
        const low = start + Math.floor(Math.min(this.mutationBrush.start, this.mutationBrush.end) * span / width);
        const high = start + Math.ceil(Math.max(this.mutationBrush.start, this.mutationBrush.end) * span / width);
        this.setMutationRange(low, Math.max(1, high - low));
      }
      this.suppressMutationClick = drag.moved;
      this.mutationBrush = null;
      this.scheduleDraw();
      return;
    }
    if (drag.type === "brush" && drag.moved && this.brush) {
      const { x1, x2 } = this.brush;
      this.emitDomain(drag.scene, drag.window.index, [drag.window.invert(Math.min(x1, x2) - drag.window.x), drag.window.invert(Math.max(x1, x2) - drag.window.x)]);
    } else if (drag.type !== "resize" && !drag.moved) {
      this.activate(drag.start, drag.modifiers);
    }
    this.brush = null;
    this.scheduleDraw();
  };

  onDragCancel = () => { this.drag = null; this.brush = null; this.mutationBrush = null; this.scheduleDraw(); };

  activate = (point, event) => {
    const hit = hitTestHeatmap(this.scene, point.x, point.y, this.scrollTop);
    if (!hit) return;
    if (hit.type === "group") {
      const extent = hit.group.end - hit.group.start;
      const padding = Math.max(1, extent * 0.1);
      this.emitDomain(this.scene, hit.windowIndex, [hit.group.start - padding, hit.group.end + padding]);
    } else this.select(hit.ids, event);
  };

  onDoubleClick = event => {
    if (event.button) return;
    const window = this.windowAt(this.point(event).x);
    if (window) this.emitDomain(this.scene, window.index, [1, this.props.genomeLength || Math.max(...this.props.domains.map(d => d[1]))]);
  };

  onResizeStart = event => {
    if (event.button) return;
    event.preventDefault();
    this.drag = { type: "resize", gutter: this.props.gutterWidth, clientX: event.clientX, pointerId: event.pointerId };
    if (event.currentTarget.setPointerCapture && event.pointerId != null) event.currentTarget.setPointerCapture(event.pointerId);
  };
  onResizeKey = event => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const width = this.props.gutterWidth + (event.key === "ArrowRight" ? 16 : -16);
    if (this.props.onGutterWidthChange) this.props.onGutterWidthChange(Math.max(0, Math.min(Math.max(0, this.mainWidth() - 72), width)));
  };

  render() {
    const { data = EMPTY_DATA, width, gutterWidth, mutationMode, cnMode, nodes } = this.props;
    // Cache projection by the exact inputs that affect layout. Selection/hover redraws
    // must not sort/group the full matrix again unless the row filter is active.
    const inputs = [data, width, this.props.height, gutterWidth, mutationMode, this.props.cnMode, this.props.mutationMetric, this.props.domains, this.props.selectedRowsOnly,
      this.props.selectedRowsOnly ? nodes : null, this.props.fitRows, this.state.fitRows, this.props.chromoBins, this.props.matrixKind];
    if (!this.scene || inputs.some((input, index) => input !== this.sceneInputs[index])) {
      this.scene = this.prepare();
      this.sceneInputs = inputs;
    }
    const matrix = data && data.mutations;
    const selected = new Set(nodes.filter(n => n.selected).map(n => n.id));
    const mainWidth = this.mainWidth();
    const side = this.mutationVisible();
    const sideMatrix = this.sideMatrix();
    const junctions = this.props.matrixKind === "junctions";
    const fittedMutations = this.mutationFitted();
    const range = fittedMutations ? this.mutationRange() : null;
    const summarized = range && range[1] - range[0] > this.mutationWidth();
    const matrixWidth = fittedMutations ? this.mutationWidth() : Math.max(this.mutationWidth(), (sideMatrix ? sideMatrix.variants.length : 0) * this.mutationColumnWidth);
    const fitRows = this.rowsFitted();
    const mutationMetricLabel = this.props.mutationMetric === "ref" ? "Ref count" : this.props.mutationMetric === "alt" ? "Alt count" : "VAF";
    const countMetric = this.props.mutationMetric === "ref" || this.props.mutationMetric === "alt";
    const countScale = side && !junctions && countMetric ? mutationCountScale(sideMatrix, this.props.mutationMetric) : null;
    const { tooltip } = this.state;
    const swatch = (label, color, circle = false) => <span key={label}><i className={`heatmap-swatch${circle ? " heatmap-swatch-dot" : ""}`} style={{ background: color }} /> {label}</span>;
    return <Wrapper className="phylogeny-heatmap" data-mutation-mode={mutationMode} tabIndex={0} onKeyDown={this.onKeyDown}>
      <div className="heatmap-axis-row">
        <canvas ref={element => { this.axis = element; }} className="heatmap-axis" aria-hidden="true" style={{ width: mainWidth, height: AXIS_HEIGHT }} />
        {side && <div className="mutation-axis-label" style={{ width: this.mutationWidth() }}>
          <span>{junctions ? "Junction CN" : "Mutations"} · {range && this.state.mutationRange ? `${range[0] + 1}–${range[1]} / ` : ""}{sideMatrix.variants.length.toLocaleString()} {junctions ? "junctions" : "sites"}</span>
          {range && this.state.mutationRange && <button type="button" className="mutation-reset" aria-label="Reset mutation zoom" onClick={() => this.setState({ mutationRange: null })} title="Show all mutation sites">Reset</button>}
        </div>}
      </div>
      <div ref={element => { this.scroller = element; }} className="heatmap-scroll" style={{ height: this.viewportHeight() }} onScroll={this.onScroll}>
        <div className="heatmap-scroll-content" style={{ height: Math.max(this.viewportHeight(), this.scene.totalHeight) }}>
          <div className="heatmap-columns" style={{ height: this.viewportHeight() }}>
            <canvas ref={element => { this.canvas = element; }} className="heatmap-canvas" style={{ width: mainWidth, height: this.viewportHeight() }}
              role="img" aria-label="Phylogeny and copy-number heatmap. Scroll for cells; drag to pan, Shift-drag to brush, Command-wheel to zoom when enabled. Shift-click selects a range; Control or Command-click toggles cells. Cell selection does not open tracks."
              data-cell-count={(data || EMPTY_DATA).cellIds.length} data-site-count={matrix ? matrix.variants.length : 0}
              data-matrix-entries={matrix ? matrix.values.length : 0} data-visible-row-count={this.scene.rows.length}
              onMouseMove={this.onHover} onMouseLeave={this.onLeave} onPointerDown={this.onPointerDown} onDoubleClick={this.onDoubleClick}
              onContextMenu={event => { if (event.ctrlKey) event.preventDefault(); }} />
            {side && <div ref={element => { this.mutationScroller = element; }} className="mutation-scroll-x"
              style={{ width: this.mutationWidth(), height: this.viewportHeight(), overflowX: fittedMutations ? "hidden" : "auto" }} onScroll={this.onMutationScroll}>
              <div style={{ width: matrixWidth }}>
                <canvas ref={element => { this.mutationCanvas = element; }} className="mutation-canvas" style={{ width: this.mutationWidth(), height: this.viewportHeight() }}
                  role="img" tabIndex={fittedMutations ? 0 : undefined} aria-label={fittedMutations ? `Mutation ${summarized ? "positive-site fraction overview" : "exact-site detail"} in source order. Click a summary to zoom; Shift-drag to brush; drag to pan; wheel to zoom when enabled; double-click to reset. Keyboard: plus and minus to zoom, Alt-arrow to pan, Home to reset.` : `${junctions ? "Junction copy-number" : "Mutation"} heatmap colored by ${junctions ? "CN" : mutationMetricLabel}${countScale ? " (log scale)" : ""}. Horizontal scroll preserves source column order.`}
                  onKeyDown={this.onMutationKeyDown} onMouseMove={this.onMutationHover} onMouseLeave={this.onLeave} onClick={this.onMutationClick}
                  onPointerDown={this.onMutationPointerDown} onDoubleClick={this.onMutationDoubleClick} />
              </div>
            </div>}
          </div>
        </div>
      </div>
      {/* Focusable separator values are valid ARIA 1.1; this legacy lint uses older role data. */}
      {/* eslint-disable jsx-a11y/role-supports-aria-props */}
      {gutterWidth > 0 && <div className="heatmap-gutter-resize" role="separator" aria-label="Resize tree gutter" aria-orientation="vertical"
        aria-valuemin={0} aria-valuemax={Math.max(0, mainWidth - 72)} aria-valuenow={gutterWidth} tabIndex={0}
        style={{ left: gutterWidth, height: this.viewportHeight() }} onPointerDown={this.onResizeStart} onKeyDown={this.onResizeKey} />}
      {/* eslint-enable jsx-a11y/role-supports-aria-props */}
      {!this.scene.rows.length && <div className="heatmap-empty">{this.props.selectedRowsOnly ? "No selected cells" : "No cells available"}</div>}
      {this.scene.rows.length > 0 && !this.scene.windows.length && <div className="heatmap-empty">Widen the panel or reduce the tree gutter to view genomic data.</div>}
      <div className="heatmap-legend">
        <span className="heatmap-legend-group" aria-label="Copy number legend"><strong>CN {cnMode === "total" ? "Total" : cnMode === "major" ? "Major" : "Minor"}</strong>
          {(cnMode === "total" ? CN_COLORS : ALLELIC_CN_COLORS).map((color, index) => swatch(index === 11 ? "11+" : String(index), color))}{swatch("missing", cnColor(null, cnMode))}
        </span>
        <span className="heatmap-legend-group" aria-label="Mutation VAF legend"><strong>{summarized ? `Positive sites (${mutationMetricLabel})` : side ? junctions ? "Junction CN" : mutationMetricLabel : "VAF"}</strong>{mutationMode === "hidden" ? "Hidden" : side && junctions ? <>{CN_COLORS.map((color, index) => swatch(index === 11 ? "11+" : String(index), color))}{swatch("missing", cnColor(null))}</> : countScale && !summarized ? <>
          <span title="Logarithmic color scale over the full cohort. No counts are clipped; tooltips show the original read counts.">log scale</span>
          <span className="heatmap-count-scale" role="img" aria-label={`${mutationMetricLabel}: logarithmic color scale from 0 to ${countScale.maximum}; tooltips show raw counts`}>
            <span className="heatmap-count-gradient" />
            <span className="heatmap-count-ticks">{countScale.ticks.map(({ value, position }, index) =>
              <span key={value} style={{ left: `${100 * position}%`, transform: index === 0 ? "none" : index === countScale.ticks.length - 1 ? "translateX(-100%)" : "translateX(-50%)" }}>{value}</span>)}</span>
          </span>
          {sideMatrix.format === "plotly" && swatch("missing", vafColor(null))}
        </> : <>
          <span className="heatmap-vaf-scale" role="img" aria-label={summarized ? "Positive-site fraction: 0 (white) to 1 (black); exact values on zoom" : "VAF: continuous grayscale from 0 (white) to 1 (black)"}>
            <span className="heatmap-vaf-gradient" />
            <span className="heatmap-vaf-ticks">{[0, 0.25, 0.5, 0.75, 1].map(value => <span key={value}>{value}</span>)}</span>
          </span>
          {(!side || (sideMatrix && sideMatrix.format === "plotly")) && swatch(side ? "missing" : "× missing", vafColor(null), !side)}
          {!side && <span title="Overlapping sites: counts and values on hover; click to zoom. No mean VAF."><i className="heatmap-overlap-symbol" aria-hidden="true">+</i> overlapping sites</span>}
        </>}</span>
        {this.props.showFitControl && <button type="button" className="heatmap-fit" onClick={() => this.setState(state => ({ fitRows: !state.fitRows }))}>{fitRows ? "Readable rows" : "Fit rows"}</button>}
        {this.scene.hiddenCount > 0 && <span>{this.scene.hiddenCount} hidden cell{this.scene.hiddenCount === 1 ? "" : "s"} (data retained)</span>}
      </div>
      <div className="heatmap-accessible" aria-label="Cell selection">
        {(data || EMPTY_DATA).cellIds.map(id => <button type="button" key={id} aria-label={`Select cell ${id}`} aria-pressed={selected.has(id)}
          onFocus={() => { const row = this.scene.rowById.get(id); if (row && this.scroller) this.scroller.scrollTop = row.index * this.scene.rowHeight; }}
          onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); this.select([id], event); } }}
          onClick={event => this.select([id], event)}>{id}</button>)}
      </div>
      {tooltip && <div className="heatmap-tooltip" role="tooltip" style={{ left: Math.max(0, Math.min(width - 300, tooltip.x + 12)), top: Math.max(AXIS_HEIGHT, Math.min(this.viewportHeight() - 60, tooltip.y + AXIS_HEIGHT + 12)) }}>
        {tooltip.lines.map((line, index) => <div key={index}>{line}</div>)}
      </div>}
    </Wrapper>;
  }
}
