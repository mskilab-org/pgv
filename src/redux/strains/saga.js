import { all, takeEvery, put } from "redux-saga/effects";
import axios from "axios";
import actions from "./actions";

function* fetchStrainsList({file}) {
  const { response, error } = yield axios.get(`/data/${file}/strains.json`)
    .then((response) => ({ response }))
    .catch((error) => ({ error }));
  yield put({ type: actions.STRAINSLIST_RECEIVED, file: file, strainsList: response && response.data });
}

function* fetchPhylogeny({file}) {
  const { response, error } = yield axios.get(`/data/${file}/phylogeny.newick`)
    .then((response) => ({ response }))
    .catch((error) => ({ error }));
  yield put({ type: actions.PHYLOGENY_RECEIVED, file: file, phylogeny: response && response.data });
}

function* fetchGeography({file}) {
  const { response, error } = yield axios.get(`/data/${file}/geography.json`)
    .then((response) => ({ response }))
    .catch((error) => ({ error }));
  yield put({ type: actions.GEOGRAPHY_RECEIVED, file: file, geography: (response && response.data) || [] });
}

function* actionWatcher() {
  yield takeEvery(actions.GET_STRAINSLIST, fetchStrainsList);
  yield takeEvery(actions.GET_PHYLOGENY, fetchPhylogeny);
  yield takeEvery(actions.GET_GEOGRAPHY, fetchGeography);
}
export default function* rootSaga() {
  yield all([actionWatcher()]);
}
