import { all } from 'redux-saga/effects';
import appSagas from './app/saga';
import genomeSagas from './genome/saga';
import strainsSagas from './strains/saga';

export default function* rootSaga(getState) {
  yield all([
    appSagas(),
    genomeSagas(),
    strainsSagas()
  ]);
}
