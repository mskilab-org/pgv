import React, { Component } from "react";
import { connect } from "react-redux";
import handleViewport from "react-in-viewport";
import { Card, Space, Tooltip, Button, message, Select, Checkbox, Modal, Progress, InputNumber, Typography } from "antd";
import { AiOutlineDownload, AiOutlinePushpin, AiFillPushpin } from "react-icons/ai";
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
const defaultView = { gutterWidth: 240, gutterHidden: false, mutationMode: "hidden", selectedRowsOnly: false, selectedTracksOnly: false };

/** Existing PGV Card/container; the dense visualization is an interchangeable child. */
export class PhylogenyPanel extends Component {
  container = null;
  openDialog = null;
  pendingOpen = null;
  disposed = false;

  componentDidUpdate(previous) {
    if (previous.plotId !== this.props.plotId || previous.datasetEpoch !== this.props.datasetEpoch) this.closeDialog();
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
          this.props.openPhylogenyCells(ids, true);
        }
      },
    });
  };

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
      heatmap, plotId, view = defaultView, cellTrackLoad, phylogenyPinned } = this.props;
    if (!phylogeny) return null;
    const data = heatmap && heatmap.plotId === plotId ? heatmap : null;
    const linked = !!(data && data.tree && data.cellIds.length);
    const selected = nodes.filter(node => node.selected).length;
    const pending = cellTrackLoad.status === "loading";
    const trackCount = (this.props.plots || []).filter(plot => isDetailPlot(plot) && !plot.deleted).length;
    const mutationMode = view.mutationMode || "hidden";
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
        </Space>}>
        {linked && <div className="phylogeny-toolbar">
          <div className="phylogeny-control-groups">
            <div className="phylogeny-control-group" role="group" aria-label="Display controls">
              <div className="phylogeny-group-heading"><span className="phylogeny-group-title">Display</span></div>
              <Space wrap size={[10, 8]}>
                <Button size="small" onClick={() => this.props.updatePhylogenyView({ gutterHidden: !view.gutterHidden })}>
                  {view.gutterHidden ? "Show tree / labels" : "Hide tree / labels"}
                </Button>
                <label className="phylogeny-control">Mutations
                  <Select aria-label="Mutation display" size="small" value={mutationMode} style={{ width: 100 }}
                    onChange={value => this.props.updatePhylogenyView({ mutationMode: value })}
                    options={[{ value: "hidden", label: "Hidden" }, { value: "overlay", label: "Overlay" }, { value: "paired", label: "Paired" }]} />
                </label>
                <label className="phylogeny-control">Height
                  <InputNumber aria-label="Heatmap height" size="small" min={140} max={maxHeight} step={20} value={height}
                    style={{ width: 72 }} onChange={value => Number.isFinite(value) && this.props.updatePhylogenyPanelHeight(value)} />
                </label>
                <Button size="small" onClick={() => this.props.updateDomains([[1, this.props.genomeLength]])}>Reset zoom</Button>
              </Space>
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
                  <Checkbox checked={!!view.selectedRowsOnly} onChange={event => this.props.updatePhylogenyView({ selectedRowsOnly: event.target.checked })}>Selected rows only</Checkbox>
                  <Checkbox checked={!!view.selectedTracksOnly} onChange={event => this.props.updatePhylogenyView({ selectedTracksOnly: event.target.checked })}>Hide unselected tracks</Checkbox>
                </Space>
              </div>
            </div>
          </div>
          <div className="phylogeny-summary">
            <Space wrap size={10}><Text>{data.cellIds.length} cell{data.cellIds.length === 1 ? "" : "s"}</Text>
              {data.mutations && <Text type="secondary">{data.mutations.variants.length.toLocaleString()} sites · {data.mutations.values.length.toLocaleString()} values</Text>}
            </Space>
          </div>
          <Text type="secondary" className="phylogeny-gesture-help">Drag: pan · Shift-drag: brush · {this.props.zoomedByCmd ? "⌘ + scroll" : "Scroll"}: zoom · Shift-click: range · Ctrl / ⌘-click: toggle cells</Text>
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
            gutterWidth={view.gutterHidden ? 0 : view.gutterWidth} mutationMode={mutationMode}
            nodes={nodes} highlightedNodes={highlightedNodes} chromoBins={this.props.chromoBins} domains={this.props.domains}
            genomeLength={this.props.genomeLength} selectedRowsOnly={!!view.selectedRowsOnly}
            onSelectNodes={selectPhylogenyNodes} onDomainsChange={this.props.updateDomains}
            onHoverLocation={this.props.updateHoveredLocation} zoomedByCmd={this.props.zoomedByCmd}
            onGutterWidthChange={value => this.props.updatePhylogenyView({ gutterWidth: Math.max(100, Math.min(500, value)) })} /> :
          <PhyloTree width={width} height={height} newickString={phylogeny} samples={samples}
            onNodeClick={selectPhylogenyNodes} nodes={nodes} highlightedNodes={highlightedNodes} />
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
const mapStateToProps = state => ({
  loading: state.App.loading, plots: state.App.plots, nodes: state.App.nodes, highlightedNodes: state.App.highlightedNodes,
  samples: state.App.samples, heatmap: state.App.phylogenyHeatmap, view: state.App.phylogenyView,
  cellTrackLoad: state.App.cellTrackLoad, datasetEpoch: state.App.datasetEpoch,
  chromoBins: state.App.chromoBins, domains: state.App.domains, genomeLength: state.App.genomeLength,
  phylogenyPinned: state.App.phylogenyPinned, zoomedByCmd: state.App.zoomedByCmd,
});
const { selectPhylogenyNodes, updatePhylogenyView, openPhylogenyCells, cancelPhylogenyCellLoad, clearPhylogenyTracks,
  loadPhylogenyHeatmap, updateDomains, updateHoveredLocation, updatePhylogenyPin, updatePhylogenyPanelHeight } = appActions;
export default connect(mapStateToProps, { selectPhylogenyNodes, updatePhylogenyView, openPhylogenyCells,
  cancelPhylogenyCellLoad, clearPhylogenyTracks, loadPhylogenyHeatmap, updateDomains, updateHoveredLocation, updatePhylogenyPin, updatePhylogenyPanelHeight })(
  withTranslation("common")(handleViewport(PhylogenyPanel, { rootMargin: "-1.0px" }))
);
