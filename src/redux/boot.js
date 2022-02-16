import { store } from "./store";
import appActions from "./app/actions";

// eslint-disable-next-line import/no-anonymous-default-export
export default () =>
  new Promise(() => {
    store.dispatch(appActions.launchApp(null, null));
  });
