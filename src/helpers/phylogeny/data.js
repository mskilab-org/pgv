/** Pure input adapters for the phylogeny overview. No DOM, I/O, or Plotly runtime. */

function hasControlCharacters(text) {
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

/**
 * Parse one semicolon-terminated Newick tree. Omitted lengths are zero.
 * Leaf labels are IDs; internal labels are names, never identity keys.
 */
export function parseNewick(text) {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Newick must be a nonempty string");
  }
  let cursor = 0;
  const leaves = new Set();
  const internals = [];
  const fail = (message) => {
    throw new Error(`Invalid Newick at ${cursor}: ${message}`);
  };
  const skip = () => {
    while (cursor < text.length) {
      if (/\s/.test(text[cursor])) {
        cursor += 1;
      } else if (text[cursor] === "[") {
        let depth = 1;
        cursor += 1;
        while (cursor < text.length && depth) {
          if (text[cursor] === "[") depth += 1;
          if (text[cursor] === "]") depth -= 1;
          cursor += 1;
        }
        if (depth) fail("unterminated comment");
      } else {
        break;
      }
    }
  };
  const label = () => {
    skip();
    const quote = text[cursor];
    if (quote === "'" || quote === '"') {
      cursor += 1;
      let result = "";
      while (cursor < text.length) {
        const char = text[cursor++];
        if (char === quote) {
          if (text[cursor] === quote) {
            result += quote;
            cursor += 1;
          } else {
            return result;
          }
        } else {
          result += char;
        }
      }
      fail("unterminated quoted label");
    }
    const start = cursor;
    while (cursor < text.length && !/[\s()[\],:;'"]/.test(text[cursor])) cursor += 1;
    return text.slice(start, cursor);
  };
  const subtree = (depth) => {
    // Guard malformed/adversarial nesting before exhausting the JavaScript stack.
    if (depth > 512) fail("tree nesting exceeds 512 levels");
    skip();
    const children = [];
    if (text[cursor] === "(") {
      cursor += 1;
      children.push(subtree(depth + 1));
      skip();
      while (text[cursor] === ",") {
        cursor += 1;
        children.push(subtree(depth + 1));
        skip();
      }
      if (text[cursor] !== ")") fail("expected ')' after children");
      cursor += 1;
    }
    const name = label();
    if (hasControlCharacters(name)) fail("control character in label");
    if (!children.length) {
      if (!name.trim()) fail("leaf label is required");
      if (leaves.has(name)) fail(`duplicate leaf ID '${name}'`);
      leaves.add(name);
    }
    skip();
    let length = 0;
    if (text[cursor] === ":") {
      cursor += 1;
      skip();
      const start = cursor;
      while (cursor < text.length && !/[\s()[\],;]/.test(text[cursor])) cursor += 1;
      const token = text.slice(start, cursor);
      if (!/^[+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(token)) fail("invalid branch length");
      length = Number(token);
      if (!Number.isFinite(length)) fail("non-finite branch length");
    }
    const node = { id: children.length ? "" : name, name, length, children };
    if (children.length) internals.push(node);
    skip();
    return node;
  };
  const tree = subtree(0);
  if (text[cursor] !== ";") fail("expected final ';'");
  cursor += 1;
  skip();
  if (cursor !== text.length) fail("content after final ';'");
  let serial = 0;
  // Allocate after reading all tips, so even a tip named like an internal ID is safe.
  internals.forEach((node) => {
    let id;
    do {
      id = `__newick_internal_${serial++}`;
    } while (leaves.has(id));
    node.id = id;
  });
  return tree;
}

/** Return tip IDs in the tree's traversal order, without sorting or filtering. */
export function leafIds(tree) {
  const result = [];
  const pending = [tree];
  while (pending.length) {
    const node = pending.pop();
    if (!node || !Array.isArray(node.children) || typeof node.id !== "string") {
      throw new Error("Invalid tree node");
    }
    if (!node.children.length) result.push(node.id);
    else {
      for (let i = node.children.length - 1; i >= 0; i -= 1) pending.push(node.children[i]);
    }
  }
  return result;
}

function chromosomeKey(chromosome, chromoBins) {
  if (typeof chromosome !== "string" || !/^[A-Za-z0-9][A-Za-z0-9.-]*$/.test(chromosome)) {
    throw new Error("Invalid chromosome");
  }
  const alias = chromosome.startsWith("chr") ? chromosome.slice(3) : `chr${chromosome}`;
  const key = [chromosome, alias].find((candidate) =>
    chromoBins && Object.prototype.hasOwnProperty.call(chromoBins, candidate)
  );
  if (!key || !chromoBins[key] || !Number.isFinite(chromoBins[key].startPlace)) {
    throw new Error(`Unknown chromosome or invalid bin: ${chromosome}`);
  }
  return key;
}

/** Preserve raw intervals; use the same endpoint placement as legacy GenomePlot. */
export function normalizeCopyNumber(genome, chromoBins) {
  if (!genome || !Array.isArray(genome.intervals)) {
    throw new Error("Genome intervals must be an array");
  }
  return genome.intervals.map((interval) => {
    if (!interval) throw new Error("Invalid copy-number interval");
    const { startPoint, endPoint, y: cn, iid } = interval;
    const chromosome = chromosomeKey(interval.chromosome, chromoBins);
    if (!Number.isSafeInteger(startPoint) || !Number.isSafeInteger(endPoint) || startPoint < 0 || endPoint < startPoint) {
      throw new Error(`Invalid copy-number boundaries: ${iid}`);
    }
    if (cn !== null && (!Number.isFinite(cn) || cn < 0)) {
      throw new Error(`Invalid copy-number value: ${iid}`);
    }
    const start = chromoBins[chromosome].startPlace + startPoint;
    const end = chromoBins[chromosome].startPlace + endPoint;
    if (!Number.isFinite(start) || !Number.isFinite(end)) throw new Error("Invalid projected interval");
    // Exported CN bin ends may exceed nominal chromosome lengths: never clamp them.
    return { chromosome, start, end, cn, iid, startPoint, endPoint };
  }).sort((a, b) => a.start - b.start);
}

function validCellId(id) {
  return typeof id === "string" && id.trim().length > 0 &&
    !/[<>]/.test(id) && !hasControlCharacters(id) &&
    !["__proto__", "prototype", "constructor"].includes(id);
}

function parseVariant(id, chromoBins) {
  const match = /^([A-Za-z0-9][A-Za-z0-9.-]*)_(\d+)_([ACGTRYSWKMBDHVNacgtryswkmbdhvn*-]+)_([ACGTRYSWKMBDHVNacgtryswkmbdhvn*-]+)$/.exec(id);
  if (!match) throw new Error(`Malformed variant ID: ${id}`);
  const chromosome = chromosomeKey(match[1], chromoBins);
  const position = Number(match[2]);
  if (!Number.isSafeInteger(position) || position < 1) throw new Error(`Invalid variant position: ${id}`);
  const place = chromoBins[chromosome].startPlace + position;
  if (!Number.isFinite(place)) throw new Error(`Invalid projected variant: ${id}`);
  return { id, chromosome, position, ref: match[3], alt: match[4], place };
}

/**
 * Adapt the approved extracted Plotly bar figure, not arbitrary Plotly/HTML.
 * yaxis ticks own row identity; fixed tooltip text owns site identity; only
 * marker.color owns VAF. First-seen variant order is preserved across traces.
 * Optional displayCellIds records numeric y-axis top-to-bottom order separately
 * from cellIds and row-major buffers. Categorical axes use the native fallback.
 * Two linear passes avoid per-entry objects and repeated per-row/site searches.
 */
export function parsePlotlyMutations(figure, chromoBins) {
  const axis = figure && figure.layout && figure.layout.yaxis;
  if (!figure || !Array.isArray(figure.data) || !axis ||
      !Array.isArray(axis.tickvals) || !Array.isArray(axis.ticktext) ||
      axis.tickvals.length !== axis.ticktext.length) {
    throw new Error("Plotly mutations require matching yaxis tickvals/ticktext metadata");
  }
  const cellIds = axis.ticktext.slice();
  const rows = new Map();
  const cells = new Set();
  for (let row = 0; row < cellIds.length; row += 1) {
    const id = cellIds[row];
    const tick = axis.tickvals[row];
    if (!validCellId(id)) throw new Error("Invalid or unsafe cell ID");
    if (!(Number.isFinite(tick) || (typeof tick === "string" && validCellId(tick)))) {
      throw new Error("Invalid cell row coordinate");
    }
    if (cells.has(id) || rows.has(tick)) throw new Error("Duplicate cell ID or row coordinate");
    cells.add(id);
    rows.set(tick, row);
  }

  let entries = 0;
  figure.data.forEach((trace) => {
    if (!trace || !Array.isArray(trace.y) || !Array.isArray(trace.text) ||
        !trace.marker || !Array.isArray(trace.marker.color)) {
      throw new Error("Plotly mutation trace requires y/text/marker.color arrays");
    }
    if ((trace.type !== undefined && trace.type !== "bar") ||
        (trace.orientation !== undefined && trace.orientation !== "h") ||
        (trace.yaxis !== undefined && trace.yaxis !== "y") ||
        (trace.xaxis !== undefined && trace.xaxis !== "x")) {
      throw new Error("Unsupported Plotly mutation trace type or axes");
    }
    const n = trace.y.length;
    if (trace.text.length !== n || trace.marker.color.length !== n) {
      throw new Error("Mismatched mutation trace array lengths");
    }
    ["x", "base", "width", "hoverinfo", "textposition"].forEach((key) => {
      if (trace[key] !== undefined && Array.isArray(trace[key]) && trace[key].length !== n) {
        throw new Error(`Mismatched mutation ${key} array length`);
      }
    });
    // Geometry is not used for genomic placement, but malformed numeric source
    // fields are rejected rather than accidentally interpreted as coordinates.
    ["x", "base", "width"].forEach((key) => {
      if (trace[key] !== undefined) {
        const values = Array.isArray(trace[key]) ? trace[key] : [trace[key]];
        for (let i = 0; i < values.length; i += 1) {
          if (!Number.isFinite(values[i])) throw new Error(`Invalid Plotly ${key} geometry`);
        }
      }
    });
    entries += n;
  });
  if (!Number.isSafeInteger(entries)) throw new Error("Mutation matrix is too large");
  const rowIndices = new Uint32Array(entries);
  const colIndices = new Uint32Array(entries);
  const variants = [];
  const columns = new Map();
  const identities = new Set();
  // Match only this inert envelope. No HTML parser, entity decoding, or eval.
  const envelope = /^<b>([^<>\r\n]+)<\/b><br\s*\/?>([^<>\r\n]+)<br\s*\/?>Value: (?:NA|[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)$/;
  let offset = 0;
  for (const trace of figure.data) {
    for (let j = 0; j < trace.y.length; j += 1) {
      const row = rows.get(trace.y[j]);
      if (row === undefined) throw new Error(`Unknown cell row coordinate at entry ${offset}`);
      const match = typeof trace.text[j] === "string" && envelope.exec(trace.text[j]);
      if (!match || match[1] !== cellIds[row]) {
        throw new Error(`Malformed mutation text or cell/row mismatch at entry ${offset}`);
      }
      const id = match[2];
      let col = columns.get(id);
      if (col === undefined) {
        const variant = parseVariant(id, chromoBins);
        const identity = `${variant.chromosome}_${variant.position}_${variant.ref}_${variant.alt}`;
        if (identities.has(identity)) throw new Error(`Duplicate variant identity: ${id}`);
        identities.add(identity);
        col = variants.length;
        columns.set(id, col);
        variants.push(variant);
      }
      rowIndices[offset] = row;
      colIndices[offset] = col;
      offset += 1;
    }
  }
  if (entries !== cellIds.length * variants.length) {
    throw new Error("Incomplete mutation matrix: missing or duplicate cell/site pairs");
  }
  const values = new Float64Array(entries);
  const missing = new Uint8Array(entries);
  const seen = new Uint8Array(entries);
  const stats = { cells: cellIds.length, variants: variants.length, entries, missing: 0, zero: 0, positive: 0 };
  offset = 0;
  for (const trace of figure.data) {
    for (let j = 0; j < trace.y.length; j += 1) {
      const index = rowIndices[offset] * variants.length + colIndices[offset];
      if (seen[index]) throw new Error(`Duplicate cell/site pair at entry ${offset}`);
      seen[index] = 1;
      const value = trace.marker.color[j];
      if (value === null) {
        values[index] = NaN;
        missing[index] = 1;
        stats.missing += 1;
      } else {
        if (!Number.isFinite(value) || value < 0 || value > 1) {
          throw new Error(`Invalid VAF at entry ${offset}: expected null or a number in [0, 1]`);
        }
        values[index] = value;
        if (value === 0) stats.zero += 1;
        else stats.positive += 1;
      }
      offset += 1;
    }
  }
  // Numeric Plotly y increases upwards unless the range/axis is reversed.
  // Sort metadata indices only: never permute the source IDs or matrix buffers.
  const result = { cellIds, variants, values, missing, stats };
  if (!["category", "multicategory"].includes(axis.type) && axis.tickvals.every(Number.isFinite)) {
    const reversed = ["reversed", "min reversed", "max reversed"].includes(axis.autorange) ||
      (Array.isArray(axis.range) && axis.range.length === 2 && axis.range.every(Number.isFinite) && axis.range[0] > axis.range[1]);
    result.displayCellIds = cellIds.map((_, row) => row)
      .sort((a, b) => (reversed ? 1 : -1) * (axis.tickvals[a] - axis.tickvals[b]))
      .map(row => cellIds[row]);
  }
  // Equal dimensions plus unique pairs imply complete coverage (including nulls).
  return result;
}
