import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import ContainerDimensions from "react-container-dimensions";
import { Card, Space } from "antd";
import * as d3 from "d3";
import { withTranslation } from "react-i18next";
import { AiOutlineBarChart } from "react-icons/ai";
import Wrapper from "./index.style";
import appActions from "../../redux/app/actions";
import BarPlot from "../barPlot";

const margins = {
  padding: 0,
};

const { updateDomain } = appActions;

class BarPlotPanel extends Component {

  render() {
    const { t, loading, data, title, domain, defaultDomain, chromoBins, updateDomain } = this.props;
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
                <AiOutlineBarChart />
              </span>
              <span className="ant-pro-menu-item-title">
                {title}
              </span>
            </Space>
          }
          extra={<p><b>{d3.format(",")(data.length)}</b> {t("components.rpkm-panel.datapoint", {count: data.length})}</p>}
        >
          <div className="ant-wrapper">
            <ContainerDimensions>
              {({ width, height }) => {
                return (
                  <BarPlot
                    {...{ width: width - 2 * margins.padding, height: height, updateDomain: updateDomain, results: data, defaultDomain: defaultDomain, xDomain: domain, chromoBins: chromoBins}}
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
BarPlotPanel.propTypes = {};
BarPlotPanel.defaultProps = {};
const mapDispatchToProps = (dispatch) => ({
  updateDomain: (from, to) => dispatch(updateDomain(from,to))
});
const mapStateToProps = (state) => ({
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(BarPlotPanel));
