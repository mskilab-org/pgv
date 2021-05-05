import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import { withRouter, Redirect } from "react-router-dom";
import { Row, Col, Skeleton } from "antd";
import HomeWrapper from "./home.style";
import HeaderPanel from "../../components/headerPanel";
import LegendPanel from "../../components/legendPanel";
import GeographyPanel from "../../components/geographyPanel";
import PhylogenyPanel from "../../components/phylogenyPanel";
import PcaPanel from "../../components/pcaPanel";
import ScatterPlotPanel from "../../components/coveragePanel";
import BarPlotPanel from "../../components/barPlotPanel";
import GenesPanel from "../../components/genesPanel";
import GenomePanel from "../../components/genomePanel";
import AnatomyPanel from "../../components/anatomyPanel";
import appActions from "../../redux/app/actions";

const { getDependencies, updateDomain } = appActions;

class Home extends Component {
  render() {
    const {
      t,
      datafile,
      strainsList,
      loading,
      panels,
      selectedCoordinate,
      genomeRange,
      domain,
      defaultDomain,
      chromoBins,
      plots
    } = this.props;

    let plotComponents = [];
    plots.forEach((d,i) => {
      let plotComponent = null;
      if (d.type === "genome") {
        plotComponent = <GenomePanel {...{
          loading,
          domain,
          defaultDomain,
          genome: d.data,
          title: d.title,
          chromoBins: chromoBins}}/>
      } else if (d.type === "genes") {
        plotComponent = <GenesPanel {...{ genes: d.data, domain, chromoBins }} />;
      } else if (d.type === "barplot") {
        plotComponent = <BarPlotPanel {...{ data: d.data, title: d.title, domain, defaultDomain, chromoBins, loading }} />;
      } else if (d.type === "scatterplot") {
        plotComponent = <ScatterPlotPanel {...{data: d.data, title: d.title, domain, defaultDomain, chromoBins, loading}} />
      }
      plotComponents.push(
        <Row key={i} className="ant-panel-container ant-home-map-panel-container">
          <Col className="gutter-row" span={24}>
            {plotComponent}
          </Col>
        </Row>)
    });

    return (
      <HomeWrapper>
        <Skeleton active loading={loading}>
          <div className="ant-home-header-container">
            <HeaderPanel
              {...{
                description: [datafile.reference],
                file: datafile.file,
                strainsList,
                tags: datafile.tags,
              }}
            />
          </div>
          <div className="ant-home-content-container">
            <Row className="ant-panel-container ant-home-legend-container">
              <Col className="gutter-row" span={24}>
                <LegendPanel
                  {...{
                    selectedCoordinate,
                    genomeRange,
                    domain,
                    defaultDomain,
                    chromoBins,
                  }}
                />
              </Col>
            </Row>
            {plotComponents.map((d,i) => d)}
          </div>
          {false && (
            <div className="ant-home-content-container">
              {panels.phylogeny.visible && (
                <Row className="ant-panel-container ant-home-map-panel-container">
                  <Col className="gutter-row" span={24}>
                    <PhylogenyPanel />
                  </Col>
                </Row>
              )}
              {panels.pca.visible && (
                <Row className="ant-panel-container ant-home-map-panel-container">
                  <Col className="gutter-row" span={24}>
                    <PcaPanel />
                  </Col>
                </Row>
              )}
              {(panels.geography.visible || panels.anatomy.visible) && (
                <Row
                  gutter={24}
                  className="ant-panel-container ant-home-map-panel-container"
                >
                  {panels.geography.visible && (
                    <Col
                      className="gutter-row"
                      span={panels.anatomy.visible ? 18 : 24}
                    >
                      <GeographyPanel />
                    </Col>
                  )}
                  {panels.anatomy.visible && (
                    <Col
                      className="gutter-row"
                      span={panels.geography.visible ? 6 : 24}
                    >
                      <AnatomyPanel />
                    </Col>
                  )}
                </Row>
              )}
            </div>
          )}
        </Skeleton>
      </HomeWrapper>
    );
  }
}
Home.propTypes = {};
Home.defaultProps = {};
const mapDispatchToProps = (dispatch) => ({
  getDependencies: (file) => dispatch(getDependencies(file)),
  updateDomain: (from, to) => dispatch(updateDomain(from, to)),
});
const mapStateToProps = (state) => ({
  panels: state.App.panels,
  file: state.App.file,
  tags: state.App.tags,
  defaultDomain: state.App.defaultDomain,
  datafile: state.App.datafile,
  datafiles: state.App.datafiles,
  strainsList: state.Strains.strainsList,
  selectedCoordinate: state.App.selectedCoordinate,
  genomeRange: state.App.genomeRange,
  domain: state.App.domain,
  chromoBins: state.App.chromoBins,
  plots: state.App.plots,
  loading: state.App.loading,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withRouter(withTranslation("common")(Home)));
