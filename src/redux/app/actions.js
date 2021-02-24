const actions = {
  GET_SETTINGS: "GET_SETTINGS",
  SETTINGS_RECEIVED: "SETTINGS_RECEIVED",
  UPDATE_COORDINATES: "UPDATE_COORDINATES",
  COORDINATES_UPDATED: "COORDINATES_UPDATED",
  UPDATE_VISIBILITY: "UPDATE_VISIBILITY",
  VISIBILITY_UPDATED: "VISIBILITY_UPDATED",
  GET_DATAFILES: "GET_DATAFILES",
  DATAFILES_RECEIVED: "DATAFILES_RECEIVED",
  GET_GENOME: "GET_GENOME",
  GENOME_RECEIVED: "GENOME_RECEIVED",
  UPDATE_NAVIGATION: "UPDATE_NAVIGATION",
  NAVIGATION_UPDATED: "NAVIGATION_UPDATED",
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
  getDatafiles: () => ({
    type: actions.GET_DATAFILES,
  }),
  getGenome: (file) => ({
    type: actions.GET_GENOME,
    file: file
  }),
  updateNavigation: (currentPage) => ({
    type: actions.UPDATE_NAVIGATION,
    currentPage: currentPage
  })
};

export default actions;
