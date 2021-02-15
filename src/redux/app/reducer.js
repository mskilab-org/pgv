import actions from './actions';
import * as d3 from "d3";

export default function appReducer(state = {}, action) {
  switch (action.type) {
    case actions.GET_SETTINGS:
      return { ...state, loading: true };
    case actions.SETTINGS_RECEIVED:
      let genomeLength = action.settings.metadata.reduce(
        (acc, elem) => acc + elem.endPoint,
        0
      );
      let boundary = 0;
      let chromoBins = action.settings.metadata.reduce((hash, element) => {
        let chromo = element;
        chromo.length = chromo.endPoint;
        chromo.startPlace = boundary;
        hash[element.chromosome] = chromo;
        boundary += chromo.length;
        return hash;
      }, {});
      return { ...state, genomeLength, chromoBins, loading: false };
    case actions.GET_DATAFILES:
      return { ...state, loading: true };
    case actions.DATAFILES_RECEIVED:
      let files = action.datafiles.map((d,i) => { return {datafile: d.datafile, tags: d.description.split(';')}});
      let tagsAll = files.map(d => d.tags).flat();
      let tags = [...d3.rollup(tagsAll, g => g.length, d => d)].sort((a,b) => d3.descending(a[1], b[1])); 
      return { ...state, datafiles: files, tags: tags, loading: false };
    default:
      return state;
  }
}
