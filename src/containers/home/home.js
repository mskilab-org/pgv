import React, { Component } from "react";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import { withRouter } from "react-router-dom";
import { ScrollToHOC } from "react-scroll-to";
import { Row, Col, Skeleton, Affix, Alert, Button } from "antd";
import HomeWrapper from "./home.style";
import HeaderPanel from "../../components/headerPanel";
import LegendPanel from "../../components/legendPanel";
import PhylogenyPanel from "../../components/phylogenyPanel";
import ScatterPlotPanel from "../../components/scatterPlotPanel";
import BarPlotPanel from "../../components/barPlotPanel";
import GenesPanel from "../../components/genesPanel";
import GenomePanel from "../../components/genomePanel";
import WalkPanel from "../../components/walkPanel";
import AnatomyPanel from "../../components/anatomyPanel";
import appActions from "../../redux/app/actions";
import BigwigPlotPanel from "../../components/bigwigPlotPanel";

const { updatePlots, updatePhylogenyView, selectPhylogenyNodes, selectPhylogenyTree, openPhylogenyCells } = appActions;

export class Home extends Component {
  state = { legendAffixed: false, genesAffixed: false, phyloAffixed: false,
    viewportHeight: typeof window === "undefined" ? 900 : window.innerHeight,
    headerHeight: 54, legendHeight: 67, genesHeight: 162 };
  measured = {};
  resizeObserver = null;

  componentDidMount() {
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(this.measurePanels);
      Object.values(this.measured).filter(Boolean).forEach(element => this.resizeObserver.observe(element));
    }
    window.addEventListener("resize", this.measurePanels);
    this.measurePanels();
  }
  componentDidUpdate() { this.measurePanels(); }
  componentWillUnmount() {
    if (this.resizeObserver) this.resizeObserver.disconnect();
    window.removeEventListener("resize", this.measurePanels);
  }
  setMeasuredElement = (key, element) => {
    if (this.resizeObserver && this.measured[key]) this.resizeObserver.unobserve(this.measured[key]);
    this.measured[key] = element;
    if (this.resizeObserver && element) this.resizeObserver.observe(element);
  };
  setHeaderRef = element => this.setMeasuredElement("headerHeight", element);
  setLegendRef = element => this.setMeasuredElement("legendHeight", element);
  setGenesRef = element => this.setMeasuredElement("genesHeight", element);
  measurePanels = () => {
    const next = {};
    Object.entries(this.measured).forEach(([key, element]) => {
      const height = element && element.getBoundingClientRect().height;
      if (height > 0 && Math.abs(height - this.state[key]) > 0.5) next[key] = height;
    });
    if (window.innerHeight !== this.state.viewportHeight) next.viewportHeight = window.innerHeight;
    if (Object.keys(next).length) this.setState(next);
  };
  onPanelAffixChanged = (panel, affixed) => {
    this.setState({ [panel]: affixed });
  };

  togglePlotVisibility = (checked, index, deleted = false) => {
    let plots = this.props.plots.map((plot, i) => i === index ? { ...plot, visible: checked, deleted } : plot);
    this.props.updatePlots(plots);
  };

  render() {
    const {
      loading,
      selectedCoordinate,
      chromoBins,
      legendPinned,
      genesPinned,
      phylogenyPinned,
      phylogenyPanelHeight,
      plots,
      phylogenyHeatmap,
      phylogenyHeatmaps = {},
      phylogenyView,
      phylogenyViews = {},
      phylogenyNodes = {},
      nodes = [],
    } = this.props;

    const phyloComponents = plots.filter((e) => e.type === "phylogeny" && !e.deleted);
    let phyloComponent = phyloComponents[0];
    let anatomyComponent = plots.find((e) => e.type === "anatomy");
    let genesComponent = plots.find((e) => e.type === "genes");
    const heatmapFor = plot => phylogenyHeatmaps[plot.id] || (phylogenyHeatmap && phylogenyHeatmap.plotId === plot.id ? phylogenyHeatmap : null);
    const defaultPanelView = { gutterWidth: 240, gutterHidden: false, mutationMode: "hidden", cnMode: "total", mutationMetric: "vaf", fitRows: false, selectedRowsOnly: false, selectedTracksOnly: false };
    // Global state mirrors recent actions; it does not acquire a new owner when
    // another panel is removed. Legacy fallback applies only without scoped state.
    const legacyPanel = plot => !Object.keys(phylogenyViews).length && !Object.keys(phylogenyNodes).length &&
      phylogenyHeatmap && phylogenyHeatmap.plotId === plot.id && plots.filter(item => item.type === "phylogeny").length === 1;
    const viewFor = plot => phylogenyViews[plot.id] || (legacyPanel(plot) ? (phylogenyView || defaultPanelView) : defaultPanelView);
    const nodesFor = plot => phylogenyNodes[plot.id] || (legacyPanel(plot) ? nodes : []);
    const linkedPanels = phyloComponents.map(plot => ({ plot, data: heatmapFor(plot), view: viewFor(plot), nodes: nodesFor(plot) }))
      .filter(panel => panel.plot.visible && panel.data && panel.data.tree && panel.data.cellIds.length);
    const linked = linkedPanels.length > 0;
    const view = linkedPanels[0] ? linkedPanels[0].view : (phylogenyView || {});
    const gutter = linked && !view.gutterHidden ? view.gutterWidth || 240 : 0;
    const sideVisible = linked && view.mutationMode === "side" && !!linkedPanels[0].data[view.matrixKind === "junctions" ? "junctions" : "mutations"];
    const legendOffset = this.state.headerHeight;
    const genesOffset = legendOffset + (legendPinned ? this.state.legendHeight : 0);
    const phylogenyOffset = genesOffset + (genesPinned && genesComponent && genesComponent.visible ? this.state.genesHeight : 0);
    const availableHeight = Math.max(200, this.state.viewportHeight - phylogenyOffset);
    const heatmapMaxHeight = linked && phylogenyPinned ? Math.max(140, Math.floor(availableHeight * 0.4) - 140) : 1600;
    const heatmapHeight = linked ? Math.min(phylogenyPanelHeight || 640, heatmapMaxHeight) : phylogenyPanelHeight;
    const phylogenyRows = phyloComponents.filter(plot => plot.visible).map((plot) => {
      const data = heatmapFor(plot);
      const panelView = viewFor(plot);
      const panelNodes = nodesFor(plot);
      const panelLinked = !!(data && data.tree && data.cellIds.length);
      return <Row key={plot.id} className="phylogeny-panel-row">
        <Col className="gutter-row" span={!panelLinked && anatomyComponent && anatomyComponent.visible && plot === phyloComponent ? 18 : 24}>
          <PhylogenyPanel loading={loading} phylogeny={plot.data} title={plot.title} height={heatmapHeight} maxHeight={heatmapMaxHeight}
            plotId={plot.id} index={plots.indexOf(plot)} toggleVisibility={this.togglePlotVisibility}
            heatmap={data} view={panelView} nodes={panelNodes} treeOptions={plot.treeOptions || []} activeTreeId={plot.activeTreeId}
            onUpdatePhylogenyView={changes => this.props.updatePhylogenyView(changes, plot.id)}
            onOpenPhylogenyCells={(ids, confirmed) => this.props.openPhylogenyCells(ids, confirmed, plot.id)}
            selectPhylogenyNodes={selectedNodes => this.props.selectPhylogenyNodes(selectedNodes, plot.id)}
            selectPhylogenyTree={this.props.selectPhylogenyTree} />
        </Col>
        {!linked && plot === phyloComponent && anatomyComponent && anatomyComponent.visible && <Col className="gutter-row" span={6}>
          <AnatomyPanel loading={loading} anatomy={anatomyComponent.data} title={anatomyComponent.title}
            height={phylogenyPanelHeight + 7} figure={anatomyComponent.figure} />
        </Col>}
      </Row>;
    });
    let phyloAnatomy = <>{phylogenyRows}{!phyloComponents.length && anatomyComponent && anatomyComponent.visible && <Row className=""><Col span={24}>
      <AnatomyPanel loading={loading} anatomy={anatomyComponent.data} title={anatomyComponent.title}
        height={phylogenyPanelHeight + 7} figure={anatomyComponent.figure} />
    </Col></Row>}</>;
    let plotPhyloAnatomyComponent = phylogenyPinned ? (
      <Affix
        offsetTop={phylogenyOffset}
        style={{ zIndex: 700 }}
        onChange={(affixed) =>
          this.onPanelAffixChanged("phyloAffixed", affixed)
        }
      >
        {phyloAnatomy}
      </Affix>
    ) : (
      phyloAnatomy
    );
    let plotComponents = [];
    if (genesComponent && genesComponent.data && genesComponent.visible) {
      let genesPlotComponent = genesPinned ? (
        <Affix
          offsetTop={genesOffset}
          style={{ zIndex: 900 }}
          onChange={(affixed) =>
            this.onPanelAffixChanged("genesAffixed", affixed)
          }
        >
          <GenesPanel
            {...{ genes: genesComponent.data, chromoBins, visible: false }}
          />
        </Affix>
      ) : (
        <GenesPanel
          {...{ genes: genesComponent.data, chromoBins, visible: false }}
        />
      );
      plotComponents.push(<div key="genes" ref={this.setGenesRef} className={linked ? "pgv-genes-panel phylogeny-aligned-panel" : "pgv-genes-panel"}>{genesPlotComponent}</div>);
    }
    if (
      phylogenyRows.length > 0 ||
      (anatomyComponent && anatomyComponent.visible)
    ) {
      plotComponents.push(<React.Fragment key="phylogeny">{plotPhyloAnatomyComponent}</React.Fragment>);
    }
    if (linked && anatomyComponent && anatomyComponent.visible) {
      plotComponents.push(<Row key="anatomy" className="ant-panel-container"><Col span={24}><AnatomyPanel loading={loading}
        anatomy={anatomyComponent.data} title={anatomyComponent.title} height={phylogenyPanelHeight + 7} figure={anatomyComponent.figure} /></Col></Row>);
    }
    plots.forEach((d, index) => {
      const cellId = d.sample || d.ownerFile;
      const panels = linkedPanels.filter(panel => panel.data.cellIds.includes(cellId));
      // A cohort's filter cannot hide another cohort's tracks. Shared cells
      // stay available if any owning panel still permits them.
      const filtered = panels.length > 0 && panels.every(panel => panel.view.selectedTracksOnly &&
        !panel.nodes.some(node => node.id === cellId && node.selected));
      if (d.deleted || filtered) {
        return;
      }
      if (["genome", "walk"].includes(d.type) && !d.data) return;
      let plotComponent = null;
      if (d.type === "genome") {
        plotComponent = (
          <GenomePanel
            {...{
              loading: loading || d.loadStatus === "loading",
              genome: d.data,
              title: d.title,
              chromoBins: chromoBins,
              visible: d.visible,
              index,
              toggleVisibility: this.togglePlotVisibility,
            }}
          />
        );
      } else if (d.type === "walk") {
        plotComponent = (
          <WalkPanel
            {...{
              loading: loading || d.loadStatus === "loading",
              maximumY: d.data.maximumY,
              walks: d.data.walks,
              title: d.title,
              chromoBins: chromoBins,
              visible: d.visible,
              index,
              toggleVisibility: this.togglePlotVisibility,
              tag: d.tag,
            }}
          />
        );
      } else if (d.type === "phylogeny" || d.type === "anatomy") {
        return;
      } else if (d.type === "genes") {
        return;
      } else if (d.type === "barplot") {
        plotComponent = (
          <BarPlotPanel
            {...{
              data: d.data,
              title: d.title,
              chromoBins,
              visible: d.visible,
              loading: loading || d.loadStatus === "loading",
              index,
              toggleVisibility: this.togglePlotVisibility,
            }}
          />
        );
      } else if (d.type === "scatterplot") {
        plotComponent = (
          <ScatterPlotPanel
            {...{
              data: d.data,
              title: d.title,
              chromoBins,
              visible: d.visible,
              loading: loading || d.loadStatus === "loading",
              index,
              toggleVisibility: this.togglePlotVisibility,
            }}
          />
        );
      } else if (d.type === "bigwig") {
        plotComponent = (
          <BigwigPlotPanel
            {...{
              data: d.data,
              defaultChartType: d.defaultChartType,
              tag: d.tag,
              title: d.title,
              chromoBins,
              visible: d.visible,
              loading: loading || d.loadStatus === "loading",
              index,
              toggleVisibility: this.togglePlotVisibility,
            }}
          />
        );
      }
      plotComponents.push(
        <Row
          key={d.id || `${d.ownerFile || d.sample}-${d.type}-${d.source || index}`}
          id={`${d.sample}-${d.type}`}
          data-cell-id={d.sample || d.ownerFile}
          data-plot-type={d.type}
          className={`ant-panel-container ant-home-map-panel-container${linked ? " phylogeny-aligned-panel" : ""}`}
        >
          <Col className="gutter-row" span={24}>
            {gutter > 0 && d.visible && <div className="phylogeny-track-label" title={d.sample || d.ownerFile}>
              <strong>{d.sample || d.ownerFile}</strong><small>{d.type}</small>
            </div>}
            {d.visible && d.loadError && <Alert type="warning" showIcon message={d.loadError}
              action={<Button size="small" onClick={() => this.togglePlotVisibility(true, index)}>Retry</Button>} />}
            {plotComponent}
          </Col>
        </Row>
      );
    });

    return (
      <HomeWrapper data-phylogeny-linked={linked ? "true" : undefined} style={{ "--phylogeny-gutter": `${gutter}px`, "--phylogeny-right-inset": sideVisible ? "calc(12px + min(280px, max(80px, calc(35% - 8.4px))))" : "0px" }}>
        <Skeleton active loading={loading}>
          <Affix offsetTop={0} style={{ zIndex: 1100 }}>
            <div className="ant-home-header-container" ref={this.setHeaderRef}>
              <HeaderPanel />
            </div>
          </Affix>
          <div className="ant-home-content-container">
            <Row className="ant-panel-container ant-home-legend-container" ref={this.setLegendRef}>
              <Col className="gutter-row" span={24}>
                {legendPinned ? (
                  <Affix
                    offsetTop={legendOffset}
                    style={{ zIndex: 1000 }}
                    onChange={(affixed) =>
                      this.onPanelAffixChanged("legendAffixed", affixed)
                    }
                  >
                    <LegendPanel
                      {...{
                        selectedCoordinate,
                      }}
                    />
                  </Affix>
                ) : (
                  <LegendPanel
                    {...{
                      selectedCoordinate,
                    }}
                  />
                )}
              </Col>
            </Row>
            {plotComponents.map((d, i) => d)}
          </div>
        </Skeleton>
      </HomeWrapper>
    );
  }
}
Home.propTypes = {};
Home.defaultProps = {};
const mapDispatchToProps = (dispatch) => ({
  updatePlots: (plots) => dispatch(updatePlots(plots)),
  updatePhylogenyView: (changes, plotId) => dispatch(updatePhylogenyView(changes, plotId)),
  selectPhylogenyNodes: (nodes, plotId) => dispatch(selectPhylogenyNodes(nodes, plotId)),
  selectPhylogenyTree: (plotId, treeId) => dispatch(selectPhylogenyTree(plotId, treeId)),
  openPhylogenyCells: (ids, confirmed, plotId) => dispatch(openPhylogenyCells(ids, confirmed, plotId)),
});
const mapStateToProps = (state) => ({
  tags: state.App.tags,
  selectedFiles: state.App.selectedFiles,
  datafiles: state.App.datafiles,
  chromoBins: state.App.chromoBins,
  plots: state.App.plots,
  legendPinned: state.App.legendPinned,
  genesPinned: state.App.genesPinned,
  phylogenyPinned: state.App.phylogenyPinned,
  phylogenyPanelHeight: state.App.phylogenyPanelHeight,
  loading: state.App.loading,
  phylogenyHeatmap: state.App.phylogenyHeatmap,
  phylogenyHeatmaps: state.App.phylogenyHeatmaps,
  phylogenyView: state.App.phylogenyView,
  phylogenyViews: state.App.phylogenyViews,
  phylogenyNodes: state.App.phylogenyNodes,
  nodes: state.App.nodes,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withRouter(withTranslation("common")(ScrollToHOC(Home))));
