import React, { Component } from "react";
import Wrapper from "./heatmap.style";
import { prepareHeatmap, drawHeatmap, drawHeatmapAxis, hitTestHeatmap, describeHit, changeDomain, benchmarkFullMatrix, CN_COLORS, cnColor, vafColor } from "./heatmapRenderer";

import { allowPlotNavigation } from "../../helpers/plotNavigation";
import { selectCellRange } from "../../helpers/phylogeny/selection";

const EMPTY_DATA = { cellIds: [], cnByCell: {}, mutations: null, tree: null };
const EMPTY = [];
const AXIS_HEIGHT = 36;

/** Controlled PGV child: callbacks are the only selection/domain effects; no I/O. */
export default class PhylogenyHeatmap extends Component {
  static defaultProps = {
    width: 600, height: 640, gutterWidth: 240, mutationMode: "hidden", nodes: EMPTY,
    highlightedNodes: EMPTY, domains: EMPTY, chromoBins: {}, selectedRowsOnly: false, zoomedByCmd: false,
  };

  state = { tooltip: null, fitRows: false };
  canvas = null;
  axis = null;
  scroller = null;
  scene = null;
  scrollTop = 0;
  raf = null;
  hover = null;
  drag = null;
  brush = null;
  disposed = false;
  selectionAnchor = null;

  viewportHeight = () => Math.max(48, this.props.height - AXIS_HEIGHT - 36);

  prepare = () => {
    const { data, width, gutterWidth, domains, mutationMode, nodes, selectedRowsOnly } = this.props;
    const visibleCount = selectedRowsOnly ? (data || EMPTY_DATA).cellIds.filter(id => nodes.some(n => n.id === id && n.selected)).length : (data || EMPTY_DATA).cellIds.length;
    return prepareHeatmap({ data: data || EMPTY_DATA, width, gutterWidth, domains, mutationMode, nodes, selectedRowsOnly,
      rowHeight: this.state.fitRows ? this.viewportHeight() / Math.max(1, visibleCount) : undefined });
  };

  componentDidMount() {
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
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
    if (previous.data !== this.props.data || previous.width !== this.props.width || previous.gutterWidth !== this.props.gutterWidth) {
      if (!this.drag || this.drag.type !== "resize") this.drag = null;
      this.brush = null;
    }
    const changed = previous.data !== this.props.data || previous.width !== this.props.width || previous.height !== this.props.height ||
      previous.gutterWidth !== this.props.gutterWidth || previous.domains !== this.props.domains || previous.mutationMode !== this.props.mutationMode ||
      previous.selectedRowsOnly !== this.props.selectedRowsOnly || previousState.fitRows !== this.state.fitRows ||
      (this.props.selectedRowsOnly && previous.nodes !== this.props.nodes);
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

  canvasContext = (canvas, height) => {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(this.props.width * dpr));
    const pixels = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== pixels) canvas.height = pixels;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  };

  draw = () => {
    const ctx = this.canvasContext(this.canvas, this.viewportHeight());
    if (!ctx) return;
    const frame = drawHeatmap(ctx, this.scene, { height: this.viewportHeight(), scrollTop: this.scrollTop,
      nodes: this.props.nodes, highlightedNodes: this.props.highlightedNodes, hover: this.hover, brush: this.brush });
    Object.entries(frame).forEach(([key, value]) => {
      this.canvas.setAttribute(`data-frame-${key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}`, String(value));
    });
    const axisContext = this.canvasContext(this.axis, AXIS_HEIGHT);
    if (axisContext) drawHeatmapAxis(axisContext, this.scene, this.props.chromoBins, AXIS_HEIGHT);
  };

  benchmark = (iterations = 12) => benchmarkFullMatrix(this.canvas, { ...this.props, data: this.props.data || EMPTY_DATA, restore: this.draw }, iterations);

  point = event => {
    const rect = this.canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * (rect.width ? this.props.width / rect.width : 1),
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
    this.hover = window || hit ? { x, windowIndex: window ? window.index : null, rowId: hit ? hit.row.id : null } : null;
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
    if (drag.type === "resize") {
      if (this.props.onGutterWidthChange) this.props.onGutterWidthChange(Math.max(0, Math.min(Math.max(0, this.props.width - 72), drag.gutter + event.clientX - drag.clientX)));
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
    if (drag.type === "brush" && drag.moved && this.brush) {
      const { x1, x2 } = this.brush;
      this.emitDomain(drag.scene, drag.window.index, [drag.window.invert(Math.min(x1, x2) - drag.window.x), drag.window.invert(Math.max(x1, x2) - drag.window.x)]);
    } else if (drag.type !== "resize" && !drag.moved) {
      this.activate(drag.start, drag.modifiers);
    }
    this.brush = null;
    this.scheduleDraw();
  };

  onDragCancel = () => { this.drag = null; this.brush = null; this.scheduleDraw(); };

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
    if (this.props.onGutterWidthChange) this.props.onGutterWidthChange(Math.max(0, Math.min(Math.max(0, this.props.width - 72), width)));
  };

  render() {
    const { data = EMPTY_DATA, width, gutterWidth, mutationMode, nodes } = this.props;
    // Cache projection by the exact inputs that affect layout. Selection/hover redraws
    // must not sort/group the full matrix again unless the row filter is active.
    const inputs = [data, width, this.props.height, gutterWidth, mutationMode, this.props.domains, this.props.selectedRowsOnly,
      this.props.selectedRowsOnly ? nodes : null, this.state.fitRows];
    if (!this.scene || inputs.some((input, index) => input !== this.sceneInputs[index])) {
      this.scene = this.prepare();
      this.sceneInputs = inputs;
    }
    const matrix = data && data.mutations;
    const selected = new Set(nodes.filter(n => n.selected).map(n => n.id));
    const { tooltip } = this.state;
    const swatch = (label, color, circle = false) => <span key={label}><i className={`heatmap-swatch${circle ? " heatmap-swatch-dot" : ""}`} style={{ background: color }} /> {label}</span>;
    return <Wrapper className="phylogeny-heatmap" data-mutation-mode={mutationMode}>
      <canvas ref={element => { this.axis = element; }} className="heatmap-axis" aria-hidden="true" style={{ width, height: AXIS_HEIGHT }} />
      <div ref={element => { this.scroller = element; }} className="heatmap-scroll" style={{ height: this.viewportHeight() }} onScroll={this.onScroll}>
        <div className="heatmap-scroll-content" style={{ height: Math.max(this.viewportHeight(), this.scene.totalHeight) }}>
          <canvas ref={element => { this.canvas = element; }} className="heatmap-canvas" style={{ width, height: this.viewportHeight() }}
            role="img" aria-label="Phylogeny, copy number and mutation heatmap. Scroll for cells; drag to pan, Shift-drag to brush, Command-wheel to zoom when enabled. Shift-click selects a range; Control or Command-click toggles cells. Cell selection does not open tracks."
            data-cell-count={(data || EMPTY_DATA).cellIds.length} data-site-count={matrix ? matrix.variants.length : 0}
            data-matrix-entries={matrix ? matrix.values.length : 0} data-visible-row-count={this.scene.rows.length}
            onMouseMove={this.onHover} onMouseLeave={this.onLeave} onPointerDown={this.onPointerDown} onDoubleClick={this.onDoubleClick}
            onContextMenu={event => { if (event.ctrlKey) event.preventDefault(); }} />
        </div>
      </div>
      {/* Focusable separator values are valid ARIA 1.1; this legacy lint uses older role data. */}
      {/* eslint-disable jsx-a11y/role-supports-aria-props */}
      {gutterWidth > 0 && <div className="heatmap-gutter-resize" role="separator" aria-label="Resize tree gutter" aria-orientation="vertical"
        aria-valuemin={0} aria-valuemax={Math.max(0, width - 72)} aria-valuenow={gutterWidth} tabIndex={0}
        style={{ left: gutterWidth, height: this.viewportHeight() }} onPointerDown={this.onResizeStart} onKeyDown={this.onResizeKey} />}
      {/* eslint-enable jsx-a11y/role-supports-aria-props */}
      {!this.scene.rows.length && <div className="heatmap-empty">{this.props.selectedRowsOnly ? "No selected cells" : "No cells available"}</div>}
      {this.scene.rows.length > 0 && !this.scene.windows.length && <div className="heatmap-empty">Widen the panel or reduce the tree gutter to view genomic data.</div>}
      <div className="heatmap-legend">
        <span className="heatmap-legend-group" aria-label="Copy number legend"><strong>CN</strong>
          {CN_COLORS.map((color, index) => swatch(index === 11 ? "11+" : String(index), color))}{swatch("missing", cnColor(null))}
        </span>
        <span className="heatmap-legend-group" aria-label="Mutation VAF legend"><strong>VAF</strong>{mutationMode === "hidden" ? "Hidden" : <>
          <span className="heatmap-vaf-scale" role="img" aria-label="VAF: continuous grayscale from 0 (white) to 1 (black)">
            <span className="heatmap-vaf-gradient" />
            <span className="heatmap-vaf-ticks">{[0, 0.25, 0.5, 0.75, 1].map(value => <span key={value}>{value}</span>)}</span>
          </span>
          {swatch("× missing", vafColor(null), true)}
          <span title="Overlapping sites: counts and values on hover; click to zoom. No mean VAF."><i className="heatmap-overlap-symbol" aria-hidden="true">+</i> overlapping sites</span>
        </>}</span>
        <button type="button" className="heatmap-fit" onClick={() => this.setState(state => ({ fitRows: !state.fitRows }))}>{this.state.fitRows ? "Readable rows" : "Fit rows"}</button>
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
