import { all, takeEvery, put } from "redux-saga/effects";
import axios from "axios";
import * as d3 from "d3";
import { loadArrowTable } from "../../helpers/utility";
import actions from "./actions";

function* fetchDatafiles() {
  const { response, error } = yield axios.get("/datafiles.json")
  .then((response) => ({ response }))
  .catch((error) => ({ error }));
  if (response) {
    yield put({ type: actions.DATAFILES_RECEIVED, datafiles: response && response.data });
  } else {
    yield put({ type: actions.DATAFILES_FAILED, datafiles: []});
  }
}

function* fetchGenome({file}) {
  const json = yield axios.get(`/data/${file}/genome.json`).then((response) => response);
  yield put({ type: actions.GENOME_RECEIVED, file: file, genome: json.data });
}

function* fetchCoverageData({file}) {
  const { results, error } = yield loadArrowTable(`data/${file}/coverage.arrow`)
    .then((results) => ({ results }))
    .catch((error) => ({ error }));
  yield put({ type: actions.COVERAGEDATA_RECEIVED, file: file, coverageData: results });
}

function* fetchRPKMData({file}) {
  const { results, error } = yield loadArrowTable(`data/${file}/rpkm.arrow`)
    .then((results) => ({ results }))
    .catch((error) => ({ error }));
  yield put({ type: actions.RPKMDATA_RECEIVED, file: file, rpkmData: results });
}

function* actionWatcher() {
  yield takeEvery(actions.GET_DATAFILES, fetchDatafiles);
  yield takeEvery(actions.GET_GENOME, fetchGenome);
  yield takeEvery(actions.GET_COVERAGEDATA, fetchCoverageData);
  yield takeEvery(actions.GET_RPKMDATA, fetchRPKMData);
}
export default function* rootSaga() {
  yield all([actionWatcher()]);
}
