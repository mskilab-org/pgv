import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import { withRouter, Redirect } from "react-router-dom";
import { ScrollToHOC } from "react-scroll-to";
import { Row, Col, Skeleton, Affix } from "antd";
import HomeWrapper from "./home.style";
import HeaderPanel from "../../components/headerPanel";
import LegendPanel from "../../components/legendPanel";
import GeographyPanel from "../../components/geographyPanel";
import PhylogenyPanel from "../../components/phylogenyPanel";
import PcaPanel from "../../components/pcaPanel";
import ScatterPlotPanel from "../../components/scatterPlotPanel";
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
      selectedCoordinate,
      chromoBins,
      legendPinned,
      plots,
    } = this.props;

    let plotComponents = [];
    plots.forEach((d, i) => {
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
            }}
          />
        );
      } else if (d.type === "phylogeny") {
        plotComponent = (
          <PhylogenyPanel
            {...{
              loading,
              phylogeny: d.data,
              title: d.title,
              visible: d.visible
            }}
          />
        );
      } else if (d.type === "genes") {
        plotComponent = (
          <GenesPanel {...{ genes: d.data, chromoBins, visible: false }} />
        );
      } else if (d.type === "barplot") {
        plotComponent = (
          <BarPlotPanel
            {...{
              data: d.data,
              title: d.title,
              chromoBins,
              visible: d.visible,
              loading,
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
            }}
          />
        );
      }
      d.visible &&
        plotComponents.push(
          <Row
            key={i}
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
              <HeaderPanel
                {...{
                  description: [datafile.reference],
                  file: datafile.file,
                  strainsList,
                  tags: datafile.tags,
                }}
              />
            </div>
          </Affix>
          <div className="ant-home-content-container">
            <Row className="ant-panel-container ant-home-legend-container">
              <Col className="gutter-row" span={24}>
                {legendPinned ? <Affix offsetTop={120}>
                  <LegendPanel
                    {...{
                      selectedCoordinate,
                    }}
                  />
                </Affix> : <LegendPanel
                    {...{
                      selectedCoordinate,
                    }}
                  />}
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
  getDependencies: (file) => dispatch(getDependencies(file)),
  updateDomain: (from, to) => dispatch(updateDomain(from, to)),
});
const mapStateToProps = (state) => ({
  file: state.App.file,
  tags: state.App.tags,
  datafile: state.App.datafile,
  datafiles: state.App.datafiles,
  chromoBins: state.App.chromoBins,
  plots: state.App.plots,
  legendPinned: state.App.legendPinned,
  loading: state.App.loading,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withRouter(withTranslation("common")(ScrollToHOC(Home))));
