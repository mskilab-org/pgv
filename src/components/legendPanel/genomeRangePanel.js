import React, { PureComponent } from "react";
import { PropTypes } from "prop-types";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import { locateGenomeRange } from "../../helpers/utility";

class GenomeRangePanel extends PureComponent {
  render() {
    const { domain, chromoBins } = this.props;
    return (
        <>
          {locateGenomeRange(chromoBins, domain[0], domain[1])}
        </>
    );
  }
}
GenomeRangePanel.propTypes = {
};
GenomeRangePanel.defaultProps = {
};
const mapDispatchToProps = {};
const mapStateToProps = (state) => ({
  domain: state.App.domain,
  chromoBins: state.App.chromoBins
});
export default connect(mapStateToProps, mapDispatchToProps)(withTranslation("common")(GenomeRangePanel));