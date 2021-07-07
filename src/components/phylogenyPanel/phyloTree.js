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

class PhyloTree extends Component {
  container = null;
  tree = null;

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
        fontFamily: "Sans-serif",
        fontSize: 16,
        textBaseline: "bottom",
        textAlign: "center",
        digits: 2,
        position: {
          bottom: 10,
          right: 10,
        },
      },
    });
  }

  componentDidUpdate(prevProps, prevState) {
    const {newickString, strainsList, geography} = this.props;
    if (!newickString) {
      return;
    }
    const pixelRatio = window.devicePixelRatio || 2.0;
    const geographyHash = {};
    geography.forEach((d, i) => (geographyHash[d.id] = d));

    this.tree.load(newickString);
    this.tree.on("beforeFirstDraw", () => {
      this.tree.leaves.forEach((leaf, i) => {
        leaf.data = strainsList.find((d,i) => +d.sid === +leaf.id);
        if (leaf.data && leaf.data.strain) {
          leaf.label = leaf.data.strain;
        }
        leaf.data = leaf.data || {};
        leaf.data.geography = geographyHash[leaf.data && leaf.data.gid] || {};
        leaf.setDisplay({
          leafStyle: {
            strokeStyle: geographyHash[leaf.data.gid] ? d3.rgb(geographyHash[leaf.data && leaf.data.gid].fill).darker() : "#808080",
            fillStyle: geographyHash[leaf.data.gid] ? geographyHash[leaf.data && leaf.data.gid].fill : "#808080",
            lineWidth: 2,
          }
        });
      });
    });
    this.tree.lineWidth = 1.2 * pixelRatio;
    this.tree.fillCanvas = true;
    this.tree.showInternalNodeLabels = true;
    this.tree.branchColour = "#808080";
    this.tree.selectedColour = "#FF7F0E";
    this.tree.setTreeType("rectangular");
    this.tree.highlightColour = "#FF7F0E";
    this.tree.highlightWidth = 2;
    this.tree.padding = margins.padding;
    this.tree.zoomFactor = 1;
    this.tree.setNodeSize(3 * pixelRatio);
    this.tree.setTextSize(8 * pixelRatio);
    this.tree.setSize((this.props.width - 2 * margins.padding) / pixelRatio, (this.tree.leaves.length * 10) / pixelRatio);
    this.tree.draw();
    this.tree.adjustForPixelRatio();
    this.tree.disableZoom = true;
    this.tree.tooltip = new PhyloTooltip(this.tree);
    this.tree.on("mousemove", (e) => {
      var node = this.tree.getNodeAtMousePosition(e);
      if (node) {
        this.tree.tooltip.open(e.clientX, e.clientY, node);
      }
    });
    this.tree.on("click", (e) => {
      var node = this.tree.getNodeAtMousePosition(e);
      if (node) {
        this.props.onNodeClick(node.id);
        this.tree.tooltip.close();
      }
    });
    // to trigger the redrawing
    d3.select(".phylocanvas").node().click();
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
  strainsList: PropTypes.array,
  geography: PropTypes.array
};
PhyloTree.defaultProps = {
  strainsList: [],
  geography: []
};
export default withTranslation("common")(PhyloTree);
