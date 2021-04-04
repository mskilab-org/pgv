import actions from "./actions";
import * as d3 from "d3";

const initState = {
  loading: false,
  datafiles: [],
  tags: [],
  genome: {},
  file: undefined,
  coverageData: null
};

export default function appReducer(state = initState, action) {
  switch (action.type) {
    case actions.GET_DATAFILES:
      return { ...state, loading: true };
    case actions.DATAFILES_RECEIVED:
      let files = action.datafiles.map((d, i) => {
        return { filename: d.filename, file: d.filename.replace(".json", ""), tags: d.description };
      });
      let tagsAll = files.map((d) => d.tags).flat();
      let tags = [
        ...d3.rollup(
          tagsAll,
          (g) => g.length,
          (d) => d
        ),
      ].sort((a, b) => d3.descending(a[1], b[1]));
      return { ...state, datafiles: files, tags: tags, loading: false };
    case actions.DATAFILES_FAILED:
        return { ...state, datafiles: [], tags: [], missingDataFiles: true, loading: false };
    case actions.GET_GENOME:
      return { ...state, loading: true };
    case actions.GENOME_RECEIVED:
      const datafile = state.datafiles.find(d => d.file === action.file);
      return { ...state, datafile, genome: action.genome, file: action.file, loading: false };
    case actions.GET_COVERAGEDATA:
      return { ...state, loading: true };
    case actions.COVERAGEDATA_RECEIVED:
      const table = action.coverageData
      return { ...state, coverageData: table, file: action.file, loading: false };
    default:
      return state;
  }
}
