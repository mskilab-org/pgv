import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { withTranslation } from "react-i18next";
///import * as d3 from "d3";
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
        fillStyle: "#3C7483",
        strokeStyle: "#3C7483",
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
    const pixelRatio = window.devicePixelRatio || 1.0;
    const geographyHash = {};
    geography.forEach((d, i) => (geographyHash[d.id] = d));

    //this.tree.setSize(this.props.width, this.props.height);
    this.tree.load(newickString, () => console.log("tree loaded"));
    this.tree.on("beforeFirstDraw", () => {
      this.tree.leaves.forEach((leaf, i) => {
        leaf.data = strainsList.find((d,i) => +d.sid === +leaf.id);
        if (leaf.data && leaf.data.strain) {
          leaf.label = leaf.data.strain;
        }
        leaf.data = leaf.data || {};
        leaf.data.geography = geographyHash[leaf.data && leaf.data.gid] || {};
        leaf.setDisplay({colour: geographyHash[leaf.data.gid] ? geographyHash[leaf.data && leaf.data.gid].fill : "#333"});
      });
    });
    this.tree.lineWidth = 1.2;
    this.tree.fillCanvas = true;
    this.tree.showInternalNodeLabels = true;
    this.tree.branchColour = "#3C7483";
    this.tree.selectedColour = "#FF7F0E";
    this.tree.setTreeType("rectangular");
    this.tree.highlightColour = "#FF7F0E";
    this.tree.highlightWidth = 2;
    this.tree.padding = margins.padding;
    this.tree.zoomFactor = 2;
    this.tree.setNodeSize(5);
    this.tree.setTextSize(11);
    this.tree.setSize((this.props.width - 2 * margins.padding) / pixelRatio, (this.tree.leaves.length * 10) / pixelRatio);
    this.tree.draw();
    this.tree.adjustForPixelRatio();
    this.tree.disableZoom = true;
    this.tree.tooltip = new PhyloTooltip(this.tree);
    this.tree.on("mousemove", (e) => {
      var node = this.tree.getNodeAtMousePosition(e);
      if (node) {
        //console.log(node);
        this.tree.tooltip.open(e.clientX, e.clientY, node);
      }
    });
    window.pc = this.tree;
  }

  render() {
    const { t } = this.props;

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
