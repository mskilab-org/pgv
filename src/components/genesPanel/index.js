import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { Card, Space } from "antd";
import { withTranslation } from "react-i18next";
import { CgArrowsBreakeH } from "react-icons/cg";
import Wrapper from "./index.style";

class GenesPanel extends Component {
  render() {
    const { t } = this.props;
    return (
      <Wrapper>
        <Card
          size="small"
          title={
            <Space>
              <span role="img" className="anticon anticon-dashboard">
                <CgArrowsBreakeH />
              </span>
              <span className="ant-pro-menu-item-title">
                {t("components.genes-panel.header")}
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
GenesPanel.propTypes = {};
GenesPanel.defaultProps = {};
export default withTranslation("common")(GenesPanel);
