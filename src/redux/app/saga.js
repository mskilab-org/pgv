import { all, takeEvery, put, call} from "redux-saga/effects";
import axios from "axios";
import actions from "./actions";
import * as d3 from "d3";
import { loadArrowTable, updateChromoBins, locateGenomeRange} from "../../helpers/utility";
import genomeActions from "./../genome/actions";
import strainsActions from "./../strains/actions";

function* fetchSettings() {
  const json = yield axios.get(`/settings.json`).then((response) => response);
  yield put({ type: actions.SETTINGS_RECEIVED, settings: json.data });
  yield put({ type: actions.GET_GENES, coordinate: json.data.coordinates.default });
}

function* updateCoordinates({coordinate}) {
  yield put({ type: actions.COORDINATES_UPDATED, coordinate: coordinate });
  yield put({ type: actions.GET_GENES, coordinate: coordinate });
}

function* updateVisibility({panel, visible}) {
  yield put({ type: actions.VISIBILITY_UPDATED, panel: panel, visible: visible });
}

function* fetchGeography({file}) {
  const { response, error } = yield axios.get(`/data/${file}/geography.json`)
    .then((response) => ({ response }))
    .catch((error) => ({ error }));
  yield put({ type: actions.GEOGRAPHY_RECEIVED, file: file, geography: (response && response.data) });
}

function* fetchGenes({coordinate}) {
  const { response, error } = yield axios.get(`/genes/${coordinate}.json`)
    .then((response) => ({ response }))
    .catch((error) => ({ error }));
  yield put({ type: actions.GENES_RECEIVED, genes: (response && response.data) });
}

function* fetchDependencies({file}) {
  yield all([
    put({ type: genomeActions.GET_GENOME, file: file }),
    put({ type: strainsActions.GET_STRAINSLIST, file: file }),
    put({ type: strainsActions.GET_PHYLOGENY, file: file }),
    put({ type: actions.GET_GEOGRAPHY, file: file }),
    put({ type: strainsActions.GET_ANATOMY, file: file }),
    put({ type: actions.DEPENDENCIES_RECEIVED, file: file }),
  ])
}

function* fetchArrowData(plot) {
  yield loadArrowTable(plot.source)
    .then((results) => plot.data = results)
    .catch((error) => plot.data = []);
}

function* launchApplication() {
  const { responseSettings, responseDatafiles } = yield axios.all([axios.get("/settings.json"), axios.get("/datafiles.json")])
  .then(axios.spread((responseSettings, responseDatafiles) => {
    return {...{responseSettings, responseDatafiles}}
  })).catch(errors => {
    console.log("got errors", errors)
  });
  if (responseSettings && responseDatafiles) {
    let settings = responseSettings.data;
    let datafiles = responseDatafiles.data;
    let files = datafiles.map((d, i) => {
      return { filename: d.filename, file: d.filename.replace(".json", ""), tags: d.description, plots: d.plots, reference: d.reference };
    });
    let tagsAll = files.map((d) => d.tags).flat();
    let tags = [
      ...d3.rollup(
        tagsAll,
        (g) => g.length,
        (d) => d
      ),
    ].sort((a, b) => d3.descending(a[1], b[1]));
    let searchParams = new URL(decodeURI(document.location)).searchParams;
    let file = searchParams.get("file") || files[0].file;
    const datafile = files.find(d => d.file === file);
    let selectedCoordinate = datafile.reference;
    let { genomeLength, chromoBins } = updateChromoBins(
      settings.coordinates.sets[selectedCoordinate]
    );
    let geographyHash = {};
    settings.geography.forEach((d, i) => (geographyHash[d.id] = d));
    let defaultDomain = [1, genomeLength];
    let from = searchParams.get("from") || defaultDomain[0];
    let to = searchParams.get("to") || defaultDomain[1];
    let domain = [ +from, +to];
    let url = new URL(decodeURI(document.location));
    let params = new URLSearchParams(url.search);
    params.set("file", file);
    params.set("from", +from);
    params.set("to", +to);
    let newURL = `${url.origin}/?${params.toString()}`; 
    window.history.replaceState(newURL, 'Pan Genome Viewer', newURL);

    let plots = [{type: "genes", source: `/genes/${selectedCoordinate}.arrow`}, ...datafile.plots.map(d => {return {...d, source: `data/${file}/${d.source}`}})];
    yield axios.all(plots.filter((d,i) => ["genome", "phylogeny"].includes(d.type)).map(d => axios.get(d.source))).then(axios.spread((...responses) => {
      responses.forEach((d,i) => plots.filter((d,i) => ["genome", "phylogeny"].includes(d.type))[i].data = d.data);
    })).catch(errors => {
      console.log("got errors on loading dependencies", errors)
    });

    yield all([...plots.filter((d,i) => ["genes", "barplot", "scatterplot"].includes(d.type)).map(x => call(fetchArrowData, x))]);

   // yield all([...plots.filter((d,i) => ["phylogeny"].includes(d.type)).map(x => call(fetchArrowData, x))]);

    let genomeRange = locateGenomeRange(chromoBins, +from, +to);
    let properties = {datafile, defaultDomain, genomeLength, datafiles: files, selectedCoordinate, genomeRange, tags, file, from, to, domain, chromoBins, plots};
    yield put({ type: actions.LAUNCH_APP_SUCCESS, properties });
  } else {
    yield put({ type: actions.LAUNCH_APP_FAILED });
  }
  
}

function* actionWatcher() {
  yield takeEvery(actions.LAUNCH_APP, launchApplication);
  yield takeEvery(actions.GET_SETTINGS, fetchSettings);
  yield takeEvery(actions.UPDATE_COORDINATES, updateCoordinates);
  yield takeEvery(actions.UPDATE_VISIBILITY, updateVisibility);
  yield takeEvery(actions.GET_GEOGRAPHY, fetchGeography);
  yield takeEvery(actions.GET_DEPENDENCIES, fetchDependencies);
  yield takeEvery(actions.GET_GENES, fetchGenes);
}
export default function* rootSaga() {
  yield all([actionWatcher()]);
}
