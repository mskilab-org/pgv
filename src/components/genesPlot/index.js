import React, { Component } from "react";
import { PropTypes } from "prop-types";
import * as d3 from "d3";
import { connect } from "react-redux";
import { withTranslation } from "react-i18next";
import { Axis, axisPropsFromTickScale, BOTTOM } from "react-d3-axis";
import Wrapper from "./index.style";
import { humanize, measureText } from "../../helpers/utility";
import Plot from "./plot";
import Grid from "../grid/index";
import appActions from "../../redux/app/actions";

const { updateDomain } = appActions;

const margins = {
  gap: 24,
};

class GenesPlot extends Component {
  constructor(props) {
    super(props);
    this.zoom = null;
    this.container = null;
    this.plotContainer = null;
    this.grid = null;
    let { width, height, genes, defaultDomain, xDomain } = this.props;

    let stageWidth = width - 2 * margins.gap;
    let stageHeight = height - 2 * margins.gap;
    let genomeScale = d3
      .scaleLinear()
      .domain(defaultDomain)
      .range([0, stageWidth]);
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
      .on("zoom", (event) => this.zoomed(event, false))
      .on("end", (event) => this.zoomed(event, true));

    let geneStruct = {
      geneTypes: genes.getColumn("type").toArray(),
      geneTitles: genes.getColumn("title").toArray(),
      genesStartPoint: genes.getColumn("startPlace").toArray(),
      genesEndPoint: genes.getColumn("endPlace").toArray(),
      genesY: genes.getColumn("y").toArray(),
      genesFill: genes.getColumn("color").toArray(),
      genesStroke: genes.getColumn("color").toArray(),
      domainX: xDomain,
      domainY: [-3, 3],
    };

    this.state = {
      stageWidth,
      stageHeight,
      xDomain,
      genomeScale,
      geneStruct,
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
    return nextProps.xDomain.toString() !== this.props.xDomain.toString() || (nextState.tooltip.shapeId !== this.state.tooltip.shapeId);
  }

  componentDidMount() {
    const { xDomain, genomeScale, stageWidth, stageHeight, geneStruct } =
      this.state;
    var s = [genomeScale(xDomain[0]), genomeScale(xDomain[1])];
    const regl = require("regl")({
      extensions: ["ANGLE_instanced_arrays"],
      container: this.container,
      pixelRatio: window.devicePixelRatio || 1.5,
      attributes: {
        antialias: true,
        depth: false,
        stencil: true,
        preserveDrawingBuffer: true,
      },
    });

    regl.cache = {};
    this.regl = regl;

    this.regl.clear({
      color: [0, 0, 0, 0.0],
      stencil: true,
    });
    this.plot = new Plot(this.regl);
    this.plot.load(stageWidth, stageHeight, geneStruct);
    this.plot.render();
    d3.select(this.container)
      .attr("preserveAspectRatio", "xMinYMin meet")
      .call(this.zoom);
    d3.select(this.container).call(
      this.zoom.transform,
      d3.zoomIdentity.scale(stageWidth / (s[1] - s[0])).translate(-s[0], 0)
    );
  }

  componentDidUpdate() {
    let { xDomain } = this.props;
    const { genomeScale, stageWidth } = this.state;
    var s = [genomeScale(xDomain[0]), genomeScale(xDomain[1])];
    d3.select(this.container)
      .attr("preserveAspectRatio", "xMinYMin meet")
      .call(this.zoom);
    d3.select(this.container).call(
      this.zoom.transform,
      d3.zoomIdentity.scale(stageWidth / (s[1] - s[0])).translate(-s[0], 0)
    );
  }

  zoomed(event, shouldChangeHistory) {
    let newDomain = event.transform
      .rescaleX(this.state.genomeScale)
      .domain()
      .map(Math.floor);
    if (newDomain.toString() !== this.props.xDomain.toString()) {
      this.regl.cache = {};
      this.regl.clear({
        color: [0, 0, 0, 0.0],
        depth: false,
        stencil: true
      });
  
      this.regl.poll();

      this.plot.rescaleX(newDomain);
      this.setState({ xDomain: newDomain }, () => {
         this.props.updateDomain(newDomain[0], newDomain[1], shouldChangeHistory, "zoom");
      });
    }
  }

  componentWillUnmount() {
    if (this.regl) {
      this.regl.destroy();
    }
  }

  handleMouseMove = (event) => {
    const { stageHeight } = this.state;
    const { genes, width, height } = this.props;
    let position = [d3.pointer(event)[0] - margins.gap, d3.pointer(event)[1] - margins.gap];
    try {
      const pixels = this.plot.regl.read({
        x: position[0],
        y: stageHeight - position[1],
        width: 1,
        height: 1,
        data: new Uint8Array(6),
        framebuffer: this.plot.fboIntervals,
      });
      let index = pixels[0] * 65536 + pixels[1] * 256 + pixels[2] - 3000;
      if (genes.get(index)) {
        let selectedGene = genes.get(index).toJSON();
        let textData = this.tooltipContent(selectedGene);
        let diffY = d3.min([0, height - event.nativeEvent.offsetY - textData.length * 16 - 12]);
        let diffX = d3.min([0, width - event.nativeEvent.offsetX - d3.max(textData, (d) => measureText(`${d.label}: ${d.value}`, 12)) - 30]);
        this.state.tooltip.shapeId !== selectedGene.iid && this.setState({tooltip: {shapeId: selectedGene.iid, visible: true, x: (event.nativeEvent.offsetX + diffX), y: (event.nativeEvent.offsetY + diffY), text: textData}})
      } else {
        this.state.tooltip.visible && this.setState({tooltip: {shapeId: null, visible: false}})
      }
    } catch (error) {
      //console.error(error);
    }
  }

  handleClick = (event) => {
    const { stageHeight } = this.state;
    const { genes } = this.props;
    let position = [d3.pointer(event)[0] - margins.gap, d3.pointer(event)[1] - margins.gap];
    try {
      const pixels = this.plot.regl.read({
        x: position[0],
        y: stageHeight - position[1],
        width: 1,
        height: 1,
        data: new Uint8Array(6),
        framebuffer: this.plot.fboIntervals,
      });
      let index = pixels[0] * 65536 + pixels[1] * 256 + pixels[2] - 3000;
      let selectedGene = genes.get(index)
      if (selectedGene) {
        window
              .open(
                `https://www.genecards.org/cgi-bin/carddisp.pl?gene=${
                  selectedGene.toJSON().title
                }`,
                "_blank"
              )
              .focus();
      }
    } catch (error) {
      //console.error(error);
    }
  }

  tooltipContent(interval) {
    let attributes = [
      { label: "iid", value: interval.iid },
      { label: "title", value: interval.title },
      { label: "type", value: interval.type },
      { label: "Chromosome", value: interval.chromosome },
      { label: "Y", value: interval.y },
      { label: "Start Point", value: d3.format(",")(interval.startPoint) },
      { label: "End Point", value: d3.format(",")(interval.endPoint) },
    ];
    interval.strand &&
      attributes.push({ label: "Strand", value: interval.strand });
    interval.sequence &&
      attributes.push({ label: "Sequence", value: interval.sequence });
    interval.metadata &&
      Object.keys(interval.metadata).forEach((key) => {
        attributes.push({
          label: humanize(key),
          value: interval.metadata[key],
        });
      });
    return attributes;
  }

  render() {
    const { width, height, chromoBins, genes, title } =
      this.props;
    const { xDomain, stageWidth, stageHeight, geneStruct, tooltip } = this.state;
    const { geneTypes, genesStartPoint, geneTitles, genesY } = geneStruct;

    const xScale = d3.scaleLinear().domain(xDomain).range([0, stageWidth]);
    const yScale = d3.scaleLinear().domain([-3, 3]).range([stageHeight, 0]);
    let texts = [];
    if (true) {
      let startPosNext = { 1: -1, "-1": -1 };
      for (let i = 0; i < genes.count(); i++) {
        if (
          genesStartPoint[i] <= xDomain[1] &&
          genesStartPoint[i] >= xDomain[0] &&
          geneTypes[i] === "gene"
        ) {
          let isGene = geneTypes[i] === "gene";
          let xPos = xScale(genesStartPoint[i]);
          let textLength = measureText(geneTitles[i], 10);
          let yPos = yScale(genesY[i]);
          if (
            isGene &&
            xPos > 0 &&
            xPos < stageWidth &&
            xPos > startPosNext[genesY[i].toString()]
          ) {
            let d = genes.get(i).toJSON();
            texts.push(
              <text
                key={d.iid}
                x={xPos}
                y={yPos}
                dy={-10}
                fontFamily="Arial"
                fontSize={10}
                textAnchor="start"
              >
                {d.title}
              </text>
            );
            startPosNext[d.y] = xPos + textLength;
          }
        }
      }
    }
    return (
      <Wrapper className="ant-wrapper" margins={margins}>
        <div
          className="genome-plot"
          style={{ width: stageWidth, height: stageHeight }}
          ref={(elem) => (this.container = elem)}
          onMouseMove={(e) => this.handleMouseMove(e)}
          onClick={(e) => this.handleClick(e)}
        />
        {(
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
            <g
              className="labels-container"
              transform={`translate(${[0, margins.gap]})`}
            >
             <text
              transform={`translate(${[0, yScale(1)]})rotate(90)`}
              textAnchor="middle"
              fontSize={16}
              dy="-4"
            >
              {"-"}
            </text>
            <text
              transform={`translate(${[0, yScale(-1)]})rotate(90)`}
              textAnchor="middle"
              fontSize={16}
              dy="-4"
            >
              {"+"}
            </text>
            </g>
            <g
              clipPath="url(#clipping)"
              className="labels-container"
              transform={`translate(${[margins.gap, margins.gap]})`}
            >
              {texts}
            </g>
            <g transform={`translate(${[margins.gap,margins.gap]})`} >
              {<Grid
                showY={false}
                scaleX={xScale}
                scaleY={yScale}
                axisWidth={stageWidth}
                axisHeight={stageHeight}
                chromoBins={chromoBins}
              />}
            </g>
            {tooltip.visible && <g
            className="tooltip"
            transform={`translate(${[tooltip.x + 30, tooltip.y]})`}
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
        )}
      </Wrapper>
    );
  }
}
GenesPlot.propTypes = {
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  xDomain: PropTypes.array,
  genes: PropTypes.object,
  title: PropTypes.string,
  chromoBins: PropTypes.object,
};
GenesPlot.defaultProps = {
  xDomain: [],
};
const mapDispatchToProps = (dispatch) => ({
  updateDomain: (from, to, shouldChangeHistory, eventSource) => dispatch(updateDomain(from,to,shouldChangeHistory, eventSource))
});
const mapStateToProps = (state) => ({
  xDomain: state.App.domain,
  chromoBins: state.App.chromoBins,
  defaultDomain: state.App.defaultDomain,
  shouldChangeHistory: state.App.shouldChangeHistory,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(GenesPlot));
