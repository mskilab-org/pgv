import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { withTranslation } from "react-i18next";
import { AiFillBoxPlot } from "react-icons/ai";
import ContainerDimensions from "react-container-dimensions";
import { Card, Space } from "antd";
import { connect } from "react-redux";
import Wrapper from "./index.style";
import GenomeRangePanel from "./genomeRangePanel";
import LegendMultiBrush from "./legend-multi-brush";
const { Meta } = Card;
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
              return <LegendMultiBrush className="ant-wrapper" {...{ width: (width - 2 * margins.padding) }} />;
            }}
          </ContainerDimensions>
          <Meta description={<GenomeRangePanel/>} />
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
});
export default connect(mapStateToProps, mapDispatchToProps)(withTranslation("common")(LegendPanel));