const actions = {
  GET_SETTINGS: "GET_SETTINGS",
  SETTINGS_RECEIVED: "SETTINGS_RECEIVED",
  GET_DATAFILES: "GET_DATAFILES",
  DATAFILES_RECEIVED: "DATAFILES_RECEIVED",
  getSettings: () => ({
    type: actions.GET_SETTINGS,
  }),
  getDatafiles: () => ({
    type: actions.GET_DATAFILES,
  })
};

export default actions;
