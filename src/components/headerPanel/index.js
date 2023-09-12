import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import * as d3 from "d3";
import {
  PageHeader,
  Space,
  Button,
  Tooltip,
  message,
  Drawer,
  Row,
  Col,
  Switch,
  Menu,
  Dropdown,
  InputNumber,
  Tabs,
  Divider,
} from "antd";
import {
  AiOutlineDownload,
  AiOutlineSetting,
  AiOutlineDown,
} from "react-icons/ai";
import { downloadCanvasAsPng } from "../../helpers/utility";
import ListSort from "../../helpers/listsort";
import html2canvas from "html2canvas";
import Wrapper from "./index.style";
import appActions from "../../redux/app/actions";

const {
  updatePlots,
  updateLegendPin,
  updateGenesPin,
  updatePhylogenyPin,
  updateZoomedByCmd,
  updateRenderOutsideViewport,
  updateDomains,
  updatePhylogenyPanelHeight,
  addBigwigPlot,
  updateGlobalBigwigYScale,
} = appActions;

const PHYLOGENY_PANEL_HEIGHT = { min: 50, max: 500, default: 200, step: 10 };

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
          `${this.props.selectedFiles
            .map((d) => d.file)
            .join("_")
            .replace(/\s+/g, "_")
            .toLowerCase()}.png`
        );
      })
      .catch((error) => {
        message.error(this.props.t("general.error", { error }));
      });
  };

  onCheckChanged = (checked, id) => {
    let plots = [...this.props.plots];
    plots.find((e) => e.id === id).visible = checked;
    this.props.updatePlots(plots);
  };

  onLegendPinChanged = (checked) => {
    this.props.updateLegendPin(checked);
  };

  onGenesPinChanged = (checked) => {
    this.props.updateGenesPin(checked);
  };

  onPhylogenyPinChanged = (checked) => {
    this.props.updatePhylogenyPin(checked);
  };

  onRenderOutsideViewPortChanged = (checked) => {
    this.props.updateRenderOutsideViewport(checked);
  };

  onPhylogenyPanelHeightChanged = (value) => {
    let val = d3.max([value, PHYLOGENY_PANEL_HEIGHT.min]);
    val = d3.min([val, PHYLOGENY_PANEL_HEIGHT.max]);
    this.props.updatePhylogenyPanelHeight(val);
  };

  onHiglassDataFilesMenuClicked = (uuid) => {
    this.props.plots.filter((d) => d.uuid === uuid).length < 1 &&
      this.props.addBigwigPlot(uuid);
  };

  onZoomedByCmdChanged = (checked) => {
    this.props.updateZoomedByCmd(checked);
  };

  onGlobalBigwigYScaleChanged = (checked) => {
    this.props.updateGlobalBigwigYScale(checked);
  };

  onPlotListChanged = (items) => {
    let plots = [
      this.props.plots.filter((d) =>
        ["genes", "phylogeny", "anatomy"].includes(d.type)
      ),
      items.map((d, i) => this.props.plots.find((e) => e.id === d.key)),
    ].flat();

    this.props.updatePlots(plots);
  };

  render() {
    const {
      t,
      selectedFiles,
      plots,
      zoomedByCmd,
      legendPinned,
      genesPinned,
      phylogenyPinned,
      renderOutsideViewPort,
      nodes,
      selectedConnectionsRange,
      selectedConnectionIds,
      phylogenyPanelHeight,
      higlassDatafiles,
      globalBigwigYScale,
    } = this.props;
    let tags = [...new Set(selectedFiles.map((d) => d.tags).flat())];
    let title = selectedFiles.map((d) => d.file).join(", ");
    let selectedCoordinate = [
      ...new Set(selectedFiles.map((d) => d.reference).flat()),
    ][0];
    let groupedHiglassDataFiles = d3.group(
      higlassDatafiles,
      (d) => d.project_name
    );
    let higlassDatafilesMenu = [...groupedHiglassDataFiles.keys()]
      .sort((a, b) => d3.ascending(a, b))
      .map((key, i) => (
        <Menu.SubMenu title={key || t("containers.home.other")}>
          {groupedHiglassDataFiles.get(key).map((e, i) => (
            <Menu.Item
              key={e.uuid}
              disabled={plots.find((d) => d.uuid === e.uuid)}
              onClick={() => this.onHiglassDataFilesMenuClicked(e.uuid)}
            >
              {e.name}
            </Menu.Item>
          ))}
        </Menu.SubMenu>
      ));
    return (
      <Wrapper>
        <PageHeader
          className="site-page-header"
          title={title}
          subTitle={
            selectedFiles.length > 0 && (
              <Space>
                {selectedCoordinate}
                <Dropdown
                  overlay={
                    <Menu>
                      {tags.map((d, i) => (
                        <Menu.Item className="no-click-item" key={d}>
                          {d}
                        </Menu.Item>
                      ))}
                    </Menu>
                  }
                >
                  <a
                    className="ant-dropdown-link"
                    onClick={(e) => e.preventDefault()}
                    href="/#"
                  >
                    <Space>
                      <span className="aligned-center" style={{}}>
                        <span>
                          <b>{tags.length}</b>{" "}
                          {t("containers.home.category", {
                            count: tags.length,
                          })}
                        </span>
                        &nbsp;
                        <AiOutlineDown />
                      </span>
                    </Space>
                  </a>
                </Dropdown>
                <span>
                  <b>{nodes.filter((d) => d.selected).length}</b>{" "}
                  {t("containers.home.node", {
                    count: nodes.filter((d) => d.selected).length,
                  })}
                </span>
                <Button
                  type="link"
                  onClick={() =>
                    this.props.updateDomains(selectedConnectionsRange)
                  }
                  disabled={selectedConnectionIds.length < 1}
                >
                  <span>
                    <b>{selectedConnectionIds.length}</b>{" "}
                    {t("containers.home.connection", {
                      count: selectedConnectionIds.length,
                    })}
                  </span>
                </Button>
                <Dropdown overlay={<Menu>{higlassDatafilesMenu}</Menu>}>
                  <a
                    className="ant-dropdown-link"
                    onClick={(e) => e.preventDefault()}
                    href="/#"
                  >
                    <Space>
                      <span className="aligned-center" style={{}}>
                        <span>
                          <b>{higlassDatafiles.length}</b>{" "}
                          {t("containers.home.bigwig", {
                            count: higlassDatafiles.length,
                          })}
                        </span>
                        &nbsp;
                        <AiOutlineDown />
                      </span>
                    </Space>
                  </a>
                </Dropdown>
              </Space>
            )
          }
          extra={
            <Space>
              {selectedFiles.length > 0 && (
                <Tooltip title={t("components.download-as-png-tooltip")}>
                  <Button
                    type="text"
                    shape="circle"
                    icon={<AiOutlineDownload />}
                    size="small"
                    onClick={() => this.onDownloadButtonClicked()}
                  />
                </Tooltip>
              )}
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
        >
          <Drawer
            title={t("components.settings.title")}
            placement="right"
            closable={true}
            onClose={this.onClose}
            visible={this.state.visible}
          >
            <Tabs
              defaultActiveKey="1"
              size="small"
              items={[
                {
                  key: "1",
                  label: t("components.settings-panel.general-settings"),
                  children: (
                    <Row gutter={[16, 16]}>
                      <Col span={24}>
                        <Space>
                          <Switch
                            onChange={(checked) =>
                              this.onZoomedByCmdChanged(checked)
                            }
                            size="small"
                            checked={zoomedByCmd}
                          />
                          {t("components.settings-panel.zoomed-by-cmd")}
                        </Space>
                      </Col>
                      <Col span={24}>
                        <Space>
                          <Switch
                            onChange={(checked) =>
                              this.onLegendPinChanged(checked)
                            }
                            size="small"
                            checked={legendPinned}
                          />
                          {t("components.settings-panel.legend-pinned")}
                        </Space>
                      </Col>
                      <Col span={24}>
                        <Tooltip
                          title={t(
                            "components.settings-panel.render-outside-viewport-help"
                          )}
                        >
                          <Space>
                            <Switch
                              onChange={(checked) =>
                                this.onRenderOutsideViewPortChanged(checked)
                              }
                              size="small"
                              checked={renderOutsideViewPort}
                            />
                            {t(
                              "components.settings-panel.render-outside-viewport"
                            )}
                          </Space>
                        </Tooltip>
                      </Col>
                      <Col span={24}>
                        <Tooltip
                          title={t(
                            "components.settings-panel.global-bigwig-y-scale-help"
                          )}
                        >
                          <Space>
                            <Switch
                              onChange={(checked) =>
                                this.onGlobalBigwigYScaleChanged(checked)
                              }
                              size="small"
                              checked={globalBigwigYScale}
                            />
                            {t(
                              "components.settings-panel.global-bigwig-y-scale"
                            )}
                          </Space>
                        </Tooltip>
                      </Col>
                      <Divider orientation="left" plain>
                        {t("components.settings-panel.genes.divider-text")}
                      </Divider>
                      {plots
                        .filter((d) => ["genes"].includes(d.type))
                        .map((d, i) => (
                          <Col span={24}>
                            <Space>
                              <Switch
                                onChange={(checked) =>
                                  this.onCheckChanged(checked, d.id)
                                }
                                size="small"
                                checked={d.visible}
                              />
                              {t("components.settings-panel.genes.switch")}
                            </Space>
                          </Col>
                        ))}
                      <Col span={24}>
                        <Space>
                          <Switch
                            disabled={!plots.find((d) => d.type === "genes")}
                            onChange={(checked) =>
                              this.onGenesPinChanged(checked)
                            }
                            size="small"
                            checked={genesPinned}
                          />
                          {t("components.settings-panel.genes.pinning")}
                        </Space>
                      </Col>
                      <Divider orientation="left" plain>
                        {t("components.settings-panel.phylogeny.divider-text")}
                      </Divider>
                      {plots
                        .filter((d) => ["phylogeny"].includes(d.type))
                        .map((d, i) => (
                          <Col span={24}>
                            <Space>
                              <Switch
                                onChange={(checked) =>
                                  this.onCheckChanged(checked, d.id)
                                }
                                size="small"
                                checked={d.visible}
                              />
                              {t("components.settings-panel.phylogeny.switch")}
                            </Space>
                          </Col>
                        ))}
                      <Col span={24}>
                        <Space>
                          <Switch
                            disabled={
                              !(
                                (plots.find((d) => d.type === "phylogeny") &&
                                  plots.find((d) => d.type === "phylogeny")
                                    .visible) ||
                                (plots.find((d) => d.type === "anatomy") &&
                                  plots.find((d) => d.type === "anatomy")
                                    .visible)
                              )
                            }
                            onChange={(checked) =>
                              this.onPhylogenyPinChanged(checked)
                            }
                            size="small"
                            checked={phylogenyPinned}
                          />
                          {t("components.settings-panel.phylogeny.pinning")}
                        </Space>
                      </Col>
                      <Col span={24}>
                        <Space>
                          <InputNumber
                            style={{ width: 55 }}
                            size="small"
                            min={PHYLOGENY_PANEL_HEIGHT.min}
                            max={PHYLOGENY_PANEL_HEIGHT.max}
                            value={phylogenyPanelHeight}
                            step={PHYLOGENY_PANEL_HEIGHT.step}
                            defaultValue={PHYLOGENY_PANEL_HEIGHT.default}
                            bordered={false}
                            onChange={(value) =>
                              this.onPhylogenyPanelHeightChanged(value)
                            }
                          />
                          {t("components.settings-panel.phylogeny.height")}
                        </Space>
                      </Col>
                      <Divider orientation="left" plain>
                        {t("components.settings-panel.anatomy.divider-text")}
                      </Divider>
                      {plots
                        .filter((d) => ["anatomy"].includes(d.type))
                        .map((d, i) => (
                          <Col span={24}>
                            <Space>
                              <Switch
                                onChange={(checked) =>
                                  this.onCheckChanged(checked, d.id)
                                }
                                size="small"
                                checked={d.visible}
                              />
                              {t("components.settings-panel.anatomy.switch")}
                            </Space>
                          </Col>
                        ))}
                    </Row>
                  ),
                },
                {
                  key: "2",
                  label: t("components.settings-panel.plot-configuration"),
                  children: (
                    <div className="list-sort-panel-wrapper">
                      <div className="list-sort-panel">
                        <ListSort
                          dragClassName="list-drag-selected"
                          appearAnim={{
                            animConfig: { marginTop: [5, 30], opacity: [1, 0] },
                          }}
                          onChange={(e) => this.onPlotListChanged(e)}
                        >
                          {plots
                            .filter(
                              (d) =>
                                !["genes", "phylogeny", "anatomy"].includes(
                                  d.type
                                )
                            )
                            .map((d, i) => (
                              <div key={d.id} className="list-sort-panel-list">
                                <div className="list-sort-panel-icon">
                                  <Switch
                                    onChange={(checked) =>
                                      this.onCheckChanged(checked, d.id)
                                    }
                                    size="small"
                                    checked={d.visible}
                                  />
                                </div>
                                <div className={"list-sort-panel-text"}>
                                  <p>{d.title}</p>
                                </div>
                              </div>
                            ))}
                        </ListSort>
                      </div>
                    </div>
                  ),
                },
              ]}
            />
          </Drawer>
        </PageHeader>
      </Wrapper>
    );
  }
}
HeaderPanel.propTypes = {
  selectedFiles: PropTypes.array,
  plots: PropTypes.array,
};
HeaderPanel.defaultProps = {
  className: "list-sort-demo",
};
const mapDispatchToProps = (dispatch) => ({
  updatePlots: (plots) => dispatch(updatePlots(plots)),
  updateLegendPin: (legendPinned) => dispatch(updateLegendPin(legendPinned)),
  updateGenesPin: (genesPinned) => dispatch(updateGenesPin(genesPinned)),
  updatePhylogenyPin: (phylogenyPinned) =>
    dispatch(updatePhylogenyPin(phylogenyPinned)),
  updateZoomedByCmd: (checked) => dispatch(updateZoomedByCmd(checked)),
  updateGlobalBigwigYScale: (checked) =>
    dispatch(updateGlobalBigwigYScale(checked)),
  updateRenderOutsideViewport: (renderOutsideViewPort) =>
    dispatch(updateRenderOutsideViewport(renderOutsideViewPort)),
  updateDomains: (domains) => dispatch(updateDomains(domains)),
  updatePhylogenyPanelHeight: (value) =>
    dispatch(updatePhylogenyPanelHeight(value)),
  addBigwigPlot: (value) => dispatch(addBigwigPlot(value)),
});
const mapStateToProps = (state) => ({
  plots: state.App.plots,
  tags: state.App.tags,
  zoomedByCmd: state.App.zoomedByCmd,
  legendPinned: state.App.legendPinned,
  genesPinned: state.App.genesPinned,
  phylogenyPinned: state.App.phylogenyPinned,
  renderOutsideViewPort: state.App.renderOutsideViewPort,
  nodes: state.App.nodes,
  selectedConnectionIds: state.App.selectedConnectionIds,
  selectedConnectionsRange: state.App.selectedConnectionsRange,
  phylogenyPanelHeight: state.App.phylogenyPanelHeight,
  selectedFiles: state.App.selectedFiles,
  higlassDatafiles: state.App.higlassDatafiles,
  globalBigwigYScale: state.App.globalBigwigYScale,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(HeaderPanel));
