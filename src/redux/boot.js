import { store } from './store';
import appActions from './app/actions';
import genomeActions from './genome/actions';

// eslint-disable-next-line import/no-anonymous-default-export
export default () =>
  new Promise(() => {
    store.dispatch(appActions.getSettings());
    store.dispatch(genomeActions.getDatafiles());
  });
