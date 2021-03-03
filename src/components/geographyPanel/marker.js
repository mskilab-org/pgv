import React, { Component } from "react";
import { PropTypes } from "prop-types";

class Marker extends Component {
  render() {
    const { text, fill, key } = this.props;
    return (
      <div key={key}>
        <svg width="30" height="30">
          <circle cx="15" cy="15" r="10" fill="#FFF" stroke={fill} strokeWidth="2" />
          <text x="15" y="15" textAnchor="middle" fill="#333" fontSize="10" dy="4">{text}</text>
        </svg>
      </div>
    );
  }
}
Marker.propTypes = {};
Marker.defaultProps = {};

export default Marker;
