import actions from './actions';

export default function appReducer(state = {}, action) {
  switch (action.type) {
    case actions.GET_SETTINGS:
      return { ...state, loading: true };
    case actions.SETTINGS_RECEIVED:
      return { ...state, settings: action.settings, loading: false };
    default:
      return state;
  }
}
