import { all, takeEvery, put, call } from "redux-saga/effects";
import axios from "axios";
import StringToReact from "string-to-react";
import actions from "./actions";
import * as d3 from "d3";
import {
  loadArrowTable,
  updateChromoBins,
  domainsToLocation,
  locationToDomains,
} from "../../helpers/utility";

function* fetchArrowData(plot) {
  yield loadArrowTable(plot.source)
    .then((results) => (plot.data = results))
    .catch((error) => (plot.data = []));
}

function* launchApplication(action) {
  console.log(action);
  const { responseSettings, responseDatafiles } = yield axios
    .all([axios.get("/settings.json"), axios.get("/datafiles.json")])
    .then(
      axios.spread((responseSettings, responseDatafiles) => {
        return { ...{ responseSettings, responseDatafiles } };
      })
    )
    .catch((errors) => {
      console.log("got errors", errors);
    });
  if (responseSettings && responseDatafiles) {
    let settings = responseSettings.data;
    let datafiles = responseDatafiles.data;
    let files = Object.keys(datafiles)
      .map((key, i) => {
        let d = datafiles[key];
        return {
          filename: key,
          file: key.replace(".json", ""),
          tags: d.description,
          plots: d.plots,
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
    let file = searchParams.get("file");
    if (filteredFiles.length > 0) {
      file = filteredFiles[0].file;
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

    if (action.file) {
      file = action.file;
    }

    file = files.some((d) => d.file === file) ? file : files[0].file;

    const datafile = files.find((d) => d.file === file);
    let selectedCoordinate = datafile.reference;
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
    let params = new URLSearchParams(url.search);
    params.set("file", file);
    let newURL = `${url.origin}/?file=${params.get(
      "file"
    )}&location=${domainsToLocation(chromoBins, domains)}`;
    window.history.replaceState(newURL, "Pan Genome Viewer", newURL);

    let plots = [
      {
        type: "genes",
        title: "Genes",
        source: `/genes/${selectedCoordinate}.arrow`,
        visible: false,
      },
      ...datafile.plots.map((d) => {
        return { ...d, source: `data/${file}/${d.source}` };
      }),
    ];
    yield axios
      .all(
        plots
          .filter((d, i) => ["genome", "phylogeny", "anatomy"].includes(d.type))
          .map((d) => axios.get(d.source))
      )
      .then(
        axios.spread((...responses) => {
          responses.forEach(
            (d, i) =>
              (plots.filter((d, i) =>
                ["genome", "phylogeny", "anatomy"].includes(d.type)
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

    const { response } = yield axios
      .get(`/data/${file}/connections.associations.json`)
      .then((response) => ({ response }))
      .catch((error) => ({ error }));
    let connectionsAssociations = (response && response.data) || [];

    const { responseSamples } = yield axios
      .get(`/data/${file}/samples.json`)
      .then((responseSamples) => ({ responseSamples }))
      .catch((error) => ({ error }));
    let samples = (responseSamples && responseSamples.data) || [];

    let anatomyPlot = plots.find((d) => d.type === "anatomy");
    if (anatomyPlot) {
      const { res } = yield axios
        .get(`/data/${file}/${anatomyPlot.figure}`)
        .then((res) => ({ res }))
        .catch((error) => ({ error }));
      anatomyPlot.figure = (res && res.data && StringToReact(res.data)) || null;
    }

    let properties = {
      datafile,
      defaultDomain,
      genomeLength,
      datafiles: files,
      filteredFiles,
      filteredTags,
      selectedCoordinate,
      tags,
      file,
      domains,
      chromoBins,
      plots,
      connectionsAssociations,
      samples,
    };
    yield put({ type: actions.LAUNCH_APP_SUCCESS, properties });
  } else {
    yield put({ type: actions.LAUNCH_APP_FAILED });
  }
}

function* actionWatcher() {
  yield takeEvery(actions.LAUNCH_APP, launchApplication);
}
export default function* rootSaga() {
  yield all([actionWatcher()]);
}
