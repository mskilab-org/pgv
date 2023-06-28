import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import ContainerDimensions from "react-container-dimensions";
import handleViewport from "react-in-viewport";
import {
  Card,
  Space,
  Tooltip,
  Button,
  message,
  Row,
  Col,
  Alert,
  Typography,
  Segmented,
} from "antd";
import * as d3 from "d3";
import { withTranslation } from "react-i18next";
import {
  AiOutlineDotChart,
  AiOutlineDownload,
  AiOutlineDown,
  AiOutlineRight,
  AiOutlineAreaChart,
  AiOutlineClose,
} from "react-icons/ai";
import { downloadCanvasAsPng, transitionStyle } from "../../helpers/utility";
import * as htmlToImage from "html-to-image";
import Wrapper from "./index.style";
import BigwigPlot from "../bigwigPlot";

const { Text } = Typography;

const margins = {
  padding: 0,
  gap: 0,
};

class BigwigPlotPanel extends Component {
  container = null;

  constructor(props) {
    super(props);

    this.state = {
      plotType: props.defaultChartType,
    };
  }

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

  handleSegmentedChange = (plotType) => {
    this.setState({ plotType });
  };

  render() {
    const {
      t,
      loading,
      data,
      domains,
      title,
      inViewport,
      renderOutsideViewPort,
      visible,
      index,
      toggleVisibility,
      zoomedByCmd,
    } = this.props;
    const { plotType } = this.state;
    return (
      <Wrapper visible={visible}>
        <Card
          style={transitionStyle(inViewport || renderOutsideViewPort)}
          loading={loading}
          size="small"
          title={
            <Space>
              <span role="img" className="anticon anticon-dashboard">
                {plotType === "area" ? (
                  <AiOutlineAreaChart />
                ) : (
                  <AiOutlineDotChart />
                )}
              </span>
              <span className="ant-pro-menu-item-title">{title}</span>
              {data ? (
                <span>
                  <b>{d3.format(",")(data.length)}</b>{" "}
                  {t("components.area-panel.datapoint", {
                    count: data.length,
                  })}
                </span>
              ) : (
                false && (
                  <Text type="danger">{t("general.invalid-arrow-file")}</Text>
                )
              )}
            </Space>
          }
          extra={
            <Space>
              {
                <Segmented
                  size="small"
                  defaultValue={plotType}
                  onChange={(plotType) => this.handleSegmentedChange(plotType)}
                  options={[
                    {
                      value: "area",
                      icon: <AiOutlineAreaChart />,
                    },
                    {
                      value: "scatterplot",
                      icon: <AiOutlineDotChart />,
                    },
                  ]}
                />
              }
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
                      <Row style={{ width }} gutter={[margins.gap, 0]}>
                        <Col flex={1}>
                          {data ? (
                            <BigwigPlot
                              {...{
                                width,
                                height,
                                domains,
                                data,
                                plotType,
                              }}
                            />
                          ) : (
                            false && (
                              <Alert
                                message={t("general.invalid-arrow-file")}
                                description={t(
                                  "general.invalid-arrow-file-detail"
                                )}
                                type="error"
                                showIcon
                              />
                            )
                          )}
                        </Col>
                      </Row>
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
BigwigPlotPanel.propTypes = {};
BigwigPlotPanel.defaultProps = {
  defaultChartType: "area",
};
const mapDispatchToProps = (dispatch) => ({});
const mapStateToProps = (state) => ({
  domains: state.App.domains,
  renderOutsideViewPort: state.App.renderOutsideViewPort,
  zoomedByCmd: state.App.zoomedByCmd,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(
  withTranslation("common")(
    handleViewport(BigwigPlotPanel, { rootMargin: "-1.0px" })
  )
);