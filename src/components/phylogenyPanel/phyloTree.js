import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { withTranslation } from "react-i18next";
import * as d3 from "d3";
import Phylocanvas, { Tooltip } from "phylocanvas";
import PhyloTooltip from "./phyloTooltip";
import scalebarPlugin from "phylocanvas-plugin-scalebar";
import contextMenuPlugin, {
  DEFAULT_MENU_ITEMS,
  DEFAULT_BRANCH_MENU_ITEMS,
  DEFAULT_FILENAMES,
} from "phylocanvas-plugin-context-menu";

Phylocanvas.plugin(scalebarPlugin);
Phylocanvas.plugin(contextMenuPlugin);

const margins = {
  padding: 10
};

const pixelRatio = window.devicePixelRatio || 2.0;

class PhyloTree extends Component {
  container = null;
  tree = null;

  constructor(props) {
    super(props);
    this.state = { selectedNodes: []};
  }

  componentDidMount() {
    this.tree = Phylocanvas.createTree(this.container, {
      contextMenu: {
        menuItems: DEFAULT_MENU_ITEMS,
        branchMenuItems: DEFAULT_BRANCH_MENU_ITEMS,
        unstyled: false,
        className: "",
        parent: this.container,
        filenames: DEFAULT_FILENAMES,
      },
      scalebar: {
        active: true,
        width: 100,
        height: 20,
        fillStyle: "#808080",
        strokeStyle: "#808080",
        lineWidth: 1,
        fontFamily: "Arial",
        fontSize: 8 * pixelRatio,
        textBaseline: "bottom",
        textAlign: "center",
        digits: 2,
        position: {
          bottom: 0,
          right: 0,
        },
      },
    });
    this.tree.tooltip = new PhyloTooltip(this.tree);
  }

  componentDidUpdate(prevProps, prevState) {
    const {newickString, samples, height } = this.props;
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
    this.tree.setNodeSize(3 * pixelRatio);
    this.tree.setTextSize(8 * pixelRatio);
    this.tree.setSize((this.props.width - 2 * margins.padding) / pixelRatio, ((height || this.tree.leaves.length * 12) / pixelRatio));
    
    this.tree.adjustForPixelRatio();
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
    this.tree.draw(true);
    
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
