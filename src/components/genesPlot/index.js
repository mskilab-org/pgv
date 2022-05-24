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
  gapX: 24,
  gapY: 0,
  bGap: 0,
  rectangleHeight: 10,
};

class GenesPlot extends Component {
  regl = null;
  container = null;
  genesY = null;
  domainY = [-3, 3];
  geneTypes = null;
  geneTitles = null;
  genesStartPoint = null;
  genesEndPoint = null;
  genesColor = null;
  genesStrand = null;
  genesWeight = null;

  constructor(props) {
    super(props);
    let { genes } = this.props;
    this.geneTypes = genes.getChild("type").toArray();
    this.geneTitles = genes.getChild("title").toArray();
    this.genesStartPoint = genes.getChild("startPlace").toArray();
    this.genesEndPoint = genes.getChild("endPlace").toArray();
    this.genesY = genes.getChild("y").toArray();
    this.genesColor = genes.getChild("color").toArray();
    this.genesStrand = genes.getChild("strand").toArray();
    this.genesWeight = genes.getChild("weight").toArray();

    this.state = {
      tooltip: {
        shape: null,
        visible: false,
        shapeId: -1,
        x: -1000,
        y: -1000,
        text: "",
      },
    };
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

    this.plot = new Plot(this.regl, margins.gapX, 0);
    this.updateStage();
  }

  componentDidUpdate(prevProps, prevState) {
    const { domains } = this.props;

    if (prevProps.width !== this.props.width) {
      this.componentWillUnmount();
      this.componentDidMount();
    } else {
      this.plot.rescaleX(domains);
    }
  }

  componentWillUnmount() {
    if (this.regl) {
      this.regl.destroy();
      this.regl._gl.clear(this.regl._gl.COLOR_BUFFER_BIT);
      this.regl._gl.clear(this.regl._gl.DEPTH_BUFFER_BIT);
      this.regl._gl.clear(this.regl._gl.STENCIL_BUFFER_BIT);
    }
  }

  updateStage() {
    let { domains, width, height } = this.props;
    let stageWidth = width - 2 * margins.gapX;
    let stageHeight = height - 3 * margins.gapY;

    this.plot.load(
      stageWidth,
      stageHeight,
      this.genesStartPoint,
      this.genesEndPoint,
      this.genesY,
      this.genesColor,
      domains
    );
    this.plot.render();
  }

  handleMouseMove = (event) => {
    const { genes, width, height } = this.props;

    let stageWidth = width - 2 * margins.gapX;
    let stageHeight = height - 3 * margins.gapY;
    let position = [
      d3.pointer(event)[0] - margins.gapX,
      d3.pointer(event)[1] - margins.gapY,
    ];

    if (
      position[0] < stageWidth &&
      position[0] >= 0 &&
      position[1] <= stageHeight &&
      position[1] > 0
    ) {
      const pixels = this.plot.regl.read({
        x: position[0],
        y: stageHeight - position[1],
        width: 1,
        height: 1,
        data: new Uint8Array(6),
        framebuffer: this.plot.fboIntervals,
      });
      let index = pixels[0] * 65536 + pixels[1] * 256 + pixels[2] - 3000;
      if (index >= 0 && index < genes.numRows) {
        let selectedGene = genes.get(index).toJSON();
        let textData = this.tooltipContent(selectedGene);
        let diffY = d3.min([
          0,
          height - event.nativeEvent.offsetY - textData.length * 16 - 12,
        ]);
        let diffX = d3.min([
          0,
          width -
            event.nativeEvent.offsetX -
            d3.max(textData, (d) => measureText(`${d.label}: ${d.value}`, 12)) -
            30,
        ]);
        this.state.tooltip.shapeId !== selectedGene.iid &&
          this.setState({
            tooltip: {
              shape: selectedGene,
              shapeId: selectedGene.iid,
              visible: true,
              x: event.nativeEvent.offsetX + diffX,
              y: event.nativeEvent.offsetY + diffY,
              text: textData,
            },
          });
      } else {
        this.state.tooltip.visible &&
          this.setState({
            tooltip: { shape: null, shapeId: null, visible: false },
          });
      }
    }
  };

  handleClick = (event) => {
    const { genes, width, height } = this.props;
    let stageWidth = width - 2 * margins.gapX;
    let stageHeight = height - 3 * margins.gapY;
    let position = [
      d3.pointer(event)[0] - margins.gapX,
      d3.pointer(event)[1] - margins.gapY,
    ];

    if (
      position[0] < stageWidth &&
      position[0] >= 0 &&
      position[1] <= stageHeight &&
      position[1] > 0
    ) {
      const pixels = this.plot.regl.read({
        x: position[0],
        y: stageHeight - position[1],
        width: 1,
        height: 1,
        data: new Uint8Array(6),
        framebuffer: this.plot.fboIntervals,
      });
      let index = pixels[0] * 65536 + pixels[1] * 256 + pixels[2] - 3000;
      let selectedGene = genes.get(index);
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
  };

  tooltipContent(interval) {
    let attributes = [
      { label: "iid", value: interval.iid },
      { label: "title", value: interval.title },
      { label: "type", value: interval.type },
      { label: "Chromosome", value: interval.chromosome },
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
    const { width, height, genes, domains } = this.props;
    const { tooltip } = this.state;

    let stageWidth = width - 2 * margins.gapX;
    let stageHeight = height - 3 * margins.gapY;

    let windowWidth =
      (stageWidth - (domains.length - 1) * margins.gapX) / domains.length;
    let windowHeight = stageHeight;
    let yScale = d3.scaleLinear().domain(this.domainY).range([windowHeight, 0]);
    let windowScales = [];
    domains.forEach((xDomain, j) => {
      let xScale = d3.scaleLinear().domain(xDomain).range([0, windowWidth]);

      let texts = [];
      let positiveStrandTexts = [];
      let negativeStrandTexts = [];

      let startPosNext = { "+": -1, "-": -1 };
      for (let i = 0; i < genes.numRows; i++) {
        if (
          this.genesStartPoint[i] <= xDomain[1] &&
          this.genesStartPoint[i] >= xDomain[0] &&
          this.geneTypes[i] === "gene"
        ) {
          let isGene = this.geneTypes[i] === "gene";
          let xPos = xScale(this.genesStartPoint[i]);
          let textLength = measureText(this.geneTitles[i], 10);
          let yPos = yScale(this.genesY[i]);
          if (isGene && xPos > 0 && xPos < stageWidth) {
            let d = genes.get(i).toJSON();
            let textBlock = (
              <text
                key={d.iid}
                x={xPos}
                y={yPos}
                endPos={xPos + textLength}
                strand={this.genesStrand[i]}
                dy={-10}
                fontFamily="Arial"
                fontSize={10}
                textAnchor="start"
                className={this.genesWeight[i] > 1 ? "weighted" : ""}
                clipPath="url(#clipping)"
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  window
                    .open(
                      `https://www.genecards.org/cgi-bin/carddisp.pl?gene=${
                        genes.get(i).toJSON().title
                      }`,
                      "_blank"
                    )
                    .focus();
                }}
              >
                {d.title}
              </text>
            );
            startPosNext[d.strand] = xPos + textLength;
            this.genesStrand[i] === "+" && positiveStrandTexts.push(textBlock);
            this.genesStrand[i] === "-" && negativeStrandTexts.push(textBlock);
          }
        }
      }

      positiveStrandTexts = positiveStrandTexts.sort((a, b) =>
        d3.ascending(a.props.x, b.props.x)
      );
      let pTexts = [];
      let sPos = -1;
      let previousTextType = null;
      positiveStrandTexts.forEach((d, i) => {
        if (
          d.props.className === "weighted" &&
          previousTextType !== "weighted"
        ) {
          pTexts.pop();
          pTexts.push(d);
          sPos = d.props.endPos;
          previousTextType = d.props.className;
        } else {
          if (d.props.x > sPos) {
            pTexts.push(d);
            sPos = d.props.endPos;
            previousTextType = d.props.className;
          }
        }
      });
      negativeStrandTexts = negativeStrandTexts.sort((a, b) =>
        d3.ascending(a.props.x, b.props.x)
      );
      let nTexts = [];
      sPos = -1;
      previousTextType = null;
      negativeStrandTexts.forEach((d, i) => {
        if (
          d.props.className === "weighted" &&
          previousTextType !== "weighted"
        ) {
          nTexts.pop();
          nTexts.push(d);
          sPos = d.props.endPos;
          previousTextType = d.props.className;
        } else {
          if (d.props.x > sPos) {
            nTexts.push(d);
            sPos = d.props.endPos;
            previousTextType = d.props.className;
          }
        }
      });

      texts = nTexts.concat(pTexts);
      windowScales.push({ xScale, yScale, texts });
    });
    let tooltipDomainIndex = -1,
      tooltipScale = null;
    if (tooltip.visible) {
      tooltipDomainIndex = domains.findIndex(
        (xDomain) =>
          !(
            tooltip.shape.endPlace < xDomain[0] ||
            tooltip.shape.startPlace > xDomain[1]
          )
      );
      tooltipScale = windowScales[tooltipDomainIndex];
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
        <svg
          width={width}
          height={height}
          className="plot-container"
          ref={(elem) => (this.plotContainer = elem)}
        >
          <clipPath id="clipping">
            <rect x={0} y={0} width={windowWidth} height={windowHeight} />
          </clipPath>
          <g
            className="labels-container"
            transform={`translate(${[0, margins.gapY]})`}
          >
            <text
              transform={`translate(${[0, yScale(0.75)]})rotate(90)`}
              textAnchor="middle"
              fontSize={16}
              dy="-4"
            >
              &#8212;
            </text>
            <text
              transform={`translate(${[0, yScale(-1.25)]})rotate(90)`}
              textAnchor="middle"
              fontSize={16}
              dy="-4"
            >
              &#x2b;
            </text>
          </g>
          <g
            className="texts-container"
            transform={`translate(${[margins.gapX, margins.gapY]})`}
          >
            {windowScales.map((d, i) => (
              <g
                transform={`translate(${[
                  i * (margins.gapX + windowWidth),
                  0,
                ]})`}
              >
                {d.texts}
              </g>
            ))}
          </g>
          {tooltip.visible && (
            <g transform={`translate(${[margins.gapX, margins.gapY]})`}>
              <g
                transform={`translate(${[
                  tooltipDomainIndex * (margins.gapX + windowWidth),
                  0,
                ]})`}
              >
                <rect
                  x={tooltipScale.xScale(tooltip.shape.startPlace)}
                  y={
                    tooltipScale.yScale(tooltip.shape.y) -
                    margins.rectangleHeight / 2
                  }
                  width={
                    tooltipScale.xScale(tooltip.shape.endPlace) -
                    tooltipScale.xScale(tooltip.shape.startPlace)
                  }
                  height={margins.rectangleHeight}
                  stroke={d3.rgb("#FF7F0E").darker()}
                  fill="#FF7F0E"
                />
              </g>
            </g>
          )}
          {tooltip.visible && (
            <g
              className="tooltip"
              transform={`translate(${[tooltip.x + 30, tooltip.y]})`}
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
                fillOpacity="0.97"
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
GenesPlot.propTypes = {
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  genes: PropTypes.object,
};
GenesPlot.defaultProps = {};
const mapDispatchToProps = (dispatch) => ({});
const mapStateToProps = (state) => ({});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(GenesPlot));
