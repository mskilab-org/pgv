const actions = {
  GET_DATAFILES: "GET_DATAFILES",
  DATAFILES_RECEIVED: "DATAFILES_RECEIVED",
  DATAFILES_FAILED: "DATAFILES_FAILED",
  GET_GENOME: "GET_GENOME",
  GENOME_RECEIVED: "GENOME_RECEIVED",
  getDatafiles: () => ({
    type: actions.GET_DATAFILES,
  }),
  getGenome: (file) => ({
    type: actions.GET_GENOME,
    file: file
  })
};

export default actions;
