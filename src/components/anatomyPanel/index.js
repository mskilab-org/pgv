import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import { Card, Space, Empty, message, Tooltip, Button } from "antd";
import ContainerDimensions from "react-container-dimensions";
import { withTranslation } from "react-i18next";
import * as htmlToImage from "html-to-image";
import { downloadCanvasAsPng } from "../../helpers/utility";
import { GiAnatomy } from "react-icons/gi";
import { AiOutlineDownload } from "react-icons/ai";
import Body from "./body";
import Wrapper from "./index.style";
import appActions from "../../redux/app/actions";

const { selectPhylogenyNodes } = appActions;

class AnatomyPanel extends Component {
  container = null;

  onDownloadButtonClicked = () => {
    htmlToImage
      .toCanvas(this.container, { pixelRatio: 2 })
      .then((canvas) => {
        downloadCanvasAsPng(
          canvas,
          `${(
            this.props.title || this.props.t("components.anatomy-panel.header")
          )
            .replace(/\s+/g, "_")
            .toLowerCase()}.png`
        );
      })
      .catch((error) => {
        message.error(this.props.t("general.error", { error }));
      });
  };

  render() {
    const {
      t,
      title,
      height,
      anatomy,
      figure,
      nodes,
      selectPhylogenyNodes,
      highlightedNodes,
    } = this.props;

    return (
      <Wrapper empty={anatomy.length < 1} minHeight={height}>
        <Card
          size="small"
          title={
            <Space>
              <span role="img" className="anticon anticon-dashboard">
                <GiAnatomy />
              </span>
              <span className="ant-pro-menu-item-title">
                {title || t("components.anatomy-panel.header")}
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
          <div className="ant-wrapper" ref={(elem) => (this.container = elem)}>
            {anatomy.length < 1 && (
              <Empty
                description={t("components.anatomy-panel.no-data-message")}
              />
            )}
            {anatomy.length > 0 && (
              <ContainerDimensions>
                {({ width, height }) => {
                  return (
                    <Body
                      {...{
                        width: width,
                        height: height,
                        figure,
                        locations: anatomy,
                        nodes,
                        highlightedNodes,
                        onNodeClick: selectPhylogenyNodes,
                      }}
                    />
                  );
                }}
              </ContainerDimensions>
            )}
          </div>
        </Card>
      </Wrapper>
    );
  }
}
AnatomyPanel.propTypes = {
  anatomy: PropTypes.array,
};
AnatomyPanel.defaultProps = {
  anatomy: [],
};
const mapDispatchToProps = (dispatch) => ({
  selectPhylogenyNodes: (nodes) => dispatch(selectPhylogenyNodes(nodes)),
});
const mapStateToProps = (state) => ({
  loading: state.App.loading,
  nodes: state.App.nodes,
  highlightedNodes: state.App.highlightedNodes,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(AnatomyPanel));
