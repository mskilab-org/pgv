import actions from "./actions";

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
  return { genomeLength, chromoBins };
}

const initState = {
  loading: false,
  selectedCoordinate: null,
  defaultGeography: [],
  genomeLength: 0,
  chromoBins: {},
  coordinates: [],
  geography: [],
  geographyHash: {},
  panels: {phylogeny: {}, pca: {}, genes: {}, geography: {}, anatomy: {}}
};

export default function appReducer(state = initState, action) {
  let {geographyHash, geography} = state;
  switch (action.type) {
    case actions.GET_SETTINGS:
      return { ...state, loading: true };
    case actions.SETTINGS_RECEIVED:
      let selectedCoordinate = action.settings.coordinates.default;
      let { genomeLength, chromoBins } = updateChromoBins(
        action.settings.coordinates.sets[selectedCoordinate]
      );
      geographyHash = {};
      action.settings.geography.forEach((d, i) => (geographyHash[d.id] = d));
      return {
        ...state,
        genomeLength,
        chromoBins,
        selectedCoordinate,
        coordinates: action.settings.coordinates,
        defaultGeography: action.settings.geography,
        geography: action.settings.geography,
        geographyHash: geographyHash,
        panels: action.settings.panels,
        loading: false,
      };
    case actions.UPDATE_COORDINATES:
      return { ...state, loading: true };
    case actions.COORDINATES_UPDATED:
      let updatedBins = updateChromoBins(
        state.coordinates.sets[action.coordinate]
      );
      return {
        ...state,
        genomeLength: updatedBins.genomeLength,
        chromoBins: updatedBins.chromoBins,
        selectedCoordinate: action.coordinate,
        loading: false,
      };
    case actions.UPDATE_VISIBILITY:
      return { ...state, loading: true };
    case actions.VISIBILITY_UPDATED:
      let panels = { ...state.panels };
      panels[action.panel].visible = action.visible;
      return { ...state, panels: panels, loading: false };
    case actions.GET_GEOGRAPHY:
      return { ...state, loading: true };
    case actions.GEOGRAPHY_RECEIVED:
      geography = action.geography || state.defaultGeography;
      geographyHash = {};
      geography.forEach((d, i) => (geographyHash[d.id] = d));
      return { ...state, geography, file: action.file, geographyHash, loading: false };
    case actions.GET_DEPENDENCIES:
      return { ...state, loading: true };
    case actions.DEPENDENCIES_RECEIVED:
      return { ...state, loading: false };
    default:
      return state;
  }
}
