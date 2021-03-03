import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { rgb } from "d3";

class Marker extends Component {
  render() {
    const { text, fill, key, radius } = this.props;
    return (
      <div key={key}>
        <svg width={30 + 2 * radius} height={30 + 2 * radius}>
          <circle cx={15 + radius} cy={15 + radius} r={10 + radius} fill={fill} stroke={rgb(fill).darker()} strokeWidth="2" />
          <text x={15 + radius} y={15 + radius} textAnchor="middle" fill="#FFF" fontSize="10" dy="4">{text}</text>
        </svg>
      </div>
    );
  }
}
Marker.propTypes = {};
Marker.defaultProps = {};

export default Marker;
