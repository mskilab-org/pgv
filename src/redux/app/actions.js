const actions = {
  GET_SETTINGS: "GET_SETTINGS",
  SETTINGS_RECEIVED: "SETTINGS_RECEIVED",
  GET_DATAFILES: "GET_DATAFILES",
  DATAFILES_RECEIVED: "DATAFILES_RECEIVED",
  GET_GENOME: "GET_GENOME",
  GENOME_RECEIVED: "GENOME_RECEIVED",
  getSettings: () => ({
    type: actions.GET_SETTINGS,
  }),
  getDatafiles: () => ({
    type: actions.GET_DATAFILES,
  }),
  getGenome: (file) => ({
    type: actions.GET_GENOME,
    file: file
  })
};

export default actions;
