import { Tooltip } from "phylocanvas";
import * as d3 from "d3";
import i18n from "../../i18n";

class PhyloTooltip extends Tooltip {
  constructor(tree, options) {
    super(tree, options);
    this.element.style.background = "rgba(97, 97, 97, 0.9)";
    this.element.style.color = "#fff";
    this.element.style.cursor = "pointer";
    this.element.style.padding = "8px";
    this.element.style.marginTop = "16px";
    this.element.style.borderRadius = "2px";
    this.element.style.textAlign = "left";
    this.element.style.fontFamily = this.tree.font || "sans-serif";
  }

  createContent(node) {
    let box = d3
      .select(this.element)
      .append("div")
      .attr("class", "tooltip-box");

    box.append("p")
      .attr("class", "header")
      .text(node.data.strain);

    let fieldValues = [
      [i18n.t("common:components.phylogeny-panel.tooltip.id"), node.id],
      [i18n.t("common:components.phylogeny-panel.tooltip.branch-length"), d3.format(".2s")(node.branchLength)],
      [i18n.t("common:components.phylogeny-panel.tooltip.total-branch-length"), d3.format(".2s")(node.totalBranchLength)],
      [i18n.t("common:components.phylogeny-panel.tooltip.strain"), node.data.strain || "N/A"],
      [i18n.t("common:components.phylogeny-panel.tooltip.clade"), node.data.clade || "N/A"],
      [i18n.t("common:components.phylogeny-panel.tooltip.location"), (node.data.geography && node.data.geography.title) || "N/A"],
      [i18n.t("common:components.phylogeny-panel.tooltip.country"), (node.data.geography && node.data.geography.code) || "N/A"],
    ];
    box.append("table").attr("class", "content").append("tbody");

    let tableData = d3.select(this.element).select("tbody")
      .selectAll("tr")
      .data(fieldValues)
      .enter()
      .append("tr");

    tableData.append("td").html((d, i) => `<strong>${d[0]}</strong>: ${d[1]}`);
  }
}

export default PhyloTooltip;
