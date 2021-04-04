import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import * as d3 from "d3";
import appActions from "../../redux/app/actions";

const { updateDomain } = appActions;

const margins = {
  legend: {
    padding: 24,
    height: 60,
    bar: 30,
    style: { fill: "steelblue", stroke: "black", fillOpacity: 0.8 },
  },
  chromoBox: { fillOpacity: 0.66 },
  chromoText: { textAnchor: "middle", fill: "white" },
  brush: {gap: 5, defaultLength: 100}
};

class Legend extends Component {

  componentDidMount() {
    const { chromoBins } = this.props;

    let stageWidth = this.props.width - 2 * margins.legend.padding;
    let stageHeight = margins.legend.height;
    
    this.brush = d3.brushX()
    .extent([[0,margins.brush.gap], [stageWidth, stageHeight - margins.brush.gap]])
    
    d3.select(this.container)
    .append("g")
    .attr("class", "brush-container")
    .attr("transform", `translate(${[margins.legend.padding,0]})`)
    .call(this.brush);
    
  }

  componentDidUpdate() {
    const { defaultDomain, domain, updateDomain } = this.props;
    let stageWidth = this.props.width - 2 * margins.legend.padding;

    let genomeScale = d3
      .scaleLinear()
      .domain(defaultDomain)
      .range([0, stageWidth]);

    this.brush
    .on("brush end", (event) => {
      const selection = event.selection;
      if (!event.sourceEvent || !selection) return;
      const [from, to] = selection.map(genomeScale.invert).map(Math.floor);
 
      updateDomain(from, to);
    });

    d3.select(this.container).select("g.brush-container")
    .call(this.brush)
    .call(this.brush.move, domain.map(genomeScale))
    .call(g => g.select(".overlay")
        .datum({type: "selection"})
        .on("mousedown touchstart", (event) => {
          const dx = margins.brush.defaultLength; // Use a fixed width when recentering.
          const [[cx]] = d3.pointers(event);
          const [x0, x1] = [cx - dx / 2, cx + dx / 2];
          const [X0, X1] = [0, stageWidth];
          d3.select(this.container).select("g.brush-container")
              .call(this.brush.move, x1 > X1 ? [X1 - dx, X1] 
                  : x0 < X0 ? [X0, X0 + dx] 
                  : [x0, x1]);
              }
        ));
  }

  render() {
    const { width, defaultDomain, chromoBins } = this.props;
    if (!chromoBins) {
      return null;
    }
    let stageWidth = width - 2 * margins.legend.padding;
    let stageHeight = margins.legend.height;
    let genomeScale = d3
      .scaleLinear()
      .domain(defaultDomain)
      .range([0, stageWidth]);

    return (
        <div className="ant-wrapper">
          <svg ref={(elem) => (this.container = elem)} width={width} height={stageHeight} className="legend-container">
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
  domain: PropTypes.array,
  defaultDomain: PropTypes.array,
  width: PropTypes.number.isRequired,
};
Legend.defaultProps = {
  chromoBins: {},
  genomeLength: 0,
  width: 400,
};
const mapDispatchToProps = (dispatch) => ({
  updateDomain: (from, to) => dispatch(updateDomain(from,to))
});
const mapStateToProps = (state) => ({
  domain: state.App.domain,
  defaultDomain: state.App.defaultDomain,
  chromoBins: state.App.chromoBins,
});
export default connect(mapStateToProps, mapDispatchToProps)(Legend);