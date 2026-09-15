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

const { updatePlots } = appActions;

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
      phylogenyView,
      nodes = [],
    } = this.props;

    let phyloComponent = plots.find((e) => e.type === "phylogeny");
    let anatomyComponent = plots.find((e) => e.type === "anatomy");
    let genesComponent = plots.find((e) => e.type === "genes");
    const linked = !!(phyloComponent && phyloComponent.visible && phylogenyHeatmap &&
      phylogenyHeatmap.plotId === phyloComponent.id && phylogenyHeatmap.tree && phylogenyHeatmap.cellIds.length);
    const view = phylogenyView || {};
    const gutter = linked && !view.gutterHidden ? view.gutterWidth || 240 : 0;
    const selectedCells = new Set(nodes.filter(node => node.selected).map(node => node.id));
    const cohortCells = new Set(linked ? phylogenyHeatmap.cellIds : []);
    const legendOffset = this.state.headerHeight;
    const genesOffset = legendOffset + (legendPinned ? this.state.legendHeight : 0);
    const phylogenyOffset = genesOffset + (genesPinned && genesComponent && genesComponent.visible ? this.state.genesHeight : 0);
    const availableHeight = Math.max(200, this.state.viewportHeight - phylogenyOffset);
    const heatmapMaxHeight = linked && phylogenyPinned ? Math.max(140, Math.floor(availableHeight * 0.4) - 140) : 1600;
    const heatmapHeight = linked ? Math.min(phylogenyPanelHeight || 640, heatmapMaxHeight) : phylogenyPanelHeight;
    let phyloAnatomy = (
      <Row className="">
        {phyloComponent && phyloComponent.visible && (
          <Col
            className="gutter-row"
            span={!linked && anatomyComponent && anatomyComponent.visible ? 18 : 24}
          >
            {phyloComponent && (
              <PhylogenyPanel
                {...{
                  loading,
                  phylogeny: phyloComponent.data,
                  title: phyloComponent.title,
                  height: heatmapHeight,
                  maxHeight: heatmapMaxHeight,
                  plotId: phyloComponent.id,
                }}
              />
            )}
          </Col>
        )}
        {!linked && anatomyComponent && anatomyComponent.visible && (
          <Col
            className="gutter-row"
            span={phyloComponent && phyloComponent.visible ? 6 : 24}
          >
            <AnatomyPanel
              {...{
                loading,
                anatomy: anatomyComponent.data,
                title: anatomyComponent.title,
                height: phylogenyPanelHeight + 7,
                figure: anatomyComponent.figure,
              }}
            />
          </Col>
        )}
      </Row>
    );
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
      (phyloComponent && phyloComponent.visible) ||
      (anatomyComponent && anatomyComponent.visible)
    ) {
      plotComponents.push(<React.Fragment key="phylogeny">{plotPhyloAnatomyComponent}</React.Fragment>);
    }
    if (linked && anatomyComponent && anatomyComponent.visible) {
      plotComponents.push(<Row key="anatomy" className="ant-panel-container"><Col span={24}><AnatomyPanel loading={loading}
        anatomy={anatomyComponent.data} title={anatomyComponent.title} height={phylogenyPanelHeight + 7} figure={anatomyComponent.figure} /></Col></Row>);
    }
    plots.forEach((d, index) => {
      if (d.deleted || (linked && view.selectedTracksOnly && cohortCells.has(d.sample || d.ownerFile) && !selectedCells.has(d.sample || d.ownerFile))) {
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
      <HomeWrapper data-phylogeny-linked={linked ? "true" : undefined} style={{ "--phylogeny-gutter": `${gutter}px` }}>
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
  phylogenyView: state.App.phylogenyView,
  nodes: state.App.nodes,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withRouter(withTranslation("common")(ScrollToHOC(Home))));
