import actions from "./actions";
import * as d3 from "d3";
import { domainsToLocation, cluster } from "../../helpers/utility";

const initState = {
  loading: false,
  selectedCoordinate: null,
  genomeLength: 0,
  defaultDomain: [],
  domains: [],
  datafile: { filename: "", file: "", tags: [], plots: [], reference: "" },
  chromoBins: {},
  coordinates: [],
  tags: [],
  plots: [],
  nodes: [],
  phylogenyPanelHeight: 200,
  selectedConnectionIds: [],
  connectionsAssociations: [],
  selectedConnectionsRange: [],
  highlightedNodes: [],
  legendPinned: true,
  genesPinned: false,
  phylogenyPinned: false,
  renderOutsideViewPort: false,
  samples: {}
};

export default function appReducer(state = initState, action) {
  switch (action.type) {
    case actions.LAUNCH_APP:
      return { ...state, loading: true };
    case actions.LAUNCH_APP_SUCCESS:
      return { ...state, ...action.properties, loading: false };
    case actions.LAUNCH_APP_FAILED:
      return { ...state, missingDataFiles: true, loading: false };
    case actions.PLOTS_UPDATED:
      let genesPlot = action.plots.find(d => d.type === "genes");
      let phylogenyPlot = action.plots.find(d => d.type === "phylogeny");
      let genesPinnedState = genesPlot && genesPlot.visible ? state.genesPinned : false;
      let phylogenyPinnedState = phylogenyPlot && phylogenyPlot.visible ? state.phylogenyPinned : false;
      return { ...state, plots: action.plots, genesPinned: genesPinnedState, phylogenyPinned: phylogenyPinnedState};
    case actions.LEGEND_PIN_UPDATED:
      return { ...state, legendPinned: action.legendPinned };
    case actions.GENES_PIN_UPDATED:
      return { ...state, genesPinned: action.genesPinned };
    case actions.PHYLOGENY_PIN_UPDATED:
      return { ...state, phylogenyPinned: action.phylogenyPinned };
    case actions.RENDER_OUTSIDE_VIEWPORT_UPDATED:
      return { ...state, renderOutsideViewPort: action.renderOutsideViewPort };
    case actions.PHYLOGENY_NODES_HIGHLIGHTED:
      return { ...state, highlightedNodes: action.nodes };
    case actions.PHYLOGENY_PANEL_HEIGHT_UPDATED:
      return { ...state, phylogenyPanelHeight: action.phylogenyPanelHeight };
    case actions.PHYLOGENY_NODES_SELECTED:
      let matchedConnectionIds = action.nodes
        .filter((node) => node.selected)
        .map((node) =>
          state.connectionsAssociations
            .filter((e) => e.sample === node.id)
            .map((e) => e.connections)
        )
        .filter((d) => d.length > 0)
        .flat();
      let selectedConnectionIds =
        matchedConnectionIds.length > 0
          ? matchedConnectionIds.reduce((p, c) =>
              p.filter((e) => c.includes(e))
            )
          : [];
      let unmatchedConnectionIds = action.nodes
        .filter((node) => !node.selected)
        .map((node) =>
          state.connectionsAssociations
            .filter((e) => e.sample === node.id)
            .map((e) => e.connections)
        )
        .filter((d) => d.length > 0)
        .flat();
      selectedConnectionIds =
        unmatchedConnectionIds.length > 0
          ? selectedConnectionIds.filter(
              (x) => !unmatchedConnectionIds.flat().includes(x)
            )
          : selectedConnectionIds;
      let selectedNodes = action.nodes.filter((node) => node.selected);
      let selectedConnectionsRange = [];
      if (selectedNodes.length > 0 && selectedConnectionIds.length > 0) {
        let selectedNode = selectedNodes[0];
        let selectedPlot = state.plots.find(
          (d) => d.sample === selectedNode.id && d.type === "genome"
        );
        let selectedIntervals = selectedConnectionIds
          .map((e) => selectedPlot.data.connections.find((d) => d.cid === e))
          .map((d) =>
            [Math.abs(d.source), Math.abs(d.sink)]
              .map((k) =>
                selectedPlot.data.intervals.filter((e) => e.iid === k)
              )
              .flat()
          )
          .flat();
        let annottated = selectedIntervals.map((d) => {
          return {
            startPlace: d3.max([
              state.chromoBins[d.chromosome].startPlace + d.startPoint - 1e3,
              1,
            ]),
            endPlace: d3.min([
              state.chromoBins[d.chromosome].startPlace + d.endPoint + 1e3,
              state.genomeLength,
            ]),
          };
        });
        selectedConnectionsRange = cluster(annottated, state.genomeLength);
      }
      return {
        ...state,
        nodes: action.nodes,
        selectedConnectionIds,
        selectedConnectionsRange,
      };
    case actions.DOMAINS_UPDATED:
      let doms = action.domains;
      let url = new URL(decodeURI(document.location));
      let params = new URLSearchParams(url.search);
      let newURL = `${url.origin}/?file=${params.get(
        "file"
      )}&location=${domainsToLocation(state.chromoBins, doms)}`;
      window.history.replaceState(newURL, "Pan Genome Viewer", newURL);
      return { ...state, domains: doms };
    default:
      return state;
  }
}
