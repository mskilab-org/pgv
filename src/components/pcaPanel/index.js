import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { Card, Space } from "antd";
import { withTranslation } from "react-i18next";
import { AiOutlineDotChart } from "react-icons/ai";
import Wrapper from "./index.style";

class PcaPanel extends Component {
  render() {
    const { t } = this.props;
    return (
      <Wrapper>
        <Card
          size="small"
          title={
            <Space>
              <span role="img" className="anticon anticon-dashboard">
                <AiOutlineDotChart />
              </span>
              <span className="ant-pro-menu-item-title">
                {t("components.pca-panel.header")}
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
PcaPanel.propTypes = {};
PcaPanel.defaultProps = {};
export default withTranslation("common")(PcaPanel);
