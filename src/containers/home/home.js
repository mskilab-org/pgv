import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import { withRouter } from "react-router-dom";
import { Row, Col } from "antd";
import HomeWrapper from "./home.style";
import HeaderPanel from "../../components/headerPanel";
import LegendPanel from "../../components/legendPanel";
import GeographyPanel from "../../components/geographyPanel";
import PhylogenyPanel from "../../components/phylogenyPanel";
import PcaPanel from "../../components/pcaPanel";
import CoveragePanel from "../../components/coveragePanel";
import RPKMPanel from "../../components/rpkmPanel";
import GenesPanel from "../../components/genesPanel";
import GenomePanel from "../../components/genomePanel";
import AnatomyPanel from "../../components/anatomyPanel";

class Home extends Component {

  render() {
    const { panels } = this.props;
    return (
      <HomeWrapper>
        <div className="ant-home-header-container">
          <HeaderPanel/>
        </div>
        <div className="ant-home-content-container">
          {panels.phylogeny.visible && <Row className="ant-panel-container ant-home-map-panel-container">
            <Col className="gutter-row" span={24}>
              <PhylogenyPanel/>
            </Col>
          </Row>}
          {panels.pca.visible && <Row className="ant-panel-container ant-home-map-panel-container">
            <Col className="gutter-row" span={24}>
              <PcaPanel/>
            </Col>
          </Row>}
          {(panels.geography.visible || panels.anatomy.visible) && <Row gutter={24} className="ant-panel-container ant-home-map-panel-container">
            {panels.geography.visible && <Col className="gutter-row" span={panels.anatomy.visible ? 18 : 24}>
              <GeographyPanel/>
            </Col>}
            {panels.anatomy.visible && <Col className="gutter-row" span={panels.geography.visible ? 6 : 24}>
              <AnatomyPanel/>
            </Col>}
          </Row>}
          <Row className="ant-panel-container ant-home-legend-container">
            <Col className="gutter-row" span={24}>
              <LegendPanel/>
            </Col>
          </Row>
          {panels.genes.visible && <Row className="ant-panel-container ant-home-map-panel-container">
            <Col className="gutter-row" span={24}>
              <GenesPanel/>
            </Col>
          </Row>}
          {panels.rpkm.visible && <Row className="ant-panel-container ant-home-map-panel-container">
            <Col className="gutter-row" span={24}>
              <RPKMPanel/>
            </Col>
          </Row>}
          {panels.coverage.visible && <Row className="ant-panel-container ant-home-map-panel-container">
            <Col className="gutter-row" span={24}>
              <CoveragePanel/>
            </Col>
          </Row>}
          <Row className="ant-panel-container ant-home-map-panel-container">
            <Col className="gutter-row" span={24}>
              <GenomePanel/>
            </Col>
          </Row>
        </div>
      </HomeWrapper>
    );
  }
}
Home.propTypes = {
};
Home.defaultProps = {
  panels: {
    phylogeny: {visible: true},
    geography: {visible: true},
    pca: {visible: true},
    genes: {visible: true},
    anatomy: {visible: false},
    coverage: {visible: false},
    rpkm: {visible: false},
  }
};
const mapDispatchToProps = (dispatch) => ({
});
const mapStateToProps = (state) => ({
  panels: state.App.panels
});
export default connect(mapStateToProps, mapDispatchToProps)(withRouter(withTranslation("common")(Home)));
