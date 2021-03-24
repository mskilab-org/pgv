import { all, takeEvery, put } from "redux-saga/effects";
import axios from "axios";
import * as d3 from "d3";
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

function* actionWatcher() {
  yield takeEvery(actions.GET_DATAFILES, fetchDatafiles);
  yield takeEvery(actions.GET_GENOME, fetchGenome);
}
export default function* rootSaga() {
  yield all([actionWatcher()]);
}
