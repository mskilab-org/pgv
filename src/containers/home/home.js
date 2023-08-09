import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import { withRouter } from "react-router-dom";
import { ScrollToHOC } from "react-scroll-to";
import { Row, Col, Skeleton, Affix } from "antd";
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

const { updateDomain, updatePlots } = appActions;

class Home extends Component {
  state = { legendAffixed: false, genesAffixed: false, phyloAffixed: false };

  onPanelAffixChanged = (panel, affixed) => {
    this.setState({ panel: affixed });
  };

  togglePlotVisibility = (checked, index, deleted = false) => {
    let plots = [...this.props.plots];
    plots[index].visible = checked;
    plots[index].deleted = deleted;
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
    } = this.props;

    let phyloComponent = plots.find((e) => e.type === "phylogeny");
    let anatomyComponent = plots.find((e) => e.type === "anatomy");
    let genesComponent = plots.find((e) => e.type === "genes");
    let phyloAnatomy = (
      <Row className="">
        {phyloComponent && phyloComponent.visible && (
          <Col
            className="gutter-row"
            span={anatomyComponent && anatomyComponent.visible ? 18 : 24}
          >
            {phyloComponent && (
              <PhylogenyPanel
                {...{
                  loading,
                  phylogeny: phyloComponent.data,
                  title: phyloComponent.title,
                  height: phylogenyPanelHeight,
                }}
              />
            )}
          </Col>
        )}
        {anatomyComponent && anatomyComponent.visible && (
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
        offsetTop={
          genesPinned ? (legendPinned ? 283 : 207) : legendPinned ? 121 : 54
        }
        style={{
          position: this.state.legendAffixed ? "absolute" : "relative",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 700,
        }}
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
          offsetTop={legendPinned ? 121 : 54}
          style={{
            position: this.state.legendAffixed ? "absolute" : "relative",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 900,
          }}
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
      plotComponents.push(genesPlotComponent);
    }
    if (
      (phyloComponent && phyloComponent.visible) ||
      (anatomyComponent && anatomyComponent.visible)
    ) {
      plotComponents.push(plotPhyloAnatomyComponent);
    }
    plots.forEach((d, index) => {
      if (d.deleted) {
        return;
      }
      let plotComponent = null;
      if (d.type === "genome") {
        plotComponent = (
          <GenomePanel
            {...{
              loading,
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
              loading,
              maximumY: d.data.maximumY,
              walks: d.data.walks,
              title: d.title,
              chromoBins: chromoBins,
              visible: d.visible,
              index,
              toggleVisibility: this.togglePlotVisibility,
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
              loading,
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
              loading,
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
              loading,
              index,
              toggleVisibility: this.togglePlotVisibility,
            }}
          />
        );
      }
      plotComponents.push(
        <Row
          key={index}
          id={`${d.sample}-${d.type}`}
          className="ant-panel-container ant-home-map-panel-container"
        >
          <Col className="gutter-row" span={24}>
            {plotComponent}
          </Col>
        </Row>
      );
    });

    return (
      <HomeWrapper>
        <Skeleton active loading={loading}>
          <Affix offsetTop={0}>
            <div className="ant-home-header-container">
              <HeaderPanel />
            </div>
          </Affix>
          <div className="ant-home-content-container">
            <Row className="ant-panel-container ant-home-legend-container">
              <Col className="gutter-row" span={24}>
                {legendPinned ? (
                  <Affix
                    offsetTop={54}
                    style={{
                      position: this.state.legendAffixed
                        ? "absolute"
                        : "relative",
                      top: 0,
                      left: 0,
                      right: 0,
                      zIndex: 1000,
                    }}
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
  updateDomain: (from, to) => dispatch(updateDomain(from, to)),
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
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withRouter(withTranslation("common")(ScrollToHOC(Home))));
