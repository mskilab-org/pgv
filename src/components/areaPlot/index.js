import React, { Component } from "react";
import { PropTypes } from "prop-types";
import * as d3 from "d3";
import { connect } from "react-redux";
import { withTranslation } from "react-i18next";
import Grid from "../grid/index";
import Wrapper from "./index.style";
import appActions from "../../redux/app/actions";

const { updateDomains } = appActions;

const margins = {
  gapX: 24,
  gapY: 24,
  yTicksCount: 10,
};

class AreaPlot extends Component {
  plotContainer = null;

  // shouldComponentUpdate(nextProps, nextState) {
  //   return (
  //     nextProps.data.toString() !== this.props.data.toString() ||
  //     nextProps.domains.toString() !== this.props.domains.toString() ||
  //     nextProps.width !== this.props.width ||
  //     nextProps.height !== this.props.height
  //   );
  // }

  componentDidMount() {
    const { domains } = this.props;
    this.panels.forEach((panel, index) => {
      let domain = domains[index];
      var s = [
        panel.panelGenomeScale(domain[0]),
        panel.panelGenomeScale(domain[1]),
      ];
      d3.select(this.plotContainer)
        .select(`#panel-rect-${index}`)
        .attr("preserveAspectRatio", "xMinYMin meet")
        .call(panel.zoom); //.on("wheel", (event) => { event.preventDefault(); });;
      d3.select(this.plotContainer)
        .select(`#panel-rect-${index}`)
        .call(
          panel.zoom.transform,
          d3.zoomIdentity
            .scale(panel.panelWidth / (s[1] - s[0]))
            .translate(-s[0], 0)
        );
    });
  }

  componentDidUpdate(prevProps, prevState) {
    const { domains } = this.props;

    this.panels.forEach((panel, index) => {
      let domain = domains[index];
      var s = [
        panel.panelGenomeScale(domain[0]),
        panel.panelGenomeScale(domain[1]),
      ];
      d3.select(this.plotContainer)
        .select(`#panel-rect-${index}`)
        .attr("preserveAspectRatio", "xMinYMin meet")
        .call(panel.zoom); //.on("wheel", (event) => { event.preventDefault(); });;
      d3.select(this.plotContainer)
        .select(`#panel-rect-${index}`)
        .call(
          panel.zoom.transform,
          d3.zoomIdentity
            .scale(panel.panelWidth / (s[1] - s[0]))
            .translate(-s[0], 0)
        );
    });
  }

  zooming(event, index) {
    let panel = this.panels[index];
    let newDomain = event.transform
      .rescaleX(panel.panelGenomeScale)
      .domain()
      .map(Math.floor);
    let newDomains = [...this.props.domains];
    let selection = Object.assign([], newDomain);

    let otherSelections = this.props.domains.filter((d, i) => i !== index);
    let lowerEdge = d3.max(
      otherSelections
        .filter(
          (d, i) => selection && d[0] <= selection[0] && selection[0] <= d[1]
        )
        .map((d, i) => d[1])
    );

    // calculate the upper allowed selection edge this brush can move
    let upperEdge = d3.min(
      otherSelections
        .filter(
          (d, i) => selection && d[1] >= selection[0] && selection[1] <= d[1]
        )
        .map((d, i) => d[0])
    );

    // if there is an upper edge, then set this to be the upper bound of the current selection
    if (upperEdge !== undefined && selection[1] >= upperEdge) {
      selection[1] = upperEdge;
      selection[0] = d3.min([selection[0], upperEdge - 1]);
    }

    // if there is a lower edge, then set this to the be the lower bound of the current selection
    if (lowerEdge !== undefined && selection[0] <= lowerEdge) {
      selection[0] = lowerEdge;
      selection[1] = d3.max([selection[1], lowerEdge + 1]);
    }

    newDomains[index] = selection;

    if (newDomains.toString() !== this.props.domains.toString()) {
      this.setState({ domains: newDomains }, () => {
        this.props.updateDomains(newDomains);
      });
    }
  }

  zoomEnded(event, index) {
    this.zooming(event, index);
  }

  render() {
    const { width, height, domains, chromoBins, data, defaultDomain } =
      this.props;

    let stageWidth = width - 2 * margins.gapX;
    let stageHeight = height - 3 * margins.gapY;

    let panelWidth =
      (stageWidth - (domains.length - 1) * margins.gapX) / domains.length;
    let panelHeight = stageHeight;
    this.panels = [];

    domains.forEach((xDomain, index) => {
      let dataPoints = [];

      data.forEach((dataPoint, i) => {
        if (!(dataPoint.x > xDomain[1] || dataPoint.x < xDomain[0])) {
          dataPoints.push(dataPoint);
        }
      });

      let offset = index * (panelWidth + margins.gapX);
      let zoom = d3
        .zoom()
        .scaleExtent([1, Infinity])
        .translateExtent([
          [0, 0],
          [panelWidth, panelHeight],
        ])
        .extent([
          [0, 0],
          [panelWidth, panelHeight],
        ])
        .on("zoom", (event) => this.zooming(event, index))
        .on("end", (event) => this.zoomEnded(event, index));
      let panelGenomeScale = d3
        .scaleLinear()
        .domain(defaultDomain)
        .range([0, panelWidth]);

      let yExtent = d3.extent(dataPoints, (e) => e.y);

      let yScale = d3
        .scaleLinear()
        .domain(yExtent)
        .range([panelHeight, 0])
        .nice();

      let xScale = d3.scaleLinear().domain(xDomain).range([0, panelWidth]);
      let yTicks = yScale.ticks(margins.yTicksCount);
      yTicks[yTicks.length - 1] = yScale.domain()[1];
      this.panels.push({
        index,
        xScale,
        yScale,
        yTicks,
        zoom,
        panelWidth,
        panelHeight,
        offset,
        panelGenomeScale,
        dataPoints,
      });
    });

    return (
      <Wrapper className="ant-wrapper" margins={margins}>
        <div
          className="areaplot"
          style={{ width: stageWidth, height: stageHeight }}
          ref={(elem) => (this.container = elem)}
        />
        <svg
          width={width}
          height={height}
          className="plot-container"
          ref={(elem) => (this.plotContainer = elem)}
        >
          <defs>
            <clipPath key={`cuttOffViewPane`} id={`cuttOffViewPane`}>
              <rect x={0} y={0} width={stageWidth} height={stageHeight} />
            </clipPath>
            {this.panels.map((panel, i) => (
              <clipPath
                key={`cuttOffViewPane-${panel.index}`}
                id={`cuttOffViewPane-${panel.index}`}
              >
                <rect
                  x={0}
                  y={0}
                  width={panel.panelWidth}
                  height={2 * panel.panelHeight}
                />
              </clipPath>
            ))}
          </defs>
          <g transform={`translate(${[margins.gapX, margins.gapY]})`}>
            {this.panels.map((panel, i) => (
              <g
                key={`panel-${panel.index}`}
                id={`panel-${panel.index}`}
                transform={`translate(${[panel.offset, 0]})`}
              >
                <g clipPath={`url(#1cuttOffViewPane-${panel.index})`}>
                  <path
                    transform={`translate(${[0, 0]})`}
                    fill="#cce5df"
                    stroke="#69b3a2"
                    strokeWidth="1.0"
                    d={d3
                      .area()
                      .defined((e, j) => e.y)
                      .curve(d3.curveStep)
                      .x((e, j) => panel.xScale(e.x))
                      .y0(panel.yScale.range()[0])
                      .y1((e, j) => panel.yScale(e.y))(panel.dataPoints)}
                  />
                </g>
                <rect
                  className="zoom-background"
                  id={`panel-rect-${panel.index}`}
                  x={0.5}
                  width={panelWidth}
                  height={panelHeight}
                  style={{
                    stroke: "steelblue",
                    fill: "transparent",
                    strokeWidth: 1,
                    opacity: 0.375,
                    pointerEvents: "all",
                  }}
                />
                <Grid
                  gap={0}
                  scaleX={panel.xScale}
                  scaleY={panel.yScale}
                  axisWidth={panel.panelWidth}
                  axisHeight={panel.panelHeight}
                  chromoBins={chromoBins}
                />
              </g>
            ))}
          </g>
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
const mapDispatchToProps = (dispatch) => ({
  updateDomains: (domains) => dispatch(updateDomains(domains)),
});
const mapStateToProps = (state) => ({
  chromoBins: state.App.chromoBins,
  defaultDomain: state.App.defaultDomain,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(AreaPlot));
