import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { Divider } from "antd";
import { withTranslation } from "react-i18next";
import { nest } from "d3-collection";

class MarkerPopup extends Component {
  render() {
    const { t, title, text, node } = this.props;
    const cladeStrains = nest()
    .key((d) => d.clade)
    .entries(node.values);
    return (
      <div className="marker-popup">
        <div className="ant-popover-title">{title}</div>
        <div className="ant-popover-inner-content">
          <h4>{t("components.geography-panel.tooltip.content.strain", {count: node.values.length})}, {t("components.geography-panel.tooltip.content.clade", {count: cladeStrains.length})}</h4>
          {cladeStrains.map((d,i) => <p><strong>{d.key}</strong>: {t("components.geography-panel.tooltip.content.strain", {count: d.values.length})}</p>)}
        </div>
      </div>
    );
  }
}
MarkerPopup.propTypes = {};
MarkerPopup.defaultProps = {};

export default (withTranslation("common")(MarkerPopup));
