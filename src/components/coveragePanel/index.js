import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import ContainerDimensions from "react-container-dimensions";
import { Card, Space } from "antd";
import * as d3 from "d3";
import { withTranslation } from "react-i18next";
import { AiOutlineDotChart } from "react-icons/ai";
import Wrapper from "./index.style";
import appActions from "../../redux/genome/actions";
import ScatterPlot from "../scatterPlot";

const margins = {
  padding: 0,
};
const { getCoverageData } = appActions;

class CoveragePanel extends Component {
  componentDidMount() {
    let params = new URL(decodeURI(document.location)).searchParams;
    let file = params.get("file");
    file && this.props.getCoverageData(file);
  }

  render() {
    const { t, loading, coverageData, domain, chromoBins } = this.props;
    if (!coverageData) {
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
                {t("components.coverage-panel.header")}
              </span>
            </Space>
          }
          extra={<p><b>{d3.format(",")(coverageData.length)}</b> {t("components.coverage-panel.datapoint", {count: coverageData.length})}</p>}
        >
          <div className="ant-wrapper">
            <ContainerDimensions>
              {({ width, height }) => {
                return (
                  <ScatterPlot
                    {...{ width: width - 2 * margins.padding, height: height, results: coverageData, xDomain: domain, chromoBins: chromoBins, title: t("components.coverage-panel.title")}}
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
CoveragePanel.propTypes = {};
CoveragePanel.defaultProps = {};
const mapDispatchToProps = (dispatch) => ({
  getCoverageData: (file) => dispatch(getCoverageData(file)),
});
const mapStateToProps = (state) => ({
  loading: state.Strains.loading,
  domain: state.App.domain,
  coverageData: state.Genome.coverageData,
  chromoBins: state.App.chromoBins
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(CoveragePanel));
