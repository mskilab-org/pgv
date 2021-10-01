import actions from "./actions";
import { domainsToLocation, cluster } from "../../helpers/utility";

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
  selectedConnectionsRange: [],
  geographyHash: {},
  legendPinned: true,
  genesPinned: false,
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
    case actions.GENES_PIN_UPDATED:
        return { ...state, genesPinned: action.genesPinned };
    case actions.RENDER_OUTSIDE_VIEWPORT_UPDATED:
      return { ...state, renderOutsideViewPort: action.renderOutsideViewPort };
    case actions.PHYLOGENY_NODES_SELECTED:
      let matchedConnectionIds = action.nodes.filter(node => node.selected).map(node => state.connectionsAssociations.filter(e => e.sample === node.id).map(e => e.connections)).filter(d => d.length > 0).flat();
      let selectedConnectionIds = matchedConnectionIds.length > 0 ? matchedConnectionIds.reduce((p,c) => p.filter(e => c.includes(e))) : []; 
      let unmatchedConnectionIds = action.nodes.filter(node => !node.selected).map(node => state.connectionsAssociations.filter(e => e.sample === node.id).map(e => e.connections)).filter(d => d.length > 0).flat();
      selectedConnectionIds = unmatchedConnectionIds.length > 0 ? selectedConnectionIds.filter(x => !unmatchedConnectionIds.flat().includes(x)) : selectedConnectionIds; 
      let selectedNodes = action.nodes.filter(node => node.selected);
      let selectedConnectionsRange = [];
      if (selectedNodes.length > 0) {
        let selectedNode = selectedNodes[0];
        let selectedPlot = state.plots.find(d => d.sample === selectedNode.id && d.type === "genome");
        let selectedIntervals = selectedConnectionIds.map(e => selectedPlot.data.connections.find(d => d.cid === e)).map(d => [Math.abs(d.source), Math.abs(d.sink)].map(k => selectedPlot.data.intervals.filter(e => e.iid === k)).flat()).flat();
        let annottated = selectedIntervals.map(d => {return {startPlace: (state.chromoBins[d.chromosome].startPlace + d.startPoint), endPlace: state.chromoBins[d.chromosome].startPlace + d.endPoint}});
        selectedConnectionsRange = cluster(annottated, state.genomeLength);
      }
      
      return { ...state, nodes: action.nodes, selectedConnectionIds, selectedConnectionsRange };
    case actions.DOMAINS_UPDATED:      
      let doms = action.domains;
      let url = new URL(decodeURI(document.location));
      let params = new URLSearchParams(url.search);
      let newURL = `${url.origin}/?file=${params.get("file")}&location=${domainsToLocation(state.chromoBins, doms)}`; 
      window.history.replaceState(newURL, 'Pan Genome Viewer', newURL);
      return { ...state, domains: doms };
    default:
      return state;
  }
}
