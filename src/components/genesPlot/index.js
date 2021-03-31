import React, { Component } from "react";
import { PropTypes } from "prop-types";
import * as d3 from "d3";
import { Axis, axisPropsFromTickScale, LEFT, BOTTOM } from "react-d3-axis";
import Wrapper from "./index.style";
import { rgbtoInteger, measureText } from "../../helpers/utility";
import Plot from "./plot";

const margins = {
  gap: 24,
};

class GenesPlot extends Component {
  regl = null;
  container = null;

  componentDidMount() {
    const regl = require("regl")({
      extensions: ["ANGLE_instanced_arrays"],
      container: this.container,
      pixelRatio: window.devicePixelRatio || 1.5,
      attributes: { antialias: true, depth: false, stencil: true },
    });

    regl.cache = {};
    this.regl = regl;

    this.regl.clear({
      color: [0, 0, 0, 0.05],
      stencil: true,
    });
    this.plot = new Plot(this.regl);
    this.updateStage();
  }

  componentDidUpdate(prevProps, prevState) {
    this.regl.clear({
      color: [0, 0, 0, 0.05],
      depth: false,
    });

    this.regl.poll();

    this.updateStage();
  }

  componentWillUnmount() {
    if (this.regl) {
      this.regl.destroy();
    }
  }

  updateStage() {
    let { width, height, genes, xDomain, chromoBins } = this.props;

    let stageWidth = width - 2 * margins.gap;
    let stageHeight = height - 2 * margins.gap;
    this.regl.poll();
    
    let geneBins = {}, genesStartPoint = [], genesEndPoint = [], domainY = [0,0], genesY = [], domainX = xDomain, genesFill = [], genesStroke = [];
    genes.forEach((d,i) => {
      d.y = d.strand === "+" ? 1 : 3;
      d.startPlace = chromoBins[`${d.chromosome}`].startPlace + d.startPoint;
      genesStartPoint.push(d.startPlace);
      d.endPlace = chromoBins[`${d.chromosome}`].startPlace + d.endPoint;
      genesEndPoint.push(d.endPlace);
      genesY.push(+d.y);
      genesFill.push(rgbtoInteger(d3.rgb(chromoBins[`${d.chromosome}`].color)));
      genesStroke.push(rgbtoInteger(d3.rgb(chromoBins[`${d.chromosome}`].color).darker()));
      domainY = [d3.min([domainY[0], +d.y]), d3.max([domainY[1], +d.y])];
      geneBins[d.iid] = d;
    });
    
    domainY = [0,4];
    let geneStruct = {genesStartPoint, genesEndPoint, genesY, genesFill, genesStroke, domainX , domainY};

    this.plot.load(
      stageWidth,
      stageHeight,
      geneStruct
    );
    this.plot.render();
  }

  handleGeneLabelClick = (gene) => {
    window.open(`https://www.genecards.org/cgi-bin/carddisp.pl?gene=${gene.title}`, '_blank').focus();
  }

  render() {
    const { width, height, xDomain, genes, title, chromoBins } = this.props;
    let stageWidth = width - 2 * margins.gap;
    let stageHeight = height - 2 * margins.gap;
    const xScale = d3.scaleLinear().domain(xDomain).range([0, stageWidth]);
    const yScale = d3
      .scaleLinear()
      .domain([0, 4])
      .range([stageHeight, 0]);
    let texts = [];
    let startPosNext = {"+": -1, "-": -1};
    genes.forEach((d,i) => {
      let isGene = (d.type === "gene")
      let startPos = chromoBins[`${d.chromosome}`].startPlace + d.startPoint;
      let xPos = xScale(startPos);
      let textLength = measureText(d.title, 10);
      let yPos = yScale(d.strand === "+" ? 1 : 3);
      if (isGene && (xPos > 0) && (xPos < stageWidth) && (xPos > startPosNext[d.strand])) {
        texts.push(<text key={d.iid} x={xPos} y={yPos} dy={-10} onClick={() => this.handleGeneLabelClick(d)} fontFamily="Arial" fontSize={10} textAnchor="start">{d.title}</text>);
        startPosNext[d.strand] = xPos + textLength;
      }
    });
    return (
      <Wrapper className="ant-wrapper" margins={margins}>
        <div
          className="genome-plot"
          style={{ width: stageWidth, height: stageHeight }}
          ref={(elem) => (this.container = elem)}
        />
        <svg width={width} height={height} className="plot-container">
          <text
            transform={`translate(${[width / 2, margins.gap]})`}
            textAnchor="middle"
            fontSize={16}
            dy="-4"
          >
            {title}
          </text>
          <g className="labels-container" transform={`translate(${[margins.gap, margins.gap]})`}>
            {texts}
          </g>
          <g
            transform={`translate(${[margins.gap, stageHeight + margins.gap]})`}
          >
            <Axis
              {...axisPropsFromTickScale(xScale, 10)}
              format={(d) => d3.format("~s")(d)}
              style={{ orient: BOTTOM }}
            />
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
  genes: PropTypes.array,
  title: PropTypes.string,
  chromoBins: PropTypes.object
};
GenesPlot.defaultProps = {
  xDomain: [],
};
export default GenesPlot;