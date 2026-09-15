/** Select by stable cell identity; Shift ranges follow visible tree order, never matrix order. */
export function selectCellRange({ cellIds, order, ids, nodes = [], anchor = null, shift = false, additive = false }) {
  const known = new Set(cellIds);
  const targets = ids.filter(id => known.has(id));
  if (!targets.length) return { nodes, anchor };
  const indices = new Map(order.map((id, index) => [id, index]));
  const anchorRows = (anchor || []).map(id => indices.get(id)).filter(index => index !== undefined);
  const targetRows = targets.map(id => indices.get(id)).filter(index => index !== undefined);
  const range = shift && anchorRows.length > 0 && targetRows.length > 0;
  const chosen = range ? [...order.slice(Math.min(...anchorRows, ...targetRows), Math.max(...anchorRows, ...targetRows) + 1), ...targets] : targets;
  const selected = new Set(additive ? nodes.filter(node => node.selected).map(node => node.id) : []);
  const remove = additive && !range && targets.every(id => selected.has(id));
  chosen.forEach(id => remove ? selected.delete(id) : selected.add(id));
  return { nodes: cellIds.map(id => ({ id, selected: selected.has(id) })), anchor: range ? anchor : targets };
}
