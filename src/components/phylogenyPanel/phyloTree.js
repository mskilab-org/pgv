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

const newickString =
  "(((((((((2111:0.0132004,2100:0.0124094):0.00189451,684:0.0147268):0.000353252,(996:0.0149102,1327:0.014325):0.00056004):9.42737e-05,((2359:0.0141286,422:0.0139684):0.000548672,(936:0.0149728,1316:0.0140564):0.000617456):0.000385663):0.000166222,((1872:0.0153727,891:0.0137107):0.000237675,((1255:0.0127089,976:0.0136137):0.000587787,(975:0.0132533,2367:0.013718):0.000838381):0.000318072):0.000263619):7.71881e-05,((2387:0.0147911,387:0.0139887):0.000450893,(37:0.0173755,1332:0.0140003):0.00074744):0.00028287):0.000208791,((((((2354:0.01473,951:0.0146571):0.000726049,2314:0.0139242):0.000184345,(1252:0.0132202,920:0.0142596):0.00114475):4.16311e-05,1854:0.0152054):0.000221864,(((1093:0.0141566,2060:0.0140704):0.000969077,1302:0.0145814):0.000285373,373:0.0139092):0.000542941):0.000117155,(((((((((1449:0.0142791,1038:0.0139046):0.000454378,1053:0.0152157):0.000157541,((2205:0.0138455,1076:0.0140241):0.000779503,(177:0.014693,2080:0.0142277):0.00111656):0.000434563):0.000237199,(200:0.0142373,198:0.0151281):0.000404852):0.000129861,(((1070:0.0141267,1046:0.014382):0.000671689,1097:0.0134853):0.000340146,240:0.0152299):0.000328385):0.000168991,2276:0.0152347):0.000152986,((((((290:0.0131048,258:0.0123755):0.000350107,260:0.0125034):0.000298603,(493:0.0141574,533:0.0131168):0.000665299):6.84028e-05,((((276:0.012614,619:0.0125318):0.000131278,299:0.0122367):0.000694859,1498:0.0131416):0.000156088,((((1626:0.0125987,629:0.0119863):0.000419012,606:0.0124775):0.000250456,((1482:0.0123901,485:0.0119254):0.000474215,262:0.0135178):0.000449027):0.000158808,(542:0.0119502,1475:0.0121283):0.000826445):0.000158129):0.00018994):0.000117042,497:0.0136736):0.000288139,289:0.0135807):0.00157973):6.45714e-05,((655:0.0145047,2147:0.0133865):0.00021289,(1971:0.0125848,1944:0.0114937):0.00122581):0.00100977):0.000231758,2082:0.015079):0.000348801):0.000199304):5.23283e-05,(((((116:0.0187541,68:0.0189825):0.00056034,(((((((((2427:0.0176553,765:0.0181081):0.000460569,767:0.0183304):0.00050949,(798:0.0191113,1173:0.0181643):0.000711585):0.000201467,(772:0.0178535,751:0.0185122):0.00113782):0.000428096,((1754:0.0186478,1175:0.0178494):0.000871655,1178:0.0183207):0.000545512):9.21246e-05,64:0.019269):0.000107686,(((((1783:0.0186698,124:0.0186607):0.000450568,809:0.0193786):0.000405896,1734:0.0192978):5.76293e-05,(((753:0.0180118,44:0.0186169):0.000426407,(1217:0.0183276,1674:0.0174357):0.000738666):0.000136171,(2423:0.0185865,1777:0.0182395):0.00098782):0.000258365):0.000170529,16:0.0204205):0.000196886):0.00043631,2458:0.0186496):0.000117215,(1664:0.0196402,1151:0.0181513):0.00053751):0.000676967):0.000567187,111:0.0185741):0.000575075,12:0.0168174):0.000651088,57:0.0197144):0.00110813):0.00014561,((943:0.0127794,2306:0.0143542):0.000738124,1310:0.014839):0.00014561);";

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
    //this.tree.setSize(this.props.width, this.props.height);
    this.tree.load(newickString, () => console.log("tree loaded"));

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
      console.log(this.tree.zoom);
      if (this.tree.zoom < 1) {
        this.tree.fitInPanel();
      }
    });
    this.tree.disableZoom = true;
    this.tree.tooltip = new PhyloTooltip(this.tree);
    this.tree.on("mousemove", (e) => {
      var node = this.tree.getNodeAtMousePosition(e);
      if (node) {
        console.log(node);
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
