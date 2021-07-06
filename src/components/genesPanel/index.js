import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import { withTranslation } from "react-i18next";
import ContainerDimensions from "react-container-dimensions";
import handleViewport from "react-in-viewport";
import { Card, Space, Tooltip, Switch, Button, message } from "antd";
import * as d3 from "d3";
import { AiOutlineDownload } from "react-icons/ai";
import { downloadCanvasAsPng, transitionStyle } from "../../helpers/utility";
import * as htmlToImage from "html-to-image";
import { CgArrowsBreakeH } from "react-icons/cg";
import Wrapper from "./index.style";
import GenesPlot from "../genesPlot";

const margins = {
  padding: 0,
};

class GenesPanel extends Component {
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
          `${this.props.t("components.genes-panel.header").replace(/\s+/g, "_").toLowerCase()}.png`
        );
      })
      .catch((error) => {
        message.error(this.props.t("general.error", { error }));
      });
  };

  render() {
    const { t, genes, inViewport } = this.props;
    const { checked } = this.state;
    if (!genes) return null;
    return (
      <Wrapper>
        {<Card
          style={transitionStyle(inViewport)}
          size="small"
          title={
            <Space>
              <span role="img" className="anticon anticon-dashboard">
                <CgArrowsBreakeH />
              </span>
              <span className="ant-pro-menu-item-title">
                {t("components.genes-panel.header")}
              </span>
              <span><b>{d3.format(",")((genes.count()))}</b> {t("components.genes-panel.gene", {count: genes.count()})}</span>
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
          </Space>}
        >
          {checked && (<div className="ant-wrapper" ref={(elem) => (this.container = elem)}>
            <ContainerDimensions>
              {({ width, height }) => {
                return (
                   <GenesPlot
                    {...{
                      width: width - 2 * margins.padding,
                      height: height,
                      genes: genes
                    }}
                  />
                );
              }}
            </ContainerDimensions>
          </div>)}
        </Card>}
      </Wrapper>
    );
  }
}
GenesPanel.propTypes = {
};
GenesPanel.defaultProps = {};
const mapDispatchToProps = (dispatch) => ({});
const mapStateToProps = (state) => ({
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(handleViewport(GenesPanel, { rootMargin: '-1.0px' })));
