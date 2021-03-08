import { all, takeEvery, put } from "redux-saga/effects";
import axios from "axios";
import actions from "./actions";
import genomeActions from "./../genome/actions";
import strainsActions from "./../strains/actions";

function* fetchSettings() {
  const json = yield axios.get(`/settings.json`).then((response) => response);
  yield put({ type: actions.SETTINGS_RECEIVED, settings: json.data });
}

function* updateCoordinates({coordinate}) {
  yield put({ type: actions.COORDINATES_UPDATED, coordinate: coordinate });
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

function* fetchDependencies({file}) {
  yield all([
    put({ type: genomeActions.GET_GENOME, file: file }),
    put({ type: strainsActions.GET_STRAINSLIST, file: file }),
    put({ type: strainsActions.GET_PHYLOGENY, file: file }),
    put({ type: actions.GET_GEOGRAPHY, file: file }),
    put({ type: actions.DEPENDENCIES_RECEIVED, file: file }),
  ])
}
function* actionWatcher() {
  yield takeEvery(actions.GET_SETTINGS, fetchSettings);
  yield takeEvery(actions.UPDATE_COORDINATES, updateCoordinates);
  yield takeEvery(actions.UPDATE_VISIBILITY, updateVisibility);
  yield takeEvery(actions.GET_GEOGRAPHY, fetchGeography);
  yield takeEvery(actions.GET_DEPENDENCIES, fetchDependencies);
}
export default function* rootSaga() {
  yield all([actionWatcher()]);
}
