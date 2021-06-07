import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import ContainerDimensions from "react-container-dimensions";
import { Card, Space, Tooltip, Switch, Button, message } from "antd";
import * as d3 from "d3";
import { withTranslation } from "react-i18next";
import { AiOutlineBarChart } from "react-icons/ai";
import { AiOutlineDownload } from "react-icons/ai";
import { downloadCanvasAsPng } from "../../helpers/utility";
import * as htmlToImage from "html-to-image";
import Wrapper from "./index.style";
import BarPlot from "../barPlot";

const margins = {
  padding: 0,
};

class BarPlotPanel extends Component {
  container = null;

  state = {
    checked: this.props.visible,
  };

  onSwitchChange = (checked) => {
    this.setState({ checked });
  };

  onDownloadButtonClicked = () => {
    htmlToImage
      .toCanvas(this.container, { pixelRatio: 2 })
      .then((canvas) => {
        downloadCanvasAsPng(
          canvas,
          `${this.props.title.replace(/\s+/g, "_").toLowerCase()}.png`
        );
      })
      .catch((error) => {
        message.error(this.props.t("general.error", { error }));
      });
  };

  render() {
    const { t, loading, data, title } = this.props;
    const { checked } = this.state;
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
              <span><b>{d3.format(",")(data.length)}</b> {t("components.rpkm-panel.datapoint", {count: data.length})}</span>
            </Space>
          }
          extra={
            <Space>
            <Tooltip title={t("components.visibility-switch-tooltip")}>
              <Switch
                size="small"
                checked={checked}
                onClick={(e) => this.onSwitchChange(e)}
              />
            </Tooltip>
            <Tooltip title={t("components.download-as-png-tooltip")}>
              <Button
                type="default"
                shape="circle"
                icon={<AiOutlineDownload />}
                size="small"
                onClick={() => this.onDownloadButtonClicked()}
              />
            </Tooltip>
          </Space>
          }
        >
          {checked && (<div className="ant-wrapper" ref={(elem) => (this.container = elem)}>
            <ContainerDimensions>
              {({ width, height }) => {
                return (
                  <BarPlot
                    {...{ width: width - 2 * margins.padding, height: height, results: data}}
                  />
                );
              }}
            </ContainerDimensions>
          </div>)}
        </Card>
      </Wrapper>
    );
  }
}
BarPlotPanel.propTypes = {};
BarPlotPanel.defaultProps = {};
const mapDispatchToProps = (dispatch) => ({
});
const mapStateToProps = (state) => ({
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(BarPlotPanel));
