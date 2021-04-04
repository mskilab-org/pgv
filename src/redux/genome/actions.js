const actions = {
  GET_DATAFILES: "GET_DATAFILES",
  DATAFILES_RECEIVED: "DATAFILES_RECEIVED",
  DATAFILES_FAILED: "DATAFILES_FAILED",
  GET_GENOME: "GET_GENOME",
  GENOME_RECEIVED: "GENOME_RECEIVED",
  GET_COVERAGEDATA: "GET_COVERAGEDATA",
  COVERAGEDATA_RECEIVED: "COVERAGEDATA_RECEIVED",
  getDatafiles: () => ({
    type: actions.GET_DATAFILES,
  }),
  getGenome: (file) => ({
    type: actions.GET_GENOME,
    file: file
  }),
  getCoverageData: (file) => ({
    type: actions.GET_COVERAGEDATA,
    file: file
  }),
};

export default actions;
