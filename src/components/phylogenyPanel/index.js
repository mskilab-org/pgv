import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import handleViewport from "react-in-viewport";
import { Card, Space, Empty, Tooltip, Button, message } from "antd";
import { AiOutlineDownload } from "react-icons/ai";
import * as htmlToImage from "html-to-image";
import { downloadCanvasAsPng } from "../../helpers/utility";
import { withTranslation } from "react-i18next";
import { GrTree } from "react-icons/gr";
import ContainerDimensions from "react-container-dimensions";
import PhyloTree from "./phyloTree";
import Wrapper from "./index.style";
import appActions from "../../redux/app/actions";

const margins = {
  padding: 0
};

const { selectPhylogenyNodes } = appActions;

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
    const { t, phylogeny, height, samples, loading, title, selectPhylogenyNodes, nodes, highlightedNodes } = this.props;
    if (!phylogeny) return null;
    return (
      <Wrapper>
        <Card
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
            {({ width, h }) => {
              return <PhyloTree {...{ width: (width - 2 * margins.padding), height: height, newickString: phylogeny, samples, onNodeClick: selectPhylogenyNodes, nodes, highlightedNodes }} />;
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
  samples: {}
};
const mapDispatchToProps = (dispatch) => ({
  selectPhylogenyNodes: (nodes) =>
    dispatch(selectPhylogenyNodes(nodes)),
});
const mapStateToProps = (state) => ({
  loading: state.App.loading,
  nodes: state.App.nodes,
  highlightedNodes: state.App.highlightedNodes,
  samples: state.App.samples
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(handleViewport(PhylogenyPanel, { rootMargin: '-1.0px' })));

