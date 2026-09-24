import React, { Component } from "react";
import { connect } from "react-redux";
import handleViewport from "react-in-viewport";
import { Card, Space, Tooltip, Button, message, Select, Checkbox, Modal, Progress, InputNumber, Typography } from "antd";
import { AiOutlineDownload, AiOutlinePushpin, AiFillPushpin, AiOutlineClose } from "react-icons/ai";
import * as htmlToImage from "html-to-image";
import { downloadCanvasAsPng } from "../../helpers/utility";
import { withTranslation } from "react-i18next";
import { GrTree } from "react-icons/gr";
import ContainerDimensions from "react-container-dimensions";
import PhyloTree from "./phyloTree";
import PhylogenyHeatmap from "./heatmap";
import PanelResizeHandle from "../panelResizeHandle";
import { isDetailPlot } from "../../helpers/phylogeny/loaders";
import Wrapper from "./index.style";
import appActions from "../../redux/app/actions";

const { Text } = Typography;
const defaultView = { gutterWidth: 240, gutterHidden: false, mutationMode: "hidden", cnMode: "total", mutationMetric: "vaf", fitRows: false, selectedRowsOnly: false, selectedTracksOnly: false };

/** Existing PGV Card/container; the dense visualization is an interchangeable child. */
export class PhylogenyPanel extends Component {
  container = null;
  openDialog = null;
  pendingOpen = null;
  disposed = false;

  componentDidUpdate(previous) {
    if (previous.plotId !== this.props.plotId || previous.datasetEpoch !== this.props.datasetEpoch || previous.activeTreeId !== this.props.activeTreeId) this.closeDialog();
  }

  componentWillUnmount() {
    this.disposed = true;
    this.closeDialog();
  }

  closeDialog = () => {
    if (this.pendingOpen) this.pendingOpen.active = false;
    this.pendingOpen = null;
    if (this.openDialog) this.openDialog.destroy();
    this.openDialog = null;
  };

  confirmOpen = () => {
    const { nodes, datasetEpoch, plotId } = this.props;
    const ids = nodes.filter(node => node.selected).map(node => node.id);
    if (!ids.length || this.props.cellTrackLoad.status === "loading") return;
    this.closeDialog();
    // The confirmation captures identities, not a mutable selection or row indices.
    const confirmation = { active: true };
    this.pendingOpen = confirmation;
    this.openDialog = Modal.confirm({
      title: `Open tracks for ${ids.length} selected cell${ids.length === 1 ? "" : "s"}?`,
      content: <div>
        <p>Existing tracks and downloaded genomes are reused. Up to three cells load at once; loading can be cancelled.</p>
        <p>Optional hidden tracks load only when expanded.</p>
        <div className="phylogeny-confirm-cells" style={{ maxHeight: 140, overflow: "auto", overflowWrap: "anywhere" }}>
          {ids.map(id => <div key={id}>{id}</div>)}
        </div>
      </div>,
      okText: "Open tracks", cancelText: "Cancel", autoFocusButton: "cancel",
      onCancel: () => { confirmation.active = false; this.pendingOpen = null; this.openDialog = null; },
      onOk: () => {
        if (!confirmation.active) return;
        confirmation.active = false;
        this.pendingOpen = null;
        this.openDialog = null;
        if (!this.disposed && this.props.datasetEpoch === datasetEpoch && this.props.plotId === plotId) {
          if (this.props.onOpenPhylogenyCells) this.props.onOpenPhylogenyCells(ids, true);
          else this.props.openPhylogenyCells(ids, true);
        }
      },
    });
  };

  onTreeChange = (treeId) => {
    if (!treeId || treeId === this.props.activeTreeId || !this.props.selectPhylogenyTree) return;
    this.closeDialog();
    this.props.selectPhylogenyTree(this.props.plotId, treeId);
    if (this.props.loadPhylogenyHeatmap) this.props.loadPhylogenyHeatmap(this.props.plotId);
  };

  updateView = (changes) => {
    if (this.props.onUpdatePhylogenyView) this.props.onUpdatePhylogenyView(changes);
    else this.props.updatePhylogenyView(changes);
  };

  onCnModeChange = (value) => this.updateView({ cnMode: value });

  clearSelection = () => {
    const { heatmap, plotId, nodes, selectPhylogenyNodes } = this.props;
    const cellIds = heatmap && heatmap.plotId === plotId ? heatmap.cellIds : nodes.map(node => node.id);
    selectPhylogenyNodes(cellIds.map(id => ({ id, selected: false })));
  };

  clearTracks = () => {
    this.closeDialog();
    this.props.clearPhylogenyTracks();
  };

  onClearSelectionClicked = () => {
    this.clearSelection();
    this.clearTracks();
  };

  onDownloadButtonClicked = () => {
    htmlToImage.toCanvas(this.container, { pixelRatio: 2 }).then(canvas => {
      downloadCanvasAsPng(canvas, `${(this.props.title || "phylogeny").replace(/\s+/g, "_").toLowerCase()}.png`);
    }).catch(error => message.error(this.props.t("general.error", { error })));
  };

  render() {
    const { t, phylogeny, height, maxHeight, samples, loading, title, selectPhylogenyNodes, nodes, highlightedNodes,
      heatmap, plotId, view = defaultView, cellTrackLoad, phylogenyPinned, treeOptions = [], activeTreeId } = this.props;
    const data = heatmap && heatmap.plotId === plotId ? heatmap : null;
    const linked = !!(data && data.tree && data.cellIds.length);
    const selected = nodes.filter(node => node.selected).length;
    const pending = cellTrackLoad.status === "loading";
    const trackCount = (this.props.plots || []).filter(plot => isDetailPlot(plot) && !plot.deleted).length;
    const mutationMode = view.mutationMode === "hidden" || !view.mutationMode ? "hidden" : "side";
    const cnMode = view.cnMode || "total";
    const mutationMetric = ["ref", "alt"].includes(view.mutationMetric) ? view.mutationMetric : "vaf";
    const matrixKind = view.matrixKind || "mutations";
    const intervals = Object.values((data && data.cnByCell) || {}).flat();
    const availableCnModes = ["total", ...["major", "minor"].filter(mode => intervals.some(interval => Number.isFinite(interval[`${mode}Cn`])))];
    const treeSelector = treeOptions.length > 1 && <Select className="phylogeny-tree-select" aria-label="Phylogeny tree" size="small"
      value={activeTreeId || treeOptions[0].id} onChange={this.onTreeChange}
      options={treeOptions.map(option => ({ value: option.id, label: option.title || option.source }))} />;
    const warnings = [...(data ? data.errors || [] : []), ...(cellTrackLoad.errors || [])];
    return <Wrapper className={linked ? "phylogeny-linked-panel" : "phylogeny-legacy-panel"}>
      <Card loading={loading} size="small"
        title={<Space><span role="img" className="anticon anticon-dashboard"><GrTree /></span>
          <span className="ant-pro-menu-item-title">{title || t("components.phylogeny-panel.header")}</span>
        </Space>}
        extra={<Space>
          {linked && <Tooltip title={phylogenyPinned ? "Unpin heatmap" : "Pin heatmap while scrolling tracks"}>
            <Button size="small" aria-label={phylogenyPinned ? "Unpin heatmap" : "Pin heatmap"}
              icon={phylogenyPinned ? <AiFillPushpin /> : <AiOutlinePushpin />}
              onClick={() => this.props.updatePhylogenyPin(!phylogenyPinned)} />
          </Tooltip>}
          <Tooltip title={t("components.download-as-png-tooltip")}><Button type="default" shape="circle" icon={<AiOutlineDownload />}
            size="small" aria-label="Download phylogeny image" onClick={this.onDownloadButtonClicked} /></Tooltip>
          {this.props.toggleVisibility && <Tooltip title={t("components.delete")}><Button type="text" aria-label="Remove phylogeny track" icon={<AiOutlineClose />} size="small"
            onClick={() => this.props.toggleVisibility(false, this.props.index, true)} /></Tooltip>}
        </Space>}>
        {!linked && <div className="phylogeny-toolbar">
          {treeSelector && <label className="phylogeny-control">Tree {treeSelector}</label>}
          <Text type="secondary"> {data && data.status === "error" ? "Tree data could not be loaded. Choose another tree or retry below." : "No linked genome data for this tree. You can choose another tree above."}</Text>
        </div>}
        {linked && <div className="phylogeny-toolbar">
          <div className="phylogeny-control-groups">
            <div className="phylogeny-control-group phylogeny-display-group" role="group" aria-label="Display controls">
              <div className="phylogeny-group-heading"><span className="phylogeny-group-title">Display</span></div>
              <div className="phylogeny-display-rows">
                <div className="phylogeny-display-row" role="group" aria-label="Tree">
                  <span className="phylogeny-row-label">Tree</span>
                  <div className="phylogeny-row-controls">
                    <Button size="small" onClick={() => this.updateView({ gutterHidden: !view.gutterHidden })}>
                      {view.gutterHidden ? "Show tree / labels" : "Hide tree / labels"}
                    </Button>
                    {treeSelector}
                  </div>
                </div>
                <div className="phylogeny-display-row" role="group" aria-label="Copy number">
                  <span className="phylogeny-row-label">Copy number</span>
                  <div className="phylogeny-row-controls">
                    <Select aria-label="Copy-number view" size="small" value={cnMode} style={{ width: 100 }}
                      onChange={this.onCnModeChange}
                      options={[{ value: "total", label: "Total" }, { value: "major", label: "Major", disabled: !availableCnModes.includes("major") }, { value: "minor", label: "Minor", disabled: !availableCnModes.includes("minor") }]} />
                  </div>
                </div>
                <div className="phylogeny-display-row" role="group" aria-label="Right heatmap">
                  <span className="phylogeny-row-label">Right heatmap</span>
                  <div className="phylogeny-row-controls">
                    <Button size="small" aria-pressed={mutationMode === "side"}
                      onClick={() => this.updateView({ mutationMode: mutationMode === "side" ? "hidden" : "side" })}>
                      {mutationMode === "side" ? "Hide" : "Show"} {matrixKind === "junctions" ? "junctions" : "mutations"}
                    </Button>
                    {mutationMode === "side" && <label className="phylogeny-control">Data
                      <Select aria-label="Right heatmap data" size="small" value={matrixKind} style={{ width: 130 }}
                        onChange={value => this.updateView({ matrixKind: value })}
                        options={[{ value: "mutations", label: "Mutations" }, { value: "junctions", label: "Junction CN" }]} />
                    </label>}
                    {mutationMode === "side" && matrixKind === "mutations" && <label className="phylogeny-control">Color
                      <Select aria-label="Mutation color" size="small" value={mutationMetric} style={{ width: 112 }}
                        onChange={value => this.updateView({ mutationMetric: value })}
                        options={[{ value: "vaf", label: "VAF" }, { value: "ref", label: "Ref count" }, { value: "alt", label: "Alt count" }]} />
                    </label>}
                  </div>
                </div>
                <div className="phylogeny-display-row" role="group" aria-label="Layout">
                  <span className="phylogeny-row-label">Layout</span>
                  <div className="phylogeny-row-controls">
                    <Button size="small" onClick={() => this.updateView({ fitRows: !view.fitRows })}>{view.fitRows ? "Readable rows" : "Fit rows"}</Button>
                    <label className="phylogeny-control">Height
                      <InputNumber aria-label="Heatmap height" size="small" min={140} max={maxHeight} step={20} value={height}
                        style={{ width: 72 }} onChange={value => Number.isFinite(value) && this.props.updatePhylogenyPanelHeight(value)} />
                    </label>
                    <Button size="small" onClick={() => this.props.updateDomains([[1, this.props.genomeLength]])}>Reset zoom</Button>
                  </div>
                </div>
              </div>
            </div>
            <div className="phylogeny-control-group phylogeny-selection-group" role="group" aria-label="Selection and tracks controls">
              <div className="phylogeny-group-heading">
                <span className="phylogeny-group-title">Selection &amp; tracks</span>
                <span className="phylogeny-group-counts">{selected} cell{selected === 1 ? "" : "s"} selected · {trackCount} panel{trackCount === 1 ? "" : "s"}</span>
              </div>
              <div className="phylogeny-selection-controls">
                <Space wrap size={[8, 8]}>
                  <Button size="small" type="primary" disabled={!selected || pending} onClick={this.confirmOpen}>Open selected ({selected})…</Button>
                  <Tooltip title="Clear selected cells and close all loaded detail tracks, including hidden panels. Pending openings are cancelled; the overview and zoom are retained.">
                    <Button size="small" disabled={loading || (!selected && !trackCount && !pending)} onClick={this.onClearSelectionClicked}>Clear selection</Button>
                  </Tooltip>
                </Space>
                <Space wrap size={[12, 8]}>
                  <Checkbox checked={!!view.selectedRowsOnly} onChange={event => this.updateView({ selectedRowsOnly: event.target.checked })}>Selected rows only</Checkbox>
                  <Checkbox checked={!!view.selectedTracksOnly} onChange={event => this.updateView({ selectedTracksOnly: event.target.checked })}>Hide unselected tracks</Checkbox>
                </Space>
              </div>
            </div>
          </div>
          <div className="phylogeny-summary">
            <Space wrap size={10}><Text>{data.cellIds.length} cell{data.cellIds.length === 1 ? "" : "s"}</Text>
              {data.mutations && <Text type="secondary">{data.mutations.variants.length.toLocaleString()} sites · {data.mutations.values.length.toLocaleString()} values</Text>}
            </Space>
          </div>
          {data.status !== "loading" && availableCnModes.length === 1 && <Text type="secondary" role="status">Allelic CN unavailable: no major/minor values were supplied for this tree.</Text>}
          {mutationMode === "side" && !(matrixKind === "junctions" ? data.junctions : data.mutations) && <Text type="secondary" role="status">{matrixKind === "junctions" ? "Junction CN" : "Mutation"} data unavailable for this tree.</Text>}
          <Text type="secondary" className="phylogeny-gesture-help">Drag: pan · Shift-drag: brush · {this.props.zoomedByCmd ? "⌘ + scroll" : "Scroll"}: zoom · Shift-click: range · Ctrl / ⌘-click: toggle cells{view.fitRows && mutationMode === "side" && matrixKind === "mutations" ? " · Mutation overview: click to inspect, Shift-drag to zoom, double-click to reset" : ""}</Text>
        </div>}
        {data && data.status === "loading" && <div className="phylogeny-load-status" role="status">
          Loading full cohort: {data.completed}/{data.total} genomes{data.completed === data.total ? "; loading mutations…" : ""}
          <Progress percent={data.total ? Math.round(100 * data.completed / data.total) : 0} size="small" showInfo={false} />
        </div>}
        {pending && <div className="phylogeny-load-status" role="status">
          Opening cells: {cellTrackLoad.completed}/{cellTrackLoad.total}
          <Button size="small" onClick={this.props.cancelPhylogenyCellLoad}>Cancel loading</Button>
          <Progress percent={cellTrackLoad.total ? Math.round(100 * cellTrackLoad.completed / cellTrackLoad.total) : 0} size="small" showInfo={false} />
        </div>}
        {cellTrackLoad.status === "cancelled" && <Text type="secondary">Loading cancelled. Already opened tracks are retained.</Text>}
        {warnings.length > 0 && <details className="phylogeny-warnings"><summary>{warnings.length} data warning{warnings.length === 1 ? "" : "s"}</summary>
          <ul>{warnings.map((error, index) => <li key={index}>{error}</li>)}</ul>
          <Button size="small" onClick={() => this.props.loadPhylogenyHeatmap(plotId)}>Retry overview</Button>
          <Text type="secondary"> To retry cell tracks, select the cells and open them again.</Text>
        </details>}
        <div ref={element => { this.container = element; }}><ContainerDimensions>{({ width }) => linked ?
          <PhylogenyHeatmap data={data} width={width} height={height}
            gutterWidth={view.gutterHidden ? 0 : view.gutterWidth} mutationMode={mutationMode} cnMode={cnMode} mutationMetric={mutationMetric}
            matrixKind={matrixKind} availableCnModes={availableCnModes}
            fitRows={!!view.fitRows} showFitControl={false} nodes={nodes} highlightedNodes={highlightedNodes} chromoBins={this.props.chromoBins} domains={this.props.domains}
            genomeLength={this.props.genomeLength} selectedRowsOnly={!!view.selectedRowsOnly}
            onSelectNodes={selectPhylogenyNodes} onCnModeChange={this.onCnModeChange} onDomainsChange={this.props.updateDomains}
            onHoverLocation={this.props.updateHoveredLocation} zoomedByCmd={this.props.zoomedByCmd}
            onGutterWidthChange={value => this.updateView({ gutterWidth: Math.max(100, Math.min(500, value)) })} /> :
          phylogeny && (!data || data.tree) ? <PhyloTree key={activeTreeId || plotId} width={width} height={height} newickString={phylogeny} samples={samples}
            onNodeClick={selectPhylogenyNodes} nodes={nodes} highlightedNodes={highlightedNodes} /> : <Text type="secondary">Tree unavailable.</Text>
        }</ContainerDimensions></div>
        <PanelResizeHandle height={height} maxHeight={maxHeight} onHeightChange={this.props.updatePhylogenyPanelHeight}
          label="Resize phylogeny panel height" disabled={maxHeight <= 140} />
      </Card>
    </Wrapper>;
  }
}

PhylogenyPanel.defaultProps = {
  phylogeny: null, height: 640, maxHeight: 1600, plots: [], samples: {}, nodes: [], highlightedNodes: [], view: defaultView,
  cellTrackLoad: { status: "idle", total: 0, completed: 0, errors: [] },
};
const mapStateToProps = (state, ownProps) => {
  const plotId = ownProps.plotId;
  return {
    loading: state.App.loading, plots: state.App.plots, nodes: ownProps.nodes || (plotId ? (state.App.phylogenyNodes || {})[plotId] || [] : state.App.nodes), highlightedNodes: ownProps.highlightedNodes || state.App.highlightedNodes,
    samples: state.App.samples,
    heatmap: Object.prototype.hasOwnProperty.call(ownProps, "heatmap") ? ownProps.heatmap : plotId ? (state.App.phylogenyHeatmaps || {})[plotId] || (state.App.phylogenyHeatmap && state.App.phylogenyHeatmap.plotId === plotId ? state.App.phylogenyHeatmap : null) : state.App.phylogenyHeatmap,
    view: ownProps.view || (plotId && state.App.phylogenyViews && state.App.phylogenyViews[plotId]) || defaultView,
    cellTrackLoad: state.App.cellTrackLoad, datasetEpoch: state.App.datasetEpoch,
    chromoBins: state.App.chromoBins, domains: state.App.domains, genomeLength: state.App.genomeLength,
    phylogenyPinned: state.App.phylogenyPinned, zoomedByCmd: state.App.zoomedByCmd,
  };
};
const { selectPhylogenyNodes, selectPhylogenyTree, updatePhylogenyView, openPhylogenyCells, cancelPhylogenyCellLoad, clearPhylogenyTracks,
  loadPhylogenyHeatmap, updateDomains, updateHoveredLocation, updatePhylogenyPin, updatePhylogenyPanelHeight } = appActions;
export const mapDispatchToProps = (dispatch, ownProps) => ({
  selectPhylogenyNodes: nodes => dispatch(selectPhylogenyNodes(nodes, ownProps.plotId)),
  updatePhylogenyView: changes => dispatch(updatePhylogenyView(changes, ownProps.plotId)),
  openPhylogenyCells: (ids, confirmed) => dispatch(openPhylogenyCells(ids, confirmed, ownProps.plotId)),
  ...Object.fromEntries(Object.entries({ selectPhylogenyTree, cancelPhylogenyCellLoad, clearPhylogenyTracks,
    loadPhylogenyHeatmap, updateDomains, updateHoveredLocation, updatePhylogenyPin, updatePhylogenyPanelHeight })
    .map(([key, creator]) => [key, (...args) => dispatch(creator(...args))])),
});
export default connect(mapStateToProps, mapDispatchToProps)(
  withTranslation("common")(handleViewport(PhylogenyPanel, { rootMargin: "-1.0px" }))
);
