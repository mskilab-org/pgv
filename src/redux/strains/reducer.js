import actions from "./actions";

const initState = {
  loading: false,
  strainsList: [],
  phylogeny: null
};

export default function appReducer(state = initState, action) {
  switch (action.type) {
    case actions.GET_STRAINSLIST:
      return { ...state, loading: true };
    case actions.STRAINSLIST_RECEIVED:
      return { ...state, strainsList: action.strainsList, file: action.file, loading: false };
    case actions.GET_PHYLOGENY:
      return { ...state, loading: true };
    case actions.PHYLOGENY_RECEIVED:
      return { ...state, phylogeny: action.phylogeny, file: action.file, loading: false };
    default:
      return state;
  }
}
