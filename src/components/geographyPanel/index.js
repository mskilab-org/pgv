import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { Card, Space } from "antd";
import { withTranslation } from "react-i18next";
import { GoGlobe } from "react-icons/go";
import Wrapper from "./index.style";

class GeographyPanel extends Component {
  render() {
    const { t } = this.props;
    return (
      <Wrapper>
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
          Content
        </Card>
      </Wrapper>
    );
  }
}
GeographyPanel.propTypes = {};
GeographyPanel.defaultProps = {};
export default withTranslation("common")(GeographyPanel);
