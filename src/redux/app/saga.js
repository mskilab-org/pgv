import {
  all,
  takeEvery,
  put,
  call,
  select,
  takeLatest,
  delay,
} from "redux-saga/effects";
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
} from "../../helpers/utility";
import { getCurrentState } from "./selectors";

const ZOOM = 2;
const HIGLASS_LIMIT = 10000;
const HIGLASS_FILETYPE = "bigwig";

function* fetchArrowData(plot) {
  yield loadArrowTable(plot.path)
    .then((results) => (plot.data = results))
    .catch((error) => {
      console.log(plot.path, error);
      plot.data = null;
    });
}

function* fetchHiglassPlotData(action) {
  const currentState = yield select(getCurrentState);
  let properties = {
    plots: [...currentState.App.plots],
  };
  let plot = properties.plots.find((d) => d.uuid === action.uuid);
  yield fetchHiglassTileset(plot);
  yield put({ type: actions.BIGWIG_PLOT_ADDED, properties });
}

function* fetchHiglassTileset(plot) {
  yield axios
    .get(`${plot.server}/api/v1/tileset_info/?d=${plot.uuid}`)
    .then((results) => {
      plot.tilesetInfo = results.data[plot.uuid];
      plot.title = plot.tilesetInfo.name;
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

function* fetchHiglassData(action) {
  yield delay(100); // to throttle multiple requests fired during zooming and panning
  const currentState = yield select(getCurrentState);
  let { maxGenomeLength, higlassServer, higlassGeneFileUUID } =
    currentState.App;
  let newTilesets = action.domains.map((d, i) => {
    let zoom = 2 + Math.floor(Math.log2(maxGenomeLength / (d[1] - d[0])));
    let tile1 = Math.floor((Math.pow(2, zoom) * d[0]) / maxGenomeLength);
    let tile2 = Math.floor((Math.pow(2, zoom) * d[1]) / maxGenomeLength);
    return { domain: d, zoom: zoom, tiles: d3.range(tile1, tile2 + 1) };
  });
  let properties = {
    plots: [...currentState.App.plots],
    genes: [],
  };
  let { plots, genes } = properties;
  let bigwigs = plots.filter((d, i) => ["bigwig"].includes(d.type));

  yield axios
    .all(
      bigwigs
        .filter((plot) => plot.uuid)
        .map((plot) =>
          axios.get(
            `${plot.server}/api/v1/tiles/?${newTilesets
              .map((d, i) =>
                d.tiles.map((e, j) => `d=${plot.uuid}.${d.zoom}.${e}`)
              )
              .flat()
              .join("&")}`
          )
        )
    )
    .then(
      axios.spread((...responses) => {
        responses.forEach((d, i) => {
          let currentPlot = plots.filter((d, i) => ["bigwig"].includes(d.type))[
            i
          ];
          let resp = d.data;
          let dataArrays = [];
          dataArrays.push(
            Object.keys(resp)
              .sort((a, b) => d3.ascending(a, b))
              .map((key, j) => {
                let tileZoom = key
                  .split(".")
                  .slice(1)
                  .map((e) => +e);
                let obj = resp[key];
                let k = getFloatArray(
                  obj.dense,
                  currentPlot.tilesetInfo.tile_size,
                  obj.dtype
                );
                return k.map((e, j) => {
                  return {
                    x:
                      (currentPlot.tilesetInfo.max_width *
                        (tileZoom[1] * currentPlot.tilesetInfo.tile_size + j)) /
                      (currentPlot.tilesetInfo.tile_size *
                        Math.pow(2, tileZoom[0])),
                    y: e,
                  };
                });
              })
          );
          currentPlot.data = dataArrays.flat().flat();
        });
      })
    )
    .catch((errors) => {
      console.log("got errors on loading dependencies", errors);
    });

  let newGeneTilesets = action.domains.map((d, i) => {
    let zoom = 0 + Math.floor(Math.log2(maxGenomeLength / (d[1] - d[0])));
    let tile1 = Math.floor((Math.pow(2, zoom) * d[0]) / maxGenomeLength);
    let tile2 = Math.floor((Math.pow(2, zoom) * d[1]) / maxGenomeLength);
    return { domain: d, zoom: zoom, tiles: d3.range(tile1, tile2 + 1) };
  });
  yield axios
    .get(
      `${higlassServer}/api/v1/tiles/?${newGeneTilesets
        .map((d, i) =>
          d.tiles.map((e, j) => `d=${higlassGeneFileUUID}.${d.zoom}.${e}`)
        )
        .flat()
        .join("&")}`
    )
    .then((results) => {
      Object.values(results.data)
        .flat()
        .forEach((gene, i) => {
          genes.push(gene);
        });
    })
    .catch((error) => {
      console.log(higlassServer, error);
      genes = [];
    });
  properties.bigwigsYRange = d3.extent(
    properties.plots
      .filter((d) => d.type === "bigwig" && d.tag === "bigwig_atac")
      .map((d) => d.data)
      .flat()
      .map((d) => d.y)
  );
  yield put({ type: actions.HIGLASS_LOADED, properties });
}

function* launchApplication(action) {
  const currentState = yield select(getCurrentState);
  let { settings, datafilesJSON } = currentState.App;
  let datafiles = datafilesJSON;
  let errorLoading = false;
  if (!settings || !datafiles) {
    const { responseSettings, responseDatafiles } = yield axios
      .all([axios.get("settings.json"), axios.get("datafiles.json")])
      .then(
        axios.spread((responseSettings, responseDatafiles) => {
          return { ...{ responseSettings, responseDatafiles } };
        })
      )
      .catch((errors) => {
        errorLoading = true;
        console.log("got errors", errors);
      });
    settings = responseSettings.data;
    datafiles = responseDatafiles.data;
  }
  if (!errorLoading) {
    let files = Object.keys(datafiles)
      .map((key, i) => {
        let d = datafiles[key];
        return {
          file: key,
          tags: d.description,
          plots: d.plots.map((e) => {
            return {
              ...e,
              title: `${key} ${e.title}`,
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
            d.tags.filter((e) => action.selectedTags.includes(e)).length ===
            action.selectedTags.length
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
        type: "genes",
        title: "Genes",
        source: `genes/${selectedCoordinate}.arrow`,
        path: `genes/${selectedCoordinate}.arrow`,
        visible: +searchParams.get("genes") === 1,
      },
      ...selectedFiles.map((d) => d.plots).flat(),
    ];
    yield axios
      .all(
        plots
          .filter((d, i) =>
            ["genome", "phylogeny", "anatomy", "walk"].includes(d.type)
          )
          .map((d) => axios.get(d.path))
      )
      .then(
        axios.spread((...responses) => {
          responses.forEach(
            (d, i) =>
              (plots.filter((d, i) =>
                ["genome", "phylogeny", "anatomy", "walk"].includes(d.type)
              )[i].data = d.data)
          );
        })
      )
      .catch((errors) => {
        console.log("got errors on loading dependencies", errors);
      });

    yield all([
      ...plots
        .filter((d, i) => ["genes", "barplot", "scatterplot"].includes(d.type))
        .map((x) => call(fetchArrowData, x)),
    ]);

    yield all([
      ...plots
        .filter((d, i) => ["bigwig"].includes(d.type))
        .map((x) => call(fetchHiglassTileset, x)),
    ]);

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
      plots = plots.filter((d) => !["anatomy", "phylogeny"].includes(d.type));
    }

    // loading for bigwig plots
    const currentState = yield select(getCurrentState);
    let { maxGenomeLength } = currentState.App;
    let newTilesets = domains.map((d, i) => {
      let zoom = 2 + Math.floor(Math.log2(maxGenomeLength / (d[1] - d[0])));
      let tile1 = Math.floor((Math.pow(2, zoom) * d[0]) / maxGenomeLength);
      let tile2 = Math.floor((Math.pow(2, zoom) * d[1]) / maxGenomeLength);
      return { domain: d, zoom: zoom, tiles: d3.range(tile1, tile2 + 1) };
    });

    let bigwigs = plots.filter((d, i) => ["bigwig"].includes(d.type));
    yield axios
      .all(
        bigwigs.map((plot) =>
          axios.get(
            `${plot.server}/api/v1/tiles/?${newTilesets
              .map((d, i) =>
                d.tiles.map((e, j) => `d=${plot.uuid}.${d.zoom}.${e}`)
              )
              .flat()
              .join("&")}`
          )
        )
      )
      .then(
        axios.spread((...responses) => {
          responses.forEach((d, i) => {
            let currentPlot = plots.filter((d, i) =>
              ["bigwig"].includes(d.type)
            )[i];
            let resp = d.data;
            let dataArrays = [];
            dataArrays.push(
              Object.keys(resp)
                .sort((a, b) => d3.ascending(a, b))
                .map((key, j) => {
                  let tileZoom = key
                    .split(".")
                    .slice(1)
                    .map((e) => +e);
                  let obj = resp[key];
                  let k = getFloatArray(
                    obj.dense,
                    currentPlot.tilesetInfo.tile_size,
                    obj.dtype
                  );
                  return k.map((e, j) => {
                    return {
                      x:
                        (currentPlot.tilesetInfo.max_width *
                          (tileZoom[1] * currentPlot.tilesetInfo.tile_size +
                            j)) /
                        (currentPlot.tilesetInfo.tile_size *
                          Math.pow(2, tileZoom[0])),
                      y: e,
                    };
                  });
                })
            );
            currentPlot.data = dataArrays.flat().flat();
          });
        })
      )
      .catch((errors) => {
        console.log("got errors on loading dependencies", errors);
      });

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

    let genesPlotData = plots.find((d) => d.type === "genes").data;
    let geneTypesIndexes = genesPlotData
      .getChild("type")
      .toArray()
      .map((d, i) => (d === "gene" ? i : undefined))
      .filter((x) => x);
    let geneTitlesList = genesPlotData.getChild("title").toArray();
    let genesOptionsList = geneTypesIndexes
      .map((d, i) => {
        return {
          label: geneTitlesList[d],
          value: d,
        };
      })
      .sort((a, b) =>
        d3.ascending(a.label.toLowerCase(), b.label.toLowerCase())
      );

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
      bigwigsYRange: d3.extent(
        plots
          .filter((d) => d.type === "bigwig")
          .map((d) => d.data)
          .flat()
      ),
    };
    yield put({ type: actions.LAUNCH_APP_SUCCESS, properties });
  } else {
    yield put({ type: actions.LAUNCH_APP_FAILED });
  }
}

function* actionWatcher() {
  yield takeEvery(actions.LAUNCH_APP, launchApplication);
  yield takeLatest(actions.ADD_BIGWIG_PLOT, fetchHiglassPlotData);
  yield takeLatest(actions.DOMAINS_UPDATED, fetchHiglassData);
}
export default function* rootSaga() {
  yield all([actionWatcher()]);
}
