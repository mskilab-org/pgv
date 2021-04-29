const actions = {
  GET_SETTINGS: "GET_SETTINGS",
  SETTINGS_RECEIVED: "SETTINGS_RECEIVED",
  UPDATE_COORDINATES: "UPDATE_COORDINATES",
  COORDINATES_UPDATED: "COORDINATES_UPDATED",
  UPDATE_VISIBILITY: "UPDATE_VISIBILITY",
  VISIBILITY_UPDATED: "VISIBILITY_UPDATED",
  GET_GEOGRAPHY: "GET_GEOGRAPHY",
  GEOGRAPHY_RECEIVED: "GEOGRAPHY_RECEIVED",
  GET_DEPENDENCIES: "GET_DEPENDENCIES",
  DEPENDENCIES_RECEIVED: "DEPENDENCIES_RECEIVED",
  GET_GENES: "GET_GENES",
  GENES_RECEIVED: "GENES_RECEIVED",
  DOMAIN_UPDATED: "DOMAIN_UPDATED",
  LAUNCH_APP: "LAUNCH_APP",
  LAUNCH_APP_SUCCESS: "LAUNCH_APP_SUCCESS",
  LAUNCH_APP_FAILED: "LAUNCH_APP_FAILED",
  launchApp: () => ({
    type: actions.LAUNCH_APP,
  }),
  getSettings: () => ({
    type: actions.GET_SETTINGS,
  }),
  updateCoordinates: (coordinate) => ({
    type: actions.UPDATE_COORDINATES,
    coordinate: coordinate
  }),
  updateVisibility: (panel, visible) => ({
    type: actions.UPDATE_VISIBILITY,
    panel: panel,
    visible: visible
  }),
  getGeography: (file) => ({
    type: actions.GET_GEOGRAPHY,
    file: file
  }),
  getDependencies: (file) => ({
    type: actions.GET_DEPENDENCIES,
    file: file
  }),
  getGenes: (coordinate) => ({
    type: actions.GET_GENES,
    coordinate: coordinate
  }),
  updateDomain: (from, to) => ({
    type: actions.DOMAIN_UPDATED,
    from: from,
    to: to
  })
};

export default actions;
