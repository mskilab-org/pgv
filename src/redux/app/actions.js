const actions = {
  GET_SETTINGS: "GET_SETTINGS",
  SETTINGS_RECEIVED: "SETTINGS_RECEIVED",
  UPDATE_COORDINATES: "UPDATE_COORDINATES",
  COORDINATES_UPDATED: "COORDINATES_UPDATED",
  UPDATE_VISIBILITY: "UPDATE_VISIBILITY",
  VISIBILITY_UPDATED: "VISIBILITY_UPDATED",
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
  })
};

export default actions;
