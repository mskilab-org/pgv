import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import { withRouter } from "react-router-dom";
import ContainerDimensions from "react-container-dimensions";
import { Row, Col } from "antd";
import HomeWrapper from "./home.style";
import Header from "../../components/header";
import Legend from "../../components/legend";
import appAction from "../../redux/app/actions";
import MapPanel from "../../components/mapPanel";
import PhylogramPanel from "../../components/phylogramPanel";
import PcaPanel from "../../components/pcaPanel";
import GenesPanel from "../../components/genesPanel";
import GenomePanel from "../../components/genomePanel";

const { getData } = appAction;

class Home extends Component {

  componentDidMount() {
    let params = (new URL(decodeURI(document.location))).searchParams;
    let datafile = params.get('datafile');
    datafile && this.props.getData(datafile);
  }
  render() {
    let { t, datafile, datafiles } = this.props;
    let selectedDataFile = datafiles.find(d => d.datafile === datafile);
    return (
      <HomeWrapper>
        <div className="ant-home-header-container">
          <Header title={datafile} subTitle={t("containers.home.category", {count: selectedDataFile && selectedDataFile.tags.length})} tags={selectedDataFile && selectedDataFile.tags}/>
        </div>
        <div className="ant-home-content-container">
          <Row className="ant-panel-container ant-home-legend-container">
            <Col className="gutter-row" span={24}>
              <ContainerDimensions>
                {({ width }) => {
                  return <Legend {...{ width }} />;
                }}
              </ContainerDimensions>
            </Col>
          </Row>
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
  data: PropTypes.object,
  datafile: PropTypes.string
};
Home.defaultProps = {
  data: {settings: {description: ""}},
  datafiles: [],
  datafile: ""
};
const mapDispatchToProps = (dispatch) => ({
  getData: (file) => dispatch(getData(file)),
});
const mapStateToProps = (state) => ({
  data: state.App.data,
  datafile: state.App.datafile,
  datafiles: state.App.datafiles,
});
export default connect(mapStateToProps, mapDispatchToProps)(withRouter(withTranslation("common")(Home)));
