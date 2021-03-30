import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { withTranslation } from "react-i18next";
import { AiFillBoxPlot } from "react-icons/ai";
import ContainerDimensions from "react-container-dimensions";
import { Card, Space } from "antd";
import { connect } from "react-redux";
import Legend from "./legend";
import Wrapper from "./index.style";

const margins = {
  padding: 12
};

class LegendPanel extends Component {
  render() {
    const { t, selectedCoordinate } = this.props;
    return (
      <Wrapper>
        <Card
          size="small"
          title={
            <Space>
              <span role="img" className="anticon anticon-dashboard">
                <AiFillBoxPlot />
              </span>
              <span className="ant-pro-menu-item-title">
                {t("components.legend-panel.header")}
              </span>
            </Space>
          }
          extra={<p>{selectedCoordinate}</p>}
        >          
          <ContainerDimensions>
            {({ width }) => {
              return <Legend className="ant-wrapper" {...{ width: (width - 2 * margins.padding) }} />;
            }}
          </ContainerDimensions>
        </Card>
      </Wrapper>
    );
  }
}
LegendPanel.propTypes = {
};
LegendPanel.defaultProps = {
};
const mapDispatchToProps = {};
const mapStateToProps = (state) => ({
  selectedCoordinate: state.App.selectedCoordinate
});
export default connect(mapStateToProps, mapDispatchToProps)(withTranslation("common")(LegendPanel));