import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import { Row, Col, Result, Alert } from "antd";
import * as d3 from "d3";
import DataSelectionWrapper from "./index.style";
import { withTranslation } from "react-i18next";
import FiltersPanel from "../../components/filtersPanel";
import HomeHeader from "../../components/headerPanel";
import FiltersResults from "../../components/filtersResults";

class DataSelection extends Component {
  state = { dataRecords: [] };

  onSearch = (values) => {
    let filtered = this.props.datafiles;
    if (values && values.tags && values.tags.length > 0) {
      filtered = this.props.datafiles.filter(
        (d) =>
          d.tags.filter((e) => values.tags.includes(e)).length ===
          values.tags.length
      );
    }
    filtered = filtered.sort((a, b) => d3.ascending(a.datafile, b.datafile));
    this.setState({ dataRecords: filtered });
  };

  render() {
    const { t, tags, loading, missingDataFiles } = this.props;

    return (
      <DataSelectionWrapper>
        <div className="ant-ds-header-container">
          <HomeHeader />
        </div>
        <div className="ant-ds-content-container">
          {missingDataFiles && (
            <Result
              status="404"
              title={t("containers.data-selection.missing.title")}
              subTitle={t("containers.data-selection.missing.subtitle")}
              extra={
                <Row>
                  <Col span={12} offset={6}>
                    <Alert
                      message={t("containers.data-selection.missing.extra")}
                      type="info"
                      showIcon
                    />
                  </Col>
                </Row>
              }
            />
          )}
          {!missingDataFiles && (
            <Row gutter={0} className="ant-ds-filter-container">
              <Col className="gutter-row" span={24}>
                <FiltersPanel {...{ tags, loading, onSearch: this.onSearch }} />
              </Col>
            </Row>
          )}
          {!missingDataFiles && (
            <Row gutter={0} className="ant-ds-results-container">
              <Col className="gutter-row" span={24}>
                <FiltersResults
                  dataRecords={this.state.dataRecords}
                  loading={loading}
                />
              </Col>
            </Row>
          )}
        </div>
      </DataSelectionWrapper>
    );
  }
}

DataSelection.propTypes = {
  tags: PropTypes.array,
};
DataSelection.defaultProps = {
  tags: [],
  loading: true,
};
const mapDispatchToProps = {};
const mapStateToProps = (state) => ({
  datafiles: state.Genome.datafiles,
  missingDataFiles: state.Genome.missingDataFiles,
  tags: state.Genome.tags,
  loading: state.Genome.loading,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(DataSelection));
