import React, { Component } from "react";
import { PropTypes } from "prop-types";
import * as d3 from "d3";
import { connect } from "react-redux";
import { withTranslation } from "react-i18next";
import Grid from "../grid/index";
import Bars from "./bars";
import Wrapper from "./index.style";

const margins = {
  gapX: 24,
  gapY: 24,
  yTicksCount: 10,
};

class BarPlot extends Component {
  regl = null;
  container = null;
  barsY = null;
  maxBarsY = null;
  barsStartPoint = null;
  barsEndPoint = null;
  barsFill = null;

  constructor(props) {
    super(props);
    let { data } = props;
    this.barsY = data.getColumn("y").toArray();
    this.maxBarsY = d3.max(this.barsY);
    this.barsStartPoint = data.getColumn("startPoint").toArray();
    this.barsEndPoint = data.getColumn("endPoint").toArray();
    this.barsFill = data.getColumn("color").toArray();
  }

  componentDidMount() {
    this.regl = require("regl")({
      extensions: ["ANGLE_instanced_arrays"],
      container: this.container,
      pixelRatio: 2.0,
      attributes: {
        antialias: true,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: true,
      },
    });

    this.regl.on("lost", () => {
      console.log("lost webgl context");
    });

    this.regl.on("restore", () => {
      console.log("webgl context restored");
    });

    this.bars = new Bars(this.regl, margins.gapX, 0);
    this.updateStage();
  }

  componentDidUpdate(prevProps, prevState) {
    const { domains } = this.props;

    if (prevProps.width !== this.props.width) {
      this.regl.destroy();
      this.componentDidMount();
    } else {
      this.bars.rescaleXY(domains);
    }
  }

  componentWillUnmount() {
    this.regl && this.regl.destroy();
  }

  updateStage() {
    let { domains, width, height } = this.props;
    let stageWidth = width - 2 * margins.gapX;
    let stageHeight = height - 3 * margins.gapY;

    this.bars.load(
      stageWidth,
      stageHeight,
      this.barsStartPoint,
      this.barsEndPoint,
      this.barsY,
      this.barsFill,
      domains
    );
    this.bars.render();
  }

  render() {
    const { width, height, domains, chromoBins } = this.props;

    let stageWidth = width - 2 * margins.gapX;
    let stageHeight = height - 3 * margins.gapY;

    let windowWidth =
      (stageWidth - (domains.length - 1) * margins.gapX) / domains.length;
    let windowHeight = stageHeight;

    let windowScales = [];
    domains.forEach((xDomain, i) => {
      let matched = [];
      this.barsStartPoint.forEach((startPoint, i) => {
        let endPoint = this.barsEndPoint[i];
        if (!(startPoint > xDomain[1] || endPoint < xDomain[0])) {
          matched.push(this.barsY[i]);
        }
      });

      let points = [
        ...new Set(matched.map((e, j) => Math.round(e * 10) / 10)),
      ].sort((a, b) => d3.descending(a, b));
      let yExtent = [
        0,
        points[Math.floor(0.1 * points.length)] || this.maxBarsY,
      ];

      let yScale = d3
        .scaleLinear()
        .domain(yExtent)
        .range([windowHeight, 0])
        .nice();
      let xScale = d3.scaleLinear().domain(xDomain).range([0, windowWidth]);
      let yTicks = yScale.ticks(margins.yTicksCount);
      yTicks[yTicks.length - 1] = yScale.domain()[1];
      windowScales.push({ xScale, yScale, yTicks });
    });

    return (
      <Wrapper className="ant-wrapper" margins={margins}>
        <div
          className="scatterplot"
          style={{ width: stageWidth, height: stageHeight }}
          ref={(elem) => (this.container = elem)}
        />
        <svg width={width} height={height} className="plot-container">
          {windowScales.map((d, i) => (
            <g
              transform={`translate(${[
                i * (margins.gapX + windowWidth),
                margins.gapY,
              ]})`}
            >
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
BarPlot.propTypes = {
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  data: PropTypes.object,
  chromoBins: PropTypes.object,
};
BarPlot.defaultProps = {};
const mapDispatchToProps = (dispatch) => ({});
const mapStateToProps = (state) => ({
  chromoBins: state.App.chromoBins,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(BarPlot));
