import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import { withTranslation } from "react-i18next";
import ContainerDimensions from "react-container-dimensions";
import WalkPlot from "../walkPlot";
import handleViewport from "react-in-viewport";
import {
  Card,
  Space,
  Button,
  Tooltip,
  message,
  Typography,
  Tag,
  InputNumber,
} from "antd";
import * as d3 from "d3";
import { GiPathDistance } from "react-icons/gi";
import {
  AiOutlineDownload,
  AiOutlineRight,
  AiOutlineDown,
  AiOutlineClose,
} from "react-icons/ai";
import {
  downloadCanvasAsPng,
  transitionStyle,
  domainsToLocation,
} from "../../helpers/utility";
import * as htmlToImage from "html-to-image";
import Wrapper from "./index.style";

const margins = {
  padding: 0,
  gap: 24,
  bar: 10,
  minHeight: 400,
  maxHeight: 1600,
  step: 10,
};

const { Text } = Typography;
const TAG_COLOR = { binset: "#f50", walk: "#2db7f5" };

class WalkPanel extends Component {
  state = { plotHeight: 400 };

  container = null;

  onDownloadButtonClicked = () => {
    htmlToImage
      .toCanvas(this.container, { pixelRatio: 2 })
      .then((canvas) => {
        downloadCanvasAsPng(
          canvas,
          `${this.props.title
            .replace(/\s+/g, "_")
            .toLowerCase()}_${domainsToLocation(
            this.props.chromoBins,
            this.props.domains
          )}.png`
        );
      })
      .catch((error) => {
        message.error(this.props.t("general.error", { error }));
      });
  };

  onMinHeightInputChanged = (plotHeight) => {
    this.setState({ plotHeight });
  };

  render() {
    const {
      t,
      walks,
      maximumY,
      title,
      inViewport,
      renderOutsideViewPort,
      visible,
      index,
      toggleVisibility,
      zoomedByCmd,
      tag,
    } = this.props;

    const { plotHeight } = this.state;
    const { minHeight, maxHeight, step } = margins;

    return (
      <Wrapper visible={visible} minHeight={minHeight}>
        <Card
          style={transitionStyle(inViewport || renderOutsideViewPort)}
          size="small"
          title={
            <Space>
              <span role="img" className="anticon anticon-dashboard">
                <GiPathDistance />
              </span>
              <span className="ant-pro-menu-item-title">{title}</span>
              <span>
                <b>{d3.format(",")(walks.length)}</b>{" "}
                {t("components.walk-panel.walk", {
                  count: walks.length,
                })}
              </span>
              {tag && (
                <span className="ant-pro-menu-item-title">
                  <Tag bordered={false} color={TAG_COLOR[tag]}>
                    {tag}
                  </Tag>
                </span>
              )}
            </Space>
          }
          extra={
            <Space>
              {tag === "binset" && (
                <Tooltip
                  title={t("components.walk-panel.input-height-tooltip", {
                    minHeight,
                    maxHeight,
                  })}
                >
                  <InputNumber
                    style={{ width: 170 }}
                    min={minHeight}
                    max={maxHeight}
                    step={step}
                    defaultValue={minHeight}
                    prefix={t("components.walk-panel.input-height-prefix")}
                    bordered={false}
                    onChange={(value) => this.onMinHeightInputChanged(value)}
                  />
                </Tooltip>
              )}
              {zoomedByCmd && (
                <Text type="secondary">{t("components.zoom-help")}</Text>
              )}
              <Tooltip title={t("components.download-as-png-tooltip")}>
                <Button
                  type="default"
                  shape="circle"
                  disabled={!visible}
                  icon={<AiOutlineDownload style={{ marginTop: 4 }} />}
                  size="small"
                  onClick={() => this.onDownloadButtonClicked()}
                />
              </Tooltip>
              <Tooltip
                title={
                  visible ? t("components.collapse") : t("components.expand")
                }
              >
                <Button
                  type="text"
                  icon={
                    visible ? (
                      <AiOutlineDown style={{ marginTop: 5 }} />
                    ) : (
                      <AiOutlineRight style={{ marginTop: 5 }} />
                    )
                  }
                  size="small"
                  onClick={() => toggleVisibility(!visible, index)}
                />
              </Tooltip>
              <Tooltip title={t("components.delete")}>
                <Button
                  type="text"
                  icon={<AiOutlineClose style={{ marginTop: 5 }} />}
                  size="small"
                  onClick={() => toggleVisibility(false, index, true)}
                />
              </Tooltip>
            </Space>
          }
        >
          {visible && (
            <div
              className="ant-wrapper"
              ref={(elem) => (this.container = elem)}
            >
              <ContainerDimensions>
                {({ width, height }) => {
                  return (
                    (inViewport || renderOutsideViewPort) && (
                      <WalkPlot
                        {...{
                          width: width - 2 * margins.padding,
                          height: d3.max([
                            maximumY * margins.bar * 1.5 + 3 * margins.gap,
                            plotHeight,
                          ]),
                          walks,
                        }}
                      />
                    )
                  );
                }}
              </ContainerDimensions>
            </div>
          )}
        </Card>
      </Wrapper>
    );
  }
}
WalkPanel.propTypes = {};
WalkPanel.defaultProps = {};
const mapDispatchToProps = (dispatch) => ({});
const mapStateToProps = (state) => ({
  renderOutsideViewPort: state.App.renderOutsideViewPort,
  zoomedByCmd: state.App.zoomedByCmd,
  domains: state.App.domains,
  chromoBins: state.App.chromoBins,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(
  withTranslation("common")(handleViewport(WalkPanel, { rootMargin: "-1.0px" }))
);
