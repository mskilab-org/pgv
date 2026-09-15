import {
  all,
  fork,
  cancel,
  take,
  put,
  call,
  select,
  delay,
} from "redux-saga/effects";
import { eventChannel, buffers } from "redux-saga";
import axios from "axios";
import StringToReact from "string-to-react";
import actions from "./actions";
import * as d3 from "d3";
import {
  loadArrowTable,
  updateChromoBins,
  domainsToLocation,
  locationToDomains,
  getFloatArray,
  alignWalks,
  guid,
} from "../../helpers/utility";
import { getCurrentState } from "./selectors";
import { createBoundedLoader, plotIdentity, detailTypes } from "../../helpers/phylogeny/loaders";
import { parseNewick, leafIds, normalizeCopyNumber, parsePlotlyMutations } from "../../helpers/phylogeny/data";

const ZOOM = 2;
const HIGLASS_LIMIT = 10000;
const HIGLASS_FILETYPE = "bigwig";

export const phylogenyLoader = createBoundedLoader();
const arrowTypes = ["genes", "barplot", "scatterplot"];
const jsonTypes = ["genome", "phylogeny", "anatomy", "walk"];
// Shared classification keeps clear/open behavior consistent across panel types.
const errorText = (error) => error && error.message ? error.message : String(error);

async function readJSON(path, token) {
  return phylogenyLoader.get(`json:${path}`, async () => {
    const source = axios.CancelToken.source();
    const unsubscribe = token ? token.onCancel(() => source.cancel("Request cancelled")) : () => {};
    try {
      const response = await axios.get(path, { cancelToken: source.token });
      return response.data;
    } finally {
      unsubscribe();
    }
  }, token);
}

async function readPlot(plot, token) {
  const arrow = arrowTypes.includes(plot.type);
  const key = `${arrow ? "arrow" : "json"}:${plot.path}`;
  if (plot.data != null) {
    if (!token.cancelled && plot.type !== "walk") phylogenyLoader.seed(key, plot.data);
    return plot.data;
  }
  if (arrow) return phylogenyLoader.get(key, async () => {
    const data = await loadArrowTable(plot.path);
    if (data == null) throw new Error(`No data in ${plot.path}`);
    return data;
  }, token);
  return readJSON(plot.path, token);
}

// Consume every completion (including cached/empty batches) through saga effects.
// Closing a cancelled saga stops queued cells and suppresses late active results.
function* runBatch(items, load, onResult) {
  const channel = eventChannel((emit) => {
    const batch = phylogenyLoader.run(items, load, {
      onResult: (result) => emit({ result }),
    });
    batch.promise.then((summary) => emit({ summary }));
    return batch.cancel;
  }, buffers.expanding());
  try {
    while (true) {
      const message = yield take(channel);
      if (message.summary) return message.summary;
      if (onResult) yield call(onResult, message.result);
    }
  } finally {
    channel.close();
  }
}

function findCohort(app, plotId) {
  const plot = app.plots.find((p) => p.type === "phylogeny" && (!plotId || p.id === plotId));
  if (!plot) return { plot: null, tree: null, cellIds: [], cells: [] };
  const tree = parseNewick(plot.data);
  const cellIds = leafIds(tree);
  const reference = plot.reference || app.selectedCoordinate;
  const files = app.datafiles.filter((file) => file.reference === reference &&
    file.plots.some((p) => p.type === "genome" && (!p.reference || p.reference === reference)));
  const genomes = (file) => file.plots.filter((p) => p.type === "genome" && (!p.reference || p.reference === reference));
  const cells = cellIds.map((id) => {
    // A multi-sample file is not a cell. Keep the exact matching graph rather
    // than later taking its first genome (DEMO: 7E != first genome 7K).
    const file = files.find((f) => f.file === id && genomes(f).some((p) => p.sample === id)) ||
      files.find((f) => genomes(f).some((p) => p.sample === id)) ||
      files.find((f) => f.file === id && genomes(f).length === 1);
    if (!file) return null;
    const graphs = genomes(file);
    const genome = graphs.find((p) => p.sample === id) || graphs[0];
    const describe = (p) => ({
      ...p, ownerFile: file.file, reference: file.reference,
      sample: p.sample || id, path: p.path || `data/${file.file}/${p.source}`,
    });
    const plots = file.plots.filter((p) => (!p.reference || p.reference === reference) &&
      (p === genome || p.sample === id || (graphs.length === 1 && (!p.sample || p.sample === file.file || p.sample === genome.sample))))
      .map(describe);
    return { id, file, genome: describe(genome), plots };
  }).filter(Boolean);
  return { plot, tree, cellIds, cells };
}

function mutationPath(plot) {
  const source = plot.heatmap.mutationSource;
  const base = new URL(".", document.baseURI);
  const folder = plot.ownerFile ? `data/${plot.ownerFile}/` : plot.path.slice(0, plot.path.lastIndexOf("/") + 1);
  const resolved = new URL(source, new URL(folder, base));
  return resolved.href.startsWith(base.href) ? resolved.href.slice(base.href.length) : resolved.href;
}

function tilePath(plot, domains, maxGenomeLength) {
  const keys = domains.flatMap((domain) => {
    const zoom = 2 + Math.floor(Math.log2(maxGenomeLength / (domain[1] - domain[0])));
    const first = Math.floor((Math.pow(2, zoom) * domain[0]) / maxGenomeLength);
    const last = Math.floor((Math.pow(2, zoom) * domain[1]) / maxGenomeLength);
    return d3.range(first, last + 1).map((tile) => `d=${plot.uuid}.${zoom}.${tile}`);
  });
  return `${plot.server}/api/v1/tiles/?${keys.join("&")}`;
}

function decodeTiles(response, info) {
  return Object.keys(response).sort(d3.ascending).flatMap((key) => {
    const [zoom, tile] = key.split(".").slice(-2).map(Number);
    const object = response[key];
    return getFloatArray(object.dense, info.tile_size, object.dtype).map((y, i) => ({
      x: (info.max_width * (tile * info.tile_size + i)) / (info.tile_size * Math.pow(2, zoom)), y,
    }));
  });
}

async function readBigwig(plot, token, view) {
  const info = plot.tilesetInfo || (await readJSON(`${plot.server}/api/v1/tileset_info/?d=${plot.uuid}`, token))[plot.uuid];
  if (!info) throw new Error(`Missing tileset ${plot.uuid}`);
  const path = tilePath(plot, view.domains, view.maxGenomeLength);
  const response = await readJSON(path, token);
  return { ...plot, path, title: plot.name ? plot.title : (plot.title || info.name),
    tilesetInfo: info, data: decodeTiles(response, info), dataDomains: view.domains, loadStatus: "ready", loadError: null };
}

function prepareWalk(raw, tag) {
  if (tag === "binset") return raw;
  const walks = raw.walks.map((walk) => ({ ...walk, iids: walk.iids.map((interval) => ({ ...interval })) }));
  alignWalks(walks);
  return { ...raw, walks, maximumY: d3.max(walks.flatMap((walk) => walk.iids), (interval) => interval.y) };
}

// Descriptors for one cell are sequential, so three scheduler slots mean at most
// three cells doing I/O, even when overview, details and coverage overlap.
async function loadCellPlots(cell, token, existing = [], opening = false, view = {}) {
  const plots = [], errors = [];
  for (const descriptor of cell.plots) {
    if (token.cancelled) break;
    const previous = existing.find((p) => plotIdentity(p) === plotIdentity(descriptor));
    const plot = { ...descriptor, ...previous };
    if (opening && (descriptor.type === "genome" || descriptor.visible)) {
      plot.visible = true;
      plot.deleted = false;
    }
    if (jsonTypes.includes(plot.type) || (arrowTypes.includes(plot.type) && (plot.visible || plot.type === "genes"))) {
      try {
        const raw = await readPlot(plot, token);
        if (token.cancelled) break;
        if (plot.type === "genome" && (!raw || !Array.isArray(raw.intervals) || !Array.isArray(raw.connections))) {
          throw new Error("Invalid genome graph");
        }
        plot.data = plot.type === "walk" ? prepareWalk(raw, plot.tag) : raw;
        plot.loadStatus = "ready";
        plot.loadError = null;
      } catch (error) {
        plot.loadStatus = "error";
        plot.loadError = errorText(error);
        errors.push(`${cell.id}: ${plot.source}: ${plot.loadError}`);
        if (["genome", "walk"].includes(plot.type)) {
          plot.data = null;
          if (!token.cancelled) phylogenyLoader.forget(`json:${plot.path}`);
        }
      }
    }
    if (plot.type === "bigwig" && plot.visible && plot.data == null) {
      try {
        Object.assign(plot, await readBigwig(plot, token, view), { loadStatus: "ready", loadError: null });
      } catch (error) {
        plot.loadStatus = "error";
        plot.loadError = errorText(error);
        errors.push(`${cell.id}: ${plot.source || plot.uuid}: ${plot.loadError}`);
      }
    }
    // Legacy structural panels dereference their graph in the constructor.
    // Report failures in cellTrackLoad instead of mounting an absent graph.
    if (!["genome", "walk"].includes(plot.type) || plot.data != null) plots.push(plot);
  }
  return { plots, errors };
}

// New/lazy plots may not yet be visible to the zoom worker (no metadata, or
// still waiting for another descriptor). Recheck at the publication boundary,
// not just when their first request starts. Every refresh uses the same queue.
function* refreshCurrentBigwigs(result, epoch) {
  while (true) {
    const { App: app } = yield select(getCurrentState);
    if (app.datasetEpoch !== epoch) return result;
    const groups = new Map();
    result.plots.filter((plot) => plot.type === "bigwig" && plot.data != null && plot.dataDomains &&
      JSON.stringify(plot.dataDomains) !== JSON.stringify(app.domains)).forEach((plot) => {
      const key = plot.ownerFile || plotIdentity(plot);
      if (!groups.has(key)) groups.set(key, { id: key, plots: [] });
      groups.get(key).plots.push({ ...plot, data: null });
    });
    if (!groups.size) return result;
    const patches = new Map(), errors = [];
    yield call(runBatch, Array.from(groups.values()), (cell, token) => loadCellPlots(cell, token, [], false, app), ({ value }) => {
      if (!value) return;
      value.plots.forEach((plot) => patches.set(plotIdentity(plot), plot));
      errors.push(...value.errors);
    });
    result = { plots: result.plots.map((plot) => patches.get(plotIdentity(plot)) || plot), errors: [...result.errors, ...errors] };
  }
}

export function* loadPhylogenyHeatmap(action) {
  const { App: app } = yield select(getCurrentState);
  if (app.loading) return;
  const epoch = app.datasetEpoch, requestId = app.phylogenyHeatmapRequest;
  let data = { status: "loading", plotId: action.plotId, tree: null, cellIds: [], cnByCell: {}, mutations: null, errors: [], completed: 0, total: 0 };
  const publish = function* () {
    yield put({ type: actions.PHYLOGENY_HEATMAP_UPDATED, epoch, requestId, data: { ...data } });
  };
  try {
    const cohort = findCohort(app, action.plotId);
    if (!cohort.cells.length) {
      yield put({ type: actions.PHYLOGENY_HEATMAP_UPDATED, epoch, requestId, data: null });
      return;
    }
    data = { ...data, tree: cohort.tree, cellIds: cohort.cellIds, total: cohort.cells.length };
    yield call(publish);
    yield call(runBatch, cohort.cells, async (cell, token) => {
      const descriptor = cell.genome;
      const existing = app.plots.find((p) => plotIdentity(p) === plotIdentity(descriptor));
      const raw = await readPlot({ ...descriptor, ...existing }, token);
      if (token.cancelled) return;
      try {
        return normalizeCopyNumber(raw, app.chromoBins);
      } catch (error) {
        if (!token.cancelled) phylogenyLoader.forget(`json:${descriptor.path}`);
        throw error;
      }
    }, function* ({ item, value, error, completed }) {
      data = { ...data, completed,
        cnByCell: error ? data.cnByCell : { ...data.cnByCell, [item.id]: value },
        errors: error ? [...data.errors, `${item.id}: ${errorText(error)}`] : data.errors,
      };
      yield call(publish);
    });
    // The full optional matrix loads regardless of the display mode or selection.
    if (cohort.plot.heatmap && cohort.plot.heatmap.mutationSource) {
      yield call(runBatch, [cohort.plot], async (plot, token) => {
        if (plot.heatmap.mutationFormat && plot.heatmap.mutationFormat !== "plotly") throw new Error("Unsupported mutation format");
        const path = mutationPath(plot);
        const raw = await readJSON(path, token);
        if (token.cancelled) return;
        try {
          return parsePlotlyMutations(raw, app.chromoBins);
        } catch (error) {
          if (!token.cancelled) phylogenyLoader.forget(`json:${path}`);
          throw error;
        }
      }, ({ value, error }) => {
        if (error) data = { ...data, errors: [...data.errors, `Mutations: ${errorText(error)}`] };
        else data = { ...data, mutations: value };
      });
    }
    data = { ...data, status: data.errors.length ? "error" : "ready" };
    yield call(publish);
  } catch (error) {
    data = { ...data, status: "error", errors: [...data.errors, errorText(error)] };
    yield call(publish);
  }
}

export function* openPhylogenyCells(action) {
  // Defense in depth: even a direct invocation cannot load an unconfirmed leaf.
  if (action.confirmed !== true) return;
  const { App: app } = yield select(getCurrentState);
  if (app.loading) return;
  const epoch = app.datasetEpoch, requestId = app.cellTrackRequest;
  let progress = { status: "loading", completed: 0, total: 0, errors: [] };
  const publish = function* () {
    yield put({ type: actions.CELL_TRACK_LOAD_UPDATED, epoch, requestId, properties: { ...progress } });
  };
  try {
    const cohort = findCohort(app, app.phylogenyHeatmap && app.phylogenyHeatmap.plotId);
    const selected = new Set(action.cellIds || []);
    const cells = cohort.cells.filter((cell) => selected.has(cell.id)).map((cell) => ({
      ...cell, plots: cell.plots.filter((p) => detailTypes.includes(p.type)),
    }));
    progress.total = cells.length;
    const matched = new Set(cells.map(cell => cell.id));
    progress.errors = cohort.cellIds.filter(id => selected.has(id) && !matched.has(id))
      .map(id => `${id}: no matching genome dataset for the current reference`);
    // Apply confirmation intent before I/O. Completion only fills data, so any
    // later collapse/delete/reorder/title edit remains the user's last word.
    yield put({ type: actions.PHYLOGENY_CELL_PLOTS_REQUESTED, epoch, requestId, plots: cells.flatMap((cell) => cell.plots) });
    yield call(publish);
    yield call(runBatch, cells, (cell, token) => loadCellPlots(cell, token, app.plots, true, app), function* ({ item, value, error, completed }) {
      if (value) value = yield call(refreshCurrentBigwigs, value, epoch);
      progress = { ...progress, completed,
        errors: [...progress.errors, ...(error ? [`${item.id}: ${errorText(error)}`] : value.errors)],
      };
      if (value) {
        // An opened genome counts even if optional coverage/walks fail. Validate
        // the exact matched graph, not another genome view from the same owner.
        const loadedFile = !error && value.plots.some(plot =>
          plotIdentity(plot) === plotIdentity(item.genome) && plot.loadStatus === "ready" && plot.data != null)
          ? item.file.file : undefined;
        // Session-only chooser synchronization: do not expand URL `file`, whose
        // launch semantics eagerly open every detail group in each owner file.
        yield put({ type: actions.PHYLOGENY_CELL_PLOTS_LOADED, epoch, requestId, previousPlots: app.plots, plots: value.plots, loadedFile });
      }
      yield call(publish);
      // Cached genomes can complete entirely in microtasks. Yield periodically
      // so the browser can paint progress and accept cancellation for a trunk.
      if (completed % 3 === 0) yield delay(0);
    });
    progress = { ...progress, status: progress.errors.length ? "error" : "ready" };
    yield call(publish);
  } catch (error) {
    progress = { ...progress, status: "error", errors: [...progress.errors, errorText(error)] };
    yield call(publish);
  }
}

export function* loadVisiblePlotData() {
  const { App: app } = yield select(getCurrentState);
  if (app.loading) return;
  const groups = new Map();
  app.plots.filter((plot) => plot.visible && plot.data == null && [...arrowTypes, "bigwig"].includes(plot.type)).forEach((plot) => {
    const key = plot.ownerFile || plot.id;
    if (!groups.has(key)) groups.set(key, { id: key, plots: [] });
    groups.get(key).plots.push(plot);
  });
  if (groups.size) yield put({ type: actions.PLOT_DATA_UPDATED, epoch: app.datasetEpoch,
    plots: Array.from(groups.values()).flatMap((cell) => cell.plots.map((plot) => ({ ...plot, loadStatus: "loading", loadError: null }))),
  });
  yield call(runBatch, Array.from(groups.values()), (cell, token) => loadCellPlots(cell, token, [], false, app), function* ({ value }) {
    if (value) value = yield call(refreshCurrentBigwigs, value, app.datasetEpoch);
    if (value) yield put({ type: actions.PLOT_DATA_UPDATED, epoch: app.datasetEpoch, previousPlots: app.plots, plots: value.plots,
      ...(value.plots.some((p) => p.type === "genes") ? { genesOptionsList: geneOptions(value.plots.find((p) => p.type === "genes").data) } : {}),
    });
  });
}

function geneOptions(data) {
  if (!data || !data.getChild("type") || !data.getChild("title")) return [];
  const titles = data.getChild("title").toArray();
  return Array.from(data.getChild("type").toArray())
    .map((type, index) => type === "gene" ? { label: titles[index], value: index } : null)
    .filter(Boolean).sort((a, b) => d3.ascending(a.label.toLowerCase(), b.label.toLowerCase()));
}

function* fetchHiglassPlotData(action) {
  const currentState = yield select(getCurrentState);
  let properties = {
    plots: currentState.App.plots.filter((p) => p.type === "bigwig" && p.uuid === action.uuid).map((p) => ({ ...p })),
  };
  const plot = properties.plots[0];
  if (!plot) return;
  yield fetchHiglassTileset(plot);
  yield put({ type: actions.BIGWIG_PLOT_ADDED, epoch: currentState.App.datasetEpoch, properties });
  // Metadata alone used to rely on a later user zoom. Load a visible menu plot
  // now, against the current viewport, through the guarded lazy-loading path.
  yield call(loadVisiblePlotData);
}

function* fetchHiglassTileset(plot) {
  yield axios
    .get(`${plot.server}/api/v1/tileset_info/?d=${plot.uuid}`)
    .then((results) => {
      plot.tilesetInfo = results.data[plot.uuid];
      plot.title = plot.name ? plot.title : plot.tilesetInfo.name;
      plot.path = `${plot.server}/api/v1/tiles/?${d3
        .range(0, Math.pow(2, ZOOM))
        .map((d, i) => `d=${plot.uuid}.${ZOOM}.${d}`)
        .join("&")}`;
    })
    .catch((error) => {
      console.log(plot.path, error);
      plot.data = null;
    });
}

export function* fetchHiglassData() {
  yield delay(100); // to throttle multiple requests fired during zooming and panning
  const currentState = yield select(getCurrentState);
  const { App: app } = currentState;
  // Never mutate the live Redux descriptors from asynchronous callbacks.
  const bigwigs = app.plots.filter((p) => p.type === "bigwig" && p.uuid !== undefined && p.tilesetInfo).map((p) => ({ ...p }));
  const properties = { plots: [] };
  const groups = new Map();
  bigwigs.forEach((plot) => {
    const key = plot.ownerFile || plotIdentity(plot);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(plot);
  });
  yield call(runBatch, Array.from(groups.values()), async (plots, token) => {
    const patches = [];
    for (const plot of plots) {
      if (token.cancelled) break;
      try {
        patches.push(await readBigwig(plot, token, app));
      } catch (error) {
        patches.push({ id: plot.id, ownerFile: plot.ownerFile, type: plot.type,
          source: plot.source, server: plot.server, uuid: plot.uuid, sample: plot.sample, tag: plot.tag, defaultChartType: plot.defaultChartType,
          loadError: errorText(error), loadStatus: "error" });
      }
    }
    return patches;
  }, ({ value }) => { if (value) properties.plots.push(...value); });
  yield put({ type: actions.HIGLASS_LOADED, epoch: currentState.App.datasetEpoch, properties });
}

export function* launchApplication(action) {
  phylogenyLoader.invalidate();
  const currentState = yield select(getCurrentState);
  const epoch = currentState.App.datasetEpoch;
  try {
    let { settings, datafilesJSON: datafiles } = currentState.App;
    if (!settings || !datafiles) {
      const [responseSettings, responseDatafiles] = yield axios.all([
        axios.get("settings.json"), axios.get("datafiles.json"),
      ]);
      settings = responseSettings.data;
      datafiles = responseDatafiles.data;
    }
    let files = Object.keys(datafiles)
      .map((key, i) => {
        let d = datafiles[key];
        return {
          file: key,
          tags: [d.description].flat(Infinity).filter((item) => {
            return (
              typeof item === "string" &&
              item.trim() !== "" &&
              item !== "{}" &&
              item !== "[]"
            );
          }),
          plots: d.plots.map((e) => {
            return {
              ...e,
              id: e.id == null ? guid() : e.id,
              ownerFile: key,
              reference: e.reference || d.reference,
              sample: e.sample || d.sample || key,
              title: e.type === "phylogeny" ? e.title : `${key} ${e.title}`,
              name: e.title,
              path: `data/${key}/${e.source}`,
            };
          }),
          reference: d.reference,
        };
      })
      .sort((a, b) => d3.ascending(a.file, b.file));
    let tagsAll = files.map((d) => d.tags).flat();
    let tags = [
      ...d3.rollup(
        tagsAll,
        (g) => g.length,
        (d) => d
      ),
    ].sort((a, b) => d3.descending(a[1], b[1]));

    let filteredFiles = [];
    if (action.selectedTags && action.selectedTags.length > 0) {
      filteredFiles = files
        .filter(
          (d) =>
            (d.tags || []).filter((e) => action.selectedTags.includes(e))
              .length === action.selectedTags.length
        )
        .sort((a, b) => d3.ascending(a.file, b.file));
    }

    let filteredAllTags = [];
    let searchParams = new URL(decodeURI(document.location)).searchParams;
    let file = searchParams.get("file")
      ? searchParams.get("file").split(",")
      : [];
    if (filteredFiles.length > 0) {
      file = [filteredFiles[0].file];
      filteredAllTags = filteredFiles.map((d) => d.tags).flat();
    } else {
      filteredFiles = [...files];
      filteredAllTags = tagsAll;
    }

    let filteredTags = [
      ...d3.rollup(
        filteredAllTags,
        (g) => g.length,
        (d) => d
      ),
    ].sort((a, b) => d3.descending(a[1], b[1]));

    if (action.files) {
      file = action.files;
    }

    let selectedFiles = files
      .sort((a, b) =>
        d3.ascending(
          (file || action.files).indexOf(a.file),
          (file || action.files).indexOf(b.file)
        )
      )
      .filter((d) => (action.files || file || []).includes(d.file));

    let selectedReferences = new Set(selectedFiles.map((d) => d.reference));

    // if all selected files are have the same reference
    let selectedCoordinate = Array.from(selectedReferences)[0] || "hg19";

    selectedFiles = selectedFiles.filter(
      (d) => d.reference === selectedCoordinate
    );

    file = selectedFiles || files[0].file;

    let { genomeLength, chromoBins } = updateChromoBins(
      settings.coordinates.sets[selectedCoordinate]
    );
    let geographyHash = {};
    settings.geography.forEach((d, i) => (geographyHash[d.id] = d));
    let defaultDomain = [1, genomeLength];
    let defaultChromosome = chromoBins[Object.keys(chromoBins)[0]];
    let domains = [];
    try {
      domains = locationToDomains(chromoBins, searchParams.get("location"));
    } catch (error) {
      domains = [[+defaultChromosome.startPlace, +defaultChromosome.endPlace]];
    }
    let url = new URL(decodeURI(document.location));
    url.searchParams.set("location", domainsToLocation(chromoBins, domains));

    url.searchParams.set("file", selectedFiles.map((d) => d.file).join(","));
    window.history.replaceState(
      unescape(url.toString()),
      "Pan Genome Viewer",
      unescape(url.toString())
    );
    let plots = [
      {
        id: guid(),
        type: "genes",
        title: "Genes",
        source: `genes/${selectedCoordinate}.arrow`,
        path: `genes/${selectedCoordinate}.arrow`,
        visible: +searchParams.get("genes") === 1,
        data: null,
      },
      ...selectedFiles.map((d) => d.plots).flat(),
    ];
    // Group by manifest owner, not descriptor: optional hidden coverage stays
    // unloaded until an explicit PLOTS_UPDATED expansion. Genes still power search.
    const initialGroups = new Map();
    plots.forEach((plot) => {
      const key = plot.ownerFile || plot.id;
      if (!initialGroups.has(key)) initialGroups.set(key, { id: key, plots: [] });
      initialGroups.get(key).plots.push(plot);
    });
    yield call(runBatch, Array.from(initialGroups.values()), (cell, token) => loadCellPlots(cell, token, [], false, { domains, maxGenomeLength: currentState.App.maxGenomeLength }), ({ value }) => {
      if (value) {
        const loaded = new Map(value.plots.map((p) => [plotIdentity(p), p]));
        plots = plots.map((p) => loaded.get(plotIdentity(p)) || p);
      }
    });
    plots = plots.filter((p) => !["genome", "walk"].includes(p.type) || p.data != null);

    let connectionsAssociations = [];
    let samples = [];
    let anatomyPlot = plots.find((d) => d.type === "anatomy");
    if (selectedFiles.length === 1) {
      const { response } = yield axios
        .get(`data/${selectedFiles[0].file}/connections.associations.json`)
        .then((response) => ({ response }))
        .catch((error) => ({ error }));
      connectionsAssociations =
        (response && response.data) || connectionsAssociations;

      const { responseSamples } = yield axios
        .get(`data/${selectedFiles[0].file}/samples.json`)
        .then((responseSamples) => ({ responseSamples }))
        .catch((error) => ({ error }));
      samples = (responseSamples && responseSamples.data) || samples;

      if (anatomyPlot && anatomyPlot.figure) {
        const { res } = yield axios
          .get(`data/${selectedFiles[0].file}/${anatomyPlot.figure}`)
          .then((res) => ({ res }))
          .catch((error) => ({ error }));
        anatomyPlot.figure =
          (res && res.data && StringToReact(res.data)) || null;
      }
    } else {
      plots = plots.filter((d) => d.type !== "anatomy");
    }

    // load list of bigwig files from the higlass server in settings.json
    let higlassServer = settings.higlassServer;
    let higlassDatafiles = [];
    yield axios
      .get(
        `${higlassServer}/api/v1/tilesets/?limit=${HIGLASS_LIMIT}&t=${HIGLASS_FILETYPE}`
      )
      .then((results) => {
        higlassDatafiles = results.data.results.filter(
          (d) =>
            d.coordSystem ===
            settings.coordinates.higlassMap[selectedCoordinate]
        );
      })
      .catch((error) => {
        console.log(higlassServer, error);
        higlassDatafiles = [];
      });

    let genesOptionsList = geneOptions(plots.find((d) => d.type === "genes").data);

    // load gene-annotations from higlass server
    let higlassGeneFileUUID = settings.geneAnnotations[selectedCoordinate];

    let properties = {
      genesOptionsList,
      higlassGeneFileUUID,
      higlassServer,
      higlassDatafiles,
      defaultDomain,
      genomeLength,
      datafiles: files,
      datafilesJSON: datafiles,
      filteredFiles,
      filteredTags,
      selectedCoordinate,
      tags,
      selectedFiles,
      domains,
      chromoBins,
      plots,
      connectionsAssociations,
      settings,
      samples,
      genesPinned: +searchParams.get("genesPinned") === 1,
    };
    yield put({ type: actions.LAUNCH_APP_SUCCESS, epoch, properties });
    const phylogeny = plots.find((plot) => plot.type === "phylogeny");
    if (phylogeny) yield put({ ...actions.loadPhylogenyHeatmap(phylogeny.id), epoch });
  } catch (error) {
    yield put({ type: actions.LAUNCH_APP_FAILED, epoch, error: errorText(error) });
  }
}

function* actionWatcher() {
  const tasks = {};
  while (true) {
    const action = yield take([
      actions.LAUNCH_APP, actions.ADD_BIGWIG_PLOT, actions.DOMAINS_UPDATED,
      actions.LOAD_PHYLOGENY_HEATMAP, actions.OPEN_PHYLOGENY_CELLS,
      actions.CANCEL_PHYLOGENY_CELL_LOAD, actions.CLEAR_PHYLOGENY_TRACKS, actions.PLOTS_UPDATED, actions.GENES_PIN_UPDATED,
    ]);
    // Do not even takeLatest-cancel a confirmed request for an unconfirmed click.
    if (action.type === actions.OPEN_PHYLOGENY_CELLS && action.confirmed !== true) continue;
    if (action.epoch !== undefined) {
      const { App: app } = yield select(getCurrentState);
      if (app.datasetEpoch !== action.epoch) continue;
    }
    if (action.type === actions.LAUNCH_APP) {
      for (const key of Object.keys(tasks)) yield cancel(tasks[key]);
    }
    if (action.type === actions.CLEAR_PHYLOGENY_TRACKS) {
      const { App: app } = yield select(getCurrentState);
      if (!app.loading) {
        for (const key of ["cells", "visible", "zoom", "bigwig"]) if (tasks[key]) yield cancel(tasks[key]);
        // A visible genes request might share the lazy task: resume retained context only.
        tasks.visible = yield fork(loadVisiblePlotData);
      }
      continue;
    }
    if (action.type === actions.CANCEL_PHYLOGENY_CELL_LOAD) {
      if (tasks.cells) yield cancel(tasks.cells);
      continue;
    }
    const [key, worker] = {
      [actions.LAUNCH_APP]: ["launch", launchApplication],
      [actions.ADD_BIGWIG_PLOT]: ["bigwig", fetchHiglassPlotData],
      [actions.DOMAINS_UPDATED]: ["zoom", fetchHiglassData],
      [actions.LOAD_PHYLOGENY_HEATMAP]: ["overview", loadPhylogenyHeatmap],
      [actions.OPEN_PHYLOGENY_CELLS]: ["cells", openPhylogenyCells],
      [actions.PLOTS_UPDATED]: ["visible", loadVisiblePlotData],
      [actions.GENES_PIN_UPDATED]: ["visible", loadVisiblePlotData],
    }[action.type];
    if (tasks[key]) yield cancel(tasks[key]);
    tasks[key] = yield fork(worker, action);
  }
}
export default function* rootSaga() {
  yield all([actionWatcher()]);
}
