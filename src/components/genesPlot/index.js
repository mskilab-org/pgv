import React, { Component } from "react";
import { PropTypes } from "prop-types";
import * as d3 from "d3";
import { connect } from "react-redux";
import { withTranslation } from "react-i18next";
import Wrapper from "./index.style";
import { humanize, measureText } from "../../helpers/utility";
import Plot from "./plot";
import Grid from "../grid/index";

const margins = {
  gapX: 12,
  gapY: 0,
  bGap: 0,
  rectangleHeight: 10
};

class GenesPlot extends Component {
  constructor(props) {
    super(props);
    this.zoom = null;
    this.container = null;
    this.plotContainer = null;
    this.grid = null;
    let { genesStructure, xDomain } = this.props;

    let geneStruct = {
      geneTypes: genesStructure.geneTypes,
      geneTitles: genesStructure.geneTitles,
      genesStartPoint: genesStructure.genesStartPoint,
      genesEndPoint: genesStructure.genesEndPoint,
      genesY: genesStructure.genesY,
      genesStroke: genesStructure.genesStroke,
      genesStrand: genesStructure.genesStrand,
      genesWeight: genesStructure.genesWeight,
      domainX: xDomain,
      domainY: [-3, 3],
    };

    this.state = {
      xDomain,
      geneStruct,
      tooltip: {
        shape: null,
        visible: false,
        shapeId: -1,
        x: -1000,
        y: -1000,
        text: ""
      }
    };
  }

  componentDidMount() {
    let { width, height } = this.props;
    const { geneStruct } = this.state;

    const regl = require("regl")({
      extensions: ["ANGLE_instanced_arrays"],
      container: this.container,
      pixelRatio: window.devicePixelRatio || 1.5,
      attributes: {
        antialias: true,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: true,
      },
    });

    regl.cache = {};
    this.regl = regl;

    this.regl.clear({
      color: [0, 0, 0, 0.0],
      depth: false,
      stencil: false
    });
    let stageWidth = width - 2 * margins.gapX;
    let stageHeight = height - 3 * margins.gapY;

    this.plot = new Plot(this.regl, margins.rectangleHeight);
    this.plot.load(stageWidth, stageHeight, geneStruct);
    this.plot.render();
  }

  componentDidUpdate(prevProps, prevState) {
    let { width, height, xDomain } = this.props;

    this.regl.cache = {};
    this.regl.clear({
      color: [0, 0, 0, 0.0],
      depth: false,
      stencil: true
    });

    this.regl.poll();
    let stageWidth = width - 2 * margins.gapX;
    let stageHeight = height - 3 * margins.gapY;

    if (prevProps.width !== this.props.width) {
      this.regl.destroy();
      this.componentDidMount();
    } else {
      this.plot.rescaleX(stageWidth, stageHeight, xDomain);
    }
  }

  componentWillUnmount() {
    if (this.regl) {
      this.regl.destroy();
    }
  }

  handleMouseMove = (event) => {
    const { genes, width, height } = this.props;

    let stageWidth = width - 2 * margins.gapX;
    let stageHeight = height - 3 * margins.gapY;
    let position = [d3.pointer(event)[0] - margins.gapX, d3.pointer(event)[1] - margins.gapY];

    if ((position[0] < stageWidth) && ((position[0] >= 0)) && (position[1] <= stageHeight) && ((position[1] > 0))) {
     
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
        this.state.tooltip.shapeId !== selectedGene.iid && this.setState({tooltip: {shape: selectedGene, shapeId: selectedGene.iid, visible: true, x: (event.nativeEvent.offsetX + diffX), y: (event.nativeEvent.offsetY + diffY), text: textData}})
      } else {
        this.state.tooltip.visible && this.setState({tooltip: {shape: null, shapeId: null, visible: false}})
      }
    }
    
  }

  handleClick = (event) => {
    const { genes, width, height } = this.props;
    let stageWidth = width - 2 * margins.gapX;
    let stageHeight = height - 3 * margins.gapY;
    let position = [d3.pointer(event)[0] - margins.gapX, d3.pointer(event)[1] - margins.gapY];

    if ((position[0] < stageWidth) && ((position[0] >= 0)) && (position[1] <= stageHeight) && ((position[1] > 0))) {
     
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
    const { width, height, chromoBins, genes, title, xDomain } =
      this.props;
    const { geneStruct, tooltip } = this.state;
    const { geneTypes, genesStartPoint, geneTitles, genesY, genesStrand, genesWeight } = geneStruct;

    let stageWidth = width - 2 * margins.gapX;
    let stageHeight = height - 3 * margins.gapY;

    const xScale = d3.scaleLinear().domain(xDomain).range([0, stageWidth]);
    const yScale = d3.scaleLinear().domain([-3, 3]).range([stageHeight, 0]);
    let texts = [];
    let positiveStrandTexts = [];
    let negativeStrandTexts = [];

      let startPosNext = { "+": -1, "-": -1 };
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
          if ((
            isGene &&
            xPos > 0 &&
            xPos < stageWidth &&
            xPos > startPosNext[genesStrand[i].toString()]
          ) || (genesWeight[i] > 1)) {
            let d = genes.get(i).toJSON();
            let textBlock = 
              <text
                key={d.iid}
                x={xPos}
                y={yPos}
                endPos={xPos + textLength}
                strand={genesStrand[i]}
                dy={-10}
                fontFamily="Arial"
                fontSize={10}
                textAnchor="start"
                className={genesWeight[i] > 1 ? "weighted" : ""}
              >
                {d.title}
              </text>;
            startPosNext[d.strand] = xPos + textLength;
            genesStrand[i] === "+" && positiveStrandTexts.push(textBlock);
            genesStrand[i] === "-" && negativeStrandTexts.push(textBlock);
          }
        }
      }

    positiveStrandTexts = positiveStrandTexts.filter((d,i) => d.props.className === "weighted" || ((i < positiveStrandTexts.length - 1) && d.props.endPos < positiveStrandTexts[i + 1].props.x));
    negativeStrandTexts = negativeStrandTexts.filter((d,i) => d.props.className === "weighted" || ((i < negativeStrandTexts.length - 1) && d.props.endPos < negativeStrandTexts[i + 1].props.x));
    positiveStrandTexts = positiveStrandTexts.filter((d,i) => ((i < positiveStrandTexts.length - 1) && d.props.endPos < positiveStrandTexts[i + 1].props.x));
    negativeStrandTexts = negativeStrandTexts.filter((d,i) => ((i < negativeStrandTexts.length - 1) && d.props.endPos < negativeStrandTexts[i + 1].props.x));

    texts = positiveStrandTexts.concat(negativeStrandTexts);
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
            height={height + margins.bGap}
            className="plot-container"
            ref={(elem) => (this.plotContainer = elem)}
          >
            <clipPath id="clipping">
              <rect x={0} y={0} width={stageWidth} height={stageHeight} />
            </clipPath>
            <text
              transform={`translate(${[width / 2, margins.gapY]})`}
              textAnchor="middle"
              fontSize={16}
              dy="-4"
            >
              {title}
            </text>
            <g
              className="labels-container"
              transform={`translate(${[0, margins.gapY]})`}
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
              transform={`translate(${[margins.gapX, margins.gapY]})`}
            >
              {texts}
            </g>
            {false && <g transform={`translate(${[margins.gapX,margins.gapY]})`} >
              {<Grid
                showY={false}
                scaleX={xScale}
                scaleY={yScale}
                axisWidth={stageWidth}
                axisHeight={stageHeight}
                chromoBins={chromoBins}
              />}
            </g>}
            {tooltip.visible && <g transform={`translate(${[margins.gapX,margins.gapY]})`} >
              <rect x={xScale(tooltip.shape.startPlace)} y={yScale(tooltip.shape.y) - margins.rectangleHeight / 2} width={xScale(tooltip.shape.endPlace) - xScale(tooltip.shape.startPlace)} height={margins.rectangleHeight} stroke={d3.rgb("#FF7F0E").darker()} fill="#FF7F0E"/>
            </g>}
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
});
const mapStateToProps = (state) => ({
  chromoBins: state.App.chromoBins,
  defaultDomain: state.App.defaultDomain
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(GenesPlot));
