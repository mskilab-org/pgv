import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import { withRouter, Redirect } from "react-router-dom";
import { PageHeader, Space, Tag } from "antd";
import Wrapper from "./index.style";
import appAction from "../../redux/app/actions";

const { getGenome } = appAction;

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
    console.log(new URL(decodeURI(document.location)))
    file && this.props.getGenome(file);
  }
  render() {
    const { t, file, datafile, datafiles } = this.props;

    const { redirectToReferrer } = this.state;
    let params = new URL(decodeURI(document.location)).searchParams;
    if (!params.get("file") && redirectToReferrer) {
      let file = datafiles[0].file;
      this.props.getGenome(file);
      return <Redirect to={`?file=${file}`} />;
    }

    let description =
      datafile &&
      t("containers.home.category", {
        count: datafile && datafile.tags.length,
      });
    let tags = (datafile && datafile.tags) || [];
    return (
      <Wrapper>
        <PageHeader
          className="site-page-header"
          title={file}
          subTitle={description}
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
  file: "",
};
const mapDispatchToProps = (dispatch) => ({
  getGenome: (file) => dispatch(getGenome(file))
});
const mapStateToProps = (state) => ({
  file: state.App.file,
  datafile: state.App.datafile,
  datafiles: state.App.datafiles,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withRouter(withTranslation("common")(HeaderPanel)));
