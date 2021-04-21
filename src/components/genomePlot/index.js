import React, { Component } from "react";
import { renderToString } from "react-dom/server";
import { PropTypes } from "prop-types";
import * as d3 from "d3";
import { Axis, axisPropsFromTickScale, LEFT, BOTTOM } from "react-d3-axis";
import Wrapper from "./index.style";
import { rgbtoInteger, humanize, measureText } from "../../helpers/utility";
import Plot from "./plot";

const margins = {
  gap: 24,
};

class GenomePlot extends Component {
  regl = null;
  container = null;
  plotContainer = null;

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
    let {
      width,
      height,
      genome,
      xDomain,
      chromoBins,
    } = this.props;

    let stageWidth = width - 2 * margins.gap;
    let stageHeight = height - 2 * margins.gap;
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
      this.handleZoom(genome.intervals, chromoBins, xDomain, stageWidth, stageHeight);
    }
  }

  componentWillUnmount() {
    if (this.regl) {
      this.regl.destroy();
    }
  }

  handleZoom(intervals, chromoBins, newDomainX, stageWidth, stageHeight) {
    this.regl.clear({
      color: [0, 0, 0, 0.05],
      depth: false,
    });

    this.regl.poll();

    let newDomainY = this.calculateDomainY(intervals, chromoBins, newDomainX);
    this.plot.rescaleXY(newDomainX, newDomainY);
    
    d3.select("g.separators-container").html(
      renderToString(
        this.separatorsContent(
          newDomainX,
          chromoBins,
          stageWidth,
          stageHeight
        )
      )
    );
    d3.select("g.chromo-axis-container").html(
      renderToString(
        this.chromoAxisContent(
          newDomainX,
          chromoBins,
          stageWidth,
          stageHeight
        )
      )
    );
    d3.select("g.y-axis-container").html(
      renderToString(
        this.axisYContent(
          intervals, chromoBins, newDomainX, stageHeight
        )
      )
    );
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
      intervalBins[d.iid] = d;
    });
    domainY = this.calculateDomainY(
      intervals, chromoBins, xDomain
    )

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
        var newDomainX = t.rescaleX(this.genomeScale).domain().map(Math.floor);
        if (newDomainX.toString !== xDomain) {
          this.handleZoom(intervals, chromoBins, newDomainX, stageWidth, stageHeight);
        }
      })
      .on("end", (event) => {
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
    d3.select(this.container)
      .select("canvas")
      .on("mousemove", function (event) {
        let position = d3.pointer(event);
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
          if (intervals[index]) {
            let textData = self.tooltipContent(intervals[index]);
            let maxLength = d3.max(textData, (d) =>
              measureText(`${d.label}: ${d.value}`, 12)
            );
            d3.select(self.plotContainer).selectAll("g.tooltip tspan").remove();
            d3.select(self.plotContainer)
              .select("g.tooltip rect")
              .attr("height", textData.length * 16 + 12)
              .attr("width", maxLength + 30);
            d3.select(self.plotContainer)
              .select("g.tooltip")
              .attr("transform", `translate(${position})`)
              .select("text")
              .selectAll("tspan")
              .data(textData)
              .enter()
              .append("tspan")
              .attr("x", (d, i) => 40)
              .attr("y", (d, i) => 38 + i * 16)
              .html(
                (e, i) =>
                  `<tspan font-weight="bold">${e.label}</tspan>: ${e.value}`
              );
          } else {
            d3.select(self.plotContainer)
              .select("g.tooltip")
              .attr("transform", `translate(${[-1000, -1000]})`);
          }
        } catch (error) {
          console.error(error);
        }
      });
  }

  tooltipContent(interval) {
    let attributes = [
      { label: "iid", value: interval.iid },
      { label: "Chromosome", value: interval.chromosome },
      { label: "Y", value: interval.y },
      { label: "Start Point", value: d3.format(",")(interval.startPoint) },
      { label: "End Point", value: d3.format(",")(interval.endPoint) },
      {
        label: "Length",
        value: d3.format(",")(interval.endPoint - interval.startPoint),
      },
    ];
    if (interval.strand) {
      attributes.push({ label: "Strand", value: interval.strand });
    }
    if (interval.sequence) {
      attributes.push({ label: "Sequence", value: interval.sequence });
    }
    Object.keys(interval.metadata).forEach((key) => {
      attributes.push({ label: humanize(key), value: interval.metadata[key] });
    });
    return attributes;
  }

  separatorsContent(xDomain, chromoBins, stageWidth, stageHeight) {
    const xScale = d3.scaleLinear().domain(xDomain).range([0, stageWidth]);
    let objects = Object.keys(chromoBins).map((d, i) => (
      <g
        key={d}
        transform={`translate(${[xScale(chromoBins[d].startPlace), 0]})`}
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
    ));
    return <g>{objects}</g>;
  }

  chromoAxisContent(xDomain, chromoBins, stageWidth, stageHeight) {
    const xScale = d3.scaleLinear().domain(xDomain).range([0, stageWidth]);
    let objects = Object.keys(chromoBins).map((d, i) => {
      let xxScale = d3
        .scaleLinear()
        .domain([chromoBins[d].startPoint, chromoBins[d].endPoint])
        .range([
          0,
          xScale(chromoBins[d].endPlace) - xScale(chromoBins[d].startPlace),
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
            transform={`translate(${[xScale(chromoBins[d].startPlace), 0]})`}
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
    });
    return <g>{objects}</g>;
  }

  axisYContent(intervals, chromoBins, xDomain, stageHeight) {
    const yScale = d3
      .scaleLinear()
      .domain(this.calculateDomainY(intervals, chromoBins, xDomain))
      .range([stageHeight, 0]);
    let tickCount = 10;
    let ticks = yScale.ticks(tickCount);
    ticks[ticks.length - 1] = yScale.domain()[1];
    return (
      <g>
        <Axis
          {...axisPropsFromTickScale(yScale, tickCount)}
          values={ticks}
          style={{ orient: LEFT }}
        />
      </g>
    );
  }

  calculateDomainY(intervals, chromoBins, xDomain) {
    let globalMaxY = 0;
    let filterMaxY = null;
    intervals.forEach((d, i) => {
      let startPlace = chromoBins[`${d.chromosome}`].startPlace + d.startPoint;
      let endPlace = chromoBins[`${d.chromosome}`].startPlace + d.endPoint;
      globalMaxY = d3.max([d.y, globalMaxY]);
      if (
        (startPlace <= xDomain[1] && startPlace >= xDomain[0]) ||
        (endPlace <= xDomain[1] && endPlace >= xDomain[0])
      ) {
        filterMaxY = d3.max([d.y, filterMaxY || 0]);
      }
    });
    return [0, (filterMaxY || globalMaxY) + 1];
  }

  render() {
    const { width, height, genome, chromoBins, xDomain, title } = this.props;
    let stageWidth = width - 2 * margins.gap;
    let stageHeight = height - 2 * margins.gap;

    return (
      <Wrapper className="ant-wrapper" margins={margins}>
        <div
          className="genome-plot"
          style={{ width: stageWidth, height: stageHeight }}
          ref={(elem) => (this.container = elem)}
        />
        <svg
          width={width}
          height={height}
          className="plot-container"
          ref={(elem) => (this.plotContainer = elem)}
        >
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
          <g className="y-axis-container" 
            transform={`translate(${[margins.gap, margins.gap]})`}>
            {this.axisYContent(genome.intervals, chromoBins, xDomain, stageHeight)}
          </g>
          <g
            className="chromo-axis-container"
            clipPath="url(#clipping)"
            transform={`translate(${[margins.gap, stageHeight + margins.gap]})`}
          >
            {this.chromoAxisContent(xDomain, chromoBins, stageWidth, stageHeight)}
          </g>
          <g
            className="separators-container"
            transform={`translate(${[margins.gap, stageHeight + margins.gap]})`}
          >
            {this.separatorsContent(xDomain, chromoBins, stageWidth, stageHeight)}
          </g>
          <g
            className="tooltip"
            transform="translate(-1000, -1000)"
            pointerEvents="none"
          >
            <rect
              x="30"
              y="20"
              width="150"
              height="40"
              rx="5"
              ry="5"
              fill="rgb(97, 97, 97)"
              fillOpacity="0.97"
            />
            <text x="40" y="48" fontSize="12" fill="#FFF"></text>
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
