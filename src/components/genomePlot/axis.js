import React, { Component } from "react";
import { PropTypes } from "prop-types";
import AxisText from "./axisText";
import AxisLine from "./axisLine";

class Axis extends Component {
  render() {
    const { x, y, key} = this.props.group;
    return (
      <g key={key} transform={`translate(${[x,y]})`}>
        <AxisText {...this.props.tick} />
        <AxisLine {...this.props.line} />
      </g>
    );
  }
}
Axis.propTypes = {
  group: PropTypes.object.isRequired,
  tick: PropTypes.object.isRequired,
  line: PropTypes.object.isRequired
};
export default Axis;
