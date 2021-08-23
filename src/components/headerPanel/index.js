import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import {
  PageHeader,
  Space,
  Tag,
  Button,
  Tooltip,
  message,
  Drawer,
  Row,
  Col,
  Switch,
  Divider
} from "antd";
import { AiOutlineDownload, AiOutlineSetting } from "react-icons/ai";
import { downloadCanvasAsPng } from "../../helpers/utility";
import html2canvas from "html2canvas";
import Wrapper from "./index.style";
import appActions from "../../redux/app/actions";

const { updatePlots, updateLegendPin } = appActions;

class HeaderPanel extends Component {
  state = { visible: false };

  showDrawer = () => {
    this.setState({
      visible: true,
    });
  };

  onClose = () => {
    this.setState({
      visible: false,
    });
  };

  onDownloadButtonClicked = () => {
    html2canvas(document.body)
      .then((canvas) => {
        downloadCanvasAsPng(
          canvas,
          `${this.props.file.replace(/\s+/g, "_").toLowerCase()}.png`
        );
      })
      .catch((error) => {
        message.error(this.props.t("general.error", { error }));
      });
  };

  onCheckChanged = (checked, index) => {
    let plots = [...this.props.plots];
    plots[index].visible = checked;
    this.props.updatePlots(plots);
  };

  onLegendPinChanged = (checked) => {
    this.props.updateLegendPin(checked);
  };

  render() {
    const { t, description, file, strainsList, tags, plots, legendPinned } = this.props;
    return (
      <Wrapper>
        <PageHeader
          className="site-page-header"
          title={file}
          subTitle={
            <Space>
              {description.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </Space>
          }
          extra={
            <Space>
              <Tooltip title={t("components.download-as-png-tooltip")}>
                <Button
                  type="default"
                  shape="circle"
                  icon={<AiOutlineDownload />}
                  size="small"
                  onClick={() => this.onDownloadButtonClicked()}
                />
              </Tooltip>
              <Tooltip title={t("components.settings.tooltip")}>
                <Button
                  type="text"
                  shape="circle"
                  icon={<AiOutlineSetting />}
                  size="small"
                  onClick={this.showDrawer}
                />
              </Tooltip>
            </Space>
          }
          footer={
            <Space>
              <span>
                <b>{strainsList.length}</b>{" "}
                {t("containers.home.strain", { count: strainsList.length })}
              </span>
              <span>
                <b>{tags.length}</b>{" "}
                {t("containers.home.category", { count: tags.length })}
              </span>
            </Space>
          }
        >
          <div className="site-page-content">
            <Space wrap={true}>
              {tags.map((d, i) => (
                <Tag key={i}>{d}</Tag>
              ))}
            </Space>
          </div>
          <Drawer
            title={t("components.settings.title")}
            placement="right"
            closable={true}
            onClose={this.onClose}
            visible={this.state.visible}
          >
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Divider>{t("components.settings-panel.pinning")}</Divider>
              </Col>
              <Col span={24}>
                <Space>
                  <Switch
                    onChange={(checked) => this.onLegendPinChanged(checked)}
                    size="small"
                    checked={legendPinned}
                  />
                  {t("components.settings-panel.legend-pinned")}
                </Space>
              </Col>
              <Col span={24}>
                <Divider>{t("components.settings-panel.plot-visibility")}</Divider>
              </Col>
              {plots.map((d, index) => (
                <Col span={24}>
                  <Space>
                    <Switch
                      onChange={(checked) => this.onCheckChanged(checked, index)}
                      size="small"
                      checked={d.visible}
                    />
                    {d.title}
                  </Space>
                </Col>
              ))}
            </Row>
          </Drawer>
        </PageHeader>
      </Wrapper>
    );
  }
}
HeaderPanel.propTypes = {
  description: PropTypes.array,
  file: PropTypes.string,
  strainsList: PropTypes.array,
  tags: PropTypes.array,
};
HeaderPanel.defaultProps = {
  strainsList: [],
  description: [],
  tags: [],
};
const mapDispatchToProps = (dispatch) => ({
  updatePlots: (plots) =>
    dispatch(updatePlots(plots)),
  updateLegendPin: (legendPinned) => 
    dispatch(updateLegendPin(legendPinned))
});
const mapStateToProps = (state) => ({
  plots: state.App.plots,
  legendPinned: state.App.legendPinned
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(HeaderPanel));
