import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import { withTranslation } from "react-i18next";
import { Layout, Space, Spin, Select, Typography, Alert } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import TopbarWrapper from "./topbar.style";
import { siteConfig } from "../../settings";
import logo from "../../assets/images/logo.png";
import appActions from "../../redux/app/actions";

const { Header } = Layout;
const { Option } = Select;
const { Text } = Typography;

const { launchApp } = appActions;

class Topbar extends Component {
  handleTagsChange = (selectedTags) => {
    this.props.launchApp(null, selectedTags);
  };

  handleFileChange = (files) => {
    this.props.launchApp(files, this.props.selectedTags);
  };

  render() {
    const {
      t,
      selectedFiles,
      loading,
      missingDataFiles,
      selectedCategories,
      filteredFiles,
      filteredTags,
      datafiles,
    } = this.props;
    return (
      <TopbarWrapper>
        <Header className="ant-pro-top-menu">
          <div className="ant-pro-top-nav-header light">
            <div className="ant-pro-top-nav-header-main ">
              <div className="ant-pro-top-nav-header-main-left">
                <Space>
                  <div className="ant-pro-top-nav-header-logo" id="logo">
                    <img src={logo} alt="logo" />
                    <h1>{siteConfig.siteName}</h1>
                  </div>
                  {!missingDataFiles && (
                    <Select
                      mode="multiple"
                      value={selectedCategories}
                      className="tags-select"
                      allowClear={true}
                      loading={loading}
                      showArrow={true}
                      optionLabelProp="value"
                      maxTagCount={3}
                      placeholder={t(
                        "components.filters-panel.tags-section.placeholder"
                      )}
                      dropdownMatchSelectWidth={false}
                      onChange={this.handleTagsChange}
                    >
                      {filteredTags.map((d) => (
                        <Option key={d[0]}>
                          {d[0]} (
                          {t("components.filters-panel.tags-section.sample", {
                            count: +d[1],
                          })}
                          )
                        </Option>
                      ))}
                    </Select>
                  )}
                  {!missingDataFiles && (
                    <Select
                      mode="multiple"
                      showSearch={true}
                      value={selectedFiles.map((d) => d.file)}
                      className="files-select"
                      allowClear={true}
                      loading={loading}
                      showArrow={true}
                      optionLabelProp="value"
                      dropdownMatchSelectWidth={false}
                      optionFilterProp="children"
                      placeholder={t("topbar.browse-sample")}
                      filterOption={(input, option) =>
                        option.key.toLowerCase().indexOf(input.toLowerCase()) >=
                        0
                      }
                      filterSort={(optionA, optionB) =>
                        optionA.key
                          .toLowerCase()
                          .localeCompare(optionB.key.toLowerCase())
                      }
                      onChange={this.handleFileChange}
                    >
                      {filteredFiles.map((d) => (
                        <Option key={d.file} value={d.file}>
                          <Space>
                            <Text>{d.file}</Text>
                            <Text type="secondary">{d.reference}</Text>
                            &nbsp;
                          </Space>
                        </Option>
                      ))}
                    </Select>
                  )}
                  {loading ? (
                    <Spin
                      indicator={
                        <LoadingOutlined style={{ fontSize: 16 }} spin />
                      }
                    />
                  ) : (
                    <Space>
                      <span
                        dangerouslySetInnerHTML={{
                          __html: t("topbar.browse-title", {
                            count: filteredFiles.length,
                            total: datafiles.length,
                          }),
                        }}
                      />
                      {selectedFiles.length < 1 && (
                        <Alert
                          message={t("topbar.no-sample-selected")}
                          type="info"
                          showIcon
                        />
                      )}
                    </Space>
                  )}
                </Space>
              </div>
              <div className="ant-pro-top-nav-header-menu"></div>
              <div className="ant-pro-top-nav-header-main-right">
                <div className="ant-pro-top-nav-header-main-right-container">
                  <Space align="center">
                    <div className="ant-pro-loader-container">
                      {loading && (
                        <Spin
                          indicator={
                            <LoadingOutlined style={{ fontSize: 16 }} spin />
                          }
                        />
                      )}
                    </div>
                  </Space>
                </div>
              </div>
            </div>
          </div>
        </Header>
      </TopbarWrapper>
    );
  }
}
Topbar.propTypes = {
  selectedFiles: PropTypes.array,
};
Topbar.defaultProps = {
  currentPage: "",
};
const mapDispatchToProps = (dispatch) => ({
  launchApp: (file, selectedTags) => dispatch(launchApp(file, selectedTags)),
});
const mapStateToProps = (state) => ({
  selectedFiles: state.App.selectedFiles,
  domains: state.App.domains,
  chromoBins: state.App.chromoBins,
  missingDataFiles: state.App.missingDataFiles,
  datafiles: state.App.datafiles,
  tags: state.App.tags,
  loading: state.App.loading,
  selectedTags: state.App.selectedTags,
  filteredFiles: state.App.filteredFiles,
  filteredTags: state.App.filteredTags,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(Topbar));
