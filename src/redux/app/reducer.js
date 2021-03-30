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
    chromo.startPlace = boundary + chromo.startPoint;
    chromo.endPlace = boundary + chromo.endPoint;
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
  defaultDomain: [],
  domain: null,
  chromoBins: {},
  coordinates: [],
  geography: [],
  genes: [],
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
        defaultDomain: [1, genomeLength],
        domain: state.domain || [1, genomeLength],
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
        defaultDomain: [1, updatedBins.genomeLength],
        domain: [1, updatedBins.genomeLength],
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
    case actions.GET_GENES:
      return { ...state, loading: true };
    case actions.GENES_RECEIVED:
      return { ...state, genes: action.genes, loading: false };
    case actions.DOMAIN_UPDATED:
      let url = new URL(decodeURI(document.location));
      let params = new URLSearchParams(url.search);
      params.set("from", +action.from);
      params.set("to", +action.to);
      let newURL = `${url.origin}/?${params.toString()}`; 
      window.history.replaceState(newURL, 'Pan Genome Viewer', newURL);
      return { ...state, domain: [+action.from, +action.to] };
    default:
      return state;
  }
}
