import React, { Component } from "react";
import { PropTypes } from "prop-types";
import * as d3 from "d3";
import Wrapper from "./index.style";
import Connection from "./connection";
import Interval from "./interval";
import { measureText } from "../../helpers/utility";
import Grid from "./grid";

const margins = {
  gap: 24,
  bar: 10,
};

class GenomePlot extends Component {
  state = {
    tooltip: {
      shapeId: -1,
      x: -1000,
      y: -1000,
      text: ""
    }
  }
  handleShapeMouseOut = () => {
    this.setState({tooltip: {visible: false}});
  }

  handleShapeMouseOver = (e, shape, visible) => {
    const { width, height } = this.props;
    let diffY = d3.min([0, height - e.nativeEvent.offsetY - shape.tooltipContent.length * 16 - 12]);
    let diffX = d3.min([0, width - e.nativeEvent.offsetX - d3.max(shape.tooltipContent, (d) => measureText(`${d.label}: ${d.value}`, 12)) - 30]);
    this.setState({tooltip: {shapeId: shape.primaryKey, visible: true, x: (e.nativeEvent.offsetX + diffX), y: (e.nativeEvent.offsetY + diffY), text: shape.tooltipContent}})
  }

  render() {
    const { width, height, genome, chromoBins, xDomain, title } = this.props;
    const { tooltip } = this.state;

    let stageWidth = width - 2 * margins.gap;
    let stageHeight = height - 3 * margins.gap;

    let intervals = [];
    let intervalBins = {};
    genome.intervals.forEach((d, i) => {
      let interval = new Interval(d);
      interval.startPlace = chromoBins[`${interval.chromosome}`].startPlace + interval.startPoint;
      interval.endPlace = chromoBins[`${interval.chromosome}`].startPlace + interval.endPoint;
      interval.fill = d3.rgb(chromoBins[`${interval.chromosome}`].color).toString();
      interval.stroke = d3
        .rgb(chromoBins[`${interval.chromosome}`].color)
        .darker()
        .toString();
      intervalBins[d.iid] = interval;
      if ((interval.startPlace <= xDomain[1]) && (interval.endPlace >= xDomain[0])) {
        intervals.push(interval);
      }
    });
    let yDomain = [
      0,
      d3.max(
        intervals.filter(
          (d) => d.startPlace <= xDomain[1] && d.endPlace >= xDomain[0]
        ),
        (d) => d.y
      ) + 1,
    ];
    const xScale = d3.scaleLinear().domain(xDomain).range([0, stageWidth]);
    const yScale = d3
      .scaleLinear()
      .domain(yDomain)
      .range([stageHeight, 0])
      .nice();

    let connections = [];
    genome.connections.forEach((d, i) => {
      let connection = new Connection(d);
      connection.yScale = yScale;
      connection.pinpoint(intervalBins);
      if (connection.source) {
        connection.source.scale = xScale;
      }
      if (connection.sink) {
        connection.sink.scale = xScale;
      }
      connection.touchScale = xScale;
      if (
        (connection.source && (connection.source.place <= xDomain[1] && connection.source.place >= xDomain[0]))
        || (connection.sink && (connection.sink.place <= xDomain[1] && connection.sink.place >= xDomain[0]))
      ) {
        connections.push(connection);
      }
    });

    return (
      <Wrapper className="ant-wrapper">
        <svg width={width} height={height}>
        <defs>
          <clipPath id="cuttOffViewPane">
            <rect x={0} y={0} width={stageWidth} height={2 * stageHeight} />
          </clipPath>
          </defs>
          <g transform={`translate(${[margins.gap,margins.gap]})`} clipPath="url(#cuttOffViewPane)">
            <Grid
              scaleX={xScale}
              scaleY={yScale}
              axisWidth={stageWidth}
              axisHeight={stageHeight}
              chromoBins={chromoBins}
            />
          </g>
          <g transform={`translate(${[margins.gap,margins.gap]})`} clipPath="url(#cuttOffViewPane)">
            {intervals.map((d, i) => (
              <rect
                key={i}
                className={`shape ${d.primaryKey === tooltip.shapeId ? "highlighted" : ""}`}
                transform={`translate(${[xScale(d.startPlace),yScale(d.y) - 0.5 * margins.bar]})`}
                width={xScale(d.endPlace) - xScale(d.startPlace)}
                height={margins.bar}
                style={{fill: d.fill, stroke: d.stroke, strokeWidth: 1}}
                onMouseOver={(e) => this.handleShapeMouseOver(e, d)}
                onMouseOut={(e) => this.handleShapeMouseOut()}
              />
            ))}
          </g>
          <g transform={`translate(${[margins.gap,margins.gap]})`} clipPath="url(#cuttOffViewPane)">
            {connections.map((d, i) => (
              <path
                key={d.identifier}
                className={`connection ${d.primaryKey === tooltip.shapeId ? "highlighted" : ""}`}
                d={d.render}
                style={{fill: d.fill, stroke: d.color, strokeWidth: d.strokeWidth, strokeDasharray: d.dash, opacity: d.opacity }}
                onMouseOver={(e) => this.handleShapeMouseOver(e, d)}
                onMouseOut={(e) => this.handleShapeMouseOut()}
              />
            ))}
          </g>
          {tooltip.visible && <g
            className="tooltip"
            transform={`translate(${[tooltip.x, tooltip.y]})`}
            pointerEvents="none"
          >
            <rect
              x="0"
              y="0"
              width={d3.max(tooltip.text, (d) =>
                measureText(`${d.label}: ${d.value}`, 12) + 30
              )}
              height={tooltip.text.length * 16 + 12}
              rx="5"
              ry="5"
              fill="rgb(97, 97, 97)"
              fillOpacity="0.97"
            />
            <text x="10" y="28" fontSize="12" fill="#FFF">
              {tooltip.text.map((d,i) => 
                <tspan key={i} x={10} y={18 + i * 16}>
                  <tspan fontWeight="bold">{d.label}</tspan>: {d.value}
                </tspan>)}
            </text>
          </g>}
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
