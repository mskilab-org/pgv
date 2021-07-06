import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import { withTranslation } from "react-i18next";
import * as d3 from "d3";
import Wrapper from "./index.style";
import Connection from "./connection";
import Interval from "./interval";
import { measureText } from "../../helpers/utility";
import Grid from "../grid/index";
import appActions from "../../redux/app/actions";

const { updateDomain } = appActions;

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
    const { xDomain, width, height, defaultDomain, chromoBins, genome } = this.props;

    let stageWidth = width - 2 * margins.gap;
    let stageHeight = height - 3 * margins.gap;
    let currentTransform = null;
    let genomeScale = d3.scaleLinear().domain(defaultDomain).range([0, stageWidth]);
    this.zoom = d3.zoom()
      .translateExtent([[0, 0], [stageWidth, stageHeight]])
      .extent([[0, 0], [stageWidth, stageHeight]])
      .scaleExtent([1, Infinity])
      .on('zoom', (event) => this.zoomed(event, false))
      .on('end', (event) => this.zoomed(event, true));
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
      intervals.push(interval);
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
      connections.push(connection);
    });
    this.state = {
      stageWidth,
      stageHeight,
      xDomain,
      intervals,
      genomeScale,
      currentTransform,
      intervalBins,
      connections,
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
  
  shouldComponentUpdate(nextProps, nextState) {
    return (nextProps.xDomain.toString() !== this.props.xDomain.toString()) || (nextState.tooltip.shapeId !== this.state.tooltip.shapeId);
  }

  componentDidMount() {
    const { xDomain, genomeScale, stageWidth } = this.state;
    var s = [genomeScale(xDomain[0]), genomeScale(xDomain[1])];
    d3.select(this.container).attr('preserveAspectRatio', 'xMinYMin meet').call(this.zoom);
    d3.select(this.container).call(this.zoom.transform, d3.zoomIdentity.scale(stageWidth / (s[1] - s[0])).translate(-s[0], 0));
  }

  componentDidUpdate() {
    let { xDomain } = this.props;
    const { genomeScale, stageWidth } = this.state;
    var s = [genomeScale(xDomain[0]), genomeScale(xDomain[1])];
    d3.select(this.container).attr('preserveAspectRatio', 'xMinYMin meet').call(this.zoom);
    d3.select(this.container).call(this.zoom.transform, d3.zoomIdentity.scale(stageWidth / (s[1] - s[0])).translate(-s[0], 0));
  }  

  zoomed(event, shouldChangeHistory) {
    let newDomain = event.transform.rescaleX(this.state.genomeScale).domain().map(Math.floor);
      if (newDomain.toString() !== this.props.xDomain.toString()) {
      this.setState({xDomain: newDomain}, () => {
        this.props.updateDomain(newDomain[0], newDomain[1], shouldChangeHistory, "zoom");
      })
    }
  }

  handleMouseMove = (e) => {
    const { width, height } = this.props;
    const { intervals, connections } = this.state;
    let primaryKey = d3.select(e.target) && d3.select(e.target).attr("id");
    let shapeType = d3.select(e.target) && d3.select(e.target).attr("type");
    let shape = null;
    if (primaryKey) {
      if (shapeType === "interval") {
        shape = intervals.find(e => e.primaryKey === primaryKey);
     } else if (shapeType === "connection") {
       shape = connections.find(e => e.primaryKey === primaryKey);
      }
      let diffY = d3.min([0, height - e.nativeEvent.offsetY - shape.tooltipContent.length * 16 - 12]);
      let diffX = d3.min([0, width - e.nativeEvent.offsetX - d3.max(shape.tooltipContent, (d) => measureText(`${d.label}: ${d.value}`, 12)) - 30]);
      this.state.tooltip.shapeId !== shape.primaryKey && this.setState({tooltip: {shapeId: shape.primaryKey, visible: true, x: (e.nativeEvent.offsetX + diffX), y: (e.nativeEvent.offsetY + diffY), text: shape.tooltipContent}})
    } else {
      this.state.tooltip.visible && this.setState({tooltip: {shapeId: null, visible: false}})
    }
  }

  render() {
    const { width, height, chromoBins } = this.props; 
    const { xDomain, intervals, connections, intervalBins, stageWidth, stageHeight, tooltip } = this.state;
    
    let yDomain = [
      0,
      d3.max(
        intervals.filter(
          (d) => d.startPlace <= xDomain[1] && d.endPlace >= xDomain[0]
        ),
        (d) => d.y
      ) + 3,
    ];
    const xScale = d3.scaleLinear().domain(xDomain).range([0, stageWidth]);
    const yScale = d3
      .scaleLinear()
      .domain(yDomain)
      .range([stageHeight, 0])
      .nice();

    return (
      <Wrapper className="ant-wrapper">
        <svg width={width} height={height} onMouseMove={(e) => this.handleMouseMove(e)} ref={(elem) => (this.container = elem)} >
        <defs>
          <clipPath id="cuttOffViewPane">
            <rect x={0} y={0} width={stageWidth} height={2 * stageHeight} />
          </clipPath>
          </defs>
          <g transform={`translate(${[margins.gap,margins.gap]})`} >
            <g ref={(elem) => (this.grid = elem)} clipPath="url(#cuttOffViewPane0)">
              {<Grid
                scaleX={xScale}
                scaleY={yScale}
                axisWidth={stageWidth}
                axisHeight={stageHeight}
                chromoBins={chromoBins}
              />}
            </g>
            <g clipPath="url(#cuttOffViewPane)">
              {intervals.filter((d,i) => (d.startPlace <= xDomain[1]) && (d.endPlace >= xDomain[0])).map((d, i) => {
                return <rect
                  id={d.primaryKey}
                  type="interval"
                  key={i}
                  className={`shape ${d.primaryKey === tooltip.shapeId ? "highlighted" : ""}`}
                  transform={`translate(${[xScale(d.startPlace),yScale(d.y) - 0.5 * margins.bar]})`}
                  width={xScale(d.endPlace) - xScale(d.startPlace)}
                  height={margins.bar}
                  style={{fill: d.fill, stroke: d.stroke, strokeWidth: 1}}
                />
                })}
            </g>
            <g clipPath="url(#cuttOffViewPane)">
              {connections.filter((d,i) => (d.source && (d.source.place <= xDomain[1] && d.source.place >= xDomain[0]))
        || (d.sink && (d.sink.place <= xDomain[1] && d.sink.place >= xDomain[0]))
      ).map((d, i) => {
                d.yScale = yScale;
                d.pinpoint(intervalBins);
                if (d.source) {
                  d.source.scale = xScale;
                }
                if (d.sink) {
                  d.sink.scale = xScale;
                }
                d.touchScale = xScale;
                return <path
                  id={d.primaryKey}
                  type="connection"
                  key={d.identifier}
                  className={`connection ${d.primaryKey === tooltip.shapeId ? "highlighted" : ""}`}
                  d={d.render}
                  style={{fill: d.fill, stroke: d.color, strokeWidth: d.strokeWidth, strokeDasharray: d.dash, opacity: d.opacity, pointerEvents: 'visibleStroke' }}
                />
              })}
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
const mapDispatchToProps = (dispatch) => ({
  updateDomain: (from, to, shouldChangeHistory, eventSource) => dispatch(updateDomain(from,to,shouldChangeHistory, eventSource))
});
const mapStateToProps = (state) => ({
  xDomain: state.App.domain,
  chromoBins: state.App.chromoBins,
  defaultDomain: state.App.defaultDomain
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(GenomePlot));
