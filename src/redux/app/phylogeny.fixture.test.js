import fs from "fs";
import path from "path";
import { runSaga } from "redux-saga";
import axios from "axios";
import actions from "./actions";
import reducer from "./reducer";
import { loadPhylogenyHeatmap, openPhylogenyCells, phylogenyLoader } from "./saga";
import { updateChromoBins, loadArrowTable } from "../../helpers/utility";

jest.mock("apache-arrow", () => ({ tableFromIPC: jest.fn() }));
jest.mock("axios", () => ({ get: jest.fn(), CancelToken: { source: () => ({ token: {}, cancel: jest.fn() }) } }));
jest.mock("../../helpers/utility", () => ({ ...jest.requireActual("../../helpers/utility"), loadArrowTable: jest.fn() }));

const root = path.resolve(process.cwd(), "public");
const mutationSource = "data/BWH70_phylogeny/mutations.plotly.json";
const fixtureTest = fs.existsSync(path.join(root, mutationSource)) ? test : test.skip;

fixtureTest("LOCAL FULL FIXTURE: saga retains all 92000 hidden entries/15834 CN intervals, then opens all 125 cells from raw cache", async () => {
  phylogenyLoader.invalidate();
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "datafiles.json"), "utf8"));
  const settings = JSON.parse(fs.readFileSync(path.join(root, "settings.json"), "utf8"));
  const datafiles = Object.entries(manifest).map(([file, entry]) => ({ ...entry, file,
    plots: entry.plots.map((plot, index) => ({ ...plot, id: `${file}-${index}`, ownerFile: file,
      sample: plot.sample || file, reference: entry.reference, path: `data/${file}/${plot.source}` })),
  }));
  const cohort = datafiles.find((file) => file.file === "BWH70_phylogeny");
  const tree = { ...cohort.plots[0],
    data: fs.readFileSync(path.join(root, cohort.plots[0].path), "utf8"),
    heatmap: { mutationSource: "mutations.plotly.json", mutationFormat: "plotly" },
  };
  const { chromoBins, genomeLength } = updateChromoBins(settings.coordinates.sets[cohort.reference]);
  let state = { ...reducer(undefined, {}), datafiles, selectedFiles: [cohort], plots: [tree], selectedCoordinate: cohort.reference,
    chromoBins, genomeLength, domains: [[1, genomeLength]], nodes: [{ id: "unrelated", selected: false }],
  };
  const dispatch = (event) => { state = reducer(state, event); };
  const options = { dispatch, getState: () => ({ App: state }) };
  const rawByPath = new Map();
  let active = 0, peak = 0;
  axios.get.mockImplementation(async (source) => {
    peak = Math.max(peak, ++active);
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      const data = JSON.parse(fs.readFileSync(path.join(root, source), "utf8"));
      rawByPath.set(source, data);
      return { data };
    } finally { active--; }
  });
  const load = actions.loadPhylogenyHeatmap(tree.id);
  dispatch(load);
  await runSaga(options, loadPhylogenyHeatmap, load).toPromise();
  expect(peak).toBe(3);
  expect(state.phylogenyView.mutationMode).toBe("hidden");
  expect(state.phylogenyHeatmap).toMatchObject({ status: "ready", total: 125, completed: 125, errors: [] });
  expect(state.plots).toEqual([tree]);
  expect(state.selectedFiles).toEqual([cohort]);
  expect(state.phylogenyAddedFiles).toEqual([]);
  const matrix = state.phylogenyHeatmap.mutations;
  expect(matrix.stats).toEqual({ cells: 125, variants: 736, entries: 92000, missing: 1081, zero: 58632, positive: 32287 });
  const figure = rawByPath.get(mutationSource);
  const rows = new Map(figure.layout.yaxis.tickvals.map((tick, index) => [tick, index]));
  const columns = new Map(matrix.variants.map((variant, index) => [variant.id, index]));
  const seen = new Uint8Array(92000);
  let checked = 0;
  for (const trace of figure.data) {
    for (let j = 0; j < trace.y.length; j++) {
      const row = rows.get(trace.y[j]);
      const column = columns.get(trace.text[j].split("<br>")[1]);
      const index = row * 736 + column;
      const value = trace.marker.color[j];
      if (seen[index] || !Object.is(matrix.values[index], value === null ? NaN : value) || matrix.missing[index] !== Number(value === null)) {
        throw new Error(`Saga lost source matrix entry ${index}`);
      }
      seen[index] = 1;
      checked++;
    }
  }
  expect(checked).toBe(92000);
  expect(seen.every((value) => value === 1)).toBe(true);
  let intervalsChecked = 0;
  for (const cell of state.phylogenyHeatmap.cellIds) {
    const file = datafiles.find((file) => file.file === cell);
    const descriptor = file.plots.find((plot) => plot.type === "genome");
    const source = rawByPath.get(descriptor.path).intervals;
    const normalized = new Map(state.phylogenyHeatmap.cnByCell[cell].map((interval) => [interval.iid, interval]));
    expect(normalized.size).toBe(source.length);
    for (const interval of source) {
      const actual = normalized.get(interval.iid);
      if (!actual || actual.cn !== interval.y || actual.start !== chromoBins[interval.chromosome].startPlace + interval.startPoint || actual.end !== chromoBins[interval.chromosome].startPlace + interval.endPoint) {
        throw new Error(`Saga lost CN interval ${cell}/${interval.iid}`);
      }
      intervalsChecked++;
    }
  }
  expect(intervalsChecked).toBe(15834);
  const before = state;
  const open = actions.openPhylogenyCells(state.phylogenyHeatmap.cellIds, true);
  dispatch(open);
  await runSaga(options, openPhylogenyCells, open).toPromise();
  expect(state.cellTrackLoad).toEqual({ status: "ready", completed: 125, total: 125, errors: [] });
  expect(state.plots.filter((plot) => plot.type === "genome")).toHaveLength(125);
  state.plots.filter((plot) => plot.type === "genome").forEach((plot) => expect(plot.data).toBe(rawByPath.get(plot.path)));
  expect(state.plots[0]).toBe(tree);
  expect(state.domains).toBe(before.domains);
  expect(state.nodes).toBe(before.nodes);
  expect(state.phylogenyHeatmap.mutations).toBe(matrix);
  expect(axios.get).toHaveBeenCalledTimes(126);
  expect(loadArrowTable).not.toHaveBeenCalled();
  expect(state.selectedFiles).toHaveLength(126);
  expect(new Set(state.phylogenyAddedFiles).size).toBe(125);
  expect(new Set(state.selectedFiles.map(file => file.file))).toEqual(new Set([cohort.file, ...state.phylogenyHeatmap.cellIds]));
  state.selectedFiles.forEach(file => expect(file).toBe(datafiles.find(entry => entry.file === file.file)));
  dispatch(actions.clearPhylogenyTracks());
  expect(state.selectedFiles).toEqual([cohort]);
  expect(state.phylogenyAddedFiles).toEqual([]);
  expect(state.plots).toEqual([tree]);
  expect(state.phylogenyHeatmap.mutations).toBe(matrix);
  phylogenyLoader.invalidate();
}, 20000);
