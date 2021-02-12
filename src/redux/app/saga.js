import { all, takeEvery, put } from "redux-saga/effects";
import axios from "axios";
import actions from "./actions";

function* fetchSettings() {
  const json = yield axios.get(`/settings.json`).then((response) => response);
  yield put({ type: actions.SETTINGS_RECEIVED, settings: json.data });
}

function* actionWatcher() {
  yield takeEvery(actions.GET_SETTINGS, fetchSettings);
}
export default function* rootSaga() {
  yield all([actionWatcher()]);
}
