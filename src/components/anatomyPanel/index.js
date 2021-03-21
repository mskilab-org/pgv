import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { Card, Space } from "antd";
import { withTranslation } from "react-i18next";
import { GiAnatomy } from "react-icons/gi";
import {ReactComponent as Figure} from './anatomy.svg';

import Wrapper from "./index.style";

class AnatomyPanel extends Component {
  render() {
    const { t } = this.props;
    return (
      <Wrapper>
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
          <Figure width={400} height={400}/>
        </Card>
      </Wrapper>
    );
  }
}
AnatomyPanel.propTypes = {};
AnatomyPanel.defaultProps = {};
export default withTranslation("common")(AnatomyPanel);
