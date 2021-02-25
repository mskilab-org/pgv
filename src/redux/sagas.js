import { all } from 'redux-saga/effects';
import appSagas from './app/saga';
import genomeSagas from './genome/saga';

export default function* rootSaga(getState) {
  yield all([
    appSagas(),
    genomeSagas()
  ]);
}
