import { all, takeEvery, put } from "redux-saga/effects";
import axios from "axios";
import * as d3 from "d3";
import actions from "./actions";

function* fetchSettings() {
  const json = yield axios.get(`/settings.json`).then((response) => response);
  yield put({ type: actions.SETTINGS_RECEIVED, settings: json.data });
}

function* fetchDatafiles() {
  const res = yield d3.csv("/datafiles.csv").then((response) => response);
  yield put({ type: actions.DATAFILES_RECEIVED, datafiles: res });
}

function* actionWatcher() {
  yield takeEvery(actions.GET_SETTINGS, fetchSettings);
  yield takeEvery(actions.GET_DATAFILES, fetchDatafiles);
}
export default function* rootSaga() {
  yield all([actionWatcher()]);
}
