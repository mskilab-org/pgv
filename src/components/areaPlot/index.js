import React, { Component } from "react";
import { PropTypes } from "prop-types";
import * as d3 from "d3";
import { connect } from "react-redux";
import { withTranslation } from "react-i18next";
import Grid from "../grid/index";
import Wrapper from "./index.style";

const margins = {
  gapX: 24,
  gapY: 24,
  yTicksCount: 10,
};

class AreaPlot extends Component {
  render() {
    const { width, height, domains, chromoBins, data } = this.props;

    let stageWidth = width - 2 * margins.gapX;
    let stageHeight = height - 3 * margins.gapY;

    let windowWidth =
      (stageWidth - (domains.length - 1) * margins.gapX) / domains.length;
    let windowHeight = stageHeight;

    let windowScales = [];
    domains.forEach((xDomain, i) => {
      let dataPoints = [];

      data.forEach((dataPoint, i) => {
        if (!(dataPoint.x > xDomain[1] || dataPoint.x < xDomain[0])) {
          dataPoints.push(dataPoint);
        }
      });

      let yExtent = d3.extent(dataPoints, (e) => e.y);

      let yScale = d3
        .scaleLinear()
        .domain(yExtent)
        .range([windowHeight, 0])
        .nice();

      let xScale = d3.scaleLinear().domain(xDomain).range([0, windowWidth]);
      let yTicks = yScale.ticks(margins.yTicksCount);
      yTicks[yTicks.length - 1] = yScale.domain()[1];
      windowScales.push({ xScale, yScale, yTicks, dataPoints });
    });

    return (
      <Wrapper className="ant-wrapper" margins={margins}>
        <div
          className="areaplot"
          style={{ width: stageWidth, height: stageHeight }}
          ref={(elem) => (this.container = elem)}
        />
        <svg width={width} height={height} className="plot-container">
          {windowScales.map((d, i) => (
            <g
              key={i}
              transform={`translate(${[
                i * (margins.gapX + windowWidth),
                margins.gapY,
              ]})`}
            >
              <path
                transform={`translate(${[margins.gapX, 0]})`}
                fill="#cce5df"
                stroke="#69b3a2"
                strokeWidth="1.0"
                d={d3
                  .area()
                  .defined((e, j) => e.y)
                  .curve(d3.curveStep)
                  .x((e, j) => d.xScale(e.x))
                  .y0(d.yScale.range()[0])
                  .y1((e, j) => d.yScale(e.y))(d.dataPoints)}
              />
              <Grid
                gap={margins.gapX}
                scaleX={d.xScale}
                scaleY={d.yScale}
                axisWidth={windowWidth}
                axisHeight={windowHeight}
                chromoBins={chromoBins}
              />
            </g>
          ))}
        </svg>
      </Wrapper>
    );
  }
}
AreaPlot.propTypes = {
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  data: PropTypes.array,
  chromoBins: PropTypes.object,
};
AreaPlot.defaultProps = {};
const mapDispatchToProps = (dispatch) => ({});
const mapStateToProps = (state) => ({
  chromoBins: state.App.chromoBins,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(AreaPlot));
