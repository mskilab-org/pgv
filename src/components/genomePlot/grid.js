import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { select } from "d3-selection";
import { format } from "d3-format";
import { scaleLinear } from "d3-scale";
import { max } from "d3-array";
import { axisBottom, axisLeft } from "d3-axis";
import Axis from "./axis";
import AxisLine from "./axisLine";
import AxisText from "./axisText";
import AxisCircle from "./axisCircle";

class Grid extends Component {
  render() {
    const { scaleX, axisWidth, axisHeight, chromoBins, fontSize, gap } =
      this.props;
    return (
      <g>
        <g transform={`translate(${[gap,0]})`}>
          {this.calculateAxisY(this.props).map((d) => (
            <Axis key={d.key} {...d} />
          ))}
        </g>
        <g transform={`translate(${[0,axisHeight]})`}>
          {this.chromoAxisContent(
            scaleX.domain(),
            chromoBins,
            axisWidth,
            axisHeight,
            fontSize
          )}
        </g>
      </g>
    );
  }

  chromoAxisContent(xDomain, chromoBins, stageWidth, stageHeight, fontSize) {
    const xScale = scaleLinear().domain(xDomain).range([0, stageWidth]);
    let objects = Object.keys(chromoBins).map((d, i) => {
      let xxScale = scaleLinear()
        .domain([chromoBins[d].startPoint, chromoBins[d].endPoint])
        .range([
          0,
          xScale(chromoBins[d].endPlace) - xScale(chromoBins[d].startPlace),
        ]);
      return (
        xScale(chromoBins[d].startPlace) <= stageWidth && (
          <g key={d} transform={`translate(${[xScale(chromoBins[d].startPlace),0]})`}>
            {this.calculateAxisX({
              scaleX: xxScale,
              axisHeight: stageHeight,
              fontSize,
            }).map((e) => (
              <Axis key={e.key} {...e} />
            ))}
            <AxisCircle 
              x={xxScale.range()[1] / 2}
              y={-stageHeight + 1.4 * fontSize}
              radius={fontSize}
              stroke={chromoBins[d].color}
              />
            <AxisText
              text={d}
              fontSize={fontSize}
              x={xxScale.range()[1] / 2}
              y={-stageHeight + 1.7 * fontSize}
              align="middle"
              fill={chromoBins[d].color}
            />
            <AxisLine
              x1={0}
              y1={0.5}
              x2={xxScale.range()[1]}
              y2={0.5}
              dash={[4, 0]}
              stroke={"#000"}
            />
            <AxisLine
              x1={0}
              y1={0}
              x2={0}
              y2={-stageHeight}
              dash={[4, 4]}
              stroke={"rgb(128, 128, 128)"}
            />
          </g>
        )
      );
    });
    return objects;
  }

  calculateAxisX(props) {
    let tickCount = max([
      Math.floor((props.scaleX.range()[1] - props.scaleX.range()[0]) / 40),
      2,
    ]);
    let ticks = props.scaleX.ticks(tickCount);
    ticks[ticks.length - 1] = props.scaleX.domain()[1];
    const axisX = axisBottom(props.scaleX).tickSize(6).tickValues(ticks);
    const selectionAxisX = select(document.createElement("custom")).call(axisX);
    const axisXdata = [];
    selectionAxisX.selectAll(".tick").each(function (d, i) {
      var group = select(this);
      var line = group.select("line");
      var string = group.attr("transform");
      var tr = string
        .substring(string.indexOf("(") + 1, string.indexOf(")"))
        .split(",");
      axisXdata.push({
        key: `tickX${i}`,
        group: {
          key: `tickGroupX${i}`,
          x: parseFloat(tr[0]),
          y: parseFloat(tr[1]),
        },
        tick: {
          key: `tickTextX${i}`,
          text: format("~s")(d).toString(),
          number: d,
          fontSize: props.fontSize,
          x: 0,
          align: "start",
          y: 1.1 * props.fontSize,
          transform: "rotate(45)"
        },
        line: {
          key: `tickLineX${i}`,
          x1: parseFloat(line.attr("x1")) || 0,
          y1: parseFloat(line.attr("y1")) || 0,
          x2: parseFloat(line.attr("x2")) || 0,
          y2: parseFloat(line.attr("y2")) || 0,
          dash: [3, 0],
          stroke: "#000",
        },
      });
    });
    return axisXdata;
  }

  calculateAxisY(props) {
    const axisY = axisLeft(props.scaleY).tickSizeInner(-props.axisWidth);
    const selectionAxisY = select(document.createElement("custom")).call(axisY);
    const axisYdata = [];
    selectionAxisY.selectAll(".tick").each(function (d, i) {
      var group = select(this);
      var line = group.select("line");
      var string = group.attr("transform");
      var tr = string
        .substring(string.indexOf("(") + 1, string.indexOf(")"))
        .split(",");
      axisYdata.push({
        key: `tickY${i}`,
        group: {
          key: `tickGroupY${i}`,
          x: parseFloat(tr[0]),
          y: parseFloat(tr[1]),
        },
        tick: {
          key: `tickTextY${i}`,
          text: d.toString(),
          number: d,
          fontSize: props.fontSize,
          y: -0.3 * props.fontSize,
          x: 0
        },
        line: {
          key: `tickLineY${i}`,
          x1: parseFloat(line.attr("x1")) || 0,
          y1: parseFloat(line.attr("y1")) || 0,
          x2: parseFloat(line.attr("x2")) || 0,
          y2: parseFloat(line.attr("y2")) || 0,
        },
      });
    });
    return axisYdata;
  }
}
Grid.propTypes = {
  scaleX: PropTypes.func.isRequired,
  scaleY: PropTypes.func.isRequired,
  axisHeight: PropTypes.number.isRequired,
  axisWidth: PropTypes.number.isRequired,
};
Grid.defaultProps = {
  gap: 0,
  fontSize: 10,
};
export default Grid;
