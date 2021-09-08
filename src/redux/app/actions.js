const actions = {
  GET_GEOGRAPHY: "GET_GEOGRAPHY",
  GEOGRAPHY_RECEIVED: "GEOGRAPHY_RECEIVED",
  DOMAINS_UPDATED: "DOMAINS_UPDATED",
  LAUNCH_APP: "LAUNCH_APP",
  LAUNCH_APP_SUCCESS: "LAUNCH_APP_SUCCESS",
  LAUNCH_APP_FAILED: "LAUNCH_APP_FAILED",
  PLOTS_UPDATED: "PLOTS_UPDATED",
  LEGEND_PIN_UPDATED: "LEGEND_PIN_UPDATED",
  RENDER_OUTSIDE_VIEWPORT_UPDATED: "RENDER_OUTSIDE_VIEWPORT_UPDATED",
  PHYLOGENY_NODES_SELECTED: "PHYLOGENY_NODES_SELECTED",
  launchApp: () => ({
    type: actions.LAUNCH_APP,
  }),
  getGeography: (file) => ({
    type: actions.GET_GEOGRAPHY,
    file: file
  }),
  updateDomains: (domains) => ({
    type: actions.DOMAINS_UPDATED,
    domains
  }),
  updatePlots: (plots) => ({
    type: actions.PLOTS_UPDATED,
    plots
  }),
  updateLegendPin: (legendPinned) => ({
    type: actions.LEGEND_PIN_UPDATED,
    legendPinned
  }),
  updateRenderOutsideViewport: (renderOutsideViewPort) => ({
    type: actions.RENDER_OUTSIDE_VIEWPORT_UPDATED,
    renderOutsideViewPort
  }),
  selectPhylogenyNodes: (nodeIds) => ({
    type: actions.PHYLOGENY_NODES_SELECTED,
    nodeIds
  })
};

export default actions;
