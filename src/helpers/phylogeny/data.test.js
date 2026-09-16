import fs from "fs";
import path from "path";
import os from "os";
import { spawnSync } from "child_process";
import {
  parseNewick,
  leafIds,
  normalizeCopyNumber,
  normalizeAllelicCopyNumber,
  parsePlotlyMutations,
  parseSparseMutations,
  parseJunctionCopyNumber,
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

describe("allelic copy-number and sparse mutation adapters", () => {
  test("normalizes major/minor intervals with the same genomic placement", () => {
    const result = normalizeAllelicCopyNumber({ intervals: [
      { iid: 2, chromosome: "2", startPoint: 3, endPoint: 8, majorCn: 2, minorCn: 0 },
      { iid: 1, chromosome: "1", startPoint: 1, endPoint: 2, majorCn: null, minorCn: 1 },
    ] }, bins);
    expect(result).toEqual([
      { iid: 1, chromosome: "1", startPoint: 1, endPoint: 2, start: 2, end: 3, majorCn: null, minorCn: 1 },
      { iid: 2, chromosome: "2", startPoint: 3, endPoint: 8, start: 1004, end: 1009, majorCn: 2, minorCn: 0 },
    ]);
    expect(() => normalizeAllelicCopyNumber({ intervals: [{ chromosome: "1", startPoint: 1, endPoint: 2, majorCn: -1 }] }, bins)).toThrow();
  });

  test("pairs legacy y by locus, not source adjacency, color or IID", () => {
    const locus = { chromosome: "1", startPoint: 1, endPoint: 20 };
    const intervals = [
      { ...locus, iid: 101, y: 0, metadata: { color: "red" } },
      { ...locus, startPoint: 21, endPoint: 40, iid: 102, y: 4, metadata: { color: "blue" } },
      { ...locus, chromosome: "chr1", iid: 201, y: 3, metadata: { color: "blue" } },
      { ...locus, startPoint: 21, endPoint: 40, iid: 202, y: 1, metadata: { color: "red" } },
      { ...locus, chromosome: "2", iid: 101, y: 2 },
      { ...locus, chromosome: "2", iid: 101, y: 2 },
    ];
    const original = JSON.stringify(intervals);
    const result = normalizeAllelicCopyNumber({ intervals }, bins);
    expect(result.map(({ chromosome, startPoint, endPoint, majorCn, minorCn }) => [chromosome, startPoint, endPoint, majorCn, minorCn])).toEqual([
      ["1", 1, 20, 3, 0], ["1", 21, 40, 4, 1], ["2", 1, 20, 2, 2],
    ]);
    result.forEach(interval => expect(Object.prototype.hasOwnProperty.call(interval, "iid")).toBe(false));
    expect(JSON.stringify(intervals)).toBe(original);
  });

  test.each([null, undefined])("a missing legacy allele (%p) cannot establish either rank", missing => {
    const locus = { chromosome: "1", startPoint: 1, endPoint: 20 };
    expect(normalizeAllelicCopyNumber({ intervals: [{ ...locus, y: missing }, { ...locus, y: 3 }] }, bins)[0]).toMatchObject({ majorCn: null, minorCn: null });
  });

  test.each([[2], [2, 1, 0], [2, -1], [2, "1"], [2, NaN], [2, Infinity]].map(values => [values]))("rejects malformed legacy pair %p", values => {
    const intervals = values.map(y => ({ chromosome: "1", startPoint: 1, endPoint: 20, y }));
    expect(() => normalizeAllelicCopyNumber({ intervals }, bins)).toThrow(/observations|value/);
  });

  test("reference/alternate read counts default omitted/null fields and absent observations to zero", () => {
    const source = { schemaVersion: 1, variants: [{ id: "chr1_10_C_T" }, { id: "chr2_20_G_A" }], countFields: ["refCount", "altCount"], cells: {
      b: [{ variantId: "chr2_20_G_A", vaf: 0, refCount: 12, altCount: 0 }],
      a: [{ variantId: "chr1_10_C_T", vaf: 9 / 13, refCount: 4, altCount: 9 }, { variantId: "chr2_20_G_A", vaf: 1, refCount: null }],
    } };
    const result = parseSparseMutations(source, bins);
    expect(result.cellIds).toEqual(["b", "a"]);
    expect(result.variants.map(variant => variant.id)).toEqual(["chr1_10_C_T", "chr2_20_G_A"]);
    expect(result.refCounts).toEqual(new Float64Array([0, 12, 4, 0]));
    expect(result.altCounts).toEqual(new Float64Array([0, 0, 9, 0]));
    expect(result.countFields).toEqual(["refCount", "altCount"]);
    expect(result).not.toHaveProperty("majorCounts");
    expect(result).not.toHaveProperty("minorCounts");
    expect(result.values[2]).toBe(9 / 13);
    expect(() => parseSparseMutations({ ...source, countFields: ["majorCount"] }, bins)).toThrow(/countFields/);
    expect(() => parseSparseMutations({ ...source, cells: { b: [{ variantId: "chr2_20_G_A", refCount: -1 }] } }, bins)).toThrow(/refCount/);
    expect(() => parseSparseMutations({ ...source, cells: { b: [{ variantId: "chr2_20_G_A", altCount: "1" }] } }, bins)).toThrow(/altCount/);
  });

  test("keeps catalog order and stable readable IDs while defaulting absent data to zero", () => {
    const source = {
      schemaVersion: 1,
      variants: [
        { id: "chr2_20_G_A", chromosome: "2", position: 20, ref: "G", alt: "A" },
        { id: "chr1_10_C_T", chromosome: "1", position: 10, ref: "C", alt: "T" },
        { id: "chr1_30_A_G", chromosome: "1", position: 30, ref: "A", alt: "G" },
      ],
      cells: {
        "cell-b": [{ variantId: "chr2_20_G_A", vaf: null, refCount: 2 }],
        "cell-a": [{ variantId: "chr1_10_C_T", vaf: 0.75, altCount: 1 }],
      },
    };
    const result = parseSparseMutations(source, bins);
    expect(result.variants.map(variant => variant.id)).toEqual(["chr2_20_G_A", "chr1_10_C_T"]);
    expect(result.cellIds).toEqual(["cell-b", "cell-a"]);
    expect(result.values).toEqual(new Float64Array([0, 0, 0, 0.75]));
    expect(result.refCounts).toEqual(new Float64Array([2, 0, 0, 0]));
    expect(result.altCounts).toEqual(new Float64Array([0, 0, 0, 1]));
    expect(result.missing).toEqual(new Uint8Array(4));
    expect(result.stats).toEqual({ cells: 2, variants: 2, entries: 4, observations: 2, missing: 0, zero: 3, positive: 1 });
    expect(() => parseSparseMutations({ ...source, cells: { "cell-a": [{ variantId: "unknown" }] } }, bins)).toThrow(/Unknown/);
    expect(() => parseSparseMutations({ ...source, variants: source.variants, cells: { "cell-a": [{ variantId: "chr1_10_C_T" }, { variantId: "chr1_10_C_T" }] } }, bins)).toThrow(/Duplicate/);
    const active = parseSparseMutations({ ...source, cells: { ...source.cells, outsider: [{ variantId: "chr1_30_A_G", vaf: 1 }] } }, bins, ["cell-a"]);
    expect(active.cellIds).toEqual(["cell-a"]);
    expect(active.variants.map(variant => variant.id)).toEqual(["chr1_10_C_T"]);
    expect(Array.from(active.values)).toEqual([0.75]);
  });
});

describe("sparse read-count contract", () => {
  test.each([undefined, [], ["refCount"], ["altCount"], ["refCount", "altCount"]].map(fields => [fields]))("always returns both typed count buffers with countFields %p", countFields => {
    const source = { schemaVersion: 1, variants: [{ id: "chr1_10_C_T" }], cells: {
      a: [{ variantId: "chr1_10_C_T", vaf: 0.25 }],
      b: [{ variantId: "chr1_10_C_T", vaf: null, refCount: null, altCount: null }],
    }, countFields };
    const original = JSON.stringify(source);
    const result = parseSparseMutations(source, bins, ["a", "b", "absent"]);
    expect(result.values).toEqual(new Float64Array([0.25, 0, 0]));
    expect(result.refCounts).toEqual(new Float64Array(3));
    expect(result.altCounts).toEqual(new Float64Array(3));
    expect(result.missing).toEqual(new Uint8Array(3));
    expect(result.stats).toEqual({ cells: 3, variants: 1, entries: 3, observations: 2, missing: 0, zero: 2, positive: 1 });
    expect(JSON.stringify(source)).toBe(original);

    const empty = parseSparseMutations({ schemaVersion: 1, variants: [], cells: {}, countFields }, bins);
    expect(empty.values).toEqual(new Float64Array(0));
    expect(empty.refCounts).toEqual(new Float64Array(0));
    expect(empty.altCounts).toEqual(new Float64Array(0));
    expect(empty.stats).toEqual({ cells: 0, variants: 0, entries: 0, observations: 0, missing: 0, zero: 0, positive: 0 });
  });

  test("uses only active-tree VAF/ref/alt nonzero observations to form the ordered universe", () => {
    const ids = ["chr2_20_G_A", "chr1_10_C_T", "chr1_30_A_G", "chr1_40_A_C", "chr1_50_T_C"];
    const source = { schemaVersion: 1, variants: ids.map(id => ({ id })), cells: {
      b: [{ variantId: ids[0], refCount: 4 }],
      a: [{ variantId: ids[2], altCount: 7 }, { variantId: ids[1], vaf: 0.5 }, { variantId: ids[3], vaf: null, refCount: 0, altCount: null }],
      outsider: [{ variantId: ids[4], vaf: 1, refCount: 2, altCount: 3 }, { variantId: ids[3], altCount: 1 }],
    } };
    const result = parseSparseMutations(source, bins, ["a", "b", "absent"]);
    expect(result.cellIds).toEqual(["a", "b", "absent"]);
    expect(result.variants.map(variant => variant.id)).toEqual(ids.slice(0, 3));
    expect(result.values).toEqual(new Float64Array([0, 0.5, 0, 0, 0, 0, 0, 0, 0]));
    expect(result.refCounts).toEqual(new Float64Array([0, 0, 0, 4, 0, 0, 0, 0, 0]));
    expect(result.altCounts).toEqual(new Float64Array([0, 0, 7, 0, 0, 0, 0, 0, 0]));
    expect(result.stats).toEqual({ cells: 3, variants: 3, entries: 9, observations: 3, missing: 0, zero: 8, positive: 1 });
    expect(parseSparseMutations(source, bins, ["absent"]).variants).toEqual([]);
    expect(parseSparseMutations(source, bins, []).variants).toEqual([]);
  });

  test("ignores old mislabeled extra fields instead of validating, retaining sites or deriving counts from them", () => {
    const source = { schemaVersion: 1, variants: [{ id: "chr1_10_C_T" }, { id: "chr2_20_G_A" }], cells: {
      a: [{ variantId: "chr1_10_C_T", vaf: 0.5 }, { variantId: "chr2_20_G_A" }],
    } };
    const mislabeled = { ...source, majorCounts: [99, 99], minorCounts: [42, 42], cells: {
      a: [
        { ...source.cells.a[0], majorCount: "invalid", minorCount: -1 },
        { ...source.cells.a[1], majorCount: 99, minorCount: 42 },
      ],
    } };
    const result = parseSparseMutations(mislabeled, bins);
    expect(result).toEqual(parseSparseMutations(source, bins));
    expect(result.variants.map(variant => variant.id)).toEqual(["chr1_10_C_T"]);
    expect(result.refCounts).toEqual(new Float64Array([0]));
    expect(result.altCounts).toEqual(new Float64Array([0]));
    expect(result).not.toHaveProperty("majorCounts");
    expect(result).not.toHaveProperty("minorCounts");
  });

  test.each(["refCount", "altCount"])("validates supplied %s without requiring countFields metadata", field => {
    [-1, "1", NaN, Infinity, false].forEach(value => {
      const source = { schemaVersion: 1, variants: [{ id: "chr1_10_C_T" }], cells: {
        a: [{ variantId: "chr1_10_C_T", [field]: value }],
      } };
      expect(() => parseSparseMutations(source, bins)).toThrow(field);
    });
  });

  test.each([null, "refCount", ["refCount", "refCount"], ["unknown"]].map(fields => [fields]))("rejects invalid countFields %p", countFields => {
    expect(() => parseSparseMutations({ schemaVersion: 1, variants: [], cells: {}, countFields }, bins)).toThrow(/countFields/);
  });
});

describe("ordered junction copy-number matrix", () => {
  const source = () => ({ schemaVersion: 1, cellIds: ["cell-z", "cell-a"], junctions: [
    { id: "10:132180758-132180758+ <-> 11:50354829-50354829+" },
    { id: "1:1-1- <-> 2:2-2+" },
  ], values: [[null, 2.1234567890123457], [0, 9]] });

  test("preserves all cell/column order, source values, literal labels and nulls", () => {
    const raw = source();
    const original = JSON.stringify(raw);
    const result = parseJunctionCopyNumber(raw);
    expect(result.cellIds).toEqual(raw.cellIds);
    expect(result.variants).toEqual(raw.junctions);
    expect(result.values).toEqual(new Float64Array([NaN, 2.1234567890123457, 0, 9]));
    expect(result.missing).toEqual(new Uint8Array([1, 0, 0, 0]));
    expect(result.format).toBe("junction");
    expect(result.stats).toEqual({ cells: 2, variants: 2, entries: 4, missing: 1, zero: 1, positive: 2 });
    expect(JSON.stringify(raw)).toBe(original);
    expect(parseJunctionCopyNumber({ schemaVersion: 1, cellIds: [], junctions: [], values: [] }).values).toEqual(new Float64Array(0));
  });

  test.each([
    ["version", raw => { raw.schemaVersion = 2; }],
    ["missing cell IDs", raw => { delete raw.cellIds; }],
    ["duplicate cell", raw => { raw.cellIds[1] = raw.cellIds[0]; }],
    ["unsafe cell", raw => { raw.cellIds[0] = "__proto__"; }],
    ["row count", raw => { raw.values.pop(); }],
    ["column count", raw => { raw.values[0].pop(); }],
    ["missing row", raw => { delete raw.values[0]; }],
    ["missing value", raw => { delete raw.values[1][1]; }],
    ["duplicate junction", raw => { raw.junctions[1] = raw.junctions[0]; }],
    ["empty junction", raw => { raw.junctions[0].id = " "; }],
    ["control character", raw => { raw.junctions[0].id = "j\u0000"; }],
    ["negative", raw => { raw.values[0][0] = -1; }],
    ["nonfinite", raw => { raw.values[0][0] = Infinity; }],
    ["NaN", raw => { raw.values[0][0] = NaN; }],
    ["numeric string", raw => { raw.values[0][0] = "1"; }],
  ])("rejects %s", (_, mutate) => {
    const raw = source();
    mutate(raw);
    expect(() => parseJunctionCopyNumber(raw)).toThrow();
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
    expect(result.refCounts).toEqual(new Float64Array(4).fill(NaN));
    expect(result.altCounts).toEqual(new Float64Array(4).fill(NaN));
    expect(result).not.toHaveProperty("majorCounts");
    expect(result).not.toHaveProperty("minorCounts");
    expect(result.stats).toEqual({ cells: 2, variants: 2, entries: 4, missing: 1, zero: 1, positive: 2 });
    expect(JSON.stringify(figure)).toBe(original);
  });

  test("legacy counts are unavailable, never inferred from VAF or unrecognized count fields", () => {
    const figure = figureFrom();
    const expected = parsePlotlyMutations(figure, bins);
    figure.majorCounts = [4, 5, 6, 7];
    figure.minorCounts = [1, 2, 3, 4];
    figure.data[0].majorCount = [4, 5, 6, 7];
    figure.data[0].minorCount = [1, 2, 3, 4];
    figure.data[0].refCount = [10, 20, 30, 40];
    figure.data[0].altCount = [5, 10, 15, 20];
    const result = parsePlotlyMutations(figure, bins);
    expect(result).toEqual(expected);
    expect(result.refCounts.every(Number.isNaN)).toBe(true);
    expect(result.altCounts.every(Number.isNaN)).toBe(true);
    expect(result.missing).toEqual(new Uint8Array([0, 1, 0, 0]));
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
    expect(result.refCounts).toEqual(new Float64Array(0));
    expect(result.altCounts).toEqual(new Float64Array(0));
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
      if (!Object.is(result.values[i], expected === null ? NaN : expected) || result.missing[i] !== Number(expected === null) ||
          !Number.isNaN(result.refCounts[i]) || !Number.isNaN(result.altCounts[i])) {
        throw new Error(`Generated matrix mismatch at ${rows[r]} / ${sites[c]} (${i})`);
      }
      checked += 1;
    }
  }
  expect(checked).toBe(92000);
});

const fixturePath = path.resolve(process.cwd(), "public/data/BWH70_phylogeny/mutations.json");
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
      if (seen[i] || !Object.is(matrix.values[i], value === null ? NaN : value) || matrix.missing[i] !== Number(value === null) ||
          !Number.isNaN(matrix.refCounts[i]) || !Number.isNaN(matrix.altCounts[i])) {
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

const convertedPath = path.resolve(process.cwd(), "public/data/BWH70_phylogeny/mutations.sparse.json");
const junctionPath = path.resolve(process.cwd(), "public/data/BWH70_phylogeny/junctions.json");
const convertedTest = fs.existsSync(convertedPath) && fs.existsSync(junctionPath) ? test : test.skip;

convertedTest("LOCAL RDS CONVERSION: every SNV value/read count and junction entry retains source JSON order", () => {
  const source = JSON.parse(fs.readFileSync(convertedPath, "utf8"));
  const settings = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "public/settings.json"), "utf8"));
  const localBins = Object.fromEntries(settings.coordinates.sets.hg38.map(chr => [chr.chromosome, { ...chr, startPlace: 0 }]));
  const result = parseSparseMutations(source, localBins);
  expect(result.cellIds).toEqual(Object.keys(source.cells));
  expect(result.cellIds).toHaveLength(130);
  expect(result.variants.map(variant => variant.id)).toEqual(source.variants.map(variant => variant.id));
  expect(result.variants).toHaveLength(8878);
  expect(result.stats.entries).toBe(1154140);
  expect(result.countFields).toEqual(["refCount", "altCount"]);
  expect(result.refCounts).toBeInstanceOf(Float64Array);
  expect(result.altCounts).toBeInstanceOf(Float64Array);
  expect(result).not.toHaveProperty("majorCounts");
  expect(result).not.toHaveProperty("minorCounts");
  const columns = new Map(result.variants.map((variant, index) => [variant.id, index]));
  let checked = 0;
  let positive = 0;
  result.cellIds.forEach((id, row) => {
    source.cells[id].forEach(observation => {
      const offset = row * result.variants.length + columns.get(observation.variantId);
      if (result.values[offset] !== (observation.vaf == null ? 0 : observation.vaf) ||
          result.refCounts[offset] !== (observation.refCount == null ? 0 : observation.refCount) ||
          result.altCounts[offset] !== (observation.altCount == null ? 0 : observation.altCount) ||
          result.missing[offset] !== 0 || "majorCount" in observation || "minorCount" in observation) {
        throw new Error(`SNV conversion/adapter mismatch: ${id}/${observation.variantId}`);
      }
      if (observation.vaf > 0) positive += 1;
      checked += 1;
    });
  });
  expect(checked).toBe(1154140);
  expect(result.stats).toEqual({ cells: 130, variants: 8878, entries: 1154140, observations: checked, missing: 0, zero: 1154140 - positive, positive });
  const junctionSource = JSON.parse(fs.readFileSync(junctionPath, "utf8"));
  const junctions = parseJunctionCopyNumber(junctionSource);
  expect(junctions.cellIds).toEqual(junctionSource.cellIds);
  expect(junctions.variants).toEqual(junctionSource.junctions);
  expect(junctions.stats).toEqual({ cells: 125, variants: 67, entries: 8375, missing: 0, zero: 6150, positive: 2225 });
  expect(Array.from(junctions.values)).toEqual(junctionSource.values.flat());
}, 30000);

const realAllelicPath = path.resolve(process.cwd(), "public/data/BWH70_MR_1_pl1_10a/allelic.json");
const allelicFixtureTest = fs.existsSync(realAllelicPath) && fs.existsSync(fixturePath) ? test : test.skip;
allelicFixtureTest("LOCAL REAL ALLELIC: all 125 cells pair by coordinates, regardless of color/IID", () => {
  const ids = leafIds(parseNewick(fs.readFileSync(path.join(path.dirname(fixturePath), "BWH70_phylogeny_without_normal.newick"), "utf8")));
  const settings = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "public/settings.json"), "utf8"));
  const localBins = Object.fromEntries(settings.coordinates.sets.hg38.map(chr => [chr.chromosome, { ...chr, startPlace: 0 }]));
  let loci = 0;
  for (const cell of ids) {
    const raw = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "public/data", cell, "allelic.json"), "utf8"));
    const groups = new Map();
    raw.intervals.forEach(interval => {
      const key = [interval.chromosome, interval.startPoint, interval.endPoint].join(":");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(interval.y);
    });
    const result = normalizeAllelicCopyNumber(raw, localBins);
    expect(result.length * 2).toBe(raw.intervals.length);
    result.forEach(interval => {
      const key = [interval.chromosome, interval.startPoint, interval.endPoint].join(":");
      const values = groups.get(key);
      if (values.length !== 2 || interval.majorCn !== Math.max(...values) || interval.minorCn !== Math.min(...values) || "iid" in interval) {
        throw new Error(`Allelic pairing mismatch: ${cell}/${key}`);
      }
    });
    loci += result.length;
  }
  expect(ids).toHaveLength(125);
  expect(loci).toBe(15834);
}, 20000);

const rAvailable = spawnSync("Rscript", ["-e", 'quit(status=if (requireNamespace("jsonlite", quietly=TRUE)) 0 else 1)'], { encoding: "utf8" }).status === 0;
const converterTest = rAvailable ? test : test.skip;
converterTest("R converter preserves exact doubles, nulls, all zeros and original order/count names, and refuses overwrite", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "phylogeny-rds-"));
  const run = args => {
    const result = spawnSync("Rscript", args, { encoding: "utf8", timeout: 30000 });
    if (result.status !== 0) throw new Error(result.stderr || String(result.error));
    return result;
  };
  try {
    run(["-e", `d <- commandArgs(trailingOnly=TRUE)[1];
      s <- data.frame(pair=c("z","a","z"),mutation=c("chr2_20_G_A","chr1_10_C_T","chr1_10_C_T"),vaf=c(1/3,NA,0),ref.count.t=c(2,NA,0),alt.count.t=c(1,NA,0));
      j <- matrix(c(NA,1/3,0,2.1234567890123457),nrow=2,byrow=TRUE,dimnames=list(c("z","a"),c("2:2+ <-> 1:1-","1:1+ <-> 3:3-")));
      saveRDS(s,file.path(d,"s.rds")); saveRDS(j,file.path(d,"j.rds"));`, dir]);
    const inputSnvs = path.join(dir, "s.rds"), inputJcn = path.join(dir, "j.rds");
    const before = [fs.readFileSync(inputSnvs), fs.readFileSync(inputJcn)];
    const args = [path.resolve(process.cwd(), "scripts/convert-phylogeny-rds.R"), inputSnvs, inputJcn, dir];
    expect(run(args).stdout).toContain("exactly equal to RDS");
    const source = JSON.parse(fs.readFileSync(path.join(dir, "mutations.sparse.json"), "utf8"));
    expect(source.variants).toEqual([{ id: "chr2_20_G_A" }, { id: "chr1_10_C_T" }]);
    expect(Object.keys(source.cells)).toEqual(["z", "a"]);
    expect(source.cells.z).toEqual([
      { variantId: "chr2_20_G_A", vaf: 1 / 3, refCount: 2, altCount: 1 },
      { variantId: "chr1_10_C_T", vaf: 0, refCount: 0, altCount: 0 },
    ]);
    expect(source.cells.a).toEqual([{ variantId: "chr1_10_C_T", vaf: null, refCount: null, altCount: null }]);
    expect(source.countFields).toEqual(["refCount", "altCount"]);
    const matrix = parseSparseMutations(source, bins);
    expect(matrix.variants.map(variant => variant.id)).toEqual(["chr2_20_G_A"]);
    expect(matrix.values).toEqual(new Float64Array([1 / 3, 0]));
    expect(matrix.refCounts).toEqual(new Float64Array([2, 0]));
    expect(matrix.altCounts).toEqual(new Float64Array([1, 0]));
    expect(matrix.missing).toEqual(new Uint8Array(2));
    expect(matrix.stats).toEqual({ cells: 2, variants: 1, entries: 2, observations: 1, missing: 0, zero: 1, positive: 1 });
    const junctions = JSON.parse(fs.readFileSync(path.join(dir, "junctions.json"), "utf8"));
    expect(junctions).toEqual({ schemaVersion: 1, cellIds: ["z", "a"], junctions: [{ id: "2:2+ <-> 1:1-" }, { id: "1:1+ <-> 3:3-" }], values: [[null, 1 / 3], [0, 2.1234567890123457]] });
    expect(parseJunctionCopyNumber(junctions).missing).toEqual(new Uint8Array([1, 0, 0, 0]));
    const rerun = spawnSync("Rscript", args, { encoding: "utf8" });
    expect(rerun.status).not.toBe(0);
    expect(rerun.stderr).toContain("Refusing to overwrite");
    expect([fs.readFileSync(inputSnvs), fs.readFileSync(inputJcn)]).toEqual(before);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}, 60000);
