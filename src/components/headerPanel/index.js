import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import { PageHeader, Space, Tag } from "antd";
import Wrapper from "./index.style";

class HeaderPanel extends Component {
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
