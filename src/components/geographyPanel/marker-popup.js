import React, { Component } from "react";
import { PropTypes } from "prop-types";

class MarkerPopup extends Component {
  render() {
    const { title, content } = this.props;
    return (
      <div className="marker-popup">
        <div className="ant-popover-title">{title}</div>
        <div className="ant-popover-inner-content"><p>{content}</p></div>
      </div>
    );
  }
}
MarkerPopup.propTypes = {};
MarkerPopup.defaultProps = {};

export default MarkerPopup;
