const actions = {
  GET_SETTINGS: "GET_SETTINGS",
  SETTINGS_RECEIVED: "SETTINGS_RECEIVED",
  getSettings: () => ({
    type: actions.GET_SETTINGS,
  })
};

export default actions;
