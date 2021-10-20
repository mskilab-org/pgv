import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import { withTranslation } from "react-i18next";
import ContainerDimensions from "react-container-dimensions";
import handleViewport from "react-in-viewport";
import { Card, Space, Tooltip, Button, message, Row, Col } from "antd";
import * as d3 from "d3";
import { AiOutlineDownload } from "react-icons/ai";
import { downloadCanvasAsPng } from "../../helpers/utility";
import * as htmlToImage from "html-to-image";
import { CgArrowsBreakeH } from "react-icons/cg";
import Wrapper from "./index.style";
import GenesPlot from "../genesPlot";

const margins = {
  padding: 0,
  gap: 0,
};

class GenesPanel extends Component {
  container = null;
  genesStructure = null;

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
    const { t, genes, inViewport, renderOutsideViewPort, domains } = this.props;
    if (!genes) return null;
    if (!this.genesStructure) {
      this.genesStructure = {
        geneTypes: genes.getColumn("type").toArray(),
        geneTitles: genes.getColumn("title").toArray(),
        genesStartPoint: genes.getColumn("startPlace").toArray(),
        genesEndPoint: genes.getColumn("endPlace").toArray(),
        genesY: genes.getColumn("y").toArray(),
        genesStroke: genes.getColumn("color").toArray(),
        genesStrand: genes.getColumn("strand").toArray(),
        genesWeight: genes.getColumn("weight").toArray()
      }
    }
    return (
      <Wrapper>
        {<Card
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
          {(<div className="ant-wrapper" ref={(elem) => (this.container = elem)}>
              <ContainerDimensions>
                {({ width, height }) => {
                  return (
                    (inViewport || renderOutsideViewPort) && (
                      <Row style={{ width }} gutter={[margins.gap, 0]}>
                        {domains.map((domain, i) => (
                          <Col key={i} flex={1}>
                            <GenesPlot
                            {...{
                              width:
                              (width - (domains.length - 1) * margins.gap) /
                              domains.length,
                              height: height,
                              xDomain: domain,
                              genes: genes,
                              genesStructure: this.genesStructure
                            }}/>
                          </Col>
                        ))}
                      </Row>
                    )
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
  domains: state.App.domains,
  renderOutsideViewPort: state.App.renderOutsideViewPort
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(handleViewport(GenesPanel, { rootMargin: '-1.0px' })));
