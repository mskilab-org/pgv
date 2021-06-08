import React, { Component } from "react";
import { PropTypes } from "prop-types";
import * as d3 from "d3";
import { connect } from "react-redux";
import { withTranslation } from "react-i18next";
import { Axis, axisPropsFromTickScale, BOTTOM } from "react-d3-axis";
import Wrapper from "./index.style";
import { humanize, measureText } from "../../helpers/utility";
import Plot from "./plot";

const margins = {
  gap: 24,
};

class GenesPlot extends Component {
  regl = null;
  container = null;
  plotContainer = null;
  geneStruct = {};
  stageHeight = 0;
  stageWidth = 0;
  geneTypes = null;
  geneTitles = null;
  geneStartPlace = null;
  geneEndPlace = null;
  geneYPos = null;

  componentDidMount() {
    const regl = require("regl")({
      extensions: ["ANGLE_instanced_arrays"],
      container: this.container,
      pixelRatio: window.devicePixelRatio || 1.5,
      attributes: { antialias: true, depth: false, stencil: true, preserveDrawingBuffer: true },
    });

    regl.cache = {};
    this.regl = regl;

    this.regl.clear({
      color: [0, 0, 0, 0.05],
      stencil: true,
    });
    this.plot = new Plot(this.regl);
    this.geneStruct = {};
    this.stageHeight = 0;
    this.stageWidth = 0;
    this.updateStage();
  }

  componentDidUpdate(prevProps, prevState) {

    if ((prevProps.genes.length !== this.props.genes.length) 
      || (prevProps.chromoBins !== this.props.chromoBins)
      || (prevProps.width !== this.props.width)
      || (prevProps.height !== this.props.height)) {
        this.regl.clear({
          color: [0, 0, 0, 0.05],
          depth: false,
        });
    
        this.regl.poll();
        this.updateStage();
    }
    
    if (prevProps.xDomain.toString() !== this.props.xDomain.toString()) {

      this.regl.clear({
        color: [0, 0, 0, 0.05],
        depth: false,
      });
  
      this.regl.poll();

      this.plot.rescaleX(this.props.xDomain);
    }
  }

  componentWillUnmount() {
    if (this.regl) {
      this.regl.destroy();
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
      { label: "End Point", value: d3.format(",")(interval.endPoint) }
    ];
    interval.strand && attributes.push({ label: "Strand", value: interval.strand });
    interval.sequence && attributes.push({ label: "Sequence", value: interval.sequence });
    interval.metadata && Object.keys(interval.metadata).forEach((key) => {
      attributes.push({ label: humanize(key), value: interval.metadata[key] });
    });
    return attributes;
  }

  updateStage() {
    let { width, height, genes, xDomain } = this.props;

    this.stageWidth = width - 2 * margins.gap;
    this.stageHeight = height - 2 * margins.gap;
    this.regl.poll();
    
    this.geneTypes = genes.getColumn("type").toArray();
    this.geneTitles = genes.getColumn("title").toArray();
    this.geneStartPlace = genes.getColumn("startPlace").toArray();
    this.geneEndPlace = genes.getColumn("endPlace").toArray();
    this.geneYPos = genes.getColumn("y").toArray();

    this.geneStruct = {
      genesStartPoint: this.geneStartPlace, 
      genesEndPoint: this.geneEndPlace, 
      genesY: this.geneYPos, 
      genesFill: genes.getColumn("color").toArray(), 
      genesStroke: genes.getColumn("color").toArray(), 
      domainX: xDomain, 
      domainY: [-2,2]};

    this.plot.load(
      this.stageWidth,
      this.stageHeight,
      this.geneStruct
    );
    this.plot.render();

    let self = this;
    d3.select(this.container)
      .select("canvas")
      .on("mousemove", function (event) {
        let position = d3.pointer(event);
        try {
          const pixels = self.plot.regl.read({
            x: position[0],
            y: self.stageHeight - position[1],
            width: 1,
            height: 1,
            data: new Uint8Array(6),
            framebuffer: self.plot.fboIntervals,
          });
          let index = pixels[0] * 65536 + pixels[1] * 256 + pixels[2] - 3000;
          if (genes.get(index)) {
            let selectedGene = genes.get(index).toJSON();
            let textData = self.tooltipContent(selectedGene);
            let maxLength = d3.max(textData, (d) =>
              measureText(`${d.label}: ${d.value}`, 12)
            );
            d3.select(self.plotContainer).selectAll("g.tooltip tspan").remove();
            d3.select(self.plotContainer)
              .select("g.tooltip rect")
              .attr("height", textData.length * 16 + 12)
              .attr("width", maxLength + 30)
              .attr("y", selectedGene.strand === "+" ? 20 - (textData.length * 16) : 20);
            d3.select(self.plotContainer)
              .select("g.tooltip")
              .attr("transform", `translate(${position})`)
              .select("text")
              .selectAll("tspan")
              .data(textData)
              .enter()
              .append("tspan")
              .attr("x", (d, i) => 40)
              .attr("y", (d, i) => (selectedGene.strand === "+" ? 38 - (textData.length * 16) : 38) + i * 16)
              .html(
                (e, i) =>
                  `<tspan font-weight="bold">${e.label}</tspan>: ${e.value}`
              );
          } else {
            d3.select(self.plotContainer)
              .select("g.tooltip")
              .attr("transform", `translate(${[-1000, -1000]})`);
          }
        } catch (error) {
          //console.error(error);
        }
      })
      .on("click", function (event) {
        let position = d3.pointer(event);
        try {
          const pixels = self.plot.regl.read({
            x: position[0],
            y: self.stageHeight - position[1],
            width: 1,
            height: 1,
            data: new Uint8Array(6),
            framebuffer: self.plot.fboIntervals,
          });
          let index = pixels[0] * 65536 + pixels[1] * 256 + pixels[2] - 3000;
          if (genes.get(index)) {

            window.open(`https://www.genecards.org/cgi-bin/carddisp.pl?gene=${genes.get(index).toJSON().title}`, '_blank').focus();
          }
        } catch (error) {

        }
      });
  }

  handleGeneLabelClick = (gene) => {
    window.open(`https://www.genecards.org/cgi-bin/carddisp.pl?gene=${gene.title}`, '_blank').focus();
  }

  render() {
    const { width, height, xDomain, genes, title, chromoBins, shouldChangeHistory } = this.props;
    let stageWidth = width - 2 * margins.gap;
    let stageHeight = height - 2 * margins.gap;
    const xScale = d3.scaleLinear().domain(xDomain).range([0, stageWidth]);
    const yScale = d3
      .scaleLinear()
      .domain([-2, 2])
      .range([stageHeight, 0]);
    let texts = [];
    if (!this.geneTypes || shouldChangeHistory) {
    let startPosNext = {"1": -1, "-1": -1};
    this.geneTypes = this.geneTypes || genes.getColumn("type").toArray();
    this.geneTitles = this.geneTitles || genes.getColumn("title").toArray();
    this.geneStartPlace = this.geneStartPlace || genes.getColumn("startPlace").toArray();
    this.geneEndPlace = this.geneEndPlace || genes.getColumn("endPlace").toArray();
    this.geneYPos = this.geneYPos || genes.getColumn("y").toArray();
    for (let i = 0; i < genes.count(); i++) {
      if (this.geneStartPlace[i] <= xDomain[1] && this.geneStartPlace[i] >= xDomain[0] && this.geneTypes[i] === "gene") {
        let isGene = (this.geneTypes[i] === "gene")
        let xPos = xScale(this.geneStartPlace[i]);
        let textLength = measureText(this.geneTitles[i], 10);
        let yPos = yScale(this.geneYPos[i]);
        if (isGene && (xPos > 0) && (xPos < stageWidth) && (xPos > startPosNext[this.geneYPos[i].toString()])) {
          let d = genes.get(i).toJSON();
          texts.push(<text key={d.iid} x={xPos} y={yPos} dy={-10} fontFamily="Arial" fontSize={10} textAnchor="start">{d.title}</text>);
          startPosNext[d.y] = xPos + textLength;
        }
      }
    };
  }
    return (
      <Wrapper className="ant-wrapper" margins={margins}>
        <div
          className="genome-plot"
          style={{ width: stageWidth, height: stageHeight }}
          ref={(elem) => (this.container = elem)}
        />
        <svg width={width} height={height} className="plot-container" ref={(elem) => (this.plotContainer = elem)}>
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
          <g clipPath="url(#clipping)" className="labels-container" transform={`translate(${[margins.gap, margins.gap]})`}>
            {texts}
          </g>
          <g clipPath="url(#clipping)"
            transform={`translate(${[margins.gap, stageHeight + margins.gap]})`}
          >
            {Object.keys(chromoBins).map((d,i) => {
            let xxScale = d3.scaleLinear().domain([chromoBins[d].startPoint, chromoBins[d].endPoint]).range([0, xScale(chromoBins[d].endPlace) - xScale(chromoBins[d].startPlace)]);
            let tickCount = d3.max([Math.floor((xxScale.range()[1] - xxScale.range()[0]) / 40), 2]);
            let ticks = xxScale.ticks(tickCount);
            ticks[ticks.length - 1] = xxScale.domain()[1];
            return (xScale(chromoBins[d].startPlace) <= stageWidth) && <g key={d} transform={`translate(${[xScale(chromoBins[d].startPlace), 0]})`}>
              <Axis
              {...axisPropsFromTickScale(xxScale, tickCount)}
              values={ticks}
              format={(e) => d3.format("~s")(e)}
              style={{ orient: BOTTOM }}
            />
            </g>})}
          </g>
          <g
            transform={`translate(${[margins.gap, stageHeight + margins.gap]})`}
          >
            {Object.keys(chromoBins).map((d,i) => 
            <g  key={d} transform={`translate(${[xScale(chromoBins[d].startPlace), 0]})`}>
             <line x1="0" y1="0" x2="0" y2={-stageHeight} stroke="rgb(128, 128, 128)" strokeDasharray="4" />
            </g>)}
          </g>
          <g
            className="tooltip"
            transform="translate(-1000, -1000)"
            pointerEvents="none"
          >
            <rect
              x="30"
              y="20"
              width="150"
              height="40"
              rx="5"
              ry="5"
              fill="rgb(97, 97, 97)"
              fillOpacity="0.97"
            />
            <text x="40" y="48" fontSize="12" fill="#FFF"></text>
          </g>
        </svg>
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
  chromoBins: PropTypes.object
};
GenesPlot.defaultProps = {
  xDomain: [],
};
const mapDispatchToProps = (dispatch) => ({});
const mapStateToProps = (state) => ({
  xDomain: state.App.domain,
  chromoBins: state.App.chromoBins,
  shouldChangeHistory: state.App.shouldChangeHistory
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(GenesPlot));