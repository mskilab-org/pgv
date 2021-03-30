import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import { withRouter, Redirect } from "react-router-dom";
import { PageHeader, Space, Tag } from "antd";
import Wrapper from "./index.style";
import appActions from "../../redux/app/actions";

const { getDependencies, updateDomain } = appActions;

class HeaderPanel extends Component {
  state = {
    redirectToReferrer: false,
  };

  componentWillReceiveProps(nextProps) {
    // when the datafiles are finally loaded

    if (
      this.props.datafiles !== nextProps.datafiles &&
      nextProps.datafiles.length > 0
    ) {
      this.setState({ redirectToReferrer: true });
    }
  }

  componentDidMount() {
    // When we enter through a full page refresh
    let params = new URL(decodeURI(document.location)).searchParams;
    let file = params.get("file");
    let from = params.get("from");
    let to = params.get("to");
    from && to && this.props.updateDomain(from, to);
    file && this.props.getDependencies(file, from, to);
  }
  render() {
    const { t, file, datafile, datafiles, strainsList } = this.props;

    const { redirectToReferrer } = this.state;
    let params = new URL(decodeURI(document.location)).searchParams;
    if ((!params.get("file") || !params.get("from") || !params.get("to")) && redirectToReferrer) {
      const { defaultDomain } = this.props;
      let from = params.get("from") || defaultDomain[0];
      let to = params.get("to") || defaultDomain[1];
      let file = params.get("file") || datafiles[0].file;
      return <Redirect to={`?file=${file}&from=${from}&to=${to}`} />;
    }

    let description =
      datafile &&
      t("containers.home.category", {
        count: datafile && datafile.tags.length,
      });
    let strainsText =
      datafile &&
      strainsList &&
      t("containers.home.strain", {
        count: datafile && strainsList && strainsList.length,
      });
    let tags = (datafile && datafile.tags) || [];
    return (
      <Wrapper>
        <PageHeader
          className="site-page-header"
          title={file}
          subTitle={description}
          footer={
            <p>
              <b>{strainsList.length}</b> {strainsText}
            </p>
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
  datafiles: PropTypes.array,
  datafile: PropTypes.object,
  file: PropTypes.string,
};
HeaderPanel.defaultProps = {
  datafiles: [],
  datafile: { file: "", filename: "", tags: [] },
  strainsList: [],
  file: "",
};
const mapDispatchToProps = (dispatch) => ({
  getDependencies: (file) => dispatch(getDependencies(file)),
  updateDomain: (from, to) => dispatch(updateDomain(from,to)),
});
const mapStateToProps = (state) => ({
  file: state.Genome.file,
  defaultDomain: state.App.defaultDomain,
  datafile: state.Genome.datafile,
  datafiles: state.Genome.datafiles,
  strainsList: state.Strains.strainsList,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withRouter(withTranslation("common")(HeaderPanel)));
