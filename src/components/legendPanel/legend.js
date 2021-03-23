import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import * as d3 from "d3";

const margins = {
  legend: {
    padding: 24,
    height: 60,
    bar: 30,
    style: { fill: "steelblue", stroke: "black", fillOpacity: 0.8 },
  },
  chromoBox: { fillOpacity: 0.66 },
  chromoText: { textAnchor: "middle", fill: "white" },
};

class Legend extends Component {
  render() {
    const { width, genomeLength, chromoBins } = this.props;
    if (!chromoBins) {
      return null;
    }
    let stageWidth = width - 2 * margins.legend.padding;
    let stageHeight = margins.legend.height;
    let genomeScale = d3
      .scaleLinear()
      .domain([1, genomeLength])
      .range([0, stageWidth]);

    return (
        <div className="ant-wrapper">
          <svg width={width} height={stageHeight} className="legend-container">
            <g
              className="chromo-legend"
              transform={`translate(${[
                margins.legend.padding,
                0.5 * (stageHeight - margins.legend.bar),
              ]})`}
            >
              <rect
                className="legend-bar"
                width={stageWidth}
                height={margins.legend.bar}
                {...margins.legend.style}
              />
              <g className="chromo-legend-container">
                {Object.values(chromoBins).map((d, i) => (
                  <g
                    key={i}
                    className="chromo-container"
                    transform={`translate(${[genomeScale(d.startPlace), 0]})`}
                  >
                    <rect
                      className="chromo-box"
                      width={genomeScale(d.endPoint)}
                      height={margins.legend.bar}
                      fill={d3.rgb(d.color)}
                      stroke={d3.rgb(d.color).darker(1)}
                      {...margins.chromoBox}
                    />
                    <text
                      className="chromo-text"
                      dx={genomeScale(d.endPoint) / 2}
                      dy={0.62 * margins.legend.bar}
                      {...margins.chromoText}
                    >
                      {d.chromosome}
                    </text>
                  </g>
                ))}
              </g>
            </g>
          </svg>
        </div>
    );
  }
}
Legend.propTypes = {
  chromoBins: PropTypes.object,
  genomeLength: PropTypes.number,
  width: PropTypes.number.isRequired,
};
Legend.defaultProps = {
  chromoBins: {},
  genomeLength: 0,
  width: 400,
};
const mapDispatchToProps = {};
const mapStateToProps = (state) => ({
  genomeLength: state.App.genomeLength,
  chromoBins: state.App.chromoBins,
});
export default connect(mapStateToProps, mapDispatchToProps)(Legend);