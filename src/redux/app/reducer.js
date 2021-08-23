import actions from "./actions";
import { domainsToLocation, deconflictDomains } from "../../helpers/utility";

const initState = {
  loading: false,
  selectedCoordinate: null,
  defaultGeography: [],
  genomeLength: 0,
  defaultDomain: [],
  domains: [],
  datafile: {filename: "", file:"", tags: [], plots: [], reference: ""},
  strainsList: [],
  chromoBins: {},
  coordinates: [],
  geography: [],
  tags: [],
  plots: [],
  geographyHash: {},
  legendPinned: true
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
    case actions.PLOTS_UPDATED:
      return { ...state, plots: action.plots };
    case actions.LEGEND_PINNED:
      return { ...state, legendPinned: action.legendPinned };
    case actions.DOMAINS_UPDATED:      
      let doms = deconflictDomains(action.domains)
      let url = new URL(decodeURI(document.location));
      let params = new URLSearchParams(url.search);
      let newURL = `${url.origin}/?file=${params.get("file")}&location=${domainsToLocation(state.chromoBins, doms)}`; 
      window.history.replaceState(newURL, 'Pan Genome Viewer', newURL);
      return { ...state, domains: doms };
    default:
      return state;
  }
}
