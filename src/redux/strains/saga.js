import { all, takeEvery, put } from "redux-saga/effects";
import axios from "axios";
import actions from "./actions";

function* fetchStrainsList({file}) {
  const json = yield axios.get(`/data/${file}/strains.json`).then((response) => response);
  yield put({ type: actions.STRAINSLIST_RECEIVED, file: file, strainsList: json.data });
}

function* fetchPhylogeny({file}) {
  const json = yield axios.get(`/data/${file}/phylogeny.newick`).then((response) => response);
  yield put({ type: actions.PHYLOGENY_RECEIVED, file: file, phylogeny: json.data });
}

function* fetchGeography({file}) {
  const json = yield axios.get(`/data/${file}/geography.json`).then((response) => response);
  yield put({ type: actions.GEOGRAPHY_RECEIVED, file: file, geography: json.data });
}

function* actionWatcher() {
  yield takeEvery(actions.GET_STRAINSLIST, fetchStrainsList);
  yield takeEvery(actions.GET_PHYLOGENY, fetchPhylogeny);
  yield takeEvery(actions.GET_GEOGRAPHY, fetchGeography);
}
export default function* rootSaga() {
  yield all([actionWatcher()]);
}
