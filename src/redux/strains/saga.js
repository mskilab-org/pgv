import { all, takeEvery, put } from "redux-saga/effects";
import axios from "axios";
import { loadArrowTable } from "../../helpers/utility";
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
  const { results, error } = yield loadArrowTable(`data/${file}/pca.arrow`)
    .then((results) => ({ results }))
    .catch((error) => ({ error }));
  yield put({ type: actions.PCADATA_RECEIVED, file: file, pcaData: results });
}

function* actionWatcher() {
  yield takeEvery(actions.GET_STRAINSLIST, fetchStrainsList);
  yield takeEvery(actions.GET_PHYLOGENY, fetchPhylogeny);
  yield takeEvery(actions.GET_PCADATA, fetchPcaData);
}
export default function* rootSaga() {
  yield all([actionWatcher()]);
}
