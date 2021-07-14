import React, { PureComponent } from "react";
import { PropTypes } from "prop-types";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import { locateGenomeRange } from "../../helpers/utility";

class GenomeRangePanel extends PureComponent {
  render() {
    const { domains, chromoBins } = this.props;
    return (
        <>
          {domains.map(domain => locateGenomeRange(chromoBins, domain)).join(" | ")}
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
  domains: state.App.domains,
  chromoBins: state.App.chromoBins
});
export default connect(mapStateToProps, mapDispatchToProps)(withTranslation("common")(GenomeRangePanel));