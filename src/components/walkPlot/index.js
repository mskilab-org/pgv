import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import { withTranslation } from "react-i18next";
import * as d3 from "d3";
import Wrapper from "./index.style";
import Walk from "./walk";
import WalkInterval from "./walkInterval";
import WalkConnection from "./walkConnection";
import {
  measureText,
  guid,
  k_combinations,
  cluster,
  merge,
} from "../../helpers/utility";
import Grid from "../grid/index";
import appActions from "../../redux/app/actions";

const {
  updateDomains,
  selectPhylogenyNodes,
  highlightPhylogenyNodes,
  updateHoveredLocation,
} = appActions;

const margins = {
  gap: 24,
  bar: 10,
  yTicksCount: 10,
};

class WalkPlot extends Component {
  constructor(props) {
    super(props);
    this.zoom = null;
    this.container = null;
    this.grid = null;
    const { chromoBins, walks } = this.props;

    let currentTransform = null;
    let intervals = [];
    let frameConnections = [];

    let walksAll = walks.map((wlk, i) => {
      let walk = new Walk(wlk);
      walk.intervals = walk.iids.map((d, i) => {
        let interval = new WalkInterval(d, walk);
        interval.startPlace =
          chromoBins[`${interval.chromosome}`].startPlace + interval.startPoint;
        interval.endPlace =
          chromoBins[`${interval.chromosome}`].startPlace + interval.endPoint;
        interval.color = d3
          .rgb(chromoBins[`${interval.chromosome}`].color)
          .toString();
        interval.stroke = d3
          .rgb(chromoBins[`${interval.chromosome}`].color)
          .darker()
          .toString();
        interval.shapeHeight = margins.bar;
        intervals.push(interval);
        return interval;
      });

      walk.connections = walk.cids.map((d, i) => {
        let connection = new WalkConnection(d, walk);
        connection.intervalsHash = this.intervalsHash;
        connection.pinpoint();
        connection.arc = d3
          .arc()
          .innerRadius(0)
          .outerRadius(margins.bar / 2)
          .startAngle(0)
          .endAngle((e, j) => e * Math.PI);
        frameConnections.push(connection);
        return connection;
      });
      return walk;
    });

    this.state = {
      walksAll,
      intervals,
      frameConnections,
      currentTransform,
      showGrid: true,
      selectedWalkId: null,
      tooltip: {
        visible: false,
        shapeId: -1,
        walkId: null,
        x: -1000,
        y: -1000,
        text: "",
      },
    };
  }

  updatePanels() {
    const { intervals, frameConnections } = this.state;
    const { commonYScale } = this.props;
    let { domains, width, defaultDomain, height } = this.props;
    let stageWidth = width - 2 * margins.gap;
    let stageHeight = height - 3 * margins.gap;
    let panelWidth =
      (stageWidth - (domains.length - 1) * margins.gap) / domains.length;
    let panelHeight = stageHeight;
    this.connections = [];
    this.panels = domains.map((domain, index) => {
      let filteredIntervals = intervals.filter(
        (d) =>
          d3.max([d.startPlace, domain[0]]) <= d3.min([d.endPlace, domain[1]])
      );

      const xScale = d3.scaleLinear().domain(domain).range([0, panelWidth]);
      let offset = index * (panelWidth + margins.gap);

      let domainWidth = domain[1] - domain[0];
      let range = [
        index * (panelWidth + margins.gap),
        (index + 1) * panelWidth + index * margins.gap,
      ];
      let scale = d3.scaleLinear().domain(domain).range(range);
      let innerScale = d3.scaleLinear().domain(domain).range([0, panelWidth]);
      let panelGenomeScale = d3
        .scaleLinear()
        .domain(defaultDomain)
        .range([0, panelWidth]);
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
      let yDomain = [0, d3.max(filteredIntervals, (d) => d.y) + 0.5];
      let yScale = d3
        .scaleLinear()
        .domain(yDomain)
        .range([panelHeight, 0])
        .nice();
      let yTicks = yScale.ticks(margins.yTicksCount);
      yTicks[yTicks.length - 1] = yScale.domain()[1];
      let panel = {
        index,
        zoom,
        domain,
        panelWidth,
        panelHeight,
        xScale,
        yScale,
        yTicks,
        panelGenomeScale,
        offset,
        intervals: filteredIntervals,
        domainWidth,
        range,
        scale,
        innerScale,
      };
      return panel;
    });

    if (commonYScale) {
      let extent = d3.extent(this.panels.map((d) => d.yScale.domain()).flat());
      let commonYScale = d3
        .scaleLinear()
        .domain(extent)
        .range([panelHeight, 0])
        .clamp(true)
        .nice();
      let commonYTicks = commonYScale.ticks(margins.yTicksCount);
      commonYTicks[commonYTicks.length - 1] = commonYScale.domain()[1];
      this.panels.forEach((d) => {
        d.yScale = commonYScale;
        d.yTicks = commonYTicks;
      });
    }

    this.panels.forEach((panel, i) => {
      let { domain, scale } = panel;
      // filter the connections on same panel
      frameConnections
        .filter(
          (e, j) =>
            (!e.source ||
              (e.source.place <= domain[1] && e.source.place >= domain[0])) &&
            (!e.sink ||
              (e.sink.place <= domain[1] && e.sink.place >= domain[0]))
        )
        .forEach((connection, j) => {
          connection.fragment = panel.fragment;
          if (connection.source) {
            connection.source.scale = scale;
            connection.source.fragment = panel;
          }
          if (connection.sink) {
            connection.sink.scale = scale;
            connection.sink.fragment = panel;
          }
          connection.touchScale = scale;
          connection.identifier = guid();
          this.connections.push(connection);
        });
    });
    // filter the connections between the visible fragments
    k_combinations(this.panels, 2).forEach((pair, i) => {
      frameConnections
        .filter(
          (e, j) =>
            e.type !== "LOOSE" &&
            ((e.source.place <= pair[0].domain[1] &&
              e.source.place >= pair[0].domain[0] &&
              e.sink.place <= pair[1].domain[1] &&
              e.sink.place >= pair[1].domain[0]) ||
              (e.source.place <= pair[1].domain[1] &&
                e.source.place >= pair[1].domain[0] &&
                e.sink.place <= pair[0].domain[1] &&
                e.sink.place >= pair[0].domain[0]))
        )
        .forEach((connection, j) => {
          if (
            connection.source.place <= pair[0].domain[1] &&
            connection.source.place >= pair[0].domain[0]
          ) {
            connection.source.scale = pair[0].scale;
            connection.source.fragment = pair[0];
          } else {
            connection.source.scale = pair[1].scale;
            connection.source.fragment = pair[1];
          }
          if (
            connection.sink.place <= pair[0].domain[1] &&
            connection.sink.place >= pair[0].domain[0]
          ) {
            connection.sink.scale = pair[0].scale;
            connection.sink.fragment = pair[0];
          } else {
            connection.sink.scale = pair[1].scale;
            connection.sink.fragment = pair[1];
          }
          connection.identifier = guid();
          this.connections.push(connection);
        });
    });
    // filter the anchor connections
    let visibleConnections = this.connections.map((d, i) => d.cid);
    this.panels.forEach((fragment, i) => {
      frameConnections
        .filter((e, j) => {
          return (
            e.type !== "LOOSE" &&
            !visibleConnections.includes(e.cid) &&
            ((e.source.place <= fragment.domain[1] &&
              e.source.place >= fragment.domain[0]) ||
              (e.sink.place <= fragment.domain[1] &&
                e.sink.place >= fragment.domain[0]))
          );
        })
        .forEach((con, j) => {
          let connection = Object.assign(
            new WalkConnection(con, con.walk),
            con
          );
          connection.locateAnchor(fragment);
          this.connections.push(connection);
        });
    });
  }

  shouldComponentUpdate(nextProps, nextState) {
    return (
      nextProps.domains.toString() !== this.props.domains.toString() ||
      nextState.tooltip.shapeId !== this.state.tooltip.shapeId ||
      nextState.selectedWalkId !== this.state.selectedWalkId ||
      nextState.tooltip.x !== this.state.tooltip.x ||
      nextState.tooltip.y !== this.state.tooltip.y ||
      nextProps.selectedConnectionIds.toString() !==
        this.props.selectedConnectionIds.toString() ||
      nextProps.annotation !== this.props.annotation ||
      nextProps.width !== this.props.width ||
      nextProps.height !== this.props.height ||
      nextProps.hoveredLocation !== this.props.hoveredLocation ||
      nextProps.hoveredLocationPanelIndex !==
        this.props.hoveredLocationPanelIndex ||
      nextProps.commonYScale !== this.props.commonYScale
    );
  }

  componentDidMount() {
    const { domains, zoomedByCmd } = this.props;
    this.panels.forEach((panel, index) => {
      let domain = domains[index];
      var s = [
        panel.panelGenomeScale(domain[0]),
        panel.panelGenomeScale(domain[1]),
      ];
      d3.select(this.container)
        .select(`#panel-rect-${index}`)
        .attr("preserveAspectRatio", "xMinYMin meet")
        .call(
          panel.zoom.filter(
            (event) => !zoomedByCmd || (!event.button && event.metaKey)
          )
        );
      d3.select(this.container)
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

  componentDidUpdate() {
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
      d3.select(this.container)
        .select(`#panel-rect-${index}`)
        .attr("preserveAspectRatio", "xMinYMin meet")
        .call(
          panel.zoom.filter(
            (event) => !zoomedByCmd || (!event.button && event.metaKey)
          )
        );
      d3.select(this.container)
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
    if (this.panels[hoveredLocationPanelIndex]) {
      d3.select(this.container)
        .select(`#hovered-location-line-${hoveredLocationPanelIndex}`)
        .classed("hidden", !hoveredLocation)
        .attr(
          "transform",
          `translate(${[
            this.panels[hoveredLocationPanelIndex].xScale(hoveredLocation),
            0,
          ]})`
        );
      d3.select(this.container)
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

  handleMouseMove = (e) => {
    const { width, height } = this.props;
    const { intervals } = this.state;
    let primaryKey = d3.select(e.target) && d3.select(e.target).attr("id");
    let shapeClass = d3.select(e.target) && d3.select(e.target).attr("class");
    let shapeType = d3.select(e.target) && d3.select(e.target).attr("type");
    let shape = null;
    if (primaryKey && shapeClass !== "zoom-background") {
      if (shapeType === "interval") {
        shape = intervals.find((e) => e.primaryKey === primaryKey);
      } else if (shapeType === "connection") {
        shape = this.connections.find((e) => e.primaryKey === primaryKey);
      }
      if (shape) {
        let diffY = d3.min([
          0,
          height -
            e.nativeEvent.offsetY -
            shape.tooltipContent.length * 16 -
            12,
        ]);
        let diffX = d3.min([
          0,
          width -
            e.nativeEvent.offsetX -
            d3.max(shape.tooltipContent, (d) =>
              measureText(`${d.label}: ${d.value}`, 12)
            ) -
            30,
        ]);
        this.setState(
          {
            tooltip: {
              shapeId: shape.primaryKey,
              walkId: shape.walk.pid,
              visible: true,
              x: e.nativeEvent.offsetX + diffX,
              y: e.nativeEvent.offsetY + diffY,
              text: shape.tooltipContent,
            },
          },
          () => {
            shapeType === "connection" &&
              this.props.highlightPhylogenyNodes(
                this.props.connectionsAssociations
                  .filter((d) => d.connections.includes(shape.cid))
                  .map((d, i) => d.sample)
              );
          }
        );
      }
    } else {
      this.state.tooltip.visible &&
        this.setState(
          { tooltip: { shapeId: null, walkId: null, visible: false } },
          () => {
            this.props.highlightPhylogenyNodes([]);
          }
        );
    }
  };

  handleConnectionClick(event, connection) {
    if (connection.kind === "ANCHOR") {
      let newDomain = [
        Math.floor(connection.otherEnd.place - 1e3),
        Math.floor(connection.otherEnd.place + 1e3),
      ];
      let newDomains = [...this.props.domains];
      newDomains.push(newDomain);
      this.props.updateDomains(newDomains);
    } else {
      this.props.selectPhylogenyNodes(
        this.props.connectionsAssociations.map((d, i) => {
          return {
            id: d.sample,
            selected: d.connections.includes(connection.cid),
          };
        })
      );
    }
  }

  handleIntervalRightClick = (e, shape) => {
    e.preventDefault();

    d3.select(this.container)
      .select("g.tooltip")
      .attr("transform", `translate(${[-1000, -1000]})`);

    d3.select(this.container)
      .selectAll(`polygon.interval-wlk${shape.walk.pid}`)
      .interrupt();

    d3.select(this.container)
      .select("g.connections-container")
      .selectAll(`.connection-wlk${shape.walk.pid}`)
      .interrupt();

    let walk = this.state.walksAll.find((d) => d.pid === shape.walk.pid);
    let durationLength = d3
      .scaleLinear()
      .domain([1, walk.iids.length])
      .range([1000, 4000])
      .interpolate(d3.interpolateRound)
      .clamp(true);

    d3.select(this.container)
      .selectAll(`polygon.interval-wlk${shape.walk.pid}`)
      .style("opacity", 0.0)
      .transition()
      .ease(d3.easeSinInOut)
      .duration(durationLength(walk.iids.length))
      .delay(function (d, i) {
        return (
          walk.iids.findIndex((e) => +e.iid === +d3.select(this).attr("iid")) *
          1000
        );
      })
      .style("opacity", 1);

    d3.select(this.container)
      .select("g.connections-container")
      .selectAll(`.connection-wlk${shape.walk.pid}`)
      .style("opacity", 0.0)
      .transition()
      .duration(durationLength(walk.iids.length))
      .ease(d3.easeSinInOut)
      .delay(function (d, i) {
        let con = walk.cids.find(
          (e) => Math.abs(+e.cid) === Math.abs(+d3.select(this).attr("cid"))
        );
        return (
          walk.iids.findIndex((e) => +e.iid === Math.abs(con.source)) * 1000 +
          150
        );
      })
      .style("opacity", 1);
  };

  handleIntervalClick = (e, shape) => {
    this.setState(
      {
        selectedWalkId: shape.walk.pid,
        tooltip: {
          shapeId: null,
          walkId: null,
          visible: false,
        },
      },
      () => {
        let annotated = shape.walk.intervals.sort((a, b) =>
          d3.ascending(a.startPlace, b.startPlace)
        );
        annotated = merge(annotated);
        this.props.updateDomains(cluster(annotated, this.props.genomeLength));
        this.props.highlightPhylogenyNodes([]);
      }
    );
  };

  handlePanelMouseMove = (e, panelIndex) => {
    panelIndex > -1 &&
      this.props.updateHoveredLocation(
        this.panels[panelIndex].xScale.invert(d3.pointer(e)[0]),
        panelIndex
      );
  };

  handlePanelMouseOut = (e, panelIndex) => {
    panelIndex > -1 && this.props.updateHoveredLocation(null, panelIndex);
  };

  handleMouseClick = (e) => {
    let shapeClass = d3.select(e.target) && d3.select(e.target).attr("class");
    if (shapeClass === "zoom-background") {
      this.setState({ selectedWalkId: null });
    }
  };

  render() {
    const { width, selectedConnectionIds, height } = this.props;
    const { stageWidth, tooltip, selectedWalkId } = this.state;

    this.updatePanels();

    return (
      <Wrapper className="ant-wrapper">
        <svg
          width={width}
          height={height}
          onMouseMove={(e) => this.handleMouseMove(e)}
          onClick={(e) => this.handleMouseClick(e)}
          ref={(elem) => (this.container = elem)}
        >
          <defs>
            <clipPath key={`cuttOffViewPane`} id={`cuttOffViewPane`}>
              <rect x={0} y={0} width={stageWidth} height={20 * height} />
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
                  height={20 * height}
                />
              </clipPath>
            ))}
            <pattern
              id="crossgrad"
              width="80"
              height="80"
              patternUnits="userSpaceOnUse"
            >
              <rect fill="#A020F0" x="0" y="0" width="40" height="80" />
              <rect fill="#79b321" x="40" y="0" width="40" height="80" />
            </pattern>
            <pattern
              id="fill-tilted"
              patternUnits="userSpaceOnUse"
              width="2"
              height={margins.bar}
              patternTransform="rotate(45)"
            >
              <rect
                height={margins.bar}
                width="1"
                fill="#999999"
                fillOpacity={0.5}
              />
            </pattern>
          </defs>
          <g transform={`translate(${[margins.gap, margins.gap]})`}>
            {this.panels.map((panel, i) => (
              <g
                key={`panel-${panel.index}`}
                id={`panel-${panel.index}`}
                transform={`translate(${[panel.offset, 0]})`}
              >
                <rect
                  className="zoom-background"
                  id={`panel-rect-${panel.index}`}
                  x={0.5}
                  width={panel.panelWidth}
                  height={panel.panelHeight}
                  onMouseMove={(e) => this.handlePanelMouseMove(e, i)}
                  onMouseOut={(e) => this.handlePanelMouseOut(e, i)}
                  style={{
                    stroke: "steelblue",
                    fill: "transparent",
                    strokeWidth: 1,
                    opacity: 0.375,
                    pointerEvents: "all",
                  }}
                />
                <g ref={(elem) => (this.grid = elem)}>
                  {
                    <>
                      <Grid
                        scaleX={panel.xScale}
                        scaleY={null}
                        showY={false}
                        axisWidth={panel.panelWidth}
                        axisHeight={panel.panelHeight}
                      />
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
                    </>
                  }
                </g>
                <g clipPath={`url(#cuttOffViewPane-${panel.index})`}>
                  {panel.intervals.map((d, i) => {
                    return (
                      (!selectedWalkId || selectedWalkId === d.walk.pid) && (
                        <polygon
                          id={d.primaryKey}
                          iid={d.iid}
                          title={d.fullTitle}
                          type="interval"
                          className={`shape interval-wlk${d.walk.pid} ${
                            selectedWalkId === d.walk.pid ||
                            d.walk.pid === tooltip.walkId
                              ? "highlighted"
                              : ""
                          }`}
                          transform={`translate(${[
                            panel.xScale(d.startPlace),
                            panel.yScale(d.y) - 0.5 * margins.bar,
                          ]})`}
                          xPos={panel.offset + panel.xScale(d.startPlace)}
                          yPos={panel.yScale(d.y) - 0.5 * margins.bar}
                          points={d.points(panel.xScale)}
                          onClick={(event) =>
                            this.handleIntervalClick(event, d)
                          }
                          onContextMenu={(event) =>
                            this.handleIntervalRightClick(event, d)
                          }
                          style={{
                            fill:
                              (d.metadata && d.metadata.color) ||
                              "url(#fill-tilted)",
                            stroke: d3.rgb(d.color).darker(1),
                            strokeWidth: 1,
                            opacity: tooltip.walkId
                              ? d.walk.pid === tooltip.walkId
                                ? 1.0
                                : 0.3
                              : 1.0,
                          }}
                        />
                      )
                    );
                  })}
                </g>
              </g>
            ))}
            <g class="connections-container" clipPath="url(#cuttOffViewPaneii)">
              {this.connections.map(
                (d, i) =>
                  (!selectedWalkId || selectedWalkId === d.walk.pid) && (
                    <path
                      id={d.primaryKey}
                      cid={d.cid}
                      type="connection"
                      key={d.identifier}
                      transform={d.transform}
                      className={`connection connection-wlk${d.walk.pid} ${
                        d.primaryKey === tooltip.shapeId ? "highlighted" : ""
                      } ${
                        selectedConnectionIds.includes(d.cid)
                          ? "phylogeny-annotated"
                          : ""
                      }`}
                      d={d.render}
                      onClick={(event) => this.handleConnectionClick(event, d)}
                      style={{
                        fill: d.fill,
                        stroke: d.color,
                        strokeWidth: d.strokeWidth,
                        strokeDasharray: d.dash,
                        pointerEvents: "all",
                        opacity: tooltip.walkId
                          ? d.walk.pid === tooltip.walkId
                            ? d.opacity
                            : 0.3
                          : d.opacity,
                      }}
                    />
                  )
              )}
            </g>
          </g>
          {tooltip.visible && (
            <g
              className="tooltip"
              transform={`translate(${[tooltip.x, tooltip.y]})`}
              pointerEvents="none"
            >
              <rect
                x="0"
                y="0"
                width={d3.max(
                  tooltip.text,
                  (d) => measureText(`${d.label}: ${d.value}`, 12) + 30
                )}
                height={tooltip.text.length * 16 + 12}
                rx="5"
                ry="5"
                fill="rgb(97, 97, 97)"
                fillOpacity="0.67"
              />
              <text x="10" y="28" fontSize="12" fill="#FFF">
                {tooltip.text.map((d, i) => (
                  <tspan key={i} x={10} y={18 + i * 16}>
                    <tspan fontWeight="bold">{d.label}</tspan>: {d.value}
                  </tspan>
                ))}
              </text>
            </g>
          )}
        </svg>
      </Wrapper>
    );
  }
}
WalkPlot.propTypes = {
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  xDomain: PropTypes.array,
  defaultDomain: PropTypes.array,
  genome: PropTypes.object,
  title: PropTypes.string,
  chromoBins: PropTypes.object,
  updateDomain: PropTypes.func,
  annotation: PropTypes.string,
};
WalkPlot.defaultProps = {
  xDomain: [],
  defaultDomain: [],
  commonYScale: false,
};
const mapDispatchToProps = (dispatch) => ({
  updateDomains: (domains) => dispatch(updateDomains(domains)),
  selectPhylogenyNodes: (nodes) => dispatch(selectPhylogenyNodes(nodes)),
  highlightPhylogenyNodes: (nodes) => dispatch(highlightPhylogenyNodes(nodes)),
  updateHoveredLocation: (hoveredLocation, panelIndex) =>
    dispatch(updateHoveredLocation(hoveredLocation, panelIndex)),
});
const mapStateToProps = (state) => ({
  genomeLength: state.App.genomeLength,
  chromoBins: state.App.chromoBins,
  defaultDomain: state.App.defaultDomain,
  domains: state.App.domains,
  selectedConnectionIds: state.App.selectedConnectionIds,
  connectionsAssociations: state.App.connectionsAssociations,
  hoveredLocation: state.App.hoveredLocation,
  hoveredLocationPanelIndex: state.App.hoveredLocationPanelIndex,
  zoomedByCmd: state.App.zoomedByCmd,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(WalkPlot));
