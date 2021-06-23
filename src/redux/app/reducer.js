import actions from "./actions";

const initState = {
  loading: false,
  selectedCoordinate: null,
  defaultGeography: [],
  genomeLength: 0,
  defaultDomain: [],
  domain: null,
  datafile: {filename: "", file:"", tags: [], plots: [], reference: ""},
  strainsList: [],
  chromoBins: {},
  coordinates: [],
  geography: [],
  tags: [],
  plots: [],
  geographyHash: {},
  eventSource: null,
  panels: {phylogeny: {}, pca: {}, genes: {}, geography: {}, anatomy: {}, coverage: {}, rpkm: {}}
};

export default function appReducer(state = initState, action) {
  let {geographyHash, geography} = state;
  switch (action.type) {
    case actions.LAUNCH_APP:
      return { ...state, loading: true};
    case actions.LAUNCH_APP_SUCCESS:
      return { ...state, ...action.properties, loading: false };  
    case actions.LAUNCH_APP_FAILED:
      return { ...state, missingDataFiles: true, loading: false };
    case actions.GET_GEOGRAPHY:
      return { ...state, loading: true };
    case actions.GEOGRAPHY_RECEIVED:
      geography = action.geography || state.defaultGeography;
      geographyHash = {};
      geography.forEach((d, i) => (geographyHash[d.id] = d));
      return { ...state, geography, file: action.file, geographyHash, loading: false };
    case actions.DOMAIN_UPDATED:
      if (true || action.shouldChangeHistory) {
        let url = new URL(decodeURI(document.location));
        let params = new URLSearchParams(url.search);
        params.set("from", +action.from);
        params.set("to", +action.to);
        let newURL = `${url.origin}/?${params.toString()}`; 
        window.history.replaceState(newURL, 'Pan Genome Viewer', newURL);
      }
      return { ...state, shouldChangeHistory: action.shouldChangeHistory, eventSource: action.eventSource, domain: [+action.from, +action.to] };
    default:
      return state;
  }
}
