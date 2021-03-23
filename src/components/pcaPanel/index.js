import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import ContainerDimensions from "react-container-dimensions";
import { Card, Space } from "antd";
import * as d3 from "d3";
import { withTranslation } from "react-i18next";
import { AiOutlineDotChart } from "react-icons/ai";
import Wrapper from "./index.style";
import appActions from "../../redux/strains/actions";
import ScatterPlot from "../scatterPlot";

const margins = {
  padding: 0,
};
const { getPcaData } = appActions;

class PcaPanel extends Component {
  componentDidMount() {
    let params = new URL(decodeURI(document.location)).searchParams;
    let file = params.get("file");
    file && this.props.getPcaData(file);
  }

  render() {
    const { t, loading, pcaData, domain } = this.props;
    if (!pcaData) {
      return null;
    }
    return (
      <Wrapper>
        <Card
          loading={loading}
          size="small"
          title={
            <Space>
              <span role="img" className="anticon anticon-dashboard">
                <AiOutlineDotChart />
              </span>
              <span className="ant-pro-menu-item-title">
                {t("components.pca-panel.header")}
              </span>
            </Space>
          }
          extra={<p><b>{d3.format(",.2r")(pcaData.length)}</b> {t("components.pca-panel.datapoint", {count: pcaData.length})}</p>}
        >
          <div className="ant-wrapper">
            <ContainerDimensions>
              {({ width, height }) => {
                return (
                  <ScatterPlot
                    {...{ width: width - 2 * margins.padding, height: height, results: pcaData, xDomain: domain, title: t("components.pca-panel.title")}}
                  />
                );
              }}
            </ContainerDimensions>
          </div>
        </Card>
      </Wrapper>
    );
  }
}
PcaPanel.propTypes = {};
PcaPanel.defaultProps = {};
const mapDispatchToProps = (dispatch) => ({
  getPcaData: (file) => dispatch(getPcaData(file)),
});
const mapStateToProps = (state) => ({
  loading: state.Strains.loading,
  domain: state.App.domain,
  pcaData: state.Strains.pcaData,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(PcaPanel));
