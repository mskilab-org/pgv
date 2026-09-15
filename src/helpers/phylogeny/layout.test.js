import { layoutDomains, groupMutations } from "./layout";

describe("shared legacy domain geometry", () => {
  test("two disjoint windows with a gutter use exact GenomePlot margins", () => {
    const domains = [[100, 200], [1000, 1400]];
    const windows = layoutDomains(domains, 1000, 240);
    expect(windows.map(({ index, domain, x, width }) => ({ index, domain, x, width }))).toEqual([
      { index: 0, domain: [100, 200], x: 264, width: 344 },
      { index: 1, domain: [1000, 1400], x: 632, width: 344 },
    ]);
    expect(windows[0].scale(150)).toBe(172);
    expect(windows[0].invert(172)).toBe(150);
    expect(windows[1].x + windows[1].width).toBe(976);
    expect(windows[1].scale(1000)).toBe(0);
    expect(windows[1].scale(1400)).toBe(344);
    expect(domains).toEqual([[100, 200], [1000, 1400]]);
  });

  test("hidden gutter, custom gap, negative domains and unsorted window order", () => {
    const windows = layoutDomains([[100, 200], [-200, -100]], 1000);
    expect(windows.map((w) => [w.x, w.width])).toEqual([[24, 464], [512, 464]]);
    expect(windows[1].scale(-150)).toBe(232);
    expect(windows[1].invert(232)).toBe(-150);
    const custom = layoutDomains([[0, 10]], 110, 10, 0)[0];
    expect(custom.x).toBe(10);
    expect(custom.width).toBe(100);
    expect(custom.scale(11)).toBeCloseTo(110);
    expect(custom.invert(-10)).toBe(-1);
  });

  test("tiny but positive available width never produces negative geometry", () => {
    const window = layoutDomains([[1, 2]], 48.01)[0];
    expect(window.width).toBeCloseTo(0.01);
    expect(window.scale(2)).toBeCloseTo(0.01);
    expect(window.invert(window.width)).toBe(2);
  });

  test.each([
    [[], 100], [new Array(1), 100], [null, 100], [[[1, 1]], 100], [[[2, 1]], 100],
    [[[NaN, 2]], 100], [[[0, Infinity]], 100], [[[0, 1, 2]], 100],
    [[[0, 1], null], 100], [[[0, 1]], 0], [[[0, 1]], -1],
    [[[0, 1]], NaN], [[[0, 1]], Infinity], [[[0, 1]], "100"],
    [[[0, 1]], 48], [[[0, 1], [2, 3]], 72],
    [[[0, 1]], 100, 60], [[[0, 1]], 100, -1],
    [[[0, 1]], 100, 0, -1], [[[0, 1]], 100, 0, NaN],
    [[[-Number.MAX_VALUE, Number.MAX_VALUE]], 100],
    [[[0, Number.MIN_VALUE]], 100],
  ].map(([domains, width, gutter, gap]) => [domains, width, gutter, gap]))("invalid/empty/narrow geometry returns []: %p, %p, %p, %p", (domains, width, gutter, gap) => {
    expect(layoutDomains(domains, width, gutter, gap)).toEqual([]);
  });
});

const site = (place, chromosome = "1") => ({ place, chromosome });
const members = (groups) => groups.map((g) => g.indices);

describe("sorted, shared screen-footprint mutation groups", () => {
  test("strict 6px neighbor threshold and sorted original indices without source mutation", () => {
    const variants = [site(11), site(5), site(0), site(17), site(22.999)];
    const original = JSON.stringify(variants);
    const groups = groupMutations(variants, [0, 30], 30);
    expect(groups).toEqual([
      { indices: [2, 1], chromosome: "1", start: 0, end: 5, x1: 0, x2: 5 },
      { indices: [0], chromosome: "1", start: 11, end: 11, x1: 11, x2: 11 },
      { indices: [3, 4], chromosome: "1", start: 17, end: 22.999, x1: 17, x2: 22.999 },
    ]);
    expect(JSON.stringify(variants)).toBe(original);
  });

  test("merges transitive overlaps, not fixed bins or distance from first member", () => {
    expect(members(groupMutations([site(1), site(6), site(11), site(16)], [0, 20], 20)))
      .toEqual([[0, 1, 2, 3]]);
  });

  test("pan invariance includes every offscreen member of a full-chromosome group", () => {
    const variants = [site(-5), site(0), site(5), site(10), site(40)];
    const first = groupMutations(variants, [0, 10], 10);
    const panned = groupMutations(variants, [3, 13], 10);
    expect(members(first)).toEqual([[0, 1, 2, 3]]);
    expect(members(panned)).toEqual(members(first));
    expect(first[0]).toMatchObject({ start: -5, end: 10, x1: -5, x2: 10 });
    expect(panned[0]).toMatchObject({ start: -5, end: 10, x1: -8, x2: 7 });
    expect(groupMutations(variants, [20, 30], 10)).toEqual([]);
  });

  test("same scale in different disjoint windows preserves crossing groups with no inside site", () => {
    const variants = [site(0), site(5)];
    expect(groupMutations(variants, [2, 3], 1)).toEqual([
      { indices: [0, 1], chromosome: "1", start: 0, end: 5, x1: -2, x2: 3 },
    ]);
    expect(members(groupMutations(variants, [4, 5], 1))).toEqual([[0, 1]]);
  });

  test("chromosomes never merge, including interleaved/identical places", () => {
    const variants = [site(9, "2"), site(0), site(5, "2"), site(4), site(4, "3")];
    const groups = groupMutations(variants, [-10, 20], 30);
    expect(groups.map((g) => [g.chromosome, g.indices])).toEqual([
      ["1", [1, 3]], ["3", [4]], ["2", [2, 0]],
    ]);
    expect(members(groupMutations([site(5, "1"), site(5, "2")], [0, 10], 10)))
      .toEqual([[0], [1]]);
  });

  test("aggregate=false emits every in-view site including duplicates and both edges", () => {
    const variants = [site(10), site(0), site(5), site(5), site(-0.001), site(10.001)];
    const groups = groupMutations(variants, [0, 10], 10, 6, false);
    expect(members(groups)).toEqual([[1], [2], [3], [0]]);
    expect(groups.every((g) => g.start === g.end && g.x1 === g.x2)).toBe(true);
    expect(members(groupMutations(variants, [0, 10], 10, 0))).toEqual([[1], [2], [3], [0]]);
  });

  test("zoom resolves groups and spacing is in CSS pixels, not genomic units", () => {
    const variants = [site(100), site(105), site(111)];
    expect(members(groupMutations(variants, [0, 200], 200))).toEqual([[0, 1], [2]]);
    expect(members(groupMutations(variants, [0, 200], 400))).toEqual([[0], [1], [2]]);
    expect(members(groupMutations(variants, [0, 100], 100))).toEqual([[0, 1]]);
    expect(members(groupMutations(variants, [100, 112], 120))).toEqual([[0], [1], [2]]);
  });

  test("negative domains, singletons, empty input and very narrow genomic views", () => {
    expect(groupMutations([], [-10, -1], 100)).toEqual([]);
    expect(groupMutations([site(-5)], [-10, 0], 100)).toEqual([
      { indices: [0], chromosome: "1", start: -5, end: -5, x1: 50, x2: 50 },
    ]);
    const start = 1000000000;
    const group = groupMutations([site(start + 0.125)], [start, start + 0.25], 100)[0];
    expect(group.x1).toBe(50);
    expect(group.x2).toBe(50);
  });

  test.each([
    [[0, 0], 100, 6], [[1, 0], 100, 6], [[0, Infinity], 100, 6],
    [null, 100, 6], [[0, 10], 0, 6], [[0, 10], -1, 6],
    [[0, 10], NaN, 6], [[0, 10], Infinity, 6],
    [[0, 10], 100, -1], [[0, 10], 100, NaN], [[0, 10], 100, Infinity],
    [[0, Number.MIN_VALUE], 100, 6], [[-Number.MAX_VALUE, Number.MAX_VALUE], 100, 6],
  ])("invalid view/spacing has no geometry: %p, %p, %p", (domain, width, spacing) => {
    expect(groupMutations([site(1)], domain, width, spacing)).toEqual([]);
  });

  test.each([[null], [site(NaN)], [site(Infinity)], [site(1, "")], [site("1")]])("invalid site is rejected, never silently dropped: %p", (variant) => {
    expect(() => groupMutations([variant], [0, 10], 100)).toThrow();
  });

  test("large generated groups preserve all 92000 memberships with a single sorted sweep", () => {
    const variants = Array.from({ length: 92000 }, (_, i) => site(91999 - i, i % 2 ? "1" : "2"));
    const groups = groupMutations(variants, [-1, 92000], 92001);
    expect(groups.length).toBe(2);
    expect(groups.map((g) => g.indices.length)).toEqual([46000, 46000]);
    const seen = new Uint8Array(92000);
    for (const group of groups) {
      let previous = -Infinity;
      for (const index of group.indices) {
        if (seen[index] || variants[index].chromosome !== group.chromosome || variants[index].place < previous) {
          throw new Error(`Lost, duplicated or unsorted membership at ${index}`);
        }
        previous = variants[index].place;
        seen[index] = 1;
      }
    }
    expect(seen.every((v) => v === 1)).toBe(true);
  });
});
