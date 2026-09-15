import actions from "./actions";
import * as d3 from "d3";
import { domainsToLocation, cluster } from "../../helpers/utility";
import { plotIdentity, isDetailPlot } from "../../helpers/phylogeny/loaders";

const defaultPhylogenyView = {
  gutterWidth: 240, gutterHidden: false, mutationMode: "hidden",
  selectedRowsOnly: false, selectedTracksOnly: false,
};
const idleCellTrackLoad = { status: "idle", total: 0, completed: 0, errors: [] };

function hasStaleTiles(plot, domains) {
  return plot.data != null && plot.dataDomains && domains &&
    JSON.stringify(plot.dataDomains) !== JSON.stringify(domains);
}

// Async completions only patch data on panels that still exist. In particular a
// zoom request must not restore deleted panels or discard newly opened cells.
function patchPlotData(plots, patches, { bigwigsOnly = false, metadata = false, domains, previousPlots } = {}) {
  const byKey = new Map((patches || []).map((plot) => [plotIdentity(plot), plot]));
  const previous = new Map((previousPlots || []).map((plot) => [plotIdentity(plot), plot]));
  return plots.map((plot) => {
    const key = plotIdentity(plot), patch = byKey.get(key);
    if (!patch || (bigwigsOnly && plot.type !== "bigwig")) return plot;
    if (plot.type === "bigwig") {
      if (hasStaleTiles(patch, domains)) return plot;
      // An open/lazy request may wait behind coverage while zoom supplies newer
      // tiles. Only fill the data version that this request actually observed.
      if (previousPlots && plot.data != null && plot.data !== (previous.get(key) || {}).data) return plot;
    }
    const data = {};
    const fields = ["data", "dataDomains", "loadError", "loadStatus", "tilesetInfo", "path"];
    if (metadata) fields.push("title", "name");
    fields.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(patch, key)) data[key] = patch[key];
    });
    return { ...plot, ...data };
  });
}

// Only ATAC plots opt into the global scale in BigwigPlot. Empty/invalid data
// must not leave an undefined extent that makes newly loaded tracks invisible.
function sharedBigwigRange(plots) {
  const values = plots.filter((plot) => plot.type === "bigwig" && plot.tag === "bigwig_atac")
    .flatMap((plot) => Array.isArray(plot.data) ? plot.data : [])
    .map((point) => point && point.y).filter(Number.isFinite);
  return values.length ? d3.extent(values) : [0, 1];
}

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
  // File IDs added by confirmed cell opening, never the launch/cohort selection.
  phylogenyAddedFiles: [],
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
  phylogenyHeatmap: null,
  phylogenyView: defaultPhylogenyView,
  cellTrackLoad: idleCellTrackLoad,
  datasetEpoch: 0,
  phylogenyHeatmapRequest: 0,
  cellTrackRequest: 0,
  phylogenyPanelHeight: 640,
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
  // Legacy synchronous callers may omit an epoch; all new async workers supply it.
  if (action.epoch !== undefined && action.epoch !== state.datasetEpoch) return state;
  switch (action.type) {
    case actions.PHYLOGENY_VIEW_UPDATED:
      return { ...state, phylogenyView: { ...state.phylogenyView, ...action.changes } };
    case actions.LOAD_PHYLOGENY_HEATMAP:
      return { ...state, phylogenyHeatmapRequest: state.phylogenyHeatmapRequest + 1 };
    case actions.PHYLOGENY_HEATMAP_UPDATED:
      if (action.requestId !== state.phylogenyHeatmapRequest) return state;
      return { ...state, phylogenyHeatmap: action.data };
    case actions.OPEN_PHYLOGENY_CELLS:
      if (action.confirmed !== true || state.loading) return state;
      return {
        ...state, cellTrackRequest: state.cellTrackRequest + 1,
        cellTrackLoad: { status: "loading", total: 0, completed: 0, errors: [] },
      };
    case actions.CANCEL_PHYLOGENY_CELL_LOAD:
      return {
        ...state, cellTrackRequest: state.cellTrackRequest + 1,
        cellTrackLoad: { ...state.cellTrackLoad, status: "cancelled" },
      };
    case actions.CLEAR_PHYLOGENY_TRACKS:
      if (state.loading) return state; // Do not interfere with a dataset launch.
      return {
        ...state, plots: state.plots.filter(plot => !isDetailPlot(plot)),
        selectedFiles: (state.selectedFiles || []).filter(file => !(state.phylogenyAddedFiles || []).includes(file.file)),
        phylogenyAddedFiles: [],
        cellTrackRequest: state.cellTrackRequest + 1, cellTrackLoad: { ...idleCellTrackLoad },
        selectedConnectionsRange: [], bigwigsYRange: [0, 1],
      };
    case actions.CELL_TRACK_LOAD_UPDATED:
      if (action.requestId !== state.cellTrackRequest) return state;
      return { ...state, cellTrackLoad: { ...state.cellTrackLoad, ...action.properties } };
    case actions.PHYLOGENY_CELL_PLOTS_REQUESTED: {
      if (action.requestId !== state.cellTrackRequest) return state;
      const reveal = new Set(action.plots.filter((plot) => plot.type === "genome" || plot.visible).map(plotIdentity));
      return { ...state, plots: state.plots.map((plot) => reveal.has(plotIdentity(plot)) ? { ...plot, visible: true, deleted: false } : plot) };
    }
    case actions.PHYLOGENY_CELL_PLOTS_LOADED: {
      if (action.requestId !== state.cellTrackRequest) return state;
      const previous = new Set((action.previousPlots || []).map(plotIdentity));
      const plots = patchPlotData(state.plots, action.plots, { domains: state.domains, previousPlots: action.previousPlots });
      action.plots.forEach((plot) => {
        // Removed since confirmation? Never append it again. Existing panels
        // were revealed at request time; completion cannot undo later UI edits.
        if (!previous.has(plotIdentity(plot)) && !plots.some((p) => plotIdentity(p) === plotIdentity(plot))) {
          // A pan between the worker's last check and this action must not show
          // old tiles. Retain metadata so that pan's zoom worker can fill them.
          plots.push(hasStaleTiles(plot, state.domains) ? { ...plot, data: null, loadStatus: "loading" } : plot);
        }
      });
      // Only count a successful incoming genome that survived the merge: a
      // removed/deleted match cannot borrow another genome from the same owner.
      const openedGenome = action.plots.some(plot => plot.type === "genome" &&
        plot.ownerFile === action.loadedFile && plot.loadStatus === "ready" && plot.data != null &&
        plots.some(current => plotIdentity(current) === plotIdentity(plot) && !current.deleted));
      // Resolve the real chooser descriptor after epoch/request guards and
      // deduplicate by file (several cell samples can share a manifest owner).
      const selectedFiles = state.selectedFiles || [];
      const loadedFile = state.cellTrackLoad.status === "loading" && action.loadedFile && openedGenome &&
        (state.datafiles || []).find(file => file.file === action.loadedFile);
      const addedFile = loadedFile && !selectedFiles.some(file => file.file === loadedFile.file);
      return { ...state, plots, bigwigsYRange: sharedBigwigRange(plots),
        ...(addedFile ? {
          selectedFiles: [...selectedFiles, loadedFile],
          phylogenyAddedFiles: [...(state.phylogenyAddedFiles || []), loadedFile.file],
        } : {}),
      };
    }
    case actions.PLOT_DATA_UPDATED: {
      const plots = patchPlotData(state.plots, action.plots, { domains: state.domains, previousPlots: action.previousPlots });
      return { ...state, plots, bigwigsYRange: sharedBigwigRange(plots),
        ...(action.genesOptionsList ? { genesOptionsList: action.genesOptionsList } : {}) };
    }
    case actions.LAUNCH_APP:
      return {
        ...state,
        loading: true,
        missingDataFiles: false,
        datasetEpoch: state.datasetEpoch + 1,
        phylogenyHeatmapRequest: state.phylogenyHeatmapRequest + 1,
        cellTrackRequest: state.cellTrackRequest + 1,
        phylogenyHeatmap: null,
        phylogenyView: { ...defaultPhylogenyView },
        cellTrackLoad: { ...idleCellTrackLoad },
        nodes: [],
        selectedConnectionIds: [],
        selectedConnectionsRange: [],
        files: action.files,
        selectedTags: action.selectedTags,
      };
    case actions.LAUNCH_APP_SUCCESS:
      // New launch selections are explicit. Keep old provenance until success
      // so a failed launch can still clear its previous auto-added cell owners.
      return { ...state, ...action.properties, phylogenyAddedFiles: [], bigwigsYRange: sharedBigwigRange(action.properties.plots || state.plots), loading: false };
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
      url.searchParams.set("genes", genesPlot && genesPlot.visible ? 1 : 0);
      window.history.replaceState(
        unescape(url.toString()),
        "Pan Genome Viewer",
        unescape(url.toString())
      );
      return {
        ...state,
        plots: action.plots.map((plot) => plot.visible ? { ...plot, deleted: false } : plot),
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
      return Number.isFinite(action.phylogenyPanelHeight)
        ? { ...state, phylogenyPanelHeight: Math.max(140, Math.min(1600, action.phylogenyPanelHeight)) }
        : state;
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
        const graph = selectedPlot && selectedPlot.data;
        let selectedIntervals = selectedConnectionIds
          .map((e) => ((graph && graph.connections) || []).find((d) => d.cid === e))
          .filter(Boolean)
          .map((d) =>
            [Math.abs(d.source), Math.abs(d.sink)]
              .map((k) =>
                (graph.intervals || []).filter((e) => e.iid === k)
              )
              .flat()
          )
          .flat();
        let annottated = selectedIntervals.filter((d) => state.chromoBins[d.chromosome]).map((d) => {
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
        selectedConnectionsRange = annottated.length ? cluster(annottated, state.genomeLength) : [];
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
    case actions.HIGLASS_LOADED: {
      const plots = patchPlotData(state.plots, action.properties.plots, { bigwigsOnly: true, domains: state.domains });
      return { ...state, plots, bigwigsYRange: sharedBigwigRange(plots) };
    }
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
    case actions.BIGWIG_PLOT_ADDED: {
      const plots = patchPlotData(state.plots, action.properties.plots, { bigwigsOnly: true, metadata: true, domains: state.domains });
      return { ...state, plots, bigwigsYRange: sharedBigwigRange(plots), loading: false };
    }
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
