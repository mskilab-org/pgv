import React, { PureComponent } from "react";
import { PropTypes } from "prop-types";

class AxisLine extends PureComponent {
  render() {
    const { x1, y1, x2, y2, stroke, strokeWidth, dash} = this.props;
    return <line {...{x1,y1,x2,y2}} style={{stroke, strokeWidth, strokeDasharray: dash}} />;
  }
}
AxisLine.propTypes = {
  x1: PropTypes.number.isRequired,
  y1: PropTypes.number.isRequired,
  x2: PropTypes.number.isRequired,
  y2: PropTypes.number.isRequired
};
AxisLine.defaultProps = {
  dash: [1, 1],
  stroke: "lightgrey",
  strokeWidth: 1
};
export default AxisLine;
