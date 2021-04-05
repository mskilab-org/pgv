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

function* fetchPcaData({file}) {
  const { response, error } = yield axios.get(`/data/${file}/pca.json`)
    .then((response) => ({ response }))
    .catch((error) => ({ error }));
  yield put({ type: actions.PCADATA_RECEIVED, file: file, pcaData: ((response && response.data) || [])});
}

function* fetchAnatomy({file}) {
  const { response, error } = yield axios.get(`/data/${file}/anatomy.json`)
    .then((response) => ({ response }))
    .catch((error) => ({ error }));
  yield put({ type: actions.ANATOMY_RECEIVED, file: file, anatomy: ((response && response.data) || [])});
}

function* actionWatcher() {
  yield takeEvery(actions.GET_STRAINSLIST, fetchStrainsList);
  yield takeEvery(actions.GET_PHYLOGENY, fetchPhylogeny);
  yield takeEvery(actions.GET_PCADATA, fetchPcaData);
  yield takeEvery(actions.GET_ANATOMY, fetchAnatomy);
}
export default function* rootSaga() {
  yield all([actionWatcher()]);
}
