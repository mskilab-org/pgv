import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import ContainerDimensions from "react-container-dimensions";
import { Card, Space, Empty } from "antd";
import { withTranslation } from "react-i18next";
import { GoGlobe } from "react-icons/go";
import Wrapper from "./index.style";
import GeoMap from "./geo-map";

class GeographyPanel extends Component {
  render() {
    let { t, strainsList } = this.props;

    return (
      <Wrapper empty={strainsList.length < 1}>
        <Card
          size="small"
          title={
            <Space>
              <span role="img" className="anticon anticon-dashboard">
                <GoGlobe />
              </span>
              <span className="ant-pro-menu-item-title">
                {t("components.geography-panel.header")}
              </span>
            </Space>
          }
        >
          <div className="ant-wrapper">
            {strainsList.length < 1 && (
              <Empty
                description={t("components.geography-panel.no-data-message")}
              />
            )}
            {strainsList.length > 0 && (
              <ContainerDimensions>
                {({ width, height }) => {
                  return <GeoMap {...{ width: width, height: height }} />;
                }}
              </ContainerDimensions>
            )}
          </div>
        </Card>
      </Wrapper>
    );
  }
}
GeographyPanel.propTypes = {
  strainsList: PropTypes.array
};
GeographyPanel.defaultProps = {
  strainsList: [],
};
const mapDispatchToProps = (dispatch) => ({});
const mapStateToProps = (state) => ({
  strainsList: state.App.strainsList,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(GeographyPanel));
