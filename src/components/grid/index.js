import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import { withTranslation } from "react-i18next";
import * as d3 from "d3";
import { magnitude } from "../../helpers/utility";
import Wrapper from "./index.style";

class Grid extends Component {
  container = null;

  componentDidMount() {
    this.renderYAxis();
    this.renderXAxis();
    this.renderSeparators();
  }

  componentDidUpdate() {
    this.renderYAxis();
    this.renderXAxis();
    this.renderSeparators();
  }

  renderYAxis() {
    let { scaleY, axisWidth } = this.props;
    if (!scaleY) {
      return;
    }
    let yAxisContainer = d3.select(this.container).select(".y-axis-container");
    let yAxis = d3.axisLeft(scaleY).tickSize(-axisWidth);
    yAxisContainer.call(yAxis);
  }

  renderXAxis() {
    let { scaleX, axisWidth, fontSize, axisHeight, chromoBins } = this.props;

    let data = Object.keys(chromoBins).filter(
      (d) =>
        scaleX(chromoBins[d].startPlace) <= axisWidth &&
        scaleX(chromoBins[d].endPlace) >= 0
    );

    let xAxisContainer = d3
      .select(this.container)
      .select(".x-axis-container")
      .selectAll("g.axis-x")
      .data(data, (d, i) => `chromo-${d}`);

    xAxisContainer
      .enter()
      .append("g")
      .attr("class", (d) => `axis-x chromo-${d}`)
      .attr(
        "transform",
        (d) =>
          `translate(${[d3.max([scaleX(chromoBins[d].startPlace), 0]), 0]})`
      )
      .each(function (d, i) {
        let chromo = chromoBins[d];
        let domain = scaleX.domain();
        let domainStart =
          domain[0] < chromo.endPlace && domain[0] >= chromo.startPlace
            ? chromo.scaleToGenome.invert(domain[0])
            : chromo.startPoint;
        let domainEnd =
          domain[1] < chromo.endPlace && domain[1] >= chromo.startPlace
            ? chromo.scaleToGenome.invert(domain[1])
            : chromo.endPoint;
        let rangeWidth =
          scaleX(chromo.scaleToGenome(domainEnd)) -
          scaleX(chromo.scaleToGenome(domainStart));
        let xxScale = d3
          .scaleLinear()
          .domain([domainStart, domainEnd])
          .range([0, rangeWidth]);
        let tickCount = d3.max([Math.floor(rangeWidth / 40), 2]);
        let ticks = xxScale.ticks(tickCount);
        ticks[ticks.length - 1] = xxScale.domain()[1];
        let magnitudeText = magnitude(domainEnd - domainStart);
        let magnitudeDistance =
          (magnitude(domainEnd - domainStart) * rangeWidth) /
          (domainEnd - domainStart);
        let magnitudeLegendPoints = [
          0,
          -3,
          0,
          0,
          magnitudeDistance,
          0,
          magnitudeDistance,
          -3,
        ];
        const axisX = d3
          .axisBottom(xxScale)
          .tickSize(6)
          .tickValues(ticks)
          .tickFormat(d3.format("~s"));

        d3.select(this).call(axisX);

        d3.select(this)
          .append("text")
          .attr("class", "label-chromosome")
          .attr(
            "transform",
            (e, j) =>
              `translate(${[rangeWidth / 2, -axisHeight + 1.3 * fontSize]})`
          )
          .attr("dy", 0.3 * fontSize)
          .attr("fill", chromo.color)
          .text((e, j) => chromo.chromosome);

        d3.select(this)
          .append("circle")
          .attr("class", "circle-chromosome")
          .attr(
            "transform",
            (e, j) =>
              `translate(${[rangeWidth / 2, -axisHeight + 1.3 * fontSize]})`
          )
          .attr("stroke", chromo.color)
          .attr("r", fontSize);

        d3.select(this)
          .selectAll(".tick > text")
          .attr("transform", "rotate(45)")
          .style("text-anchor", "start");
        d3.select(this)
          .append("text")
          .attr("class", "label-magnitude")
          .attr("text-anchor", "middle")
          .attr(
            "transform",
            (e, j) =>
              `translate(${[rangeWidth / 2, -axisHeight - 1 * fontSize]})`
          )
          .text((e, j) => d3.format(".1s")(magnitudeText));
        d3.select(this)
          .append("polyline")
          .attr("class", "line-magnitude")
          .attr(
            "transform",
            (e, j) =>
              `translate(${[
                (rangeWidth - magnitudeDistance) / 2,
                -axisHeight - 0.5 * fontSize,
              ]})`
          )
          .attr("points", (e, j) => magnitudeLegendPoints);
      });

    xAxisContainer
      .attr(
        "transform",
        (d) =>
          `translate(${[d3.max([scaleX(chromoBins[d].startPlace), 0]), 0]})`
      )
      .each(function (d, i) {
        let chromo = chromoBins[d];
        let domain = scaleX.domain();
        let domainStart =
          domain[0] < chromo.endPlace && domain[0] >= chromo.startPlace
            ? chromo.scaleToGenome.invert(domain[0])
            : chromo.startPoint;
        let domainEnd =
          domain[1] < chromo.endPlace && domain[1] >= chromo.startPlace
            ? chromo.scaleToGenome.invert(domain[1])
            : chromo.endPoint;
        let rangeWidth =
          scaleX(chromo.scaleToGenome(domainEnd)) -
          scaleX(chromo.scaleToGenome(domainStart));
        let xxScale = d3
          .scaleLinear()
          .domain([domainStart, domainEnd])
          .range([0, rangeWidth]);
        let tickCount = d3.max([Math.floor(rangeWidth / 40), 2]);
        let ticks = xxScale.ticks(tickCount);
        ticks[ticks.length - 1] = xxScale.domain()[1];
        let magnitudeText = magnitude(domainEnd - domainStart);
        let magnitudeDistance =
          (magnitude(domainEnd - domainStart) * rangeWidth) /
          (domainEnd - domainStart);
        let magnitudeLegendPoints = [
          0,
          -3,
          0,
          0,
          magnitudeDistance,
          0,
          magnitudeDistance,
          -3,
        ];
        const axisX = d3
          .axisBottom(xxScale)
          .tickSize(6)
          .tickValues(ticks)
          .tickFormat(d3.format("~s"));

        d3.select(this).call(axisX);

        d3.select(this)
          .selectAll(".tick > text")
          .attr("transform", "rotate(45)")
          .style("text-anchor", "start");
        d3.select(this)
          .select("text.label-chromosome")
          .attr(
            "transform",
            (e, j) =>
              `translate(${[rangeWidth / 2, -axisHeight + 1.3 * fontSize]})`
          );
        d3.select(this)
          .select("circle.circle-chromosome")
          .attr(
            "transform",
            (e, j) =>
              `translate(${[rangeWidth / 2, -axisHeight + 1.3 * fontSize]})`
          );
        d3.select(this)
          .select("text.label-magnitude")
          .attr(
            "transform",
            (e, j) =>
              `translate(${[rangeWidth / 2, -axisHeight - 1 * fontSize]})`
          )
          .text((e, j) => d3.format(".2s")(magnitudeText));
        d3.select(this)
          .select("polyline.line-magnitude")
          .attr(
            "transform",
            (e, j) =>
              `translate(${[
                (rangeWidth - magnitudeDistance) / 2,
                -axisHeight - 0.5 * fontSize,
              ]})`
          )
          .attr("points", (e, j) => magnitudeLegendPoints);
      });

    xAxisContainer.exit().remove();
  }

  renderSeparators() {
    let { scaleX, axisWidth, axisHeight, chromoBins } = this.props;

    let data = Object.keys(chromoBins).filter(
      (d) =>
        scaleX(chromoBins[d].startPlace) <= axisWidth &&
        scaleX(chromoBins[d].startPlace) >= 0
    );

    let separatorsContainer = d3
      .select(this.container)
      .select(".separators-container")
      .selectAll("g.chromo-separator")
      .data(data, (d, i) => `chromo-${d}`);

    separatorsContainer
      .enter()
      .append("g")
      .attr("class", (d) => `chromo-separator chromo-${d}`)
      .attr(
        "transform",
        (d) => `translate(${[scaleX(chromoBins[d].startPlace), 0]})`
      )
      .append("line")
      .attr("y2", axisHeight)
      .attr("stroke", (d) => chromoBins[d].color);

    separatorsContainer.attr(
      "transform",
      (d) => `translate(${[scaleX(chromoBins[d].startPlace), 0]})`
    );

    separatorsContainer.exit().remove();
  }

  render() {
    const { showY, axisWidth, axisHeight, gap } = this.props;
    return (
      <Wrapper
        className="axis axis-container"
        ref={(elem) => (this.container = elem)}
      >
        <defs>
          <clipPath id="cutt-off-clip">
            <rect
              x={0}
              y={-3 * axisHeight}
              width={axisWidth}
              height={6 * axisHeight}
            />
          </clipPath>
        </defs>
        {showY && (
          <g
            className="axis--y y-axis-container"
            transform={`translate(${[gap, 0]})`}
          ></g>
        )}
        <g
          clipPath=""
          className="axis--x x-axis-container"
          transform={`translate(${[gap, axisHeight]})`}
        ></g>
        <g
          clipPath="url(#cutt-off-clip)"
          className="separators-container"
          transform={`translate(${[gap, 0]})`}
        ></g>
      </Wrapper>
    );
  }
}
Grid.propTypes = {
  scaleX: PropTypes.func.isRequired,
  scaleY: PropTypes.func.isRequired,
  axisHeight: PropTypes.number.isRequired,
  axisWidth: PropTypes.number.isRequired,
  chromoBins: PropTypes.object.isRequired,
  showY: PropTypes.bool,
};
Grid.defaultProps = {
  gap: 0,
  fontSize: 10,
  showY: true,
};
const mapDispatchToProps = (dispatch) => ({});
const mapStateToProps = (state) => ({
  chromoBins: state.App.chromoBins,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(Grid));
