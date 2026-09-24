// Real-fixture browser regressions against an already running local PGV server.
// No installs or fixture writes. React inspection is read-only; gestures use DOM.
// PLAYWRIGHT_MODULE=/path/to/installed/playwright node scripts/verify-phylogeny-browser.mjs
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyEdges } from './phylogeny-browser-edges.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const base = process.env.PGV_URL || 'http://127.0.0.1:3005';
const output = path.resolve(process.env.PGV_RESULTS_DIR || '/tmp/pgv-repair-browser');
const readJSON = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const manifest = readJSON('public/datafiles.json');
const mutations = readJSON('public/data/BWH70_phylogeny/mutations.sparse.json');
const junctions = readJSON('public/data/BWH70_phylogeny/junctions.json');
const legacySource = readJSON('public/data/BWH70_phylogeny/mutations.json');
const titles = { tumor: 'BWH70 Phylogeny without Normal Cells', normal: 'BWH70 Phylogeny with Normal Cells', demo: 'DEMO Phylogeny' };
const viewport = { width: 1440, height: 1100 };
const report = { base, viewport, started: new Date().toISOString(), checks: [], suites: [], errors: [], failures: [], skips: [] };
fs.mkdirSync(path.join(output, 'screenshots'), { recursive: true });
const browser = process.env.PGV_CDP ? await chromium.connectOverCDP(process.env.PGV_CDP) : await chromium.launch({ headless: true });
// Always isolate routes and application state, including when attached over CDP.
const contexts = [];
async function newContext() {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  context.setDefaultTimeout(20000);
  contexts.push(context);
  await context.addInitScript(() => {
    window.__pgvComponent = canvas => {
      let fiber = canvas[Object.keys(canvas).find(key => key.startsWith('__reactFiber'))];
      while (fiber && !fiber.stateNode?.scene) fiber = fiber.return;
      if (!fiber) throw new Error('Mounted heatmap scene unavailable');
      return fiber.stateNode;
    };
    // Observe actual scheduled paint operations, never invoke component.draw or
    // mutate React props/state. Bound records to the current canvas frame.
    window.__pgvStrokes = new WeakMap();
    const proto = CanvasRenderingContext2D.prototype;
    const clear = proto.clearRect, strokeRect = proto.strokeRect;
    proto.clearRect = function (...args) { window.__pgvStrokes.set(this.canvas, []); return clear.apply(this, args); };
    proto.strokeRect = function (...args) {
      const records = window.__pgvStrokes.get(this.canvas);
      if (records && records.length < 2000) records.push({ color: this.strokeStyle, lineWidth: this.lineWidth, rect: args });
      return strokeRect.apply(this, args);
    };
  });
  return context;
}
const check = (name, details = true) => { report.checks.push({ name, details }); console.log('PASS', name); };
const tick = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const canvas = scope => scope.locator('canvas[data-matrix-entries]');
const side = scope => scope.locator('.mutation-canvas');
const screenshot = (page, name) => page.screenshot({ path: path.join(output, 'screenshots', `${name}.png`), fullPage: false });
async function until(page, predicate, message) {
  const end = Date.now() + 20000;
  do { if (await predicate()) return; await tick(page); } while (Date.now() < end);
  throw new Error(`Timed out: ${message}`);
}
async function ready(page, entries = 1109750, count = 1) {
  try {
    await page.waitForFunction(({ entries, count }) => {
      const canvases = [...document.querySelectorAll('canvas[data-matrix-entries]')];
      return canvases.length === count && canvases.every(c => {
        const component = window.__pgvComponent(c);
        return Number(c.dataset.matrixEntries) === entries && component.scene.data.status === 'ready' && Number(c.dataset.frameCnDrawn) > 0;
      });
    }, { entries, count }, { timeout: 90000 });
  } catch (error) {
    const actual = await page.locator('canvas[data-matrix-entries]').evaluateAll(canvases => canvases.map(c => {
      const h = window.__pgvComponent(c);
      return { dataset: { ...c.dataset }, status: h.scene.data.status, errors: h.scene.data.errors };
    })).catch(() => []);
    throw new Error(`Expected ${count} ready canvas(es), ${entries} entries; actual ${JSON.stringify(actual)}. ${error.message}`);
  }
  await tick(page);
}
async function scene(scope) {
  return canvas(scope).evaluate(c => {
    const h = window.__pgvComponent(c), s = h.scene;
    const leaves = node => node.children?.length ? node.children.flatMap(leaves) : [node.id];
    return { plotId: s.data.plotId, status: s.data.status, cnMode: s.cnMode, matrixKind: h.props.matrixKind, rowHeight: s.rowHeight, totalHeight: s.totalHeight,
      viewportHeight: h.viewportHeight(), scrollTop: h.scrollTop, gutter: s.gutterWidth, width: s.width,
      rows: s.rows.map(r => ({ id: r.id, index: r.index, y: r.y, matrixRow: r.matrixRow })),
      windows: s.windows.map(w => ({ x: w.x, width: w.width, domain: w.domain })),
      treeLeaves: leaves(s.data.tree), tree: s.tree.map(n => ({ id: n.id, name: n.name, x: n.x, y: n.y, descendants: n.descendants })),
      selected: h.props.nodes.filter(n => n.selected).map(n => n.id), cellIds: s.data.cellIds,
      sideCellIds: s.sideMatrix?.cellIds, sideRows: [...s.sideMatrixRows], errors: s.data.errors };
  });
}
async function selectOption(page, scope, name, label) {
  const input = scope.getByRole('combobox', { name, exact: true });
  await input.locator('xpath=ancestor::div[@class="ant-select-selector"]').click();
  const option = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').filter({ hasText: new RegExp(`^${label}$`) });
  assert.equal(await option.count(), 1, `Unique enabled option ${name}: ${label}`);
  assert.ok(!(await option.getAttribute('class')).includes('ant-select-item-option-disabled'), `${label} must be enabled`);
  await option.click();
  await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').waitFor({ state: 'hidden' });
  await tick(page);
}
async function scrollRows(page, scope, fraction) {
  const scroller = scope.locator('.heatmap-scroll');
  const target = await scroller.evaluate((e, fraction) => {
    e.scrollTop = Math.round((e.scrollHeight - e.clientHeight) * fraction);
    return e.scrollTop;
  }, fraction);
  await until(page, async () => Math.abs((await scene(scope)).scrollTop - target) < 1, 'vertical scroll paint');
  await tick(page);
  return target;
}
async function geometry(scope) {
  return canvas(scope).evaluate(c => {
    const h = window.__pgvComponent(c);
    const box = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
    return { main: box(c), viewport: box(h.scroller), side: h.mutationCanvas && box(h.mutationCanvas),
      horizontal: h.mutationScroller && box(h.mutationScroller), backingWidth: h.mutationCanvas?.width,
      scrollTop: h.scrollTop, domScrollTop: h.scroller.scrollTop, scrollHeight: h.scroller.scrollHeight,
      clientHeight: h.scroller.clientHeight, scrollLeft: h.mutationScroller?.scrollLeft,
      mainRows: Number(c.dataset.frameRowsDrawn), sideRows: Number(h.mutationCanvas?.dataset.frameRowsDrawn) };
  });
}
function assertGeometry(g, visible) {
  assert.ok(Math.abs(g.main.y - g.viewport.y) < 1, `Main canvas clipped above viewport: ${JSON.stringify(g)}`);
  assert.ok(Math.abs(g.main.height - g.viewport.height) < 1);
  assert.equal(g.domScrollTop, g.scrollTop);
  assert.ok(g.mainRows > 0, 'CN viewport must not be blank');
  if (visible) {
    assert.ok(Math.abs(g.side.y - g.viewport.y) < 1, `Side canvas clipped above viewport: ${JSON.stringify(g)}`);
    assert.ok(Math.abs(g.side.x - g.horizontal.x) < 1, 'Side canvas must remain at horizontal viewport origin');
    assert.equal(g.side.height, g.main.height);
    assert.equal(g.mainRows, g.sideRows, 'Both matrices draw exactly the same visible rows');
    assert.ok(g.backingWidth > 0 && g.backingWidth < 1000, `Unbounded backing canvas: ${g.backingWidth}`);
  } else assert.equal(g.side, null);
}
async function selectRow(page, scope, index, modifiers = []) {
  const s = await scene(scope), box = await canvas(scope).boundingBox();
  const y = s.rows[index].y - s.scrollTop;
  assert.ok(y >= 0 && y < box.height, `Row ${index} must be visible`);
  assert.ok(await canvas(scope).evaluate((c, point) => document.elementFromPoint(point.x, point.y) === c,
    { x: box.x + s.gutter - 12, y: box.y + y }), `Row ${index} pointer must not be obscured by an affixed header`);
  for (const key of modifiers) await page.keyboard.down(key);
  try { await page.mouse.click(box.x + s.gutter - 12, box.y + y); }
  finally { for (const key of [...modifiers].reverse()) await page.keyboard.up(key); }
  await tick(page);
}
async function confirmSelection(page, scope, confirm) {
  await scope.getByRole('button', { name: /Open selected/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  const ids = (await scene(scope)).selected;
  assert.ok(ids.length > 0);
  assert.deepEqual(await dialog.locator('.phylogeny-confirm-cells > div').allTextContents(), ids);
  await dialog.getByRole('button', { name: confirm ? 'Open tracks' : 'Cancel', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await tick(page);
}
async function selectedFiles(page) {
  return page.locator('.files-select').evaluate(element => {
    let fiber = element[Object.keys(element).find(k => k.startsWith('__reactFiber'))];
    while (fiber && !Array.isArray(fiber.memoizedProps?.value)) fiber = fiber.return;
    if (!fiber) throw new Error('Selected files control unavailable');
    return fiber.memoizedProps.value;
  });
}
async function suite(name, run, context) {
  const page = await context.newPage();
  const errors = [], failures = [], requests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => {
    if (r.status() < 400) return;
    const failure = { url: r.url(), status: r.status() };
    // Legacy launch probes these optional files even when absent. Keep them in
    // evidence, but do not confuse documented metadata absence with data loss.
    if (r.status() === 404 && /\/(samples|connections\.associations)\.json$/.test(new URL(r.url()).pathname)) {
      (report.optionalMetadata404s ||= []).push(failure);
    } else failures.push(failure);
  });
  page.on('request', r => { if (r.url().includes('/data/')) requests.push(r.url()); });
  const result = { name };
  try {
    await run(page, requests);
    assert.deepEqual(errors, [], 'Unexpected browser JavaScript errors');
    assert.deepEqual(failures, [], 'Unexpected HTTP failures');
    result.ok = true;
  } catch (error) {
    result.ok = false; result.error = error.stack;
    console.error(`FAIL ${name}:`, error);
    await screenshot(page, `${name}-failure`).catch(() => {});
  } finally {
    result.errors = errors; result.failures = failures;
    report.errors.push(...errors); report.failures.push(...failures); report.suites.push(result);
    fs.writeFileSync(path.join(output, 'native-ui-verification.json'), JSON.stringify(report, null, 2));
    await page.close();
  }
}
const goto = page => page.goto(`${base}/?file=BWH70_phylogeny&location=1:1-2:294199`);

async function verifySources(page) {
  assert.equal(mutations.variants.length, 8878);
  assert.equal(Object.keys(mutations.cells).filter(id => manifest[id]?.plots.some(p => p.type === 'genome')).length, 125);
  // The export also contains five unmatched CD45+ normal cells; tumor loading
  // deliberately projects the 125 matched genome identities, not source keys.
  assert.equal(junctions.junctions.length, 67);
  assert.equal(junctions.cellIds.length, 125);
  const actual = await canvas(page).evaluate(c => {
    const s = window.__pgvComponent(c).scene;
    return { variants: s.data.mutations.variants.map(v => v.id), cnByCell: s.data.cnByCell,
      junctionIds: s.data.junctions.variants.map(v => v.id), junctionCells: s.data.junctions.cellIds,
      junctionValues: Array.from(s.data.junctions.values), junctionMissing: Array.from(s.data.junctions.missing) };
  });
  assert.deepEqual(actual.variants, mutations.variants.map(v => v.id), 'Mutation source catalog order');
  assert.deepEqual(actual.junctionIds, junctions.junctions.map(v => v.id), 'Junction source catalog order');
  assert.deepEqual(actual.junctionCells, junctions.cellIds);
  assert.deepEqual(actual.junctionValues, junctions.values.flat());
  assert.ok(actual.junctionMissing.every(value => value === 0));
  // Independent oracle: materialize defaults and compare EVERY supplied/default
  // VAF/count, rather than verifying dimensions or trusting the renderer itself.
  const sourceHash = createHash('sha256').update(fs.readFileSync(path.join(root, 'public/data/BWH70_phylogeny/mutations.sparse.json'))).digest('hex');
  const equality = await canvas(page).evaluate(async (c, expectedHash) => {
    // Fetch/parse the actual local source in-browser: passing its million nested
    // observations through Playwright's argument serializer wastes gigabytes.
    const response = await fetch('/data/BWH70_phylogeny/mutations.sparse.json');
    if (!response.ok) throw new Error(`Source oracle fetch: ${response.status}`);
    const bytes = await response.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hash = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
    if (hash !== expectedHash) throw new Error('Browser mutation source differs from the local fixture');
    const source = JSON.parse(new TextDecoder().decode(bytes));
    const m = window.__pgvComponent(c).scene.data.mutations;
    let compared = 0;
    for (let r = 0; r < m.cellIds.length; r++) {
      const values = new Map((source.cells[m.cellIds[r]] || []).map(v => [v.variantId, v]));
      for (let column = 0; column < m.variants.length; column++) {
        const record = values.get(source.variants[column].id) || {};
        const index = r * m.variants.length + column;
        for (const [field, key] of [['vaf', 'values'], ['refCount', 'refCounts'], ['altCount', 'altCounts']]) {
          if (m[key][index] !== (record[field] ?? 0)) throw new Error(`${m.cellIds[r]} / ${column}: ${field} source mismatch`);
        }
        if (m.missing[index] !== 0) throw new Error(`Unexpected sparse missing mask at ${index}`);
        compared++;
      }
    }
    return compared;
  }, sourceHash);
  assert.equal(equality, 1109750);
  let intervals = 0, distinctAlleles = 0;
  for (const [cell, cn] of Object.entries(actual.cnByCell)) {
    const plots = manifest[cell].plots;
    const genome = plots.find(p => p.type === 'genome');
    assert.equal(genome.allelicSource, 'allelic.json');
    const total = readJSON(`public/data/${cell}/${genome.source}`).intervals;
    const alleles = readJSON(`public/data/${cell}/${genome.allelicSource}`).intervals;
    const key = i => `${i.chromosome}:${i.startPoint}:${i.endPoint}`;
    const pairs = new Map();
    for (const i of alleles) { if (!pairs.has(key(i))) pairs.set(key(i), []); pairs.get(key(i)).push(i.y); }
    assert.equal(cn.length, total.length);
    const totals = new Map(total.map(i => [key(i), i.y]));
    for (const i of cn) {
      const pair = pairs.get(key(i));
      assert.equal(pair?.length, 2, `${cell}: actual allelic pair at ${key(i)}`);
      assert.equal(i.cn, totals.get(key(i)));
      assert.equal(i.majorCn, Math.max(...pair));
      assert.equal(i.minorCn, Math.min(...pair));
      assert.ok(Number.isFinite(i.majorCn) && Number.isFinite(i.minorCn));
      if (i.majorCn !== i.minorCn) distinctAlleles++;
      intervals++;
    }
  }
  assert.equal(Object.keys(actual.cnByCell).length, 125);
  assert.equal(intervals, 15834);
  assert.ok(distinctAlleles > 0);
  check('All 1,109,750 sparse entries/counts, 8,375 JCN values and 15,834 real allelic intervals equal their sources', { equality, intervals, distinctAlleles });
}

async function tooltipAtScrolledCell(page, kind) {
  const s = await scene(page);
  const g = await geometry(page);
  const firstColumn = Math.ceil(g.scrollLeft / 4);
  const lastColumn = Math.min(kind === 'junctions' ? 67 : 8878, Math.floor((g.scrollLeft + g.side.width - 4) / 4));
  const firstRow = Math.ceil(s.scrollTop / s.rowHeight);
  const lastRow = Math.min(s.rows.length, Math.floor((s.scrollTop + s.viewportHeight - 16) / s.rowHeight));
  let candidate;
  // Pick an actual positive source observation in the visible scrolled region;
  // a fabricated zero/missing-only tooltip cannot satisfy this test.
  for (let row = firstRow; row < lastRow && !candidate; row++) {
    const cell = s.rows[row].id;
    const records = kind === 'mutations' ? new Map(mutations.cells[cell].map(v => [v.variantId, v])) : null;
    for (let col = firstColumn; col < lastColumn; col++) {
      const id = kind === 'mutations' ? mutations.variants[col].id : junctions.junctions[col].id;
      const value = kind === 'mutations' ? records.get(id)?.vaf : junctions.values[junctions.cellIds.indexOf(cell)][col];
      if (value > 0) { candidate = { cell, col, row, id, value, record: records?.get(id) }; break; }
    }
  }
  assert.ok(candidate, `Positive ${kind} observation must exist in the viewport`);
  const x = g.side.x + (candidate.col + 0.5) * 4 - g.scrollLeft;
  const y = g.side.y + s.rows[candidate.row].y - s.scrollTop;
  await page.mouse.move(x, y);
  const expected = kind === 'junctions' ? [`Cell: ${candidate.cell}`, `Junction: ${candidate.id}`, `Junction CN: ${candidate.value}`] :
    [`Cell: ${candidate.cell}`, `Site: ${candidate.id}`, `VAF: ${candidate.value}`, `ref count: ${candidate.record.refCount ?? 0}`, `alt count: ${candidate.record.altCount ?? 0}`];
  await until(page, async () => {
    const lines = await page.locator('.heatmap-tooltip > div').allTextContents();
    return expected.every(line => lines.includes(line));
  }, `${kind} source-exact scrolled tooltip`);
  if (kind === 'junctions') assert.deepEqual(await page.locator('.heatmap-tooltip > div').allTextContents(), expected);
  return candidate;
}

async function verifyScrolling(page) {
  await goto(page); await ready(page); await verifySources(page);
  assert.equal(await page.locator('.phylogeny-heatmap').getAttribute('data-mutation-mode'), 'hidden');
  assert.equal(await page.getByRole('combobox', { name: 'Right heatmap data', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Show mutations', exact: true }).getAttribute('aria-pressed'), 'false');
  const originalRows = (await scene(page)).rows.map(r => r.id);
  assert.equal(new Set(originalRows).size, 125);
  for (const visible of [false, true]) {
    if (visible) await page.getByRole('button', { name: 'Show mutations', exact: true }).click();
    for (const [position, fraction] of [['top', 0], ['middle', 0.5], ['bottom', 1]]) {
      const offset = await scrollRows(page, page, fraction);
      if (fraction) assert.ok(offset > 500, 'Exercise the clipped-canvas regression beyond the first viewport');
      const g = await geometry(page); assertGeometry(g, visible);
      await screenshot(page, `${visible ? 'mutations' : 'hidden'}-${position}`);
      check(`${visible ? 'Visible' : 'Hidden'} side matrix: ${position} keeps canvases at the scroll viewport top`, g);
    }
  }
  await scrollRows(page, page, 0.5);
  const vertical = (await scene(page)).scrollTop;
  const horizontal = page.locator('.mutation-scroll-x');
  // Real DOM scrolling triggers native scroll handlers, not component setters.
  await horizontal.evaluate(e => { e.scrollLeft = 18001; });
  await until(page, async () => Number(await side(page).getAttribute('data-frame-first-column')) === 4500, 'visible mutation column virtualization');
  const g = await geometry(page); assertGeometry(g, true); assert.equal(g.scrollTop, vertical);
  assert.ok(Number(await side(page).getAttribute('data-frame-columns-drawn')) < 100);
  const mutationHit = await tooltipAtScrolledCell(page, 'mutations');
  assert.ok(mutationHit.col >= 4500 && mutationHit.row > 20);
  check('Horizontal scroll preserves vertical offset and resolves actual distant mutation ID/full-precision VAF', mutationHit);
  await screenshot(page, 'mutations-two-axis-tooltip');
  const originalCanvas = await side(page).elementHandle();
  await selectOption(page, page, 'Right heatmap data', 'Junction CN');
  await until(page, async () => await side(page).getAttribute('data-frame-columns') === '67', 'junction paint');
  assert.ok(await originalCanvas.evaluate(e => e === document.querySelector('.mutation-canvas')), 'Switch matrix without replacing the shared canvas');
  await originalCanvas.dispose();
  assert.equal(await page.getByRole('button', { name: 'Hide junctions', exact: true }).getAttribute('aria-pressed'), 'true');
  const j = await scene(page), jg = await geometry(page);
  assert.equal(await side(page).getAttribute('data-frame-metric'), 'jcn');
  assert.equal(jg.scrollLeft, 0);
  assert.equal(j.scrollTop, vertical);
  assert.deepEqual(j.rows.map(r => r.id), originalRows);
  assert.deepEqual(j.sideCellIds, junctions.cellIds);
  assert.deepEqual(j.sideRows, junctions.cellIds.map((id, index) => [id, index]));
  // Opening the toolbar dropdown can scroll the document, changing absolute y
  // without changing canvas alignment within the shared row viewport.
  for (const key of ['x', 'width', 'height']) {
    assert.equal(jg.main[key], g.main[key]); assert.equal(jg.side[key], g.side[key]);
  }
  assertGeometry(jg, true);
  const junctionHit = await tooltipAtScrolledCell(page, 'junctions');
  check('JCN reuses identical canvas/geometry/rows and source-ordered ID mapping with exact JCN tooltip', junctionHit);
  await screenshot(page, 'junctions-scrolled-tooltip');
  await page.getByRole('button', { name: 'Hide junctions', exact: true }).click();
  await side(page).waitFor({ state: 'detached' });
  assert.equal((await scene(page)).scrollTop, vertical);
  assert.equal(await page.getByRole('button', { name: 'Show junctions', exact: true }).count(), 1);
  await page.getByRole('button', { name: 'Show junctions', exact: true }).click();
  await scrollRows(page, page, 1);
  await page.getByRole('button', { name: 'Fit rows', exact: true }).click();
  await until(page, async () => (await geometry(page)).mainRows === 125, 'fit all rows');
  const fit = await geometry(page); assertGeometry(fit, true);
  assert.equal(fit.scrollTop, 0); assert.equal(fit.scrollHeight, fit.clientHeight);
  assert.equal(fit.sideRows, 125);
  await screenshot(page, 'junctions-fit-after-bottom');
  check('Fit rows from bottom resets scroll, draws all 125 rows in both matrices, and leaves no blank scroll area', fit);

  await selectRow(page, page, 60);
  await selectRow(page, page, 78, ['Shift']);
  await page.getByRole('checkbox', { name: 'Selected rows only', exact: true }).check();
  await page.getByRole('button', { name: 'Readable rows', exact: true }).click();
  const sizes = [];
  for (const fitRows of [false, true]) {
    if (fitRows) await page.getByRole('button', { name: 'Fit rows', exact: true }).click();
    for (const height of [600, 1000, 300, 640]) {
      await page.getByRole('spinbutton', { name: 'Heatmap height', exact: true }).fill(String(height));
      await until(page, async () => (await scene(page)).viewportHeight === height - 72, 'height update');
      await tick(page);
      const s = await scene(page), g = await geometry(page);
      assertGeometry(g, true);
      assert.equal(s.rows.length, 19);
      assert.equal(s.rowHeight, Math.max(fitRows ? 0 : 22, s.viewportHeight / 19));
      assert.equal(s.totalHeight, 19 * s.rowHeight);
      if (fitRows || height >= 600) {
        assert.ok(Math.abs(s.totalHeight - s.viewportHeight) < 1e-9, 'Selected rows fill spare height in both modes');
        assert.equal(g.scrollHeight, g.clientHeight);
        assert.equal(g.mainRows, 19);
      } else assert.ok(g.scrollHeight > g.clientHeight, 'Readable rows retain their minimum and scroll');
      sizes.push({ fitRows, height, rowHeight: s.rowHeight, totalHeight: s.totalHeight, viewportHeight: s.viewportHeight });
    }
  }
  await page.getByRole('button', { name: 'Readable rows', exact: true }).click();
  await page.getByRole('separator', { name: 'Resize phylogeny panel height', exact: true }).press('ArrowDown');
  await until(page, async () => (await scene(page)).viewportHeight === 656 - 72, 'resize grip height update');
  const resized = await scene(page);
  assert.equal(resized.rowHeight, resized.viewportHeight / 19);
  assertGeometry(await geometry(page), true);
  await screenshot(page, 'readable-selected-rows-resized');
  check('Readable selected rows fill spare height like Fit rows, enforce only a minimum, and respond to height input and resize grip', sizes);
}

async function verifyControlsAndTrees(page, requests) {
  await goto(page); await ready(page);
  for (const name of ['Display controls', 'Selection and tracks controls']) assert.equal(await page.getByRole('group', { name, exact: true }).count(), 1);
  const display = page.getByRole('group', { name: 'Display controls', exact: true });
  const selection = page.getByRole('group', { name: 'Selection and tracks controls', exact: true });
  assert.deepEqual(await display.locator('.phylogeny-display-row').evaluateAll(rows => rows.map(row => row.getAttribute('aria-label'))), ['Tree', 'Copy number', 'Right heatmap', 'Layout']);
  assert.equal(await display.getByRole('combobox', { name: 'Phylogeny tree', exact: true }).count(), 1);
  assert.equal(await selection.getByRole('combobox').count(), 0);
  const selectors = page.locator('.phylogeny-toolbar .ant-select');
  assert.equal(await selectors.count(), 2, 'Only CN and tree selectors while mutations are hidden');
  await page.getByRole('button', { name: 'Show mutations', exact: true }).click();
  assert.equal(await selectors.count(), 4);
  const viewport = page.viewportSize();
  for (const width of [1440, 900, 600, 420]) {
    await page.setViewportSize({ ...viewport, width }); await tick(page);
    const overflow = await display.evaluate(group => {
      const b = group.getBoundingClientRect();
      return [...group.querySelectorAll('.ant-select, .ant-input-number, button, .phylogeny-row-label')].filter(e => {
        const r = e.getBoundingClientRect();
        return r.width && (r.x < b.x - 1 || r.right > b.right + 1 || r.y < b.y - 1 || r.bottom > b.bottom + 1);
      }).map(e => e.getAttribute('aria-label') || e.textContent);
    });
    assert.deepEqual(overflow, [], `Display controls must wrap without clipping at ${width}px`);
  }
  await page.setViewportSize(viewport); await tick(page);
  check('Display controls are grouped by Tree / Copy number / Right heatmap / Layout and wrap at 420–1440px');
  // Inspect every actual dropdown. Obsolete modes must not be merely hidden in
  // an unexpanded selector, and no positional select indexing is used.
  for (const name of ['Right heatmap data', 'Copy-number view', 'Mutation color', 'Phylogeny tree']) {
    await page.getByRole('combobox', { name, exact: true }).locator('xpath=ancestor::div[@class="ant-select-selector"]').click();
    const options = await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').allTextContents();
    assert.ok(options.length > 0);
    if (name === 'Mutation color') assert.deepEqual(options, ['VAF', 'Ref count', 'Alt count']);
    assert.ok(options.every(text => !/Overlay|Paired|Right heatmap/.test(text)), `Obsolete mutation mode: ${options}`);
    await page.keyboard.press('Escape');
    await until(page, async () => await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').count() === 0, 'dropdown exit transition');
  }
  check('Only Show/Hide mutation toggle and named CN/matrix/tree controls; no Overlay/Paired mode options');
  for (const [label, metric] of [['Ref count', 'ref'], ['Alt count', 'alt']]) {
    await selectOption(page, page, 'Mutation color', label);
    const actual = await side(page).evaluate(c => {
      const h = window.__pgvComponent(c.closest('.phylogeny-heatmap').querySelector('.heatmap-canvas'));
      const matrix = h.scene.sideMatrix, row = h.scene.sideMatrixRows.get(h.scene.rows[0].id);
      const key = h.scene.mutationMetric === 'ref' ? 'refCounts' : 'altCounts';
      const value = matrix[key][row * matrix.variants.length];
      const maximum = Number(c.dataset.frameMaximum);
      const ctx = c.getContext('2d'), reds = new Set();
      // Inspect actual visible cell centers: formula equality at a single pixel
      // would miss the reported low-contrast, almost-one-color regression.
      for (let y = 11; y < c.height - 16; y += 22) for (let x = 2; x < c.width; x += 4) reds.add(ctx.getImageData(x, y, 1, 1).data[0]);
      return { value, maximum, pixel: Array.from(ctx.getImageData(2, 11, 1, 1).data), metric: c.dataset.frameMetric, scale: c.dataset.frameScale,
        cnMode: h.scene.cnMode, shades: reds.size, contrast: Math.max(...reds) - Math.min(...reds) };
    });
    assert.equal(actual.metric, metric); assert.equal(actual.cnMode, 'total');
    const ratio = Math.log1p(actual.value) / Math.log1p(actual.maximum);
    assert.equal(actual.scale, 'log1p');
    assert.ok(actual.shades >= 15 && actual.contrast >= 80, `${label} must show visible count variation, not nearly uniform blue`);
    assert.deepEqual(actual.pixel, [Math.round(255 * ratio), 128, Math.round(255 * (1 - ratio)), 255]);
    await page.getByRole('img', { name: `${label}: logarithmic color scale from 0 to ${actual.maximum}; tooltips show raw counts`, exact: true }).waitFor();
    await tooltipAtScrolledCell(page, 'mutations');
    await screenshot(page, `${metric}-count-log-scale`);
    check(`${label} log colors visibly distinguish actual read counts; raw tooltips and CN remain unchanged`, actual);
  }
  await selectOption(page, page, 'Mutation color', 'VAF');
  await page.getByRole('button', { name: 'Reset zoom', exact: true }).click();
  await page.getByRole('button', { name: 'Fit rows', exact: true }).click();
  const palette = ['#168ccb', '#ffffff', '#fdbf6f', '#ff8a3d', '#ff5a24', '#ef2b2d', '#d7193f', '#b2184b', '#8c1d40', '#5a2630', '#000000', '#000000'];
  for (const mode of ['Major', 'Minor']) {
    await selectOption(page, page, 'Copy-number view', mode);
    const painted = await canvas(page).evaluate(c => {
      const h = window.__pgvComponent(c), s = h.scene, w = s.windows[0];
      for (const row of s.rows) for (const i of s.data.cnByCell[row.id]) {
        const x = w.x + w.scale((i.start + i.end) / 2), y = row.y;
        if ((i.end - i.start) * w.width / (w.domain[1] - w.domain[0]) < 4 || x <= w.x + 2 || x >= w.x + w.width - 2) continue;
        return { value: i[`${s.cnMode}Cn`], rgba: Array.from(c.getContext('2d').getImageData(Math.floor(x), Math.floor(y), 1, 1).data), intervals: Number(c.dataset.frameCnDrawn) };
      }
      throw new Error('No actual CN interval pixel available');
    });
    assert.equal(painted.intervals, 15834);
    assert.ok(Number.isFinite(painted.value));
    const expected = palette[Math.min(11, Math.floor(painted.value))];
    assert.deepEqual(painted.rgba, [...[1, 3, 5].map(i => parseInt(expected.slice(i, i + 2), 16)), 255]);
    check(`${mode} view paints real allelic values (not labels/missing gray) across all 15,834 intervals`, painted);
  }
  await selectOption(page, page, 'Copy-number view', 'Total');
  const heatmap = page.locator('.phylogeny-heatmap');
  await heatmap.focus(); await page.keyboard.press('ArrowRight'); await tick(page);
  assert.equal((await scene(page)).cnMode, 'major');
  await page.keyboard.press('ArrowLeft'); await tick(page);
  assert.equal((await scene(page)).cnMode, 'total');
  const resize = page.getByRole('separator', { name: 'Resize tree gutter', exact: true });
  const before = (await scene(page)).gutter;
  await resize.press('ArrowRight'); await tick(page);
  assert.equal((await scene(page)).gutter, before + 16);
  assert.equal((await scene(page)).cnMode, 'total', 'Gutter keyboard must not cycle CN');
  await resize.press('ArrowLeft');
  for (const control of [page.getByRole('spinbutton', { name: 'Heatmap height' }), page.getByRole('combobox', { name: 'Copy-number view', exact: true }), page.getByRole('button', { name: 'Readable rows', exact: true })]) {
    await control.focus(); await page.keyboard.press('ArrowRight'); await tick(page);
    assert.equal((await scene(page)).cnMode, 'total', 'Focused controls must not receive heatmap CN shortcuts');
    await page.keyboard.press('Escape');
  }
  // The accessible leaf buttons live INSIDE the heatmap keydown boundary.
  const leaf = page.getByRole('button', { name: `Select cell ${(await scene(page)).rows[0].id}`, exact: true });
  await leaf.focus(); await leaf.press('ArrowRight'); await tick(page);
  assert.equal((await scene(page)).cnMode, 'total');
  await heatmap.focus();
  check('Focused heatmap Left/Right cycles CN; gutter, input, combo and descendant button focus do not');
  await page.getByRole('button', { name: 'Readable rows', exact: true }).click();
  await scrollRows(page, page, 0);
  // Hover an unambiguous visible leaf: account for branch-first hit testing by
  // checking the actual hover identity, then assert blue node outline paint.
  const s = await scene(page), box = await canvas(page).boundingBox();
  let hover;
  for (const node of s.tree.filter(n => n.descendants.length === 1 && n.y > 10 && n.y < s.viewportHeight - 10)) {
    await page.mouse.move(box.x + node.x, box.y + node.y); await tick(page);
    hover = await canvas(page).evaluate(c => {
      const h = window.__pgvComponent(c);
      return { hit: h.hover, lines: h.state.tooltip?.lines, strokes: window.__pgvStrokes.get(c) };
    });
    if (hover.hit?.nodeId !== node.id) continue;
    assert.ok(hover.lines.includes(`Cell: ${node.id}`));
    assert.ok(hover.strokes.some(op => op.color === '#1677ff' && op.lineWidth === 2 && op.rect.every((v, i) => Math.abs(v - [node.x - 5, node.y - 5, 10, 10][i]) < 0.01)), 'Hovered tree node has blue, two-pixel outline');
    hover = { id: node.id, lines: hover.lines }; break;
  }
  assert.ok(hover?.id, 'At least one visible tree node must be verifiably hoverable');
  await screenshot(page, 'visible-tree-node-hover'); check('Visible tree hover reports the exact cell ID and draws a blue node outline', hover);
  const requestCount = requests.length;
  await selectRow(page, page, 1); await selectRow(page, page, 4, ['Shift']);
  assert.deepEqual((await scene(page)).selected.sort(), s.rows.slice(1, 5).map(r => r.id).sort());
  await selectRow(page, page, 7, ['Control']);
  assert.equal((await scene(page)).selected.length, 5);
  assert.equal(requests.length, requestCount);
  await confirmSelection(page, page, false);
  assert.equal(await page.locator('[data-plot-type="genome"]').count(), 0);
  assert.equal(requests.length, requestCount);
  check('Shift-range and Control-toggle select real IDs; even multi-cell opening is confirmed and cancellation performs no I/O');
  await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
  await selectOption(page, page, 'Phylogeny tree', titles.demo);
  await until(page, async () => await canvas(page).count() === 0 && await page.locator('.phylogeny-legacy-panel').count() === 1, 'DEMO standalone tree');
  assert.equal(await page.getByRole('combobox', { name: 'Phylogeny tree', exact: true }).count(), 1);
  await selectOption(page, page, 'Phylogeny tree', titles.normal); await ready(page, 130 * 8878);
  assert.equal((await scene(page)).treeLeaves.length, 130);
  assert.equal((await scene(page)).cellIds.length, 130);
  assert.equal((await scene(page)).rows.length, 130);
  assert.equal(await page.locator('.phylogeny-linked-panel').count(), 1);
  await selectOption(page, page, 'Phylogeny tree', titles.tumor); await ready(page);
  assert.equal((await scene(page)).treeLeaves.length, 125);
  assert.equal((await scene(page)).rows.length, 125);
  assert.equal(await page.locator('.phylogeny-linked-panel').count(), 1);
  await screenshot(page, 'tree-switch-return');
  check('Unmatched DEMO preserves tree selector; normal 130-tip and tumor 125-tip trees safely return to the same panel');
}

async function alignment(page) {
  await page.locator('[data-plot-type="genome"] .zoom-background').first().waitFor();
  const box = await canvas(page).boundingBox(), s = await scene(page);
  const bounds = await page.locator('[data-plot-type="genome"] .zoom-background').evaluateAll(elements => elements.map(e => {
    const r = e.getBoundingClientRect(); return { x: r.x - 0.5, width: r.width };
  }));
  assert.ok(bounds.length >= 1);
  bounds.forEach((b, i) => {
    const w = s.windows[i % s.windows.length];
    assert.ok(Math.abs(b.x - (box.x + w.x)) < 1, `Detail left alignment ${JSON.stringify({ b, w, box })}`);
    assert.ok(Math.abs(b.width - w.width) < 1, `Detail width ${b.width} vs ${w.width}`);
  });
  return bounds;
}
async function verifyDetails(page, requests) {
  await goto(page); await ready(page);
  await page.getByRole('button', { name: 'Pin heatmap', exact: true }).click(); await tick(page);
  await page.getByRole('button', { name: 'Show mutations', exact: true }).click(); await tick(page);
  const before = requests.length, order = (await scene(page)).rows.map(r => r.id);
  await selectRow(page, page, 0); await confirmSelection(page, page, false);
  assert.equal(await page.locator('[data-plot-type="genome"]').count(), 0); assert.equal(requests.length, before);
  await confirmSelection(page, page, true);
  await page.locator('[data-plot-type="genome"]').waitFor();
  await until(page, async () => (await selectedFiles(page)).includes(order[0]), 'opened sample in header');
  assert.equal(requests.length, before, 'Confirmed opening must reuse overview cache');
  check('Single-cell confirmation is mandatory; accepted opening reuses overview cache and updates header', await selectedFiles(page));
  await page.locator('[data-plot-type="genome"]').scrollIntoViewIfNeeded(); await tick(page);
  check('Mutation side inset aligns real opened genome detail windows', await alignment(page));
  await selectOption(page, page, 'Right heatmap data', 'Junction CN');
  check('Junction side inset preserves genome detail alignment', await alignment(page));
  const handle = page.getByRole('separator', { name: 'Resize tree gutter', exact: true });
  await handle.press('ArrowRight'); await tick(page);
  check('Resized tree gutter preserves side-inset detail alignment', await alignment(page));
  await page.getByRole('button', { name: 'Hide tree / labels', exact: true }).click(); await tick(page);
  assert.equal((await scene(page)).gutter, 0);
  check('Hidden tree gutter preserves side-inset detail alignment', await alignment(page));
  await page.getByRole('button', { name: 'Show tree / labels', exact: true }).click();
  await page.getByRole('button', { name: 'Hide junctions', exact: true }).click(); await tick(page);
  check('Hidden side matrix expands aligned detail plotting bounds', await alignment(page));
  await page.getByRole('button', { name: 'Show junctions', exact: true }).click();
  await screenshot(page, 'selected-cell-side-inset-alignment');
  const url = page.url();
  await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
  await until(page, async () => await page.locator('[data-plot-type="genome"]').count() === 0, 'clear detail tracks');
  assert.deepEqual(await selectedFiles(page), ['BWH70_phylogeny']);
  assert.equal(page.url(), url); assert.equal(requests.length, before);
  assert.equal((await scene(page)).selected.length, 0);
  assert.equal(await canvas(page).getAttribute('data-matrix-entries'), '1109750');
  check('Clear selection removes confirmed tracks/header additions without losing the full matrix, URL or cache');
}

async function verifyIsolation(page) {
  const second = 'BWH70_browser_second_cohort';
  const injected = JSON.parse(JSON.stringify(manifest));
  injected[second] = JSON.parse(JSON.stringify(manifest.BWH70_phylogeny));
  // Duplicate panel identity, not physical data. Canonical source paths let the
  // application's real transport cache share the 85 MB source instead of routing
  // a second huge response through the browser automation protocol.
  injected[second].plots.forEach(p => {
    p.title = `Second cohort: ${p.title}`;
    p.source = `../BWH70_phylogeny/${p.source}`;
    if (p.heatmap) for (const key of ['mutationSource', 'junctionSource']) {
      if (p.heatmap[key]) p.heatmap[key] = `../BWH70_phylogeny/${p.heatmap[key]}`;
    }
  });
  await page.route('**/datafiles.json', route => route.fulfill({ json: injected }));
  await page.goto(`${base}/?file=BWH70_phylogeny,${second}&location=1:1-2:294199`); await ready(page, 1109750, 2);
  const panels = page.locator('.phylogeny-linked-panel');
  const first = panels.nth(0), other = panels.nth(1);
  assert.notEqual((await scene(first)).plotId, (await scene(other)).plotId, 'Injected cohorts must have distinct panel identities');
  await first.getByRole('button', { name: 'Fit rows', exact: true }).click();
  await other.getByRole('button', { name: 'Fit rows', exact: true }).click();
  await canvas(first).scrollIntoViewIfNeeded(); await tick(page);
  // Middle rows remain pointer-visible below PGV's affixed header even when
  // scrollIntoView considers the upper canvas edge visible behind that header.
  await selectRow(page, first, 60);
  assert.equal((await scene(first)).selected.length, 1);
  assert.deepEqual((await scene(other)).selected, [], 'Untouched second cohort must not inherit the first cohort selection');
  await canvas(other).scrollIntoViewIfNeeded(); await tick(page);
  await selectRow(page, other, 61);
  assert.deepEqual((await scene(first)).selected, [(await scene(first)).rows[60].id]);
  assert.deepEqual((await scene(other)).selected, [(await scene(other)).rows[61].id]);
  await first.getByRole('button', { name: 'Show mutations', exact: true }).click();
  assert.equal(await side(first).count(), 1); assert.equal(await side(other).count(), 0);
  const remaining = (await scene(other)).selected;
  await first.getByRole('button', { name: 'Remove phylogeny track', exact: true }).click();
  await until(page, async () => await panels.count() === 1, 'remove one cohort panel');
  assert.deepEqual((await scene(panels.first())).selected, remaining);
  assert.match(await panels.first().locator('.ant-card-head-title').innerText(), /Second cohort/);
  await screenshot(page, 'cohort-selection-isolation-removal');
  check('Two cohorts retain isolated selection/view state; removing one preserves the other (routed manifest, shared real sources)');
}

async function verifyLegacy(page, context) {
  await goto(page); await ready(page, 92000);
  assert.equal(await canvas(page).getAttribute('data-site-count'), '736');
  const axis = legacySource.layout.yaxis;
  const order = axis.ticktext.map((id, i) => ({ id, y: axis.tickvals[i] })).sort((a, b) => b.y - a.y).map(r => r.id);
  assert.deepEqual((await scene(page)).rows.map(r => r.id), order);
  await page.getByRole('button', { name: 'Show mutations', exact: true }).click(); await tick(page);
  assert.equal(await side(page).getAttribute('data-frame-columns'), '736');
  assert.ok((await geometry(page)).backingWidth < 1000);
  check('Separately routed legacy Plotly fixture retains all 125 × 736 entries and original screen order');
  // Development hook is REQUIRED here. An absent benchmark must fail, not turn
  // into a passing check. Production/browser compatibility is reported honestly.
  report.fullMatrixBenchmark = await canvas(page).evaluate(c => {
    if (typeof c.benchmarkFullMatrix !== 'function') throw new Error('Development full-matrix benchmark hook unavailable; run against the dev server');
    return c.benchmarkFullMatrix(3);
  });
  const benchmark = report.fullMatrixBenchmark;
  assert.equal(benchmark.readback, true); assert.equal(benchmark.visited, 92000); assert.equal(benchmark.drawn, 92000);
  assert.equal(benchmark.frames.length, 3);
  for (const frame of benchmark.frames) {
    assert.equal(frame.rowsDrawn, 125); assert.equal(frame.zeroDrawn, 58632); assert.equal(frame.missingDrawn, 1081);
    assert.equal(frame.positiveDrawn, 32287); assert.equal(frame.groupsDrawn, 0); assert.equal(frame.cnDrawn, 15834);
  }
  check('Real legacy dev benchmark raster-readbacks every one of 92,000 glyphs and 15,834 CN intervals', { frames: benchmark.frames.length });
  await screenshot(page, 'legacy-plotly-matrix');
  // verifyEdges opens its own pages. The CONTEXT route is essential: its 92000
  // waits and deliberate mutations.json failure cannot run on sparse data.
  report.edgeCases = await verifyEdges(context, base, output);
  assert.ok(report.edgeCases.ok, report.edgeCases.error);
  for (const item of report.edgeCases.checks) check(`Legacy: ${item.name}`, item.geometry || item.bounds || true);
}

async function verifyFitOverview(page) {
  await goto(page); await ready(page);
  await page.getByRole('button', { name: 'Show mutations', exact: true }).click();
  await page.getByRole('button', { name: 'Fit rows', exact: true }).click();
  await tick(page);
  const initial = await side(page).evaluate(c => {
    const h = window.__pgvComponent(c);
    const scroll = c.closest('.mutation-scroll-x');
    return { rows: Number(c.dataset.frameRowsDrawn), sites: Number(c.dataset.frameColumns), bins: Number(c.dataset.frameColumnsDrawn),
      entries: h.scene.sideMatrix.values.length, width: c.getBoundingClientRect().width, scrollWidth: scroll.scrollWidth, clientWidth: scroll.clientWidth,
      genomic: h.props.domains, range: h.state.mutationRange, scale: c.dataset.frameScale };
  });
  assert.equal(initial.rows, 125); assert.equal(initial.sites, 8878); assert.equal(initial.entries, 1109750);
  assert.ok(initial.bins <= 280 && initial.bins === Math.floor(initial.width));
  assert.equal(initial.scrollWidth, initial.clientWidth);
  assert.equal(initial.scale, 'positive-fraction'); assert.equal(initial.range, null);
  check('Real 125 × 8878 catalog fits the right panel without horizontal scrolling or source reduction', initial);
  await screenshot(page, 'mutations-fit-overview');
  const box = await side(page).boundingBox();
  await page.mouse.move(box.x + 20, box.y + 2);
  await page.getByRole('tooltip').getByText(/sites:/).waitFor();
  await page.mouse.click(box.x + 20, box.y + 2); await tick(page);
  const detail = await side(page).evaluate(c => {
    const h = window.__pgvComponent(c);
    return { range: h.state.mutationRange, summarized: c.dataset.frameSummarized, genomic: h.props.domains };
  });
  assert.ok(detail.range && detail.range[1] - detail.range[0] > 1);
  assert.equal(detail.summarized, 'false'); assert.deepEqual(detail.genomic, initial.genomic);
  await page.mouse.wheel(0, -120); await tick(page);
  const afterPlainWheel = await side(page).evaluate(c => window.__pgvComponent(c).state.mutationRange);
  const commandWheel = await side(page).evaluate(c => window.__pgvComponent(c).props.zoomedByCmd);
  if (commandWheel) assert.deepEqual(afterPlainWheel, detail.range);
  await page.keyboard.down('Meta'); await page.mouse.wheel(0, -120); await page.keyboard.up('Meta'); await tick(page);
  const afterWheel = await side(page).evaluate(c => window.__pgvComponent(c).state.mutationRange);
  assert.ok(afterWheel[1] - afterWheel[0] <= afterPlainWheel[1] - afterPlainWheel[0]);
  await side(page).focus(); await page.keyboard.press('='); await tick(page);
  const afterKey = await side(page).evaluate(c => window.__pgvComponent(c).state.mutationRange);
  assert.ok(afterKey[1] - afterKey[0] < afterWheel[1] - afterWheel[0]);
  await page.keyboard.press('Home'); await tick(page);
  assert.equal(await side(page).evaluate(c => window.__pgvComponent(c).state.mutationRange), null);
  await page.mouse.click(box.x + 80, box.y + 2); await tick(page);
  const beforePan = await side(page).evaluate(c => window.__pgvComponent(c).state.mutationRange);
  await page.mouse.move(box.x + 180, box.y + 2); await page.mouse.down();
  await page.mouse.move(box.x + 160, box.y + 2, { steps: 3 }); await page.mouse.up(); await tick(page);
  const afterPan = await side(page).evaluate(c => window.__pgvComponent(c).state.mutationRange);
  assert.ok(afterPan[0] > beforePan[0] && afterPan[1] - afterPan[0] === beforePan[1] - beforePan[0]);
  await page.getByRole('button', { name: 'Reset mutation zoom' }).click(); await tick(page);
  await page.keyboard.down('Shift');
  await page.mouse.move(box.x + 40, box.y + 2); await page.mouse.down();
  await page.mouse.move(box.x + 90, box.y + 2, { steps: 5 }); await page.mouse.up();
  await page.keyboard.up('Shift'); await tick(page);
  const brushed = await side(page).evaluate(c => {
    const h = window.__pgvComponent(c);
    return { range: h.state.mutationRange, genomic: h.props.domains };
  });
  assert.ok(brushed.range && brushed.range[0] > 0 && brushed.range[1] < initial.sites);
  assert.deepEqual(brushed.genomic, initial.genomic);
  await screenshot(page, 'mutations-fit-brushed');
  await page.mouse.dblclick(box.x + 20, box.y + 2); await tick(page);
  assert.equal(await side(page).evaluate(c => window.__pgvComponent(c).state.mutationRange), null);
  check('Real overview click/Shift-brush/detail/reset gestures keep mutation zoom separate from genomic domains', { detail: detail.range, brushed: brushed.range });
}

try {
  const overviewContext = await newContext();
  await suite('mutation-fit-overview', verifyFitOverview, overviewContext);
  const context = await newContext();
  await suite('real-source-scrolling', verifyScrolling, context);
  await suite('controls-selection-trees', verifyControlsAndTrees, context);
  await suite('confirmed-details-alignment', verifyDetails, context);
  await suite('cohort-isolation', verifyIsolation, context);
  const legacyContext = await newContext();
  const legacyManifest = JSON.parse(JSON.stringify(manifest));
  for (const plot of legacyManifest.BWH70_phylogeny.plots) {
    if (plot.heatmap) plot.heatmap = { mutationSource: 'mutations.json', mutationFormat: 'plotly' };
  }
  await legacyContext.route('**/datafiles.json', route => route.fulfill({ json: legacyManifest }));
  await suite('legacy-plotly', page => verifyLegacy(page, legacyContext), legacyContext);
  report.ok = report.suites.length === 6 && report.suites.every(s => s.ok);
  if (!report.ok) process.exitCode = 1;
} catch (error) {
  report.ok = false; report.error = error.stack; process.exitCode = 1; console.error(error);
} finally {
  report.finished = new Date().toISOString();
  fs.writeFileSync(path.join(output, 'native-ui-verification.json'), JSON.stringify(report, null, 2));
  for (const context of contexts) await context.close();
  await browser.close();
  console.log(`${report.ok ? 'PASS' : 'FAIL'}: ${report.checks.length} checks; evidence ${output}/native-ui-verification.json`);
}
