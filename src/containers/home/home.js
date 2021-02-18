import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import { withRouter } from "react-router-dom";
import ContainerDimensions from "react-container-dimensions";
import { Row, Col } from "antd";
import HomeWrapper from "./home.style";
import Header from "../../components/headerPanel";
import Legend from "../../components/legend";
import MapPanel from "../../components/mapPanel";
import PhylogramPanel from "../../components/phylogramPanel";
import PcaPanel from "../../components/pcaPanel";
import GenesPanel from "../../components/genesPanel";
import GenomePanel from "../../components/genomePanel";

class Home extends Component {


  render() {

    return (
      <HomeWrapper>
        <div className="ant-home-header-container">
          <Header/>
        </div>
        <div className="ant-home-content-container">
          <Row gutter={24} className="ant-panel-container ant-home-map-panel-container">
            <Col className="gutter-row" span={12}>
              <PhylogramPanel/>
            </Col>
            <Col className="gutter-row" span={12}>
              <MapPanel/>
            </Col>
          </Row>
          <Row className="ant-panel-container ant-home-map-panel-container">
            <Col className="gutter-row" span={24}>
              <PcaPanel/>
            </Col>
          </Row>
          <Row className="ant-panel-container ant-home-legend-container">
            <Col className="gutter-row" span={24}>
              <ContainerDimensions>
                {({ width }) => {
                  return <Legend {...{ width }} />;
                }}
              </ContainerDimensions>
            </Col>
          </Row>
          <Row className="ant-panel-container ant-home-map-panel-container">
            <Col className="gutter-row" span={24}>
              <GenesPanel/>
            </Col>
          </Row>
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
};
const mapDispatchToProps = (dispatch) => ({
});
const mapStateToProps = (state) => ({
});
export default connect(mapStateToProps, mapDispatchToProps)(withRouter(withTranslation("common")(Home)));
