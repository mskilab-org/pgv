import actions from "./actions";

export default function appReducer(state = {}, action) {
  switch (action.type) {
    case actions.GET_STRAINSLIST:
      return { ...state, loading: true };
    case actions.STRAINSLIST_RECEIVED:
      return { ...state, strainsList: action.strainsList, file: action.file, loading: false };
    case actions.GET_PHYLOGENY:
      return { ...state, loading: true };
    case actions.PHYLOGENY_RECEIVED:
      return { ...state, phylogeny: action.phylogeny, file: action.file, loading: false };
    case actions.GET_GEOGRAPHY:
      return { ...state, loading: true };
    case actions.GEOGRAPHY_RECEIVED:
      return { ...state, geography: action.geography, file: action.file, loading: false };
    default:
      return state;
  }
}
