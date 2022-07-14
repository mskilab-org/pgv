const actions = {
  DOMAINS_UPDATED: "DOMAINS_UPDATED",
  LAUNCH_APP: "LAUNCH_APP",
  LAUNCH_APP_SUCCESS: "LAUNCH_APP_SUCCESS",
  LAUNCH_APP_FAILED: "LAUNCH_APP_FAILED",
  PLOTS_UPDATED: "PLOTS_UPDATED",
  LEGEND_PIN_UPDATED: "LEGEND_PIN_UPDATED",
  GENES_PIN_UPDATED: "GENES_PIN_UPDATED",
  PHYLOGENY_PIN_UPDATED: "PHYLOGENY_PIN_UPDATED",
  RENDER_OUTSIDE_VIEWPORT_UPDATED: "RENDER_OUTSIDE_VIEWPORT_UPDATED",
  PHYLOGENY_NODES_SELECTED: "PHYLOGENY_NODES_SELECTED",
  PHYLOGENY_NODES_HIGHLIGHTED: "PHYLOGENY_NODES_HIGHLIGHTED",
  PHYLOGENY_PANEL_HEIGHT_UPDATED: "PHYLOGENY_PANEL_HEIGHT_UPDATED",
  HIGLASS_LOADED: "HIGLASS_LOADED",
  launchApp: (files, selectedTags) => ({
    type: actions.LAUNCH_APP,
    files,
    selectedTags,
  }),
  updateDomains: (domains, mode = null) => ({
    type: actions.DOMAINS_UPDATED,
    domains,
    mode,
  }),
  updatePlots: (plots) => ({
    type: actions.PLOTS_UPDATED,
    plots,
  }),
  updateLegendPin: (legendPinned) => ({
    type: actions.LEGEND_PIN_UPDATED,
    legendPinned,
  }),
  updateGenesPin: (genesPinned) => ({
    type: actions.GENES_PIN_UPDATED,
    genesPinned,
  }),
  updatePhylogenyPin: (phylogenyPinned) => ({
    type: actions.PHYLOGENY_PIN_UPDATED,
    phylogenyPinned,
  }),
  updateRenderOutsideViewport: (renderOutsideViewPort) => ({
    type: actions.RENDER_OUTSIDE_VIEWPORT_UPDATED,
    renderOutsideViewPort,
  }),
  selectPhylogenyNodes: (nodes) => ({
    type: actions.PHYLOGENY_NODES_SELECTED,
    nodes,
  }),
  highlightPhylogenyNodes: (nodes) => ({
    type: actions.PHYLOGENY_NODES_HIGHLIGHTED,
    nodes,
  }),
  updatePhylogenyPanelHeight: (phylogenyPanelHeight) => ({
    type: actions.PHYLOGENY_PANEL_HEIGHT_UPDATED,
    phylogenyPanelHeight,
  }),
};

export default actions;
