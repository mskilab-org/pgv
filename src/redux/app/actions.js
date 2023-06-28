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
  ADD_BIGWIG_PLOT: "ADD_BIGWIG_PLOT",
  BIGWIG_PLOT_ADDED: "BIGWIG_PLOT_ADDED",
  HOVERED_LOCATION_UPDATED: "HOVERED_LOCATION_UPDATED",
  ZOOM_BY_CMD_ENABLED: "ZOOM_BY_CMD_ENABLED",
  GLOBAL_BIGWIG_Y_SCALE_ENABLED: "GLOBAL_BIGWIG_Y_SCALE_ENABLED",
  launchApp: (files, selectedTags) => ({
    type: actions.LAUNCH_APP,
    files,
    selectedTags,
  }),
  updateDomains: (domains) => ({
    type: actions.DOMAINS_UPDATED,
    domains,
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
  updateZoomedByCmd: (zoomedByCmd) => ({
    type: actions.ZOOM_BY_CMD_ENABLED,
    zoomedByCmd,
  }),
  updateGlobalBigwigYScale: (globalBigwigYScale) => ({
    type: actions.GLOBAL_BIGWIG_Y_SCALE_ENABLED,
    globalBigwigYScale,
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
  addBigwigPlot: (uuid) => ({
    type: actions.ADD_BIGWIG_PLOT,
    uuid,
  }),
  updateHoveredLocation: (hoveredLocation, hoveredLocationPanelIndex) => ({
    type: actions.HOVERED_LOCATION_UPDATED,
    hoveredLocation,
    hoveredLocationPanelIndex,
  }),
};

export default actions;
