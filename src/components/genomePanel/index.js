import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import { withTranslation } from "react-i18next";
import ContainerDimensions from "react-container-dimensions";
import handleViewport from "react-in-viewport";
import { Card, Space, Button, Tooltip, message } from "antd";
import * as d3 from "d3";
import { GiDna2 } from "react-icons/gi";
import { AiOutlineDownload } from "react-icons/ai";
import { downloadCanvasAsPng, transitionStyle } from "../../helpers/utility";
import * as htmlToImage from "html-to-image";
import Wrapper from "./index.style";
import GenomePlot from "../genomePlot";

const margins = {
  padding: 0,
};

class GenomePanel extends Component {
  container = null;

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
    const {
      t,
      genome,
      title,
      inViewport,
      renderOutsideViewPort
    } = this.props;
    if (Object.keys(genome).length < 1) return null;
    return (
      <Wrapper>
        <Card
          style={transitionStyle(inViewport || renderOutsideViewPort)}
          size="small"
          title={
            <Space>
              <span role="img" className="anticon anticon-dashboard">
                <GiDna2 />
              </span>
              <span className="ant-pro-menu-item-title">{title}</span>
              <span>
                <b>{d3.format(",")(genome.intervals.length)}</b>{" "}
                {t("components.genome-panel.interval", {
                  count: genome.intervals.length,
                })}
              </span>
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
            </Space>
          }
        >
          {(
            <div className="ant-wrapper" ref={(elem) => (this.container = elem)}>
              <ContainerDimensions>
                {({ width, height }) => {
                  return (
                    (inViewport || renderOutsideViewPort) && <GenomePlot
                      {...{
                        width: width - 2 * margins.padding,
                        height,
                        genome
                      }}
                    />
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
GenomePanel.propTypes = {};
GenomePanel.defaultProps = {};
const mapDispatchToProps = (dispatch) => ({
});
const mapStateToProps = (state) => ({
  renderOutsideViewPort: state.App.renderOutsideViewPort
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(handleViewport(GenomePanel, { rootMargin: '-1.0px' })));

