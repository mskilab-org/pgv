import React, { PureComponent } from "react";
import { PropTypes } from "prop-types";

class AxisText extends PureComponent {
  render() {
    const { x, y, fontSize, transform, fill, text, align, pointerEvents} = this.props;
    return <text {...{x,y, transform}} style={{fontSize, fill, pointerEvents}} textAnchor={align}>{text}</text>;
  }
}
AxisText.propTypes = {
  text: PropTypes.string.isRequired
};
AxisText.defaultProps = {
  fontSize: 10,
  x: -50,
  align: "start",
  pointerEvents: "none"
};
export default AxisText;
