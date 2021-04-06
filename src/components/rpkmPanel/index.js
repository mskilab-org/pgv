import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import ContainerDimensions from "react-container-dimensions";
import { Card, Space } from "antd";
import * as d3 from "d3";
import { withTranslation } from "react-i18next";
import { AiOutlineBarChart } from "react-icons/ai";
import Wrapper from "./index.style";
import appActions from "../../redux/genome/actions";
import BarPlot from "../barPlot";

const margins = {
  padding: 0,
};
const { getRPKMData } = appActions;

class RPKMPanel extends Component {
  componentDidMount() {
    let params = new URL(decodeURI(document.location)).searchParams;
    let file = params.get("file");
    file && this.props.getRPKMData(file);
  }

  render() {
    const { t, loading, rpkmData, domain, chromoBins } = this.props;
    if (!rpkmData) {
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
                {t("components.rpkm-panel.header")}
              </span>
            </Space>
          }
          extra={<p><b>{d3.format(",")(rpkmData.length)}</b> {t("components.rpkm-panel.datapoint", {count: rpkmData.length})}</p>}
        >
          <div className="ant-wrapper">
            <ContainerDimensions>
              {({ width, height }) => {
                return (
                  <BarPlot
                    {...{ width: width - 2 * margins.padding, height: height, results: rpkmData, xDomain: domain, chromoBins: chromoBins, title: t("components.rpkm-panel.title")}}
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
RPKMPanel.propTypes = {};
RPKMPanel.defaultProps = {};
const mapDispatchToProps = (dispatch) => ({
  getRPKMData: (file) => dispatch(getRPKMData(file)),
});
const mapStateToProps = (state) => ({
  loading: state.Strains.loading,
  domain: state.App.domain,
  rpkmData: state.Genome.rpkmData,
  chromoBins: state.App.chromoBins
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(RPKMPanel));
