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
  plotContainer = null;
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
    if (
      prevProps.genome.intervals.length !==
        this.props.genome.intervals.length ||
      prevProps.chromoBins !== this.props.chromoBins ||
      prevProps.width !== this.props.width ||
      prevProps.height !== this.props.height
    ) {
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

      this.plot.rescaleX(this.props.xDomain);
    }
  }

  componentWillUnmount() {
    if (this.regl) {
      this.regl.destroy();
    }
  }

  updateStage() {
    let {
      width,
      height,
      genome,
      xDomain,
      defaultDomain,
      chromoBins,
      updateDomain,
    } = this.props;

    let stageWidth = width - 2 * margins.gap;
    let stageHeight = height - 2 * margins.gap;
    this.regl.poll();

    let intervals = genome.intervals;
    let intervalBins = {},
      intervalsStartPoint = [],
      intervalsEndPoint = [],
      counterFiltered = 0,
      globalMaxY = 10,
      maxY = 10,
      domainY = [0, 0],
      intervalsY = [],
      domainX = xDomain,
      intervalsFill = [],
      intervalsStroke = [];
    intervals.forEach((d, i) => {
      let startPlace = chromoBins[`${d.chromosome}`].startPlace + d.startPoint;
      let endPlace = chromoBins[`${d.chromosome}`].startPlace + d.endPoint;
      intervalsStartPoint.push(startPlace);
      intervalsEndPoint.push(endPlace);
      intervalsY.push(+d.y);
      intervalsFill.push(
        rgbtoInteger(d3.rgb(chromoBins[`${d.chromosome}`].color))
      );
      intervalsStroke.push(
        rgbtoInteger(d3.rgb(chromoBins[`${d.chromosome}`].color).darker())
      );
      globalMaxY = d3.max([d.y, globalMaxY]);
      intervalBins[d.iid] = d;
      if (
        (startPlace <= xDomain[1] && startPlace >= xDomain[0]) ||
        (endPlace <= xDomain[1] && endPlace >= xDomain[0])
      ) {
        counterFiltered += 1;
        maxY = d3.max([d.y, maxY]);
      }
    });
    domainY = [0, d3.min([10, counterFiltered > 0 ? maxY + 1 : globalMaxY])];

    let intervalStruct = {
      intervalsStartPoint,
      intervalsEndPoint,
      intervalsY,
      intervalsFill,
      intervalsStroke,
      domainX,
      domainY,
    };

    this.plot.load(stageWidth, stageHeight, intervalStruct);
    this.plot.render();

    this.genomeScale = d3
      .scaleLinear()
      .domain(defaultDomain)
      .range([0, stageWidth]);
    var s = [this.genomeScale(xDomain[0]), this.genomeScale(xDomain[1])];

    this.currentTransform = null;

    this.zoom = d3
      .zoom()
      .translateExtent([
        [0, 0],
        [stageWidth, stageHeight],
      ])
      .extent([
        [0, 0],
        [stageWidth, stageHeight],
      ])
      .scaleExtent([1, Infinity])
      .on("zoom", (event) => {
        var t = event.transform;
        var newDomain = t.rescaleX(this.genomeScale).domain().map(Math.floor);
        if (newDomain.toString !== xDomain) {
          updateDomain(newDomain[0], newDomain[1]);
        }
      });

    d3.select(this.container)
      .attr("preserveAspectRatio", "xMinYMin meet")
      .call(this.zoom);
    d3.select(this.container).call(
      this.zoom.transform,
      d3.zoomIdentity.scale(stageWidth / (s[1] - s[0])).translate(-s[0], 0)
    );

    let self = this;
    let selectedIndex = null;
    d3.select(this.container)
      .select("canvas")
      .on("mousemove", function (event) {
          let position = d3.pointer(event);
          console.log(position, event);
        try {
          const pixels = self.plot.regl.read({
            x: position[0],
            y: stageHeight - position[1],
            width: 1,
            height: 1,
            data: new Uint8Array(6),
            framebuffer: self.plot.fboIntervals,
          });
          let index = pixels[0] * 65536 + pixels[1] * 256 + pixels[2] - 3000;
          selectedIndex = index;
          console.log(selectedIndex, intervals[index]);
          if (intervals[index]) {
            d3.select(self.plotContainer)
              .select('g.tooltip')
              .attr('transform', `translate(${position})`)
              .select('text')
              .text(`interval#${intervals[index].iid}`)
          } else {
            d3.select(self.plotContainer).select('g.tooltip').attr('transform', `translate(${[-100, -100]})`)
          }
        } catch (error) {
          console.error(error);
        }
      });
  }

  render() {
    const { width, height, genome, chromoBins, xDomain, title } = this.props;
    let stageWidth = width - 2 * margins.gap;
    let stageHeight = height - 2 * margins.gap;

    let maxY = 10,
      globalMaxY = 10,
      counterFiltered = 0;
    genome.intervals.forEach((d, i) => {
      let startPlace = chromoBins[`${d.chromosome}`].startPlace + d.startPoint;
      let endPlace = chromoBins[`${d.chromosome}`].startPlace + d.endPoint;
      globalMaxY = d3.max([d.y, globalMaxY]);
      if (
        (startPlace <= xDomain[1] && startPlace >= xDomain[0]) ||
        (endPlace <= xDomain[1] && endPlace >= xDomain[0])
      ) {
        counterFiltered += 1;
        maxY = d3.max([d.y, maxY]);
      }
    });
    let domainY = [
      0,
      d3.min([10, counterFiltered > 0 ? maxY + 1 : globalMaxY]),
    ];

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
        <svg width={width} height={height} className="plot-container" ref={(elem) => (this.plotContainer = elem)}>
          <clipPath id="clipping">
            <rect x={0} y={0} width={stageWidth} height={stageHeight} />
          </clipPath>
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
              values={yScale.ticks(10).concat(yScale.domain()[1])}
              style={{ orient: LEFT }}
            />
          </g>
          <g
            clipPath="url(#clipping)"
            transform={`translate(${[margins.gap, stageHeight + margins.gap]})`}
          >
            {Object.keys(chromoBins).map((d, i) => {
              let xxScale = d3
                .scaleLinear()
                .domain([chromoBins[d].startPoint, chromoBins[d].endPoint])
                .range([
                  0,
                  xScale(chromoBins[d].endPlace) -
                    xScale(chromoBins[d].startPlace),
                ]);
              let tickCount = d3.max([
                Math.floor((xxScale.range()[1] - xxScale.range()[0]) / 40),
                2,
              ]);
              let ticks = xxScale.ticks(tickCount);
              ticks[ticks.length - 1] = xxScale.domain()[1];
              return (
                xScale(chromoBins[d].startPlace) <= stageWidth && (
                  <g
                    key={d}
                    transform={`translate(${[
                      xScale(chromoBins[d].startPlace),
                      0,
                    ]})`}
                  >
                    <Axis
                      {...axisPropsFromTickScale(xxScale, tickCount)}
                      values={ticks}
                      format={(e) => d3.format("~s")(e)}
                      style={{ orient: BOTTOM }}
                    />
                  </g>
                )
              );
            })}
          </g>
          <g
            transform={`translate(${[margins.gap, stageHeight + margins.gap]})`}
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
          <g class="tooltip" transform="translate(-100, 100)" pointer-events="none">
            <rect x="20" y="20" width="150" height="40" rx="5" ry="5" fill="rgb(97, 97, 97)" fill-opacity="0.97"/>
            <text x="30" y="48" font-size="14" fill="#FFF">7A</text>
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
  defaultDomain: PropTypes.array,
  genome: PropTypes.object,
  title: PropTypes.string,
  chromoBins: PropTypes.object,
  updateDomain: PropTypes.func,
};
GenomePlot.defaultProps = {
  xDomain: [],
  defaultDomain: [],
};
export default GenomePlot;
