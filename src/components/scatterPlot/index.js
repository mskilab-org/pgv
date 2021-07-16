import React, { Component } from "react";
import { PropTypes } from "prop-types";
import * as d3 from "d3";
import { connect } from "react-redux";
import { withTranslation } from "react-i18next";
import outliers from "outliers";
import Grid from "../grid/index";
import Points from "./points";
import Wrapper from "./index.style";

const margins = {
  gapX: 12,
  gapY: 24,
  yTicksCount: 10,
};

class ScatterPlot extends Component {
  regl = null;
  container = null;
  dataPointsX = null;
  dataPointsY = null;

  constructor(props) {
    super(props);
    let { results, width, height } = this.props;
    this.dataPointsY = results.getColumn("y").toArray();
    this.dataPointsX = results.getColumn("x").toArray();
    let stageWidth = width - 2 * margins.gapX;
    let stageHeight = height - 3 * margins.gapY;
    this.state = {
      stageWidth,
      stageHeight,
    };
  }

  componentDidMount() {
    const regl = require("regl")({
      extensions: ["ANGLE_instanced_arrays"],
      container: this.container,
      pixelRatio: window.devicePixelRatio || 1.5,
      attributes: {
        antialias: true,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: true,
      },
    });

    regl.cache = {};
    this.regl = regl;

    this.regl.clear({
      color: [0, 0, 0, 0.0],
      stencil: true,
    });
    this.points = new Points(this.regl);
    this.updateStage();
  }

  componentDidUpdate(prevProps, prevState) {
    this.regl.clear({
      color: [0, 0, 0, 0.0],
      depth: false,
    });

    this.regl.poll();

    let matched = Array.prototype.slice.call(
      this.dataPointsY.slice(
        this.dataPointsX.findIndex((d) => d >= this.props.xDomain[0]),
        this.dataPointsX.findIndex((d) => d >= this.props.xDomain[1])
      )
    );
    matched = [...new Set(matched.map((e) => +e.toFixed(1)))].filter(
      outliers()
    );
    let yExtent = [0, d3.max(matched)];
    this.points.rescaleXY(this.props.xDomain, yExtent);
  }

  componentWillUnmount() {
    if (this.regl) {
      this.regl.destroy();
    }
  }

  updateStage() {
    let { results, xDomain } = this.props;
    let { stageWidth, stageHeight } = this.state;

    this.regl.poll();
    let xExtent = xDomain;

    let matched = Array.prototype.slice.call(
      this.dataPointsY.slice(
        this.dataPointsX.findIndex((d) => d >= xDomain[0]),
        this.dataPointsX.findIndex((d) => d >= xDomain[1])
      )
    );
    matched = [...new Set(matched.map((e) => +e.toFixed(1)))].filter(
      outliers()
    );
    let yExtent = [0, d3.max(matched)];
    let dataPointsColor = results.getColumn("color").toArray();

    this.points.load(
      stageWidth,
      stageHeight,
      5,
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
    let { stageWidth, stageHeight } = this.state;

    let matched = Array.prototype.slice.call(
      this.dataPointsY.slice(
        this.dataPointsX.findIndex((d) => d >= xDomain[0]),
        this.dataPointsX.findIndex((d) => d >= xDomain[1])
      )
    );
    matched = [...new Set(matched.map((e) => +e.toFixed(1)))].filter(
      outliers()
    );
    let yExtent = [0, d3.max(matched)];
    const yScale = d3.scaleLinear().domain(yExtent).range([stageHeight, 0]);
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
            transform={`translate(${[width / 2, margins.gapY]})`}
            textAnchor="middle"
            fontSize={14}
            dy="-4"
          >
            {title}
          </text>
          <g transform={`translate(${[margins.gapX, margins.gapY]})`}>
            {
              <Grid
                scaleX={xScale}
                scaleY={yScale}
                axisWidth={stageWidth}
                axisHeight={stageHeight}
                chromoBins={chromoBins}
              />
            }
          </g>
          <g
            transform={`translate(${[margins.gapX, stageHeight + margins.gapY]})`}
          >
            {Object.keys(chromoBins).map((d, i) => (
              <g
                key={d}
                transform={`translate(${[
                  xScale(chromoBins[d].startPlace),
                  0,
                ]})`}
              >
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2={-stageHeight}
                  stroke="rgb(128, 128, 128)"
                  strokeDasharray="4"
                />
              </g>
            ))}
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
  chromoBins: PropTypes.object,
};
ScatterPlot.defaultProps = {
  xDomain: [],
};

const mapDispatchToProps = (dispatch) => ({});
const mapStateToProps = (state) => ({
  chromoBins: state.App.chromoBins,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(ScatterPlot));
