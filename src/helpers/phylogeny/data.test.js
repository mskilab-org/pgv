import fs from "fs";
import path from "path";
import {
  parseNewick,
  leafIds,
  normalizeCopyNumber,
  parsePlotlyMutations,
} from "./data";

const bins = {
  "1": { startPlace: 1, startPoint: 1, endPoint: 1000 },
  "2": { startPlace: 1001, startPoint: 1, endPoint: 1000 },
};

function nodes(tree) {
  return [tree, ...tree.children.flatMap(nodes)];
}

describe("Newick identity and structure", () => {
  test("single leaf, omitted lengths, traversal order and multifurcations", () => {
    expect(parseNewick("cell;")).toEqual({
      id: "cell", name: "cell", length: 0, children: [],
    });
    const tree = parseNewick("(z:2,(b:0,a:.25)branch:1e-2,c)root:3;");
    expect(leafIds(tree)).toEqual(["z", "b", "a", "c"]);
    expect(tree.name).toBe("root");
    expect(tree.length).toBe(3);
    expect(tree.children[1]).toMatchObject({ name: "branch", length: 0.01 });
    expect(tree.children[1].children[1].length).toBe(0.25);
    expect(tree.children[2].length).toBe(0);
  });

  test("quoted punctuation, escaped quotes, whitespace and nested comments", () => {
    const tree = parseNewick(
      " [root[nested]] ( 'a,b: [x]' [comment]:+1.2E2, 'O''Brien':0, \"cell two\":.5 ) 'internal name' [x]: 2; [tail] "
    );
    expect(leafIds(tree)).toEqual(["a,b: [x]", "O'Brien", "cell two"]);
    expect(tree.children.map((n) => n.length)).toEqual([120, 0, 0.5]);
    expect(tree.name).toBe("internal name");
    expect(tree.length).toBe(2);
  });

  test("internal IDs deterministic, unique even with repeated names and leaf collisions", () => {
    const source = "((a,b)same,(c,__newick_internal_0)same)same;";
    const tree = parseNewick(source);
    expect(tree).toEqual(parseNewick(source));
    const all = nodes(tree);
    expect(new Set(all.map((n) => n.id)).size).toBe(all.length);
    expect(leafIds(tree)).toEqual(["a", "b", "c", "__newick_internal_0"]);
    all.forEach((n) => expect(Object.keys(n).sort()).toEqual(["children", "id", "length", "name"]));
  });

  test("rejects excessive nesting before exhausting the parser stack", () => {
    expect(() => parseNewick("(".repeat(514) + "a" + ")".repeat(514) + ";")).toThrow(/nesting/);
  });

  test.each([
    null, 12, "", ";",  "()r;", "(a,);", "(,a);", "(a,,b);", "(a,b;",
    "a,b;", "(a,b));", "(a b,c);", "(a,b)", "(a,b);extra", "(a,b);(c,d);",
    "('unterminated,b);", "(a,b)[unterminated;", "(a,b)];", "(a:word,b);",
    "(a:NaN,b);", "(a:Infinity,b);", "(a:1e999,b);", "(a:-1,b);", "(a:,b);",
    "(a:1:2,b);", "('',b);", "(a,a);", "('a',a);", "(a,(b,a));", "('a\u0000',b);", "('a\u007f',b);",
  ])("rejects malformed/duplicate input %p", (source) => {
    expect(() => parseNewick(source)).toThrow();
  });
});

describe("copy number normalization", () => {
  const interval = (overrides = {}) => ({
    iid: 1, chromosome: "1", startPoint: 1, endPoint: 20, y: 2, ...overrides,
  });

  test("preserves every boundary, ID and precise value with legacy placement and sorting", () => {
    const genome = { intervals: [
      interval({ iid: 3, chromosome: "2", startPoint: 0, endPoint: 0, y: null }),
      interval({ iid: 2, startPoint: 21, endPoint: 1002, y: 0 }),
      interval({ y: 1.23456789012345 }),
    ] };
    const original = JSON.stringify(genome);
    expect(normalizeCopyNumber(genome, bins)).toEqual([
      { iid: 1, chromosome: "1", startPoint: 1, endPoint: 20, start: 2, end: 21, cn: 1.23456789012345 },
      { iid: 2, chromosome: "1", startPoint: 21, endPoint: 1002, start: 22, end: 1003, cn: 0 },
      { iid: 3, chromosome: "2", startPoint: 0, endPoint: 0, start: 1001, end: 1001, cn: null },
    ]);
    expect(JSON.stringify(genome)).toBe(original);
    expect(normalizeCopyNumber({ intervals: [] }, bins)).toEqual([]);
  });

  test("does not merge duplicate geometry or reorder equal starts", () => {
    const result = normalizeCopyNumber({ intervals: [interval({ iid: 7 }), interval({ iid: 3 })] }, bins);
    expect(result.map((i) => i.iid)).toEqual([7, 3]);
  });

  test.each([
    { chromosome: "unknown" }, { chromosome: "__proto__" },
    { startPoint: -1 }, { startPoint: NaN }, { endPoint: Infinity },
    { startPoint: "1" }, { startPoint: 21 }, { y: undefined }, { y: "2" },
    { y: NaN }, { y: -1 },
  ])("rejects invalid interval %p", (overrides) => {
    expect(() => normalizeCopyNumber({ intervals: [interval(overrides)] }, bins)).toThrow();
  });

  test.each([null, {}, { intervals: null }, { intervals: [null] }])("rejects malformed genome %p", (genome) => {
    expect(() => normalizeCopyNumber(genome, bins)).toThrow();
  });
});

// Deliberately rounded tooltip numerics: only marker.color is authoritative.
function figureFrom(rows = ["cell-b", "cell-a"], sites = ["chr2_20_G_A", "chr1_10_C_T"], valueAt = (r, c) => [[0, null], [0.666666666666667, 1]][r][c]) {
  const trace = { type: "bar", orientation: "h", y: [], text: [], x: [], base: [], width: [], marker: { color: [] } };
  sites.forEach((site, column) => {
    for (let row = rows.length - 1; row >= 0; row -= 1) {
      const value = valueAt(row, column);
      trace.y.push(100 + row * 3);
      trace.text.push(`<b>${rows[row]}</b><br>${site}<br>Value: ${value === null ? "NA" : Number(value.toPrecision(3))}`);
      trace.marker.color.push(value);
      trace.x.push(123.45); // Plotly bar geometry is not a genomic coordinate.
      trace.base.push(999999);
      trace.width.push(1);
    }
  });
  return { data: [trace], layout: { yaxis: { tickvals: rows.map((_, r) => 100 + r * 3), ticktext: rows } } };
}

function splitTraces(figure, cut) {
  const trace = figure.data[0];
  figure.data = [[0, cut], [cut, trace.y.length]].map(([start, end]) => ({
    ...trace,
    y: trace.y.slice(start, end), text: trace.text.slice(start, end),
    x: trace.x.slice(start, end), base: trace.base.slice(start, end), width: trace.width.slice(start, end),
    marker: { color: trace.marker.color.slice(start, end) },
  }));
  return figure;
}

describe("lossless Plotly adapter", () => {
  test("metadata row order, first-seen variant order, legacy places and full precision", () => {
    const figure = figureFrom();
    const original = JSON.stringify(figure);
    const result = parsePlotlyMutations(figure, bins);
    expect(result.cellIds).toEqual(["cell-b", "cell-a"]);
    expect(result.displayCellIds).toEqual(["cell-a", "cell-b"]);
    expect(result.variants).toEqual([
      { id: "chr2_20_G_A", chromosome: "2", position: 20, ref: "G", alt: "A", place: 1021 },
      { id: "chr1_10_C_T", chromosome: "1", position: 10, ref: "C", alt: "T", place: 11 },
    ]);
    expect(result.values).toBeInstanceOf(Float64Array);
    expect(result.missing).toBeInstanceOf(Uint8Array);
    expect(Array.from(result.values)).toEqual([0, NaN, 0.666666666666667, 1]);
    expect(Array.from(result.missing)).toEqual([0, 1, 0, 0]);
    expect(result.stats).toEqual({ cells: 2, variants: 2, entries: 4, missing: 1, zero: 1, positive: 2 });
    expect(JSON.stringify(figure)).toBe(original);
  });

  // Projection metadata is separate from immutable row-major storage. Sort numeric
  // ticks by screen direction; leave categorical axes to the renderer fallback.
  test.each([
    [{}, ["c", "b", "a"]],
    [{ range: [0, 200] }, ["c", "b", "a"]],
    [{ autorange: true }, ["c", "b", "a"]],
    [{ range: [200, 0] }, ["a", "b", "c"]],
    [{ autorange: "reversed" }, ["a", "b", "c"]],
    [{ autorange: "min reversed" }, ["a", "b", "c"]],
    [{ autorange: "max reversed" }, ["a", "b", "c"]],
  ])("numeric screen order handles unsorted ticks and axis direction %p", (axisOptions, expected) => {
    const figure = figureFrom(["a", "b", "c"], ["chr1_1_A_T"], r => r / 2);
    // Tick metadata order is not tick position order (and not trace order).
    figure.layout.yaxis = { tickvals: [103, 106, 100], ticktext: ["b", "c", "a"], ...axisOptions };
    const original = JSON.stringify(figure);
    const result = parsePlotlyMutations(figure, bins);
    expect(result.displayCellIds).toEqual(expected);
    expect(result.cellIds).toEqual(["b", "c", "a"]);
    expect(Array.from(result.values)).toEqual([0.5, 1, 0]);
    expect(Array.from(result.missing)).toEqual([0, 0, 0]);
    expect(JSON.stringify(figure)).toBe(original);
  });

  test.each(["category", "multicategory", "string ticks", "mixed ticks"])("%s uses the native tree-order fallback instead of guessing category positions", kind => {
    const figure = figureFrom();
    if (kind === "category" || kind === "multicategory") figure.layout.yaxis.type = kind;
    else {
      const ticks = kind === "string ticks" ? ["one", "two"] : [100, "two"];
      figure.data[0].y = figure.data[0].y.map(tick => ticks[figure.layout.yaxis.tickvals.indexOf(tick)]);
      figure.layout.yaxis.tickvals = ticks;
    }
    const result = parsePlotlyMutations(figure, bins);
    expect(result.displayCellIds).toBeUndefined();
    expect(result.cellIds).toEqual(["cell-b", "cell-a"]);
    expect(Array.from(result.values)).toEqual([0, NaN, 0.666666666666667, 1]);
  });

  test("multiple traces and trace point order do not dictate cell order", () => {
    const figure = splitTraces(figureFrom(), 3);
    expect(parsePlotlyMutations(figure, bins)).toEqual(parsePlotlyMutations(figureFrom(), bins));
  });

  test("supports chr-prefixed bins without taking genome positions from bars", () => {
    const result = parsePlotlyMutations(figureFrom(), { chr1: bins["1"], chr2: bins["2"] });
    expect(result.variants.map((v) => [v.chromosome, v.place])).toEqual([["chr2", 1021], ["chr1", 11]]);
  });

  test("empty source has explicitly empty typed buffers", () => {
    const result = parsePlotlyMutations(figureFrom([], [], () => 0), bins);
    expect(result.stats).toEqual({ cells: 0, variants: 0, entries: 0, missing: 0, zero: 0, positive: 0 });
    expect(result.cellIds).toEqual([]);
    expect(result.displayCellIds).toEqual([]);
    expect(result.values.length).toBe(0);
  });

  test.each([
    ["missing layout", (f) => { delete f.layout; }],
    ["missing metadata", (f) => { delete f.layout.yaxis.ticktext; }],
    ["mismatched metadata", (f) => { f.layout.yaxis.tickvals.pop(); }],
    ["duplicate cell", (f) => { f.layout.yaxis.ticktext[1] = "cell-b"; }],
    ["duplicate row coordinate", (f) => { f.layout.yaxis.tickvals[1] = 100; }],
    ["sparse row metadata", (f) => { delete f.layout.yaxis.ticktext[0]; }],
    ["control character cell", (f) => { f.layout.yaxis.ticktext[0] = "cell\u0000"; }],
    ["unsafe cell", (f) => { f.layout.yaxis.ticktext[0] = "<script>alert(1)</script>"; }],
    ["prototype cell", (f) => { f.layout.yaxis.ticktext[0] = "__proto__"; }],
    ["unknown row", (f) => { f.data[0].y[0] = 999; }],
    ["cell/row mismatch", (f) => { f.data[0].text[0] = f.data[0].text[0].replace("cell-a", "cell-b"); }],
    ["short values", (f) => { f.data[0].marker.color.pop(); }],
    ["short text", (f) => { f.data[0].text.pop(); }],
    ["short x", (f) => { f.data[0].x.pop(); }],
    ["short base", (f) => { f.data[0].base.pop(); }],
    ["short width", (f) => { f.data[0].width.pop(); }],
    ["non-finite geometry", (f) => { f.data[0].base[0] = Infinity; }],
    ["numeric string VAF", (f) => { f.data[0].marker.color[0] = "0.5"; }],
    ["undefined VAF", (f) => { f.data[0].marker.color[0] = undefined; }],
    ["NaN VAF", (f) => { f.data[0].marker.color[0] = NaN; }],
    ["infinite VAF", (f) => { f.data[0].marker.color[0] = Infinity; }],
    ["negative VAF", (f) => { f.data[0].marker.color[0] = -0.1; }],
    ["VAF above 1", (f) => { f.data[0].marker.color[0] = 1.1; }],
    ["unknown chromosome", (f) => { f.data[0].text[0] = f.data[0].text[0].replace("chr2_", "chrUn_"); }],
    ["unsafe position", (f) => { f.data[0].text[0] = f.data[0].text[0].replace("_20_", "_9007199254740993_"); }],
    ["malformed position", (f) => { f.data[0].text[0] = f.data[0].text[0].replace("_20_", "_2.5_"); }],
    ["HTML in tooltip", (f) => { f.data[0].text[0] += "<script>throw Error()</script>"; }],
    ["event handler", (f) => { f.data[0].text[0] = f.data[0].text[0].replace("<b>", "<b onclick='evil()'>"); }],
    ["malformed alleles", (f) => { f.data[0].text[0] = f.data[0].text[0].replace("_G_A", "_G_<img>"); }],
    ["wrong trace type", (f) => { f.data[0].type = "scatter"; }],
    ["wrong axis", (f) => { f.data[0].yaxis = "y2"; }],
  ])("rejects %s", (_, change) => {
    const figure = figureFrom();
    change(figure);
    expect(() => parsePlotlyMutations(figure, bins)).toThrow();
  });

  test("rejects a duplicate/missing pair even when total dimensions still match", () => {
    const figure = figureFrom();
    figure.data[0].y[1] = figure.data[0].y[0];
    figure.data[0].text[1] = figure.data[0].text[0];
    expect(() => parsePlotlyMutations(figure, bins)).toThrow(/duplicate/i);
  });

  test("rejects a missing pair across trace boundaries", () => {
    const figure = splitTraces(figureFrom(), 3);
    figure.data.pop();
    expect(() => parsePlotlyMutations(figure, bins)).toThrow(/missing|complete/i);
  });

  test("rejects duplicate variant identities spelled with chromosome aliases", () => {
    const figure = figureFrom(["a"], ["chr1_10_A_T", "1_10_A_T"], () => 0);
    expect(() => parsePlotlyMutations(figure, bins)).toThrow(/duplicate/i);
  });
});

// Every generated value is checked, not just dimensions or selected entries.
test("portable complete 125-cell / 736-site / 92000-entry matrix", () => {
  const rows = Array.from({ length: 125 }, (_, r) => `cell-${124 - r}`);
  const sites = Array.from({ length: 736 }, (_, c) => `chr${c % 2 + 1}_${736 - c}_A_T`);
  const valueAt = (r, c) => {
    const i = r * 736 + c;
    return i < 1081 ? null : i < 1081 + 58632 ? 0 : (i % 997 + 1) / 997;
  };
  const result = parsePlotlyMutations(splitTraces(figureFrom(rows, sites, valueAt), 46003), bins);
  expect(result.cellIds).toEqual(rows);
  expect(result.displayCellIds).toEqual(rows.slice().reverse());
  expect(result.variants.map((v) => v.id)).toEqual(sites);
  expect(result.stats).toEqual({ cells: 125, variants: 736, entries: 92000, missing: 1081, zero: 58632, positive: 32287 });
  let checked = 0;
  for (let r = 0; r < 125; r += 1) {
    for (let c = 0; c < 736; c += 1) {
      const i = r * 736 + c;
      const expected = valueAt(r, c);
      // Fail fast with a useful exact coordinate, without 184000 Jest matcher allocations.
      if (!Object.is(result.values[i], expected === null ? NaN : expected) || result.missing[i] !== Number(expected === null)) {
        throw new Error(`Generated matrix mismatch at ${rows[r]} / ${sites[c]} (${i})`);
      }
      checked += 1;
    }
  }
  expect(checked).toBe(92000);
});

const fixturePath = path.resolve(process.cwd(), "public/data/BWH70_phylogeny/mutations.plotly.json");
const fixtureTest = fs.existsSync(fixturePath) ? test : test.skip;

fixtureTest("LOCAL FULL FIXTURE (explicitly skipped only when JSON absent): all 92000 pairs, 125 tree IDs and 15834 CN intervals", () => {
  const figure = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const settings = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "public/settings.json"), "utf8"));
  const localBins = {};
  let boundary = 0;
  settings.coordinates.sets.hg38.forEach((chr) => {
    localBins[chr.chromosome] = { ...chr, startPlace: boundary + chr.startPoint };
    boundary += chr.endPoint;
  });
  const matrix = parsePlotlyMutations(figure, localBins);
  expect(matrix.stats).toEqual({ cells: 125, variants: 736, entries: 92000, missing: 1081, zero: 58632, positive: 32287 });
  expect(matrix.cellIds).toEqual(figure.layout.yaxis.ticktext);
  const rowByTick = new Map(figure.layout.yaxis.tickvals.map((tick, row) => [tick, row]));
  const colById = new Map(matrix.variants.map((v, col) => [v.id, col]));
  const seen = new Uint8Array(92000);
  const sourceOrder = new Set();
  let checked = 0;
  let missing = 0;
  let zero = 0;
  let positive = 0;
  for (const trace of figure.data) {
    for (let j = 0; j < trace.y.length; j += 1) {
      // Independent simple splitter is the test oracle, not the adapter's regex/parser.
      const parts = trace.text[j].split("<br>");
      const cell = parts[0].slice(3, -4);
      const id = parts[1];
      const [chromosome, point, ref, alt] = id.split("_");
      const row = rowByTick.get(trace.y[j]);
      const col = colById.get(id);
      if (matrix.cellIds[row] !== cell || col === undefined) throw new Error(`ID mismatch at source ${j}`);
      sourceOrder.add(id);
      const variant = matrix.variants[col];
      const chr = chromosome.replace(/^chr/, "");
      if (variant.chromosome !== chr || variant.position !== Number(point) || variant.ref !== ref || variant.alt !== alt || variant.place !== localBins[chr].startPlace + Number(point)) {
        throw new Error(`Variant metadata mismatch at source ${j}: ${id}`);
      }
      const i = row * 736 + col;
      const value = trace.marker.color[j];
      if (seen[i] || !Object.is(matrix.values[i], value === null ? NaN : value) || matrix.missing[i] !== Number(value === null)) {
        throw new Error(`Actual matrix mismatch at ${cell} / ${id} (source ${j}, matrix ${i})`);
      }
      seen[i] = 1;
      if (value === null) missing += 1;
      else if (value === 0) zero += 1;
      else positive += 1;
      checked += 1;
    }
  }
  expect(checked).toBe(92000);
  expect(seen.every((v) => v === 1)).toBe(true);
  expect([missing, zero, positive]).toEqual([1081, 58632, 32287]);
  expect(matrix.variants.map((v) => v.id)).toEqual(Array.from(sourceOrder));
  const knownRow = matrix.cellIds.indexOf("BWH70_MR_1_pl1_10c");
  expect(matrix.variants[0].id).toBe("chr17_26867149_A_T");
  expect(matrix.values[knownRow * 736]).toBe(0.666666666666667);

  const treeText = fs.readFileSync(path.join(path.dirname(fixturePath), "BWH70_phylogeny_without_normal.newick"), "utf8");
  const ids = leafIds(parseNewick(treeText));
  expect(ids).toEqual(matrix.cellIds);
  expect(figure.layout.yaxis.range).toEqual([0.5, 125.5]);
  expect(figure.layout.yaxis.tickvals).toEqual(Array.from({ length: 125 }, (_, i) => i + 1));
  // Compare all125 positions to independently parsed Newick, not just endpoints.
  expect(matrix.displayCellIds).toEqual(ids.slice().reverse());
  expect(matrix.displayCellIds.slice(0, 3)).toEqual(["BWH70_MR_1_pl1_10a", "BWH70_MR_1_pl1_5g", "BWH70_MR_1_pl1_10c"]);
  expect(matrix.displayCellIds.slice(-3)).toEqual(["BWH70_MR_2_pl1_12e", "BWH70_MR_2_pl1_12h", "BWH70_MR_3_pl1_11g"]);
  let checkedIntervals = 0;
  for (const cell of matrix.cellIds) {
    const genome = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "public/data", cell, "genome.json"), "utf8"));
    const intervals = normalizeCopyNumber(genome, localBins);
    expect(intervals.length).toBe(genome.intervals.length);
    const expected = genome.intervals.slice().sort((a, b) =>
      (localBins[a.chromosome].startPlace + a.startPoint) - (localBins[b.chromosome].startPlace + b.startPoint)
    );
    for (let i = 0; i < expected.length; i += 1) {
      const raw = expected[i];
      const actual = intervals[i];
      if (actual.iid !== raw.iid || actual.chromosome !== raw.chromosome || actual.startPoint !== raw.startPoint || actual.endPoint !== raw.endPoint || actual.cn !== raw.y || actual.start !== localBins[raw.chromosome].startPlace + raw.startPoint || actual.end !== localBins[raw.chromosome].startPlace + raw.endPoint) {
        throw new Error(`CN mismatch at ${cell} / iid ${raw.iid}`);
      }
      checkedIntervals += 1;
    }
  }
  expect(checkedIntervals).toBe(15834);
}, 20000);
