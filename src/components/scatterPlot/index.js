import React, { Component } from "react";
import { PropTypes } from "prop-types";
import * as d3 from "d3";
import { Axis, axisPropsFromTickScale, LEFT, BOTTOM } from "react-d3-axis";
import Points from "./points";
import Wrapper from "./index.style";

const margins = {
  gap: 24,
  yTicksCount: 10
};

class ScatterPlot extends Component {
  regl = null;
  container = null;

  componentDidMount() {
    const regl = require("regl")({
      extensions: ["ANGLE_instanced_arrays"],
      container: this.container,
      pixelRatio: window.devicePixelRatio || 1.5,
      attributes: { antialias: true, depth: false, stencil: false, preserveDrawingBuffer: true },
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

    if ((prevProps.results.getColumn("y").toArray().length !== this.props.results.getColumn("y").toArray().length)
      || (prevProps.width !== this.props.width)
      || (prevProps.height !== this.props.height)) {
        this.regl.clear({
          color: [0, 0, 0, 0.05],
          depth: false,
        });
    
        this.regl.poll();
        this.updateStage();
    }
    if (prevProps.xDomain.toString() !== this.props.xDomain.toString()) {
  
      this.regl.clear({
        color: [0, 0, 0, 0.05],
        depth: false,
      });
  
      this.regl.poll();
  
      let yExtent = d3.extent(this.dataPointsY.slice(this.dataPointsX.findIndex(d => d >= this.props.xDomain[0]),this.dataPointsX.findIndex(d => d >= this.props.xDomain[1])));
      this.points.rescaleXY(this.props.xDomain, yExtent);
    }
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
    let xExtent = xDomain;
    this.dataPointsY = results.getColumn("y").toArray();
    this.dataPointsX = results.getColumn("x").toArray();
    let yExtent = d3.extent(this.dataPointsY.slice(this.dataPointsX.findIndex(d => d >= xDomain[0]),this.dataPointsX.findIndex(d => d >= xDomain[1])));
    let dataPointsColor = results.getColumn("color").toArray();
    
    this.points.load(
      stageWidth,
      stageHeight,
      2,
      this.dataPointsX,
      this.dataPointsY,
      dataPointsColor,
      xExtent,
      yExtent
    );
    this.points.render();
  }

  render() {
    const { width, height, results, xDomain, chromoBins, title } = this.props;
    let stageWidth = width - 2 * margins.gap;
    let stageHeight = height - 2 * margins.gap;
    let dataPointsY = results.getColumn("y").toArray();
    let dataPointsX = results.getColumn("x").toArray();
    let yExtent = d3.extent(dataPointsY.slice(dataPointsX.findIndex(d => d >= xDomain[0]), dataPointsX.findIndex(d => d >= xDomain[1])));
    const yScale = d3
      .scaleLinear()
      .domain(yExtent)
      .range([stageHeight, 0]);
    const xScale = d3.scaleLinear().domain(xDomain).range([0, stageWidth]);
    let yTicks = yScale.ticks(margins.yTicksCount);
    yTicks[yTicks.length - 1] = yScale.domain()[1];
    return (
      <Wrapper className="ant-wrapper" margins={margins}>
        <div
          className="scatterplot"
          style={{ width: stageWidth, height: stageHeight }}
          ref={(elem) => (this.container = elem)}
        />
        <svg width={width} height={height} className="plot-container">
          <clipPath id="clipping">
            <rect x={0} y={0} width={stageWidth} height={stageHeight} />
          </clipPath>
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
              {...axisPropsFromTickScale(yScale, margins.yTicksCount)}
              values={yTicks}
              style={{ orient: LEFT }}
            />
          </g>
          <g clipPath="url(#clipping)"
            transform={`translate(${[margins.gap, stageHeight + margins.gap]})`}
          >
            {Object.keys(chromoBins).map((d,i) => {
            let xxScale = d3.scaleLinear().domain([chromoBins[d].startPoint, chromoBins[d].endPoint]).range([0, xScale(chromoBins[d].endPlace) - xScale(chromoBins[d].startPlace)]);
            let tickCount = d3.max([Math.floor((xxScale.range()[1] - xxScale.range()[0]) / 40), 2]);
            let ticks = xxScale.ticks(tickCount);
            ticks[ticks.length - 1] = xxScale.domain()[1];
            return (xScale(chromoBins[d].startPlace) <= stageWidth) && <g key={d} transform={`translate(${[xScale(chromoBins[d].startPlace), 0]})`}>
              <Axis
              {...axisPropsFromTickScale(xxScale, tickCount)}
              values={ticks}
              format={(e) => d3.format("~s")(e)}
              style={{ orient: BOTTOM }}
            />
            </g>})}
          </g>
          <g
            transform={`translate(${[margins.gap, stageHeight + margins.gap]})`}
          >
            {Object.keys(chromoBins).map((d,i) => 
            <g  key={d} transform={`translate(${[xScale(chromoBins[d].startPlace), 0]})`}>
             <line x1="0" y1="0" x2="0" y2={-stageHeight} stroke="rgb(128, 128, 128)" strokeDasharray="4" />
            </g>)}
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
  title: PropTypes.string,
  chromoBins: PropTypes.object
};
ScatterPlot.defaultProps = {
  xDomain: [],
};
export default ScatterPlot;
