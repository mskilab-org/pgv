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
    if (!this.props.newickString) {
      return;
    }

    //this.tree.setSize(this.props.width, this.props.height);
    this.tree.load(this.props.newickString, () => console.log("tree loaded"));

    this.tree.lineWidth = 1.2;
    this.tree.fillCanvas = true;
    this.tree.showInternalNodeLabels = true;
    //this.tree.adjustForPixelRatio();
    this.tree.branchColour = "#3C7483";
    this.tree.selectedColour = "#FF7F0E";
    this.tree.setTreeType("rectangular");
    this.tree.highlightColour = "#FF7F0E";
    this.tree.highlightWidth = 2;
    this.tree.padding = 10;
    this.tree.zoomFactor = 2;
    this.tree.setNodeSize(5);
    this.tree.setTextSize(11);
    this.tree.setSize(this.props.width - 20, this.tree.leaves.length * 6);
    this.tree.draw();

    this.tree.on("mousewheel", (e) => {
      //console.log(this.tree.zoom);
      if (this.tree.zoom < 1) {
        this.tree.fitInPanel();
      }
    });
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
};
PhyloTree.defaultProps = {};
export default withTranslation("common")(PhyloTree);
