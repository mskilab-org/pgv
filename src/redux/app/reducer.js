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
  nodes: [],
  selectedConnectionIds: [],
  connectionsAssociations: [],
  geographyHash: {},
  legendPinned: true,
  renderOutsideViewPort: false
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
    case actions.LEGEND_PIN_UPDATED:
      return { ...state, legendPinned: action.legendPinned };
    case actions.RENDER_OUTSIDE_VIEWPORT_UPDATED:
      return { ...state, renderOutsideViewPort: action.renderOutsideViewPort };
    case actions.PHYLOGENY_NODES_SELECTED:
      let matchedConnectionIds = action.nodes.filter(node => node.selected).map(node => state.connectionsAssociations.filter(e => e.sample === node.id).map(e => e.connections)).filter(d => d.length > 0).flat();
      let selectedConnectionIds = matchedConnectionIds.length > 0 ? matchedConnectionIds.reduce((p,c) => p.filter(e => c.includes(e))) : []; 
      let unmatchedConnectionIds = action.nodes.filter(node => !node.selected).map(node => state.connectionsAssociations.filter(e => e.sample === node.id).map(e => e.connections)).filter(d => d.length > 0).flat();
      selectedConnectionIds = unmatchedConnectionIds.length > 0 ? selectedConnectionIds.filter(x => !unmatchedConnectionIds.flat().includes(x)) : selectedConnectionIds; 
      return { ...state, nodes: action.nodes, selectedConnectionIds };
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
