import { selectCellRange } from './selection';

const cellIds = ['d', 'b', 'a', 'c', 'e']; // source matrix order is not visual order
const order = ['a', 'b', 'c', 'd', 'e'];
const selected = result => result.nodes.filter(n => n.selected).map(n => n.id).sort();
const select = extra => selectCellRange({ cellIds, order, nodes: [], anchor: null, ids: ['b'], ...extra });

test('ordinary clicks replace; ctrl/cmd adds and toggles individual cells', () => {
  const first = select({});
  expect(selected(first)).toEqual(['b']);
  expect(first.anchor).toEqual(['b']);
  const second = select({ nodes: first.nodes, ids: ['e'], additive: true });
  expect(selected(second)).toEqual(['b', 'e']);
  expect(selected(select({ nodes: second.nodes, ids: ['b'], additive: true }))).toEqual(['e']);
  expect(select({}).nodes.map(n => n.id)).toEqual(cellIds);
});

test.each([['b', 'e'], ['e', 'b']])('shift selects inclusive visual range %s to %s and retains anchor', (from, to) => {
  const first = select({ ids: [from] });
  const range = select({ nodes: first.nodes, anchor: first.anchor, ids: [to], shift: true });
  expect(selected(range)).toEqual(['b', 'c', 'd', 'e']);
  expect(range.anchor).toEqual([from]);
  expect(selected(select({ ...range, ids: ['c'], shift: true }))).toEqual(from === 'b' ? ['b', 'c'] : ['c', 'd', 'e']);
});

test('shift replaces a prior disjoint selection; ctrl-shift appends, never toggles a range', () => {
  const nodes = cellIds.map(id => ({ id, selected: id === 'a' || id === 'e' }));
  expect(selected(select({ nodes, anchor: ['b'], ids: ['d'], shift: true }))).toEqual(['b', 'c', 'd']);
  const next = select({ nodes, anchor: ['b'], ids: ['d'], shift: true, additive: true });
  expect(selected(next)).toEqual(order);
  expect(selected(select({ ...next, ids: ['d'], shift: true, additive: true }))).toEqual(order);
});

test('branches form interval endpoints; ctrl toggles descendants as a group', () => {
  const first = select({ ids: ['b', 'c'] });
  expect(selected(select({ ...first, ids: ['e'], shift: true }))).toEqual(['b', 'c', 'd', 'e']);
  expect(selected(select({ anchor: ['e'], ids: ['a', 'b'], shift: true }))).toEqual(order);
  expect(selected(select({ ...first, ids: ['b', 'c'], additive: true }))).toEqual([]);
});

test('first shift is a plain click; filtered ranges include only visible rows; missing anchor falls back', () => {
  expect(selected(select({ shift: true, ids: ['d'] }))).toEqual(['d']);
  expect(selected(select({ order: ['a', 'c', 'e'], anchor: ['a'], ids: ['e'], shift: true }))).toEqual(['a', 'c', 'e']);
  expect(selected(select({ order: ['a', 'c', 'e'], anchor: ['b'], ids: ['e'], shift: true }))).toEqual(['e']);
  const nodes = select({}).nodes;
  expect(select({ nodes, ids: [] }).nodes).toBe(nodes);
  expect(selected(select({ ids: ['unknown'] }))).toEqual([]);
});
