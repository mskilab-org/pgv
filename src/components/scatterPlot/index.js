import React, { Component } from "react";
import { PropTypes } from "prop-types";
import * as d3 from "d3";
import { Axis, axisPropsFromTickScale, LEFT, BOTTOM } from "react-d3-axis";
import Points from "./points";
import Wrapper from "./index.style";

const margins = {
  gap: 24,
};

class ScatterPlot extends Component {
  regl = null;
  container = null;

  componentDidMount() {
    const regl = require("regl")({
      extensions: ["ANGLE_instanced_arrays"],
      container: this.container,
      pixelRatio: window.devicePixelRatio || 1.5,
      attributes: { antialias: true, depth: false, stencil: true },
    });

    regl.cache = {};
    this.regl = regl;

    this.regl.clear({
      color: [0, 0, 0, 0.05],
      stencil: true,
    });
    this.points = new Points(this.regl);
    this.updateStage();
  }

  componentDidUpdate(prevProps, prevState) {
    this.regl.clear({
      color: [0, 0, 0, 0.05],
      depth: false,
    });

    this.regl.poll();

    this.updateStage();
  }

  componentWillUnmount() {
    if (this.regl) {
      this.regl.destroy();
    }
  }

  updateStage() {
    let { width, height, results, xDomain } = this.props;

    let stageWidth = width - 2 * margins.gap;
    let stageHeight = height - 2 * margins.gap;
    this.regl.poll();
    let dataPointsY = results.getColumn("y").toArray();
    let yExtent = d3.extent(dataPointsY);
    let dataPointsColor = results.getColumn("color").toArray();
    let dataPointsX = results.getColumn("x").toArray();
    let xExtent = xDomain;
    this.points.load(
      stageWidth,
      stageHeight,
      2,
      dataPointsX,
      dataPointsY,
      dataPointsColor,
      xExtent,
      yExtent
    );
    this.points.render();
  }

  render() {
    const { width, height, results, xDomain, title } = this.props;
    let stageWidth = width - 2 * margins.gap;
    let stageHeight = height - 2 * margins.gap;
    const yScale = d3
      .scaleLinear()
      .domain(d3.extent(results.getColumn("y").toArray()))
      .range([stageHeight, 0])
      .nice();
    const xScale = d3.scaleLinear().domain(xDomain).range([0, stageWidth]);
    return (
      <Wrapper className="ant-wrapper" margins={margins}>
        <div
          className="scatterplot"
          style={{ width: stageWidth, height: stageHeight }}
          ref={(elem) => (this.container = elem)}
        />
        <svg width={width} height={height} className="plot-container">
          <text
            transform={`translate(${[width / 2, margins.gap]})`}
            textAnchor="middle"
            fontSize={14}
            dy="-4"
          >
            {title}
          </text>
          <g transform={`translate(${[margins.gap, margins.gap]})`}>
            <Axis
              {...axisPropsFromTickScale(yScale)}
              style={{ orient: LEFT }}
            />
          </g>
          <g
            transform={`translate(${[margins.gap, stageHeight + margins.gap]})`}
          >
            <Axis
              {...axisPropsFromTickScale(xScale, 10)}
              format={(d) => d3.format("~s")(d)}
              style={{ orient: BOTTOM }}
            />
          </g>
        </svg>
      </Wrapper>
    );
  }
}
ScatterPlot.propTypes = {
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  xDomain: PropTypes.array,
  results: PropTypes.object,
  title: PropTypes.string
};
ScatterPlot.defaultProps = {
  xDomain: [],
};
export default ScatterPlot;
