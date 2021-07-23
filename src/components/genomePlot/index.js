import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import { withTranslation } from "react-i18next";
import * as d3 from "d3";
import Wrapper from "./index.style";
import Connection from "./connection";
import Interval from "./interval";
import { measureText, guid, k_combinations } from "../../helpers/utility";
import Grid from "../grid/index";
import appActions from "../../redux/app/actions";

const { updateDomains } = appActions;

const margins = {
  gap: 24,
  bar: 10,
};

class GenomePlot extends Component {

  constructor(props) {
    super(props);
    this.zoom = null;
    this.container = null;
    this.grid = null;
    const { domains, width, height, defaultDomain, chromoBins, genome } = this.props;

    let stageWidth = width - 2 * margins.gap;
    let stageHeight = height - 3 * margins.gap;
    let currentTransform = null;
    let genomeScale = d3.scaleLinear().domain(defaultDomain).range([0, stageWidth]);
    let intervals = [];
    let intervalBins = {};
    genome.intervals.forEach((d, i) => {
      let interval = new Interval(d);
      interval.startPlace = chromoBins[`${interval.chromosome}`].startPlace + interval.startPoint;
      interval.endPlace = chromoBins[`${interval.chromosome}`].startPlace + interval.endPoint;
      interval.color = d3.rgb(chromoBins[`${interval.chromosome}`].color).toString();
      interval.stroke = d3
        .rgb(chromoBins[`${interval.chromosome}`].color)
        .darker()
        .toString();
      intervalBins[d.iid] = interval;
      intervals.push(interval);
    });
    this.yScale = d3.scaleLinear();
    let frameConnections = genome.connections.map((d,i) => {
      let connection = new Connection(d);
      connection.pinpoint(intervalBins);
      //connection.yScale = this.yScale;
      connection.arc = d3.arc()
        .innerRadius(0)
        .outerRadius(margins.bar / 2)
        .startAngle(0)
        .endAngle((e, j) => e * Math.PI);
      return connection;
    });
    this.state = {
      stageWidth,
      stageHeight,
      domains,
      intervals,
      genomeScale,
      currentTransform,
      intervalBins,
      frameConnections,
      showGrid: true,
      tooltip: {
        visible: false,
        shapeId: -1,
        x: -1000,
        y: -1000,
        text: ""
      }
    };
  }

  updatePanels() {
    const { stageWidth, stageHeight, intervals, domains, frameConnections } = this.state;
    let panelWidth = (stageWidth - (domains.length - 1) * margins.gap) / domains.length;
    let panelHeight = stageHeight;
    this.connections = [];
    this.panels = domains.map((domain, index) => {
      let filteredIntervals =  intervals.filter(
        (d) => d.startPlace <= domain[1] && d.endPlace >= domain[0]
      );
      const xScale = d3.scaleLinear().domain(domain).range([0, panelWidth]);
      let offset = index * (panelWidth + margins.gap);

      let domainWidth = domain[1] - domain[0];
      let range = [index * (panelWidth + margins.gap), (index + 1) * panelWidth + index * margins.gap];
      let scale = d3.scaleLinear().domain(domain).range(range);
      let innerScale = d3.scaleLinear().domain(domain).range([0, panelWidth]);
      let zoom = d3.zoom().scaleExtent([1, Infinity]).translateExtent([[0, 0], [panelWidth, panelHeight]]).extent([[0, 0], [panelWidth, panelHeight]]).on('zoom', (event) => this.zooming(event, index)).on('end', (event) => this.zoomEnded(event, index));
      let panel = {index, zoom, domain, panelWidth, panelHeight, xScale, offset, intervals: filteredIntervals, domainWidth, range, scale, innerScale};
      return panel;
    });
    this.yDomain = [
      0,
      d3.max(
       this.panels.map(d => d.intervals).flat(),
        (d) => d.y
      ) + 1,
    ];
    this.yScale = d3
    .scaleLinear()
    .domain(this.yDomain)
    .range([panelHeight, 0])
    .nice();
    this.panels.forEach((panel, i) => {
      let { domain, scale } = panel;
      // filter the connections on same panel
      frameConnections
      .filter((e, j) => (!e.source || ((e.source.place <= domain[1]) && (e.source.place >= domain[0]))) && (!e.sink || ((e.sink.place <= domain[1]) && (e.sink.place >= domain[0]))))
      .forEach((connection, j) => {
        connection.yScale = this.yScale;
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
        .filter((e, j) => (e.type !== 'LOOSE')
          && (((e.source.place <= pair[0].domain[1]) && (e.source.place >= pair[0].domain[0]) && (e.sink.place <= pair[1].domain[1]) && (e.sink.place >= pair[1].domain[0]))
          ||((e.source.place <= pair[1].domain[1]) && (e.source.place >= pair[1].domain[0]) && (e.sink.place <= pair[0].domain[1]) && (e.sink.place >= pair[0].domain[0]))))
        .forEach((connection, j) => {
          connection.yScale = this.yScale;
          if ((connection.source.place <= pair[0].domain[1]) && (connection.source.place >= pair[0].domain[0])) {
            connection.source.scale = pair[0].scale;
            connection.source.fragment = pair[0];
          } else {
            connection.source.scale = pair[1].scale;
            connection.source.fragment = pair[1];
          }
          if ((connection.sink.place <= pair[0].domain[1]) && (connection.sink.place >= pair[0].domain[0])) {
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
    let visibleConnections = this.connections.map((d,i) => d.cid);
    this.panels.forEach((fragment, i) => {
      frameConnections
        .filter((e, j) => { return (e.type !== 'LOOSE') && (!visibleConnections.includes(e.cid))
          && (((e.source.place <= fragment.domain[1]) && (e.source.place >= fragment.domain[0]))
          ||((e.sink.place <= fragment.domain[1]) && (e.sink.place >= fragment.domain[0])))})
        .forEach((con, j) => {
          let connection = Object.assign(new Connection(con), con);
          connection.yScale = this.yScale;
          connection.locateAnchor(fragment);
          this.connections.push(connection);
        });
    });
  }

  shouldComponentUpdate(nextProps, nextState) {
    return (nextProps.domains.toString() !== this.props.domains.toString()) || (nextState.tooltip.shapeId !== this.state.tooltip.shapeId);
  }

  componentDidMount() {
    const { domains } = this.state;
    this.panels.forEach((panel, index) => {
      let domain = domains[index];
      var s = [panel.xScale(domain[0]), panel.xScale(domain[1])];
      d3.select(this.container).select(`#panel-rect-${index}`).attr('preserveAspectRatio', 'xMinYMin meet').call(panel.zoom).on("wheel", (event) => { event.preventDefault(); });;
      d3.select(this.container).select(`#panel-rect-${index}`).call(panel.zoom.transform, d3.zoomIdentity.scale(panel.panelWidth / (s[1] - s[0])).translate(-s[0], 0));
    });
  }

  componentDidUpdate() {
    const { domains } = this.props;
    this.panels.forEach((panel, index) => {
      let domain = domains[index];
      var s = [panel.xScale(domain[0]), panel.xScale(domain[1])];
      d3.select(this.container).select(`#panel-rect-${index}`).attr('preserveAspectRatio', 'xMinYMin meet').call(panel.zoom).on("wheel", (event) => { event.preventDefault(); });;
      d3.select(this.container).select(`#panel-rect-${index}`).call(panel.zoom.transform, d3.zoomIdentity.scale(panel.panelWidth / (s[1] - s[0])).translate(-s[0], 0));
    });
  }

  zooming(event, index) {
    let panel = this.panels[index];
    let newDomain = event.transform.rescaleX(panel.xScale).domain().map(Math.floor);
    let newDomains = [...this.state.domains];
    newDomains[index] = newDomain;
    if (newDomains.toString() !== this.state.domains.toString()) {
      this.setState({ domains: newDomains }, () => {
         this.props.updateDomains(newDomains);
      })
    }
  }

  zoomEnded(event, index) {
    let panel = this.panels[index];
    let newDomain = event.transform.rescaleX(panel.xScale).domain().map(Math.floor);
    let newDomains = [...this.state.domains];
    newDomains[index] = newDomain;
    if (newDomains.toString() !== this.state.domains.toString()) {
      this.setState({ domains: newDomains }, () => {
         this.props.updateDomains(newDomains);
      })
    }
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
        shape = intervals.find(e => e.primaryKey === primaryKey);
      } else if (shapeType === "connection") {
        shape = this.connections.find(e => e.primaryKey === primaryKey);
      }
      if (shape) {
        let diffY = d3.min([0, height - e.nativeEvent.offsetY - shape.tooltipContent.length * 16 - 12]);
        let diffX = d3.min([0, width - e.nativeEvent.offsetX - d3.max(shape.tooltipContent, (d) => measureText(`${d.label}: ${d.value}`, 12)) - 30]);
        this.state.tooltip.shapeId !== shape.primaryKey && this.setState({ tooltip: { shapeId: shape.primaryKey, visible: true, x: (e.nativeEvent.offsetX + diffX), y: (e.nativeEvent.offsetY + diffY), text: shape.tooltipContent } })
      }
    } else {
      this.state.tooltip.visible && this.setState({ tooltip: { shapeId: null, visible: false } })
    }
  }

  handleConnectionClick(event, connection) {
    console.log(event, connection)
    if (connection.kind === "ANCHOR") {
      let newDomain = [connection.otherEnd.interval.startPlace, connection.otherEnd.interval.endPlace];
      let newDomains = [...this.props.domains];
      newDomains.push(newDomain);
      this.props.updateDomains(newDomains);
    }
  }

  render() {
    const { width, height } = this.props;
    const { stageWidth, stageHeight, tooltip } = this.state;

    this.updatePanels();

    return (
      <Wrapper className="ant-wrapper">
        <svg width={width} height={height} onMouseMove={(e) => this.handleMouseMove(e)} ref={(elem) => (this.container = elem)} >
          <defs>
              <clipPath key={`cuttOffViewPane`} id={`cuttOffViewPane`}>
                <rect x={0} y={0} width={stageWidth} height={stageHeight} />
              </clipPath>
            {this.panels.map((panel, i) => 
              <clipPath key={`cuttOffViewPane-${panel.index}`} id={`cuttOffViewPane-${panel.index}`}>
                <rect x={0} y={0} width={panel.panelWidth} height={2 * panel.panelHeight} />
              </clipPath>
            )}
          </defs>
          <g transform={`translate(${[margins.gap, margins.gap]})`} >
            {this.panels.map((panel, i) => 
              <g key={`panel-${panel.index}`} id={`panel-${panel.index}`} transform={`translate(${[panel.offset, 0]})`} >
                  <rect className="zoom-background" id={`panel-rect-${panel.index}`} x={0.5} width={panel.panelWidth} height={panel.panelHeight} style={{stroke: "steelblue", fill: "transparent", strokeWidth: 1, opacity: 0.375, pointerEvents: 'all'}}/>
                  <g ref={(elem) => (this.grid = elem)}>
                    {<Grid
                      scaleX={panel.xScale}
                      scaleY={this.yScale}
                      axisWidth={panel.panelWidth}
                      axisHeight={panel.panelHeight}
                    />}
                  </g>
                  <g clipPath={`url(#cuttOffViewPane-${panel.index})`}>
                    {panel.intervals.map((d, i) => {
                      return <rect
                        id={d.primaryKey}
                        type="interval"
                        key={i}
                        className={`shape ${d.primaryKey === tooltip.shapeId ? "highlighted" : ""}`}
                        transform={`translate(${[panel.xScale(d.startPlace), this.yScale(d.y) - 0.5 * margins.bar]})`}
                        width={panel.xScale(d.endPlace) - panel.xScale(d.startPlace)}
                        height={margins.bar}
                        style={{ fill: d.color, stroke: d.stroke, strokeWidth: 1 }}
                      />
                    })}
                  </g>
              </g>
            )}
            <g clipPath="url(#cuttOffViewPaneii)">
              {this.connections.map((d, i) => 
                <path
                  id={d.primaryKey}
                  type="connection"
                  key={d.identifier}
                  transform={d.transform}
                  className={`connection ${d.primaryKey === tooltip.shapeId ? "highlighted" : ""}`}
                  d={d.render}
                  onClick={(event) => this.handleConnectionClick(event, d)}
                  style={{ fill: d.fill, stroke: d.color, strokeWidth: d.strokeWidth, strokeDasharray: d.dash, opacity: d.opacity, pointerEvents: 'all' }}
                />
              )}
            </g>
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
              {tooltip.text.map((d, i) =>
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
const mapDispatchToProps = (dispatch) => ({
  updateDomains: (domains) => dispatch(updateDomains(domains))
});
const mapStateToProps = (state) => ({
  chromoBins: state.App.chromoBins,
  defaultDomain: state.App.defaultDomain,
  domains: state.App.domains
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(GenomePlot));
