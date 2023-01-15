import React, { Component } from "react";
import { PropTypes } from "prop-types";
import * as d3 from "d3";
import { connect } from "react-redux";
import { withTranslation } from "react-i18next";
import Grid from "../grid/index";
import Wrapper from "./index.style";
import appActions from "../../redux/app/actions";

const { updateDomains, updateHoveredLocation } = appActions;

const margins = {
  gapX: 24,
  gapY: 24,
  yTicksCount: 10,
};

class GenesPlot extends Component {
  plotContainer = null;

  componentDidMount() {
    const { domains, zoomedByCmd } = this.props;
    this.panels.forEach((panel, index) => {
      let domain = domains[index];
      var s = [
        panel.panelGenomeScale(domain[0]),
        panel.panelGenomeScale(domain[1]),
      ];
      d3.select(this.plotContainer)
        .select(`#panel-rect-${index}`)
        .attr("preserveAspectRatio", "xMinYMin meet")
        .call(
          panel.zoom.filter(
            (event) => !zoomedByCmd || (!event.button && event.metaKey)
          )
        );
      d3.select(this.plotContainer)
        .select(`#panel-rect-${index}`)
        .call(
          panel.zoom.filter(
            (event) => !zoomedByCmd || (!event.button && event.metaKey)
          ).transform,
          d3.zoomIdentity
            .scale(panel.panelWidth / (s[1] - s[0]))
            .translate(-s[0], 0)
        );
    });
  }

  componentDidUpdate(prevProps, prevState) {
    const {
      domains,
      hoveredLocationPanelIndex,
      hoveredLocation,
      chromoBins,
      zoomedByCmd,
    } = this.props;

    this.panels.forEach((panel, index) => {
      let domain = domains[index];
      var s = [
        panel.panelGenomeScale(domain[0]),
        panel.panelGenomeScale(domain[1]),
      ];
      d3.select(this.plotContainer)
        .select(`#panel-rect-${index}`)
        .attr("preserveAspectRatio", "xMinYMin meet")
        .call(
          panel.zoom.filter(
            (event) => !zoomedByCmd || (!event.button && event.metaKey)
          )
        );
      d3.select(this.plotContainer)
        .select(`#panel-rect-${index}`)
        .call(
          panel.zoom.filter(
            (event) => !zoomedByCmd || (!event.button && event.metaKey)
          ).transform,
          d3.zoomIdentity
            .scale(panel.panelWidth / (s[1] - s[0]))
            .translate(-s[0], 0)
        );
    });

    if (hoveredLocationPanelIndex > -1) {
      d3.select(this.plotContainer)
        .select(`#hovered-location-line-${hoveredLocationPanelIndex}`)
        .classed("hidden", !hoveredLocation)
        .attr(
          "transform",
          `translate(${[
            this.panels[hoveredLocationPanelIndex].xScale(hoveredLocation),
            0,
          ]})`
        );
      d3.select(this.plotContainer)
        .select(`#hovered-location-text-${hoveredLocationPanelIndex}`)
        .attr(
          "x",
          this.panels[hoveredLocationPanelIndex].xScale(hoveredLocation)
        )
        .text(
          Object.values(chromoBins)
            .filter(
              (chromo) =>
                hoveredLocation < chromo.endPlace &&
                hoveredLocation >= chromo.startPlace
            )
            .map((chromo) =>
              d3.format(",")(
                Math.floor(chromo.scaleToGenome.invert(hoveredLocation))
              )
            )
        );
    }
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

  handleMouseMove = (e, panelIndex) => {
    this.props.updateHoveredLocation(
      this.panels[panelIndex].xScale.invert(d3.pointer(e)[0]),
      panelIndex
    );
  };

  handleMouseOut = (e, panelIndex) => {
    this.props.updateHoveredLocation(null, panelIndex);
  };

  render() {
    const { width, height, domains, chromoBins, genesList, defaultDomain } =
      this.props;

    let stageWidth = width - 2 * margins.gapX;
    let stageHeight = height - 2 * margins.gapY;

    let panelWidth =
      (stageWidth - (domains.length - 1) * margins.gapX) / domains.length;
    let panelHeight = stageHeight;
    this.panels = [];

    domains.forEach((xDomain, index) => {
      let dataGenes = [];

      genesList.forEach((gene, i) => {
        if (gene.xEnd >= xDomain[0] && gene.xStart <= xDomain[1]) {
          dataGenes.push({
            ...gene,
            y: gene.fields[5] === "+" ? 2 : -2,
          });
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

      let yExtent = [-8, 8];

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
        dataGenes,
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
                <g clipPath={`url(#cuttOffViewPane-${panel.index})`}>
                  {panel.dataGenes.map((e, j) => (
                    <g>
                      <rect
                        transform={`translate(${[
                          panel.xScale(e.xStart),
                          panel.yScale(e.y) - 1,
                        ]})`}
                        fill={e.fields[5] === "+" ? "#3333FF" : "#FF4444"}
                        width={panel.xScale(e.xEnd) - panel.xScale(e.xStart)}
                        height={2}
                      />
                      <polygon
                        key={e.uid}
                        id={e.uid}
                        transform={`translate(${[0, 0]})`}
                        points={
                          e.fields[5] === "+"
                            ? [
                                panel.xScale(e.xEnd),
                                panel.yScale(e.y),
                                panel.xScale(e.xEnd) - 5,
                                panel.yScale(e.y) - 5,
                                panel.xScale(e.xEnd) - 5,
                                panel.yScale(e.y) + 5,
                              ]
                            : [
                                panel.xScale(e.xStart),
                                panel.yScale(e.y),
                                panel.xScale(e.xStart) + 5,
                                panel.yScale(e.y) - 5,
                                panel.xScale(e.xStart) + 5,
                                panel.yScale(e.y) + 5,
                              ]
                        }
                        fill={e.fields[5] === "+" ? "#3333FF" : "#FF4444"}
                      />
                      <text
                        transform={`translate(${[
                          (panel.xScale(e.xStart) + panel.xScale(e.xEnd)) / 2,
                          e.fields[5] === "+"
                            ? panel.yScale(e.y) - 15
                            : panel.yScale(e.y) + 15,
                        ]})`}
                        textAnchor="middle"
                        fill={e.fields[5] === "+" ? "#3333FF" : "#FF4444"}
                        fontSize={9}
                      >
                        {e.fields[3]}
                      </text>
                    </g>
                  ))}
                </g>

                <line
                  className="hovered-location-line hidden"
                  id={`hovered-location-line-${panel.index}`}
                  y1={0}
                  y2={panel.panelHeight}
                />
                <text
                  className="hovered-location-text"
                  id={`hovered-location-text-${panel.index}`}
                  x={-1000}
                  dx={5}
                  dy={10}
                ></text>
                <rect
                  className="zoom-background"
                  id={`panel-rect-${panel.index}`}
                  x={0.5}
                  width={panelWidth}
                  height={panelHeight}
                  onMouseMove={(e) => this.handleMouseMove(e, i)}
                  onMouseOut={(e) => this.handleMouseOut(e, i)}
                  style={{
                    stroke: "steelblue",
                    fill: "transparent",
                    strokeWidth: 1,
                    opacity: 0.375,
                    pointerEvents: "all",
                  }}
                />
              </g>
            ))}
          </g>
        </svg>
      </Wrapper>
    );
  }
}
GenesPlot.propTypes = {
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  data: PropTypes.array,
  chromoBins: PropTypes.object,
};
GenesPlot.defaultProps = {};
const mapDispatchToProps = (dispatch) => ({
  updateDomains: (domains) => dispatch(updateDomains(domains)),
  updateHoveredLocation: (hoveredLocation, panelIndex) =>
    dispatch(updateHoveredLocation(hoveredLocation, panelIndex)),
});
const mapStateToProps = (state) => ({
  chromoBins: state.App.chromoBins,
  defaultDomain: state.App.defaultDomain,
  hoveredLocation: state.App.hoveredLocation,
  hoveredLocationPanelIndex: state.App.hoveredLocationPanelIndex,
  zoomedByCmd: state.App.zoomedByCmd,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(GenesPlot));
