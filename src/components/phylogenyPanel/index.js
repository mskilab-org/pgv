import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import { Card, Space, Empty, Tooltip, Switch, Button, message } from "antd";
import { AiOutlineDownload } from "react-icons/ai";
import * as htmlToImage from "html-to-image";
import { downloadCanvasAsPng } from "../../helpers/utility";
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
          `${(this.props.title || this.props.t("components.phylogeny-panel.header")).replace(/\s+/g, "_").toLowerCase()}.png`
        );
      })
      .catch((error) => {
        message.error(this.props.t("general.error", { error }));
      });
  };

  render() {
    const { t, phylogeny, strainsList, geography, loading, title } = this.props;
    const { checked } = this.state;
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
          {checked && !phylogeny && <Empty description={t("components.phylogeny-panel.no-data-message")}/>}
          {checked && phylogeny && (<div ref={(elem) => (this.container = elem)}><ContainerDimensions>
            {({ width, height }) => {
              return <PhyloTree {...{ width: (width - 2 * margins.padding), height: margins.minHeight, newickString: phylogeny, strainsList: strainsList, geography: geography }} />;
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
  loading: state.App.loading
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(PhylogenyPanel));

