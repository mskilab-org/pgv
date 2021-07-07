import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import { Card, Space, Empty } from "antd";
import ContainerDimensions from "react-container-dimensions";
import { withTranslation } from "react-i18next";
import { GiAnatomy } from "react-icons/gi";
import Body from "./body";
import Wrapper from "./index.style";

class AnatomyPanel extends Component {
  render() {
    const { t, anatomy } = this.props;

    return (
      <Wrapper empty={anatomy.length < 1}>
        <Card
          size="small"
          title={
            <Space>
              <span role="img" className="anticon anticon-dashboard">
                <GiAnatomy />
              </span>
              <span className="ant-pro-menu-item-title">
                {t("components.anatomy-panel.header")}
              </span>
            </Space>
          }
        >
          <div className="ant-wrapper">
            {anatomy.length < 1 && (
              <Empty
                description={t("components.anatomy-panel.no-data-message")}
              />
            )}
            {anatomy.length > 0 && (
              <ContainerDimensions>
                {({ width, height }) => {
                  return (
                    <Body
                      {...{ width: width, height: height, locations: anatomy }}
                    />
                  );
                }}
              </ContainerDimensions>
            )}
          </div>
        </Card>
      </Wrapper>
    );
  }
}
AnatomyPanel.propTypes = {
  anatomy: PropTypes.array,
};
AnatomyPanel.defaultProps = {
  anatomy: [],
};
const mapDispatchToProps = (dispatch) => ({});
const mapStateToProps = (state) => ({
  anatomy: state.App.anatomy,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(AnatomyPanel));
