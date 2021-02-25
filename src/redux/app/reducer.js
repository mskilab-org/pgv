import actions from "./actions";
import * as d3 from "d3";

function updateChromoBins(coordinateSet) {
  let genomeLength = coordinateSet.reduce(
    (acc, elem) => acc + elem.endPoint,
    0
  );
  let boundary = 0;
  let chromoBins = coordinateSet.reduce((hash, element) => {
    let chromo = element;
    chromo.length = chromo.endPoint;
    chromo.startPlace = boundary;
    hash[element.chromosome] = chromo;
    boundary += chromo.length;
    return hash;
  }, {});
  return {genomeLength, chromoBins}
}

export default function appReducer(state = {}, action) {
  switch (action.type) {
    case actions.GET_SETTINGS:
      return { ...state, loading: true };
    case actions.SETTINGS_RECEIVED:
      let selectedCoordinate = action.settings.coordinates.default;
      let {genomeLength, chromoBins} = updateChromoBins(action.settings.coordinates.sets[selectedCoordinate]);
      return { ...state, genomeLength, chromoBins, selectedCoordinate, coordinates: action.settings.coordinates, panels: action.settings.panels, loading: false };
    case actions.GET_DATAFILES:
      return { ...state, loading: true };
    case actions.DATAFILES_RECEIVED:
      let files = action.datafiles.map((d, i) => {
        return { filename: d.filename, file: d.filename.replace(".json", ""), tags: d.description.split(";") };
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
    case actions.GET_GENOME:
      return { ...state, loading: true };
    case actions.GENOME_RECEIVED:
      const datafile = state.datafiles.find(d => d.file === action.file);
      return { ...state, datafile, genome: action.genome, file: action.file, loading: false };
    case actions.UPDATE_COORDINATES:
      return { ...state, loading: true };
    case actions.COORDINATES_UPDATED:
      let updatedBins = updateChromoBins(state.coordinates.sets[action.coordinate]);
      return { ...state, genomeLength: updatedBins.genomeLength, chromoBins: updatedBins.chromoBins, selectedCoordinate: action.coordinate, loading: false };
    case actions.UPDATE_VISIBILITY:
      return { ...state, loading: true };
    case actions.VISIBILITY_UPDATED:
      let panels = {...state.panels};
      panels[action.panel].visible = action.visible;
      return { ...state, panels: panels, loading: false}
    default:
      return state;
  }
}
