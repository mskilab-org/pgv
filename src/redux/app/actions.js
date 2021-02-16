const actions = {
  GET_SETTINGS: "GET_SETTINGS",
  SETTINGS_RECEIVED: "SETTINGS_RECEIVED",
  GET_DATAFILES: "GET_DATAFILES",
  DATAFILES_RECEIVED: "DATAFILES_RECEIVED",
  GET_DATA: "GET_DATA",
  DATA_RECEIVED: "DATA_RECEIVED",
  getSettings: () => ({
    type: actions.GET_SETTINGS,
  }),
  getDatafiles: () => ({
    type: actions.GET_DATAFILES,
  }),
  getData: (file) => ({
    type: actions.GET_DATA,
    file: file
  })
};

export default actions;
