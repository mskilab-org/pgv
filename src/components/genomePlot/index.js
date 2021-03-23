import React, { Component } from "react";
import { PropTypes } from "prop-types";
import * as d3 from "d3";
import { Axis, axisPropsFromTickScale, LEFT, BOTTOM } from "react-d3-axis";
import Wrapper from "./index.style";
import { rgbtoInteger } from "../../helpers/utility";
import Plot from "./plot";

const margins = {
  gap: 24,
};

class GenomePlot extends Component {
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
    this.plot = new Plot(this.regl);
    this.updateStage();
  }

  componentDidUpdate(prevProps, prevState) {
    this.regl.clear({
      color: [0, 0, 0, 0],
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
    let { width, height, genome, xDomain, chromoBins } = this.props;

    let stageWidth = width - 2 * margins.gap;
    let stageHeight = height - 2 * margins.gap;
    this.regl.poll();
    
    let intervals = genome.intervals;
    let intervalBins = {}, intervalsStartPoint = [], intervalsEndPoint = [], domainY = [0,0], intervalsY = [], domainX = xDomain,intervalsFill = [], intervalsStroke = [];
    intervals.forEach((d,i) => {
      d.startPlace = chromoBins[`${d.chromosome}`].startPlace + d.startPoint;
      intervalsStartPoint.push(d.startPlace);
      d.endPlace = chromoBins[`${d.chromosome}`].startPlace + d.endPoint;
      intervalsEndPoint.push(d.endPlace);
      intervalsY.push(+d.y);
      intervalsFill.push(rgbtoInteger(d3.rgb(chromoBins[`${d.chromosome}`].color)));
      intervalsStroke.push(rgbtoInteger(d3.rgb(chromoBins[`${d.chromosome}`].color).darker()));
      domainY = [d3.min([domainY[0], +d.y]), d3.max([domainY[1], +d.y])];
      intervalBins[d.iid] = d;
    });
    
    let intervalStruct = {intervalsStartPoint, intervalsEndPoint, intervalsY, intervalsFill, intervalsStroke, domainX , domainY};
    console.log(intervalStruct)
    this.plot.load(
      stageWidth,
      stageHeight,
      intervalStruct
    );
    this.plot.render();
  }

  render() {
    const { width, height, genome, xDomain, title } = this.props;
    let stageWidth = width - 2 * margins.gap;
    let stageHeight = height - 2 * margins.gap;
    const yScale = d3
      .scaleLinear()
      .domain([0, d3.max(genome.intervals, d => d.y)])
      .range([stageHeight, 0])
      .nice();
    const xScale = d3.scaleLinear().domain(xDomain).range([0, stageWidth]);
    return (
      <Wrapper className="ant-wrapper" margins={margins}>
        <div
          className="genome-plot"
          style={{ width: stageWidth, height: stageHeight }}
          ref={(elem) => (this.container = elem)}
        />
        <svg width={width} height={height} className="plot-container">
          <text
            transform={`translate(${[width / 2, margins.gap]})`}
            textAnchor="middle"
            fontSize={16}
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
GenomePlot.propTypes = {
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  xDomain: PropTypes.array,
  genome: PropTypes.object,
  title: PropTypes.string
};
GenomePlot.defaultProps = {
  xDomain: [],
};
export default GenomePlot;