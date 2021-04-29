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

class ScatterPlotPanel extends Component {

  render() {
    const { t, loading, data, title, domain, chromoBins } = this.props;
    if (!data) {
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
                {title}
              </span>
            </Space>
          }
          extra={<p><b>{d3.format(",")(data.length)}</b> {t("components.coverage-panel.datapoint", {count: data.length})}</p>}
        >
          <div className="ant-wrapper">
            <ContainerDimensions>
              {({ width, height }) => {
                return (
                  <ScatterPlot
                    {...{ width: width - 2 * margins.padding, height: height, results: data, xDomain: domain, chromoBins: chromoBins}}
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
ScatterPlotPanel.propTypes = {};
ScatterPlotPanel.defaultProps = {};
const mapDispatchToProps = (dispatch) => ({
});
const mapStateToProps = (state) => ({
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(ScatterPlotPanel));
