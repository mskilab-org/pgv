import React, { Component } from "react";
import { PropTypes } from "prop-types";
import * as d3 from "d3";
import Points from "./points";

import Wrapper from "./index.style";

class ScatterPlot extends Component {

  regl = null;
  container = null;

  componentDidMount() {
    const regl = require("regl")({
      extensions: ['ANGLE_instanced_arrays'],
      container: this.container,
      pixelRatio:  window.devicePixelRatio || 1.5,
      attributes: {antialias: true, depth: false, stencil: true}
    });

    regl.cache = {};
    this.regl = regl;

    this.regl.clear({
      color: [0, 0, 0, 0],
      stencil: true
    });
    this.points = new Points(this.regl);
    this.updateStage();
  }

  componentDidUpdate(prevProps, prevState) {
    this.regl.clear({
      color: [0, 0, 0, 0],
      depth: false
    });

    this.regl.poll();

    this.updateStage();
  }

  componentWillUnmount(){
    if(this.regl){
      this.regl.destroy();
    }
  }

  updateStage() {
    let { width, height, results} = this.props;
    
    this.regl.poll();
    let dataPointsY = results.getColumn('y').toArray();
    let yExtent = d3.extent(dataPointsY);
    let dataPointsColor = results.getColumn('color').toArray();
    let dataPointsX = results.getColumn('x').toArray();
    let xExtent = d3.extent(dataPointsX); //[1, genomeLength]
    this.points.load(width, height, 2, dataPointsX, dataPointsY, dataPointsColor, xExtent, yExtent);
    this.points.render();
  }

  render() {
    const { t, width, height } = this.props;
    return (
      <Wrapper>
        <div
          className="scatterplot"
          style={{ width: width, height: height }}
          ref={(elem) => (this.container = elem)}
        />
      </Wrapper>
    );
  }
}
ScatterPlot.propTypes = {
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
};
ScatterPlot.defaultProps = {};
export default ScatterPlot;
