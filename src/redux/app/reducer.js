import actions from "./actions";
import * as d3 from "d3";

export default function appReducer(state = {}, action) {
  switch (action.type) {
    case actions.GET_SETTINGS:
      return { ...state, loading: true };
    case actions.SETTINGS_RECEIVED:
      let selectedCoordinate = action.settings.coordinates.default;
      let selectedCoordinateSet = action.settings.coordinates.sets[selectedCoordinate]
      let genomeLength = selectedCoordinateSet.reduce(
        (acc, elem) => acc + elem.endPoint,
        0
      );
      let boundary = 0;
      let chromoBins = selectedCoordinateSet.reduce((hash, element) => {
        let chromo = element;
        chromo.length = chromo.endPoint;
        chromo.startPlace = boundary;
        hash[element.chromosome] = chromo;
        boundary += chromo.length;
        return hash;
      }, {});
      return { ...state, genomeLength, selectedCoordinate, coordinates: action.settings.coordinates, chromoBins, loading: false };
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
      let newSelectedCoordinate = action.coordinate;
      let newSelectedCoordinateSet = state.coordinates.sets[newSelectedCoordinate]
      let newGenomeLength = newSelectedCoordinateSet.reduce(
        (acc, elem) => acc + elem.endPoint,
        0
      );
      let newBoundary = 0;
      let newChromoBins = newSelectedCoordinateSet.reduce((hash, element) => {
        let chromo = element;
        chromo.length = chromo.endPoint;
        chromo.startPlace = newBoundary;
        hash[element.chromosome] = chromo;
        newBoundary += chromo.length;
        return hash;
      }, {});
      return { ...state, genomeLength: newGenomeLength, selectedCoordinate: newSelectedCoordinate, chromoBins: newChromoBins, loading: false };
    default:
      return state;
  }
}
