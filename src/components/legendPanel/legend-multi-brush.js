import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import * as d3 from "d3";
import Fragment from "./fragment";
import appActions from "../../redux/app/actions";

const { updateDomains } = appActions;

const margins = {
  legend: {
    padding: 24,
    height: 60,
    bar: 30,
    style: { fill: "steelblue", stroke: "black", fillOpacity: 0.8 },
  },
  chromoBox: { fillOpacity: 0.66 },
  chromoText: { textAnchor: "middle", fill: "white" },
  brush: { gap: 10, defaultLength: 100 },
};

class LegendMultiBrush extends Component {
  fragments = [];
  activeId = null;

  constructor(props) {
    super(props);
    //keep track of existing brushes
    this.brushes = [];
    const { width, defaultDomain } = this.props;

    this.stageWidth = width - 2 * margins.legend.padding;
    this.stageHeight = margins.legend.height;
    this.brushesHeight = margins.legend.bar + 2 * margins.brush.gap;

    this.genomeScale = d3
      .scaleLinear()
      .domain(defaultDomain)
      .range([0, this.stageWidth]);

    // Execute the delete operation
    d3.select("html").on("keyup", (e) => {
      if (
        (e.keyCode === 46 || e.keyCode === 8) &&
        this.fragments.filter((d) => d.selection).length > 1
      ) {
        this.fragments = this.fragments.filter(
          (fragment) => fragment.id !== this.activeId
        );
        let visibleFragments = this.fragments.filter((d) => d.selection);
        this.activeId =
          visibleFragments.length > 0
            ? visibleFragments[visibleFragments.length - 1].id
            : null;
        this.update();
      }
    });
  }

  createDefaults(domain) {
    this.createBrush();
    let fragment = this.fragments[this.fragments.length - 1];
    this.update();
    fragment = d3
      .select(this.container)
      .select("#brush-" + fragment.id)
      .datum();
    fragment.domain = domain;
    fragment.selection = [
      this.genomeScale(fragment.domain[0]),
      this.genomeScale(fragment.domain[1]),
    ];
    d3.select(this.container)
      .select("#brush-" + fragment.id)
      .call(fragment.brush.move, fragment.selection);
    this.update();
    this.createBrush();
    this.update();
    this.activeId = fragment.id;
    d3.select(this.container).selectAll(".brush").classed("highlighted", false);
    d3.select(this.container)
      .select("#brush-" + fragment.id)
      .classed("highlighted", true);
  }

  createBrush = () => {
    var self = this;
    var brush = d3
      .brushX()
      .extent([
        [0, 0],
        [this.stageWidth, this.brushesHeight],
      ])
      .on("start", function (event) {
        // brush starts here
        self.originalSelection = event.selection;
      })
      .on("brush", function (event) {
        // brushing happens here

        // ignore brush-by-zoom
        if (event.sourceEvent && event.sourceEvent.type === "zoom") return;

        // Only transition after input.
        if (!event || !event.sourceEvent || event.sourceEvent.type === "brush")
          return;

        let fragment = d3.select(this).datum();
        self.activeId = d3.select(this).datum().id;
        let originalSelection = fragment.selection;
        let currentSelection = event.selection;
        let selection = Object.assign([], currentSelection);
        let node;

        // read the current state of all the self.fragments before you start checking on collisions
        self.otherSelections = self.fragments
          .filter((d, i) => d.selection !== null && d.id !== self.activeId)
          .map((d, i) => {
            node = d3.select("#brush-" + d.id).node();
            return node && d3.brushSelection(node);
          });

        // calculate the lower allowed selection edge this brush can move
        let lowerEdge = d3.max(
          self.otherSelections
            .filter((d, i) => d && d.selection !== null)
            .filter(
              (d, i) =>
                originalSelection &&
                d[0] <= originalSelection[0] &&
                originalSelection[0] <= d[1]
            )
            .map((d, i) => d[1])
        );

        // calculate the upper allowed selection edge this brush can move
        let upperEdge = d3.min(
          self.otherSelections
            .filter((d, i) => d && d.selection !== null)
            .filter(
              (d, i) =>
                originalSelection &&
                d[1] >= originalSelection[0] &&
                originalSelection[1] <= d[1]
            )
            .map((d, i) => d[0])
        );

        // if there is an upper edge, then set this to be the upper bound of the current selection
        if (upperEdge !== undefined && selection[1] >= upperEdge) {
          selection[1] = upperEdge;
          selection[0] = d3.min([selection[0], upperEdge - 1]);
        }

        // if there is a lower edge, then set this to the be the lower bound of the current selection
        if (lowerEdge !== undefined && selection[0] <= lowerEdge) {
          selection[0] = lowerEdge;
          selection[1] = d3.max([selection[1], lowerEdge + 1]);
        }

        // move the brush to stay within the allowed bounded selection zone
        if (
          selection !== undefined &&
          selection !== null &&
          selection[1] !== selection[0]
        ) {
          fragment.selection = selection;
          d3.select(this).call(fragment.brush.move, selection);
        }
        fragment.domain = selection
          .map(self.genomeScale.invert)
          .map(Math.floor);
        // finally, update the chart with the selection in question
        self.update();
      })
      .on("end", function (event) {
        // ignore brush-by-zoom
        if (event.sourceEvent && event.sourceEvent.type === "zoom") return;

        // Only transition after input.
        if (!event.sourceEvent) return;

        // Ignore empty selections.
        if (!event.selection) return;

        // Figure out if our latest brush has a selection
        let lastBrushID = self.fragments[self.fragments.length - 1].id;
        let lastBrush = d3.select("#brush-" + lastBrushID).node();
        let selection = lastBrush && d3.brushSelection(lastBrush);

        // If it does, that means we need another one
        if (selection && selection[0] !== selection[1]) {
          self.createBrush();
        }

        self.activeId = d3.select(this).datum().id;

        // finally, update the chart with the selection in question
        self.update();
      });

    this.fragments.push(new Fragment(brush));
  };

  update = () => {
    // draw the brushes
    this.renderBrushes();

    this.props.updateDomains(
      this.fragments
        .filter((d) => d.selection)
        .map((d) => d.domain)
        .sort((a, b) => d3.ascending(a[0], b[0]))
    );
  };

  renderBrushes = () => {
    var self = this;

    let brushSelection = d3
      .select(this.container)
      .select(".brushes")
      .selectAll(".brush")
      .data(this.fragments, (d, i) => d.id);

    // Set up new brushes
    brushSelection
      .enter()
      .insert("g", ".brush")
      .attr("class", "brush")
      .attr("id", (d, i) => "brush-" + d.id)
      .each(function (fragment) {
        //call the brush
        d3.select(this).call(fragment.brush);
      });

    // update the brushes
    brushSelection.each(function (fragment) {
      d3.select(this)
        .attr("class", "brush")
        .classed("highlighted", (d, i) => d.id === self.activeId)
        .selectAll(".overlay")
        .style("pointer-events", (d, i) => {
          let brush = fragment.brush;
          if (
            fragment.id === self.fragments[self.fragments.length - 1].id &&
            brush !== undefined
          ) {
            return "all";
          } else {
            return "none";
          }
        });
    });

    // exit the brushes
    brushSelection.exit().remove();
  };

  componentDidMount() {
    const { domains } = this.props;
    domains.map((d) => this.createDefaults(d));
  }

  shouldComponentUpdate(nextProps) {
    return (
      (nextProps &&
        nextProps.domains.toString() !== this.props.domains.toString())
    );
  }

  componentDidUpdate() {}

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
        <svg
          ref={(elem) => (this.container = elem)}
          width={width}
          height={stageHeight}
          className="legend-container"
        >
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
            <g
              className="brushes"
              transform={`translate(${[0, -margins.brush.gap]})`}
            ></g>
          </g>
        </svg>
      </div>
    );
  }
}
LegendMultiBrush.propTypes = {
  chromoBins: PropTypes.object,
  domain: PropTypes.array,
  defaultDomain: PropTypes.array,
  width: PropTypes.number.isRequired,
};
LegendMultiBrush.defaultProps = {
  width: 400,
};
const mapDispatchToProps = (dispatch) => ({
  updateDomains: (domains) => dispatch(updateDomains(domains)),
});
const mapStateToProps = (state) => ({
  domains: state.App.domains,
  chromoBins: state.App.chromoBins,
  defaultDomain: state.App.defaultDomain,
});
export default connect(mapStateToProps, mapDispatchToProps)(LegendMultiBrush);
