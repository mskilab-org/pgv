import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import { PageHeader, Space, Tag, Button, Tooltip, message } from "antd";
import { AiOutlineDownload } from "react-icons/ai";
import { downloadCanvasAsPng } from "../../helpers/utility";
import html2canvas from 'html2canvas';
import Wrapper from "./index.style";

class HeaderPanel extends Component {

  onDownloadButtonClicked = () => {
    html2canvas(document.body).then((canvas) => {
      downloadCanvasAsPng(
        canvas,
        `${this.props.file.replace(/\s+/g, "_").toLowerCase()}.png`
      );
  }).catch((error) => {
    message.error(this.props.t("general.error", { error }));
  });
  };

  render() {
    const {
      t,
      description,
      file,
      strainsList,
      tags,
    } = this.props;
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
          </Space>
          }
          footer={
              <Space>
                <span>
                  <b>{strainsList.length}</b> {t("containers.home.strain", {count: strainsList.length})}
                </span>
                <span>
                  <b>{tags.length}</b> {t("containers.home.category", {count: tags.length})}
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
const mapDispatchToProps = (dispatch) => ({});
const mapStateToProps = (state) => ({});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(HeaderPanel));
