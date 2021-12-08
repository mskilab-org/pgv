import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { withTranslation } from "react-i18next";
import * as d3 from "d3";
import Phylocanvas, { Tooltip } from "phylocanvas";
import PhyloTooltip from "./phyloTooltip";

const margins = {
  padding: 2
};

class PhyloTree extends Component {
  container = null;
  tree = null;

  constructor(props) {
    super(props);
    this.state = { selectedNodes: []};
  }

  componentDidMount() {
    this.tree = Phylocanvas.createTree(this.container, {
    });
    this.tree.tooltip = new PhyloTooltip(this.tree);
  }

  componentDidUpdate(prevProps, prevState) {
    const {newickString, samples, width, height } = this.props;
    let pixelRatio = window.devicePixelRatio || 2.0;
    if (!newickString) {
      return;
    }

    let selectedNodes = this.props.nodes.filter(d => d.selected).map(d => d.id);
    let previousSelectedNodes = prevProps.nodes.filter(d => d.selected).map(d => d.id);
    if (previousSelectedNodes.toString() !== selectedNodes.toString()) {
      this.setState({selectedNodes});
    }

    this.tree.load(newickString);
    this.tree.on("beforeFirstDraw", () => {
      this.tree.leaves.forEach((leaf, i) => {
        leaf.data = samples[leaf.id];
        if (leaf.data && leaf.data.sample) {
          leaf.label = leaf.data.sample;
        }
        leaf.highlighted = this.props.highlightedNodes.includes(leaf.id);
        leaf.data = leaf.data || {};
        leaf.selected = this.state.selectedNodes.includes(leaf.id); 
      });
    });

    this.tree.lineWidth = 1.2 * pixelRatio;
    this.tree.fillCanvas = true;
    this.tree.showInternalNodeLabels = true;
    this.tree.branchColour = "#808080";
    this.tree.internalLabelStyle.textSize = 8 * pixelRatio;
    this.tree.internalLabelStyle.font = "Arial";
    this.tree.selectedColour = "#79b321";
    this.tree.setTreeType("rectangular");
    this.tree.highlightColour = "#79b321";
    this.tree.highlightWidth = 2;
    this.tree.padding = margins.padding;
    this.tree.zoomFactor = 1;
    this.tree.shiftKeyDrag = true;
    this.tree.setNodeSize(4 * pixelRatio);
    this.tree.setTextSize(8 * pixelRatio);
  
    this.tree.disableZoom = true;
    this.tree.on("mousemove", (e) => {
      var node = this.tree.getNodeAtMousePosition(e);
      if (node) {
        this.tree.tooltip.open(e.clientX, e.clientY, node);
      } else {
        this.tree.tooltip.close();
      }
    });
    this.tree.on("click", (e) => {
      this.tree.tooltip.close();
      d3.select(this.container).selectAll(".phylocanvas-tooltip .tooltip-box").remove();
      this.tree.tooltip = new PhyloTooltip(this.tree);
      this.tree.getSelectedNodeIds().toString() !== this.state.selectedNodes.toString() && this.setState({selectedNodes: this.tree.getSelectedNodeIds()}, () => {this.props.onNodeClick(this.tree.leaves.map(d => {return {id: d.id, selected: d.selected}}))});
    });

    this.tree.canvas.canvas.style.height = height + 'px';
    this.tree.canvas.canvas.style.width = (width - margins.padding) + 'px';
    
    this.tree.canvas.canvas.width = (width - margins.padding) * window.devicePixelRatio;
    this.tree.canvas.canvas.height = height * window.devicePixelRatio;
   
    this.tree.highlighters.length = 0;
    if (this.tree.maxBranchLength === 0) {
      this.tree.loadError(new Error('All branches in the tree are identical.'));
      return;
    }
    this.tree.canvas.clearRect(0, 0, this.tree.canvas.canvas.width, this.tree.canvas.canvas.height);
    this.tree.canvas.lineCap = 'round';
    this.tree.canvas.lineJoin = 'round';
    this.tree.canvas.strokeStyle = this.tree.branchColour;
    this.tree.canvas.save();
    this.tree.prerenderer.run(this.tree);
    
    this.tree.canvas.lineWidth = this.tree.lineWidth / this.tree.zoom;
    this.tree.canvas.translate(this.tree.offsetx * pixelRatio, this.tree.offsety * pixelRatio);
    this.tree.canvas.scale(this.tree.zoom, this.tree.zoom);
    this.tree.branchRenderer.render(this.tree, this.tree.root);
    this.tree.highlighters.forEach(render => render());
    this.tree.drawn = true;
    this.tree.canvas.restore();
  }

  render() {
    return (
      <div
        ref={(elem) => (this.container = elem)}
        className="ant-wrapper"
      ></div>
    );
  }
}
PhyloTree.propTypes = {
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  samples: PropTypes.object,
  onNodeClick: PropTypes.func
};
PhyloTree.defaultProps = {
  samples: {}
};
export default withTranslation("common")(PhyloTree);
