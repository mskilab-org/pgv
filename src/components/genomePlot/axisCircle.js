import React, { PureComponent } from "react";
import { PropTypes } from "prop-types";

class AxisCircle extends PureComponent {
  render() {
    const { x, y, radius, fill, stroke, strokeWidth} = this.props;
    return <circle transform={`translate(${[x,y]})`} r={radius} style={{fill, stroke, strokeWidth}}/>;
  }
}
AxisCircle.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired
};
AxisCircle.defaultProps = {
  radius: 2,
  fill: "transparent",
  stroke: "lightgrey",
  strokeWidth: 0.5
};
export default AxisCircle;
