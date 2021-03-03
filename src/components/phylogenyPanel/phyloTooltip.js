import { Tooltip } from "phylocanvas";
import * as d3 from "d3";

class PhyloTooltip extends Tooltip {

    constructor(tree, options) {
      super(tree, options);
      this.element.style.background = 'rgba(97, 97, 97, 0.9)';
      this.element.style.color = '#fff';
      this.element.style.cursor = 'pointer';
      this.element.style.padding = '8px';
      this.element.style.marginTop = '16px';
      this.element.style.borderRadius = '2px';
      this.element.style.textAlign = 'center';
      this.element.style.fontFamily = this.tree.font || 'sans-serif';
      this.element.style.fontSize = '10px';
      this.element.style.fontWeight = '500';
    }

    createContent(node) {
      let box = d3.select(this.element).append('div').attr("class", "tooltip-box");
      box.append("p").attr("class", "header").html(`${node.id} - ${node.data.strain} - ${node.data.clade}`);
      let tbody = box.append("table").append("tbody");
      let tr = tbody.append("tr");
      tr.append("th").text("Total Branch Length");
      tr.append("td").text(node.totalBranchLength);


      //.html(`ads ${node.getChildProperties('id').length} children`);
      //const textNode = document.createTextNode(`${node.getChildProperties('id').length} children`);
      //this.element.appendChild(textNode);
    }
  }

  export default PhyloTooltip;