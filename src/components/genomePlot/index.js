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
  maxY = 10;

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
    let { width, height, genome, xDomain, chromoBins } = this.props;

    let stageWidth = width - 2 * margins.gap;
    let stageHeight = height - 2 * margins.gap;
    this.regl.poll();
    
    let intervals = genome.intervals;
    let intervalBins = {}, intervalsStartPoint = [], intervalsEndPoint = [], counterFiltered = 0, globalMaxY = 10, maxY = 10, domainY = [0,0], intervalsY = [], domainX = xDomain,intervalsFill = [], intervalsStroke = [];
    intervals.forEach((d,i) => {
      let startPlace = chromoBins[`${d.chromosome}`].startPlace + d.startPoint;
      let endPlace = chromoBins[`${d.chromosome}`].startPlace + d.endPoint;
      intervalsStartPoint.push(startPlace);
      intervalsEndPoint.push(endPlace);
      intervalsY.push(+d.y);
      intervalsFill.push(rgbtoInteger(d3.rgb(chromoBins[`${d.chromosome}`].color)));
      intervalsStroke.push(rgbtoInteger(d3.rgb(chromoBins[`${d.chromosome}`].color).darker()));
      globalMaxY = d3.max([d.y, globalMaxY]);
      intervalBins[d.iid] = d;
      if (((startPlace <= xDomain[1]) && (startPlace >= xDomain[0])) || ((endPlace <= xDomain[1]) && (endPlace >= xDomain[0]))) {
        counterFiltered += 1;
        maxY = d3.max([d.y, maxY]);
      }
    }); 
    domainY = [0, d3.min([10, counterFiltered > 0 ? maxY + 1 : globalMaxY])];

    let intervalStruct = {intervalsStartPoint, intervalsEndPoint, intervalsY, intervalsFill, intervalsStroke, domainX , domainY};

    this.plot.load(
      stageWidth,
      stageHeight,
      intervalStruct
    );
    this.plot.render();
  }

  render() {
    const { width, height, genome, chromoBins, xDomain, title } = this.props;
    let stageWidth = width - 2 * margins.gap;
    let stageHeight = height - 2 * margins.gap;

    let maxY = 10, globalMaxY = 10, counterFiltered = 0;
    genome.intervals.forEach((d,i) => {
      let startPlace = chromoBins[`${d.chromosome}`].startPlace + d.startPoint;
      let endPlace = chromoBins[`${d.chromosome}`].startPlace + d.endPoint;
      globalMaxY = d3.max([d.y, globalMaxY]);
      if (((startPlace <= xDomain[1]) && (startPlace >= xDomain[0])) || ((endPlace <= xDomain[1]) && (endPlace >= xDomain[0]))) {
        counterFiltered += 1;
        maxY = d3.max([d.y, maxY]);
      }
    });
    let domainY = [0, d3.min([10, counterFiltered > 0 ? maxY + 1 : globalMaxY])];

    const yScale = d3
      .scaleLinear()
      .domain(domainY)
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
  title: PropTypes.string,
  chromoBins: PropTypes.object
};
GenomePlot.defaultProps = {
  xDomain: [],
};
export default GenomePlot;