import React, { Component } from "react";
import { PropTypes } from "prop-types";
import * as d3 from "d3";
import { Axis, axisPropsFromTickScale, LEFT, BOTTOM } from "react-d3-axis";
import { Tooltip } from "react-svg-tooltip";
import { measureText } from "../../helpers/utility";
 
const margins = {
  gap: 32
};

class Plot extends Component {
  state = {
    highlightedIndex: null,
  };

  handleMouseEnter = (index) => {
    this.setState({ highlightedIndex: index });
  };

  handleMouseLeave = (index) => {
    this.setState({ highlightedIndex: null });
  };

  render() {
    const { points, width, height, title } = this.props;
    let stageWidth = width - 2 * margins.gap;
    let stageHeight = height - 2 * margins.gap;
    const yScale = d3
      .scaleLinear()
      .domain(d3.extent(points.map(d => d.pc2)))
      .range([stageHeight, 0])
      .nice();
    const xScale = d3.scaleLinear().domain(d3.extent(points.map(d => d.pc1))).range([0, stageWidth]).nice();
    const { highlightedIndex } = this.state;
    const circleRefArray = points.map((d, i) => React.createRef());
    return (
      <svg width={width} height={height}>
        <text
          transform={`translate(${[width / 2, margins.gap]})`}
          textAnchor="middle"
          fontSize={14}
          dy="-4"
        >
          {title}
        </text>
        <g transform={`translate(${[margins.gap, margins.gap]})`}>
          <rect width={stageWidth} height={stageHeight} fill="#F2F2F2"/>
          <Axis
            {...axisPropsFromTickScale(yScale)}
            style={{ orient: LEFT }}
          />
          <text fontSize={12} fill="#333" textAnchor="middle" fontWeight="bold" transform={`rotate(-90)translate(${[-stageHeight / 2, -0.66 * margins.gap]})`}>
            pc2
          </text>
        </g>
        <g transform={`translate(${[margins.gap, margins.gap + stageHeight]})`}>
          <Axis
            {...axisPropsFromTickScale(xScale)}
            style={{ orient: BOTTOM }}
          />
         <text x={stageWidth/2} y={0.66 * margins.gap} fontSize={12} fill="#000" fontWeight="bold" textAnchor="middle">
            pc1
        </text>
        </g>
        <g transform={`translate(${[margins.gap, margins.gap]})`}>
          {points.map((d, i) => (
            <g key={i}>
              <circle
                ref={circleRefArray[i]}
                cx={xScale(d.pc1)}
                cy={yScale(d.pc2)}
                r={3}
                fill={highlightedIndex === i ? "#FF7F0E " : d.location.fill}
                fillOpacity={0.75}
                stroke={
                  highlightedIndex === i
                    ? d3.rgb("#FF7F0E").darker()
                    : d3.rgb(d.location.fill).darker()
                }
                strokeWidth={0.75}
                strokeOpacity={0.75}
                onMouseEnter={() => this.handleMouseEnter(i)}
                onMouseLeave={() => this.handleMouseLeave(i)}
              />
              <Tooltip triggerRef={circleRefArray[i]}>
                <rect
                  x={10}
                  y={10}
                  width={d3.max([measureText(d.location.title, 12), measureText(`pc1: ${d.pc1}`, 12), measureText(`pc2: ${d.pc2}`, 12)]) + 40}
                  height={80}
                  rx={5}
                  ry={5}
                  fill="rgb(97, 97, 97)"
                  fillOpacity={0.97}
                />
                <text x={20} y={32} fontSize={12} fontWeight="bold" fill="#FFF">
                  {d.record.strain}
                </text>
                <text x={20} y={48} fontSize={12} fill="#FFF">
                  pc1: {d.pc1}
                </text>
                <text x={20} y={64} fontSize={12} fill="#FFF">
                  pc2: {d.pc2}
                </text>
                <text x={20} y={80} fontSize={12} fill="#FFF">
                  {d.location.title}
                </text>
              </Tooltip>
            </g>
          ))}
        </g>
      </svg>
    );
  }
}
Plot.propTypes = {
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  points: PropTypes.array,
  title: PropTypes.string
};
Plot.defaultProps = {
  points: [],
};
export default Plot;
