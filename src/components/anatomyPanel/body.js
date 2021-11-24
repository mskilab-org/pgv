import React, { Component } from "react";
import { PropTypes } from "prop-types";
import * as d3 from "d3";
import { Tooltip } from "react-svg-tooltip";

const colors = {
  selectedColour: "#79b321",
  highlightColour: "#79b321",
  normal: "#808080"
}

class Body extends Component {
  state = {
    highlightedIndex: null,
  };

  handleMouseEnter = (index) => {
    this.setState({ highlightedIndex: index });
  };

  handleMouseLeave = (index) => {
    this.setState({ highlightedIndex: null });
  };

  onSVGClick = (e) => { 
    if (e.target.className.baseVal !== "location") {
      this.props.onNodeClick(this.props.nodes.map(e => {return {id: e.id, selected: false}}))
    }
  }

  render() {
    const { locations, width, figure, height, nodes, highlightedNodes, onNodeClick } = this.props;
    const { highlightedIndex } = this.state;
    const circleRefArray = locations.map((d, i) => React.createRef());
    let markedNodes = nodes.filter(d => d.selected).map(d => d.id);
    
    return (
      <svg
        {...Object.assign({}, figure.props, { width, height, onClick: this.onSVGClick })}>
        {[...figure.props.children, <g>
          {locations.map((d, i) => (
            <g key={i}>
              <circle
                className="location"
                ref={circleRefArray[i]}
                cx={+figure.props.width.replaceAll('px', '') * d.x}
                cy={+figure.props.height.replaceAll('px', '') * d.y}
                r={10}
                fill={highlightedIndex === i || markedNodes.includes(d.sample) ? colors.highlightColour : d3.rgb(colors.normal)}
                fillOpacity={0.75}
                stroke={
                  highlightedIndex === i
                    ? d3.rgb(colors.highlightColour).darker()
                    : d3.rgb(colors.normal).darker()
                }
                strokeWidth={2}
                strokeOpacity={0.75}
                onMouseEnter={() => this.handleMouseEnter(i)}
                onMouseLeave={() => this.handleMouseLeave(i)}
                onClick={(e) => {
                  let allNodes = nodes;
                  if (nodes.length < 1) {
                    allNodes = locations.map(k => {return {id: k.sample, selected: false}})
                  }
                  if (e.ctrlKey || e.metaKey) {
                    onNodeClick(allNodes.map(k => {return {id: k.id, selected: k.selected || k.id === d.sample}}))
                  } else {
                    onNodeClick(allNodes.map(k => {return {id: k.id, selected: k.id === d.sample}}));
                  }
                  
                }}
              />
              <circle
                className="location-highlight"
                cx={+figure.props.width.replaceAll('px', '') * d.x}
                cy={+figure.props.height.replaceAll('px', '') * d.y}
                r={highlightedNodes.includes(d.sample) ? 24 : 0}
                fill={"transparent"}
                stroke={
                  highlightedNodes.includes(d.sample)
                    ? d3.rgb(colors.highlightColour)
                    : "transparent"
                }
                strokeWidth={8}
                strokeOpacity={0.75}
              />
              <Tooltip triggerRef={circleRefArray[i]}>
                <rect
                  x={20}
                  y={-20}
                  width={50}
                  height={40}
                  rx={5}
                  ry={5}
                  fill="rgb(97, 97, 97)"
                  fillOpacity={0.97}
                />
                <text x={30} y={8} fontSize={24} fill="#FFF">
                  {d.sample}
                </text>
              </Tooltip>
            </g>
          ))}
        </g>]}
      </svg>
    );
  }
}
Body.propTypes = {
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  locations: PropTypes.array,
};
Body.defaultProps = {
  locations: [],
};
export default Body;
