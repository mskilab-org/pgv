import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import handleViewport from "react-in-viewport";
import { Card, Space, Empty, Tooltip, Switch, Button, message } from "antd";
import { AiOutlineDownload } from "react-icons/ai";
import * as htmlToImage from "html-to-image";
import { downloadCanvasAsPng, transitionStyle } from "../../helpers/utility";
import { withTranslation } from "react-i18next";
import { GrTree } from "react-icons/gr";
import ContainerDimensions from "react-container-dimensions";
import PhyloTree from "./phyloTree";
import Wrapper from "./index.style";

const margins = {
  padding: 0,
  minHeight: 600
};

class PhylogenyPanel extends Component {
  container = null;

  onDownloadButtonClicked = () => {
    htmlToImage
      .toCanvas(this.container, { pixelRatio: 2 })
      .then((canvas) => {
        downloadCanvasAsPng(
          canvas,
          `${(this.props.title || this.props.t("components.phylogeny-panel.header")).replace(/\s+/g, "_").toLowerCase()}.png`
        );
      })
      .catch((error) => {
        message.error(this.props.t("general.error", { error }));
      });
  };

  render() {
    const { t, phylogeny, strainsList, geography, loading, title, inViewport, renderOutsideViewPort, onNodeClick } = this.props;
    if (!phylogeny) return null;
    return (
      <Wrapper>
        <Card
          style={transitionStyle(inViewport || renderOutsideViewPort)}
          loading={loading}
          size="small"
          title={
            <Space>
              <span role="img" className="anticon anticon-dashboard">
                <GrTree />
              </span>
              <span className="ant-pro-menu-item-title">
                {title || t("components.phylogeny-panel.header")}
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
          </Space>}
        >
          {!phylogeny && <Empty description={t("components.phylogeny-panel.no-data-message")}/>}
          {phylogeny && (<div ref={(elem) => (this.container = elem)}><ContainerDimensions>
            {({ width, height }) => {
              return <PhyloTree {...{ width: (width - 2 * margins.padding), height: margins.minHeight, newickString: phylogeny, strainsList: strainsList, geography: geography, onNodeClick }} />;
            }}
          </ContainerDimensions></div>)}
        </Card>
      </Wrapper>
    );
  }
}
PhylogenyPanel.propTypes = {};
PhylogenyPanel.defaultProps = {
  phylogeny: null,
  strainsList: [],
  geography: []
};
const mapDispatchToProps = (dispatch) => ({
});
const mapStateToProps = (state) => ({
  loading: state.App.loading,
  renderOutsideViewPort: state.App.renderOutsideViewPort
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(handleViewport(PhylogenyPanel, { rootMargin: '-1.0px' })));

