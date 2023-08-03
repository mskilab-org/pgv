import actions from "./actions";
import * as d3 from "d3";
import { domainsToLocation, cluster } from "../../helpers/utility";

const initState = {
  higlassServer: null,
  higlassDatafiles: [],
  higlassGeneFileUUID: [],
  datafiles: [],
  datafilesJSON: null,
  settings: null,
  selectedTags: [],
  filteredTags: [],
  filteredFiles: [],
  selectedFiles: [],
  loading: false,
  genomeLength: 0,
  maxGenomeLength: 4294967296,
  domains: [],
  chromoBins: {},
  tags: [],
  plots: [],
  genes: [],
  genesOptionsList: [],
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
  samples: {},
  files: [],
  hoveredLocation: null,
  zoomedByCmd: true,
  bigwigsYRange: [0, 1],
  globalBigwigYScale: true,
};

export default function appReducer(state = initState, action) {
  switch (action.type) {
    case actions.LAUNCH_APP:
      return {
        ...state,
        loading: true,
        files: action.files,
        selectedTags: action.selectedTags,
      };
    case actions.LAUNCH_APP_SUCCESS:
      return { ...state, ...action.properties, loading: false };
    case actions.LAUNCH_APP_FAILED:
      return { ...state, missingDataFiles: true, loading: false };
    case actions.PLOTS_UPDATED:
      let genesPlot = action.plots.find((d) => d.type === "genes");
      let phylogenyPlot = action.plots.find((d) => d.type === "phylogeny");
      let genesPinnedState =
        genesPlot && genesPlot.visible ? state.genesPinned : false;
      let phylogenyPinnedState =
        phylogenyPlot && phylogenyPlot.visible ? state.phylogenyPinned : false;
      let url = new URL(decodeURI(document.location));
      url.searchParams.set("genes", genesPlot.visible ? 1 : 0);
      window.history.replaceState(
        unescape(url.toString()),
        "Pan Genome Viewer",
        unescape(url.toString())
      );
      action.plots.forEach((d) => {
        d.deleted = d.visible ? false : d.deleted;
      });
      return {
        ...state,
        plots: action.plots,
        genesPinned: genesPinnedState,
        phylogenyPinned: phylogenyPinnedState,
        mode: "brushed",
      };
    case actions.LEGEND_PIN_UPDATED:
      return { ...state, legendPinned: action.legendPinned };
    case actions.GENES_PIN_UPDATED:
      let url1 = new URL(decodeURI(document.location));
      url1.searchParams.set("genesPinned", action.genesPinned ? 1 : 0);
      let newState = {};
      if (action.genesPinned) {
        action.genesPinned &&
          (state.plots.find((d) => d.type === "genes").visible =
            action.genesPinned);
        newState = {
          ...state,
          genesPinned: action.genesPinned,
          plots: state.plots,
        };
      } else {
        newState = { ...state, genesPinned: action.genesPinned };
      }
      url1.searchParams.set(
        "genes",
        state.plots.find((d) => d.type === "genes").visible ? 1 : 0
      );
      window.history.replaceState(
        unescape(url1.toString()),
        "Pan Genome Viewer",
        unescape(url1.toString())
      );
      return newState;
    case actions.PHYLOGENY_PIN_UPDATED:
      if (action.phylogenyPinned) {
        action.phylogenyPinned &&
          (state.plots.find((d) => d.type === "phylogeny").visible =
            action.phylogenyPinned);
        return {
          ...state,
          phylogenyPinned: action.phylogenyPinned,
          plots: state.plots,
        };
      } else {
        return {
          ...state,
          phylogenyPinned: action.phylogenyPinned,
        };
      }
    case actions.RENDER_OUTSIDE_VIEWPORT_UPDATED:
      return { ...state, renderOutsideViewPort: action.renderOutsideViewPort };
    case actions.ZOOM_BY_CMD_ENABLED:
      return { ...state, zoomedByCmd: action.zoomedByCmd };
    case actions.GLOBAL_BIGWIG_Y_SCALE_ENABLED:
      return { ...state, globalBigwigYScale: action.globalBigwigYScale };
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
      // eliminate domains that are smaller than 10 bases wide
      if (doms.length > 1) {
        doms = doms.filter((d) => d[1] - d[0] > 10);
      }
      let url0 = new URL(decodeURI(document.location));
      url0.searchParams.set(
        "location",
        domainsToLocation(state.chromoBins, doms)
      );
      window.history.replaceState(
        unescape(url0.toString()),
        "Pan Genome Viewer",
        unescape(url0.toString())
      );
      return { ...state, domains: doms };
    case actions.HIGLASS_LOADED:
      return { ...state, ...action.properties, loading: false };
    case actions.ADD_BIGWIG_PLOT:
      let newBigwigPlot = {
        sample: null,
        type: "bigwig",
        server: state.higlassServer,
        uuid: action.uuid,
        visible: true,
      };
      return {
        ...state,
        plots: [...state.plots, newBigwigPlot],
        loading: true,
      };
    case actions.BIGWIG_PLOT_ADDED:
      return { ...state, ...action.properties, loading: false };
    case actions.HOVERED_LOCATION_UPDATED:
      return {
        ...state,
        hoveredLocation: action.hoveredLocation,
        hoveredLocationPanelIndex: action.hoveredLocationPanelIndex,
        loading: false,
      };
    default:
      return state;
  }
}
