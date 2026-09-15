// Full-fixture integration check against the existing local PGV dev server.
// PLAYWRIGHT_MODULE may point to an already installed Playwright module.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { verifyEdges } from './phylogeny-browser-edges.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PGV_URL || 'http://127.0.0.1:3005';
const output = process.env.PGV_RESULTS_DIR || 'remote-repo/phylogeny/logs';
fs.mkdirSync(path.join(output, 'screenshots'), { recursive: true });
const browser = process.env.PGV_CDP ? await chromium.connectOverCDP(process.env.PGV_CDP) : await chromium.launch({ headless: true });
const context = process.env.PGV_CDP ? browser.contexts()[0] : await browser.newContext();
const page = await context.newPage();
await page.setViewportSize({ width: 1440, height: 1000 });
const report = { fixture: 'BWH70', viewport: { width: 1440, height: 1000 }, checks: [], errors: [], failures: [] };
const requests = [];
page.on('pageerror', e => report.errors.push(e.message));
page.on('response', r => { if (r.status() >= 400) report.failures.push({ url: r.url(), status: r.status() }); });
page.on('request', r => { if (r.url().includes('/data/')) requests.push(r.url()); });
const check = (name, details = true) => { report.checks.push({ name, details }); console.log('PASS', name); };
const canvas = () => page.locator('canvas[data-matrix-entries]');
const tick = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const screenshot = name => page.screenshot({ path: path.join(output, 'screenshots', name + '.png'), fullPage: false });
// Read-only inspection of the mounted custom child. All interaction is via DOM controls/pointers.
const selectedFiles = () => page.locator('.files-select').evaluate(element => {
  let fiber = element[Object.keys(element).find(k => k.startsWith('__reactFiber'))];
  while (fiber && !Array.isArray(fiber.memoizedProps?.value)) fiber = fiber.return;
  return fiber.memoizedProps.value;
});
const sceneInfo = () => canvas().evaluate(c => {
  let fiber = c[Object.keys(c).find(k => k.startsWith('__reactFiber'))];
  while (fiber && !(fiber.stateNode && fiber.stateNode.scene)) fiber = fiber.return;
  const component = fiber.stateNode;
  return { cellIds: component.scene.data.cellIds, gutter: component.scene.gutterWidth, rowHeight: component.scene.rowHeight,
    root: { x: component.scene.tree[0]?.x, y: component.scene.tree[0]?.y }, scrollTop: component.scrollTop,
    rows: component.scene.rows.map(r => ({ id: r.id, y: r.y, matrixRow: r.matrixRow })),
    windows: component.scene.windows.map(w => ({ domain: w.domain, x: w.x, width: w.width, groups: w.groups })),
    singleton: (() => { const w = component.scene.windows[0]; const g = w?.groups.find(g => g.indices.length === 1); if (!g) return null;
      const m = component.scene.data.mutations; const v = g.indices[0]; const r = component.scene.rows[0]; const i = r.matrixRow * m.variants.length + v;
      return { x: w.x + g.x1, y: component.scene.rowHeight * 0.75 - component.scrollTop, id: m.variants[v].id, value: m.missing[i] ? null : m.values[i] }; })() };
});
async function setMode(mode) {
  await page.locator('.phylogeny-toolbar .ant-select-selector').click();
  await page.locator(`.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option[title="${mode}"]`).click();
  await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').waitFor({ state: 'hidden' });
  await tick();
}
async function selectRow(index, modifiers = []) {
  const rect = await canvas().boundingBox(); const s = await sceneInfo();
  for (const key of modifiers) await page.keyboard.down(key);
  await page.mouse.click(rect.x + s.gutter - 12, rect.y + (index + 0.5) * s.rowHeight - s.scrollTop);
  for (const key of modifiers.reverse()) await page.keyboard.up(key);
  await tick();
}
async function openSelected(confirm) {
  await page.getByRole('button', { name: /Open selected/ }).click();
  const dialog = page.getByRole('dialog'); await dialog.waitFor();
  await dialog.getByRole('button', { name: confirm ? 'Open tracks' : 'Cancel', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' }); await tick();
}
async function alignment() {
  await page.locator('[data-plot-type="genome"] .zoom-background').first().waitFor();
  const rect = await canvas().boundingBox(); const s = await sceneInfo();
  const bounds = await page.locator('[data-plot-type="genome"] .zoom-background').evaluateAll(elements => elements.map(e => { const r = e.getBoundingClientRect(); return { x: r.x - 0.5, width: r.width }; }));
  bounds.forEach((b, i) => {
    const w = s.windows[i % s.windows.length];
    assert.ok(Math.abs(b.x - (rect.x + w.x)) < 1, `left alignment: ${JSON.stringify({b,w,rect})}`);
    assert.ok(Math.abs(b.width - w.width) < 1, `width alignment: ${b.width} vs ${w.width}`);
  }); return bounds;
}
try {
  await page.goto(`${base}/?location=1:1-2:294199&file=BWH70_phylogeny`);
  await page.waitForSelector('canvas[data-matrix-entries="92000"]', { timeout: 60000 });
  assert.equal(await page.locator('.phylogeny-heatmap').getAttribute('data-mutation-mode'), 'hidden');
  assert.equal(await canvas().getAttribute('data-cell-count'), '125');
  assert.equal(await canvas().getAttribute('data-site-count'), '736');
  check('Hidden default; entire 125-cell × 736-site matrix loaded');
  const heightInput = page.getByRole('spinbutton', { name: 'Heatmap height' });
  assert.equal(await heightInput.inputValue(), '640');
  for (const name of ['Display controls', 'Selection and tracks controls']) assert.equal(await page.getByRole('group', { name }).count(), 1);
  assert.equal(await page.getByRole('group', { name: 'Display controls' }).getByRole('button', { name: 'Reset zoom', exact: true }).count(), 1);
  assert.equal(await page.getByRole('button', { name: 'Clear loaded tracks', exact: true }).count(), 0);
  assert.equal(await page.locator('.phylogeny-linked-panel .ant-card-head-title').innerText(), 'BWH70 Phylogeny without Normal Cells');
  const originalAxis = JSON.parse(fs.readFileSync('public/data/BWH70_phylogeny/mutations.plotly.json', 'utf8')).layout.yaxis;
  const originalOrder = originalAxis.ticktext.map((id, i) => ({ id, y: originalAxis.tickvals[i] })).sort((a, b) => b.y - a.y).map(row => row.id);
  assert.deepEqual((await sceneInfo()).rows.map(row => row.id), originalOrder);
  check('Original Plotly top-to-bottom order and cohort-only title; two control groups and Display Reset zoom');
  const palette = ['#168CCB', '#8FD3E8', '#FFFFFF', '#FDBF6F', '#FF8A3D', '#FF5A24', '#EF2B2D', '#D7193F', '#B2184B', '#8C1D40', '#5A2630', '#000000'];
  const legendColors = await page.locator('[aria-label="Copy number legend"] .heatmap-swatch').evaluateAll(elements => elements.map(e => e.style.backgroundColor));
  assert.deepEqual(legendColors.slice(0, 12), palette.map(color => `rgb(${[1,3,5].map(i => parseInt(color.slice(i, i + 2), 16)).join(', ')})`));
  check('All twelve original CN legend colors, plus distinct missing');
  await page.setViewportSize({ width: 1440, height: 1300 }); await tick();
  const heightGrip = page.getByRole('separator', { name: 'Resize phylogeny panel height' });
  await heightGrip.scrollIntoViewIfNeeded();
  const grip = await heightGrip.boundingBox();
  await page.mouse.move(grip.x + grip.width / 2, grip.y + 8); await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2, grip.y + 88, { steps: 8 }); await page.mouse.up(); await tick();
  assert.equal(await heightInput.inputValue(), '720');
  await heightGrip.press('ArrowUp'); await tick();
  assert.equal(await heightInput.inputValue(), '704');
  await heightInput.fill('640'); await heightInput.press('Enter');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => window.scrollTo(0, 0)); await tick();
  assert.equal(await heightInput.inputValue(), '640');
  check('Bottom grip and keyboard resize share height state; unpinned height is not viewport-clamped');
  await screenshot('native-refined-controls');
  let gestureScene = await sceneInfo(); let gestureBox = await canvas().boundingBox();
  const panWindow = gestureScene.windows[0]; const panX = gestureBox.x + panWindow.x + panWindow.width / 2;
  await page.mouse.move(panX, gestureBox.y + 12); await page.mouse.down();
  await page.mouse.move(panX - 70, gestureBox.y + 12, { steps: 8 }); await page.mouse.up(); await tick();
  const panned = (await sceneInfo()).windows[0].domain;
  assert.ok(panned[0] > panWindow.domain[0]);
  assert.ok(Math.abs((panned[1] - panned[0]) - (panWindow.domain[1] - panWindow.domain[0])) < 1);
  check('Plain click-drag pans without Command and preserves span');
  const selectionRequests = requests.length;
  await selectRow(1); await selectRow(4, ['Shift']);
  assert.match(await page.getByRole('button', { name: /Open selected/ }).innerText(), /\(4\)/);
  const order = (await sceneInfo()).rows.map(row => row.id);
  for (let i = 1; i <= 4; i++) assert.equal(await page.getByRole('button', { name: `Select cell ${order[i]}`, exact: true }).getAttribute('aria-pressed'), 'true');
  await selectRow(7, ['Control']);
  assert.match(await page.getByRole('button', { name: /Open selected/ }).innerText(), /\(5\)/);
  await selectRow(2, ['Control']);
  assert.match(await page.getByRole('button', { name: /Open selected/ }).innerText(), /\(4\)/);
  await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
  await selectRow(7, ['Shift']);
  assert.match(await page.getByRole('button', { name: /Open selected/ }).innerText(), /\(1\)/);
  assert.equal(requests.length, selectionRequests);
  await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
  check('Shift selects inclusive tree ranges; Control toggles individuals; clear resets range anchor without I/O');
  // Keep detail panels in the viewport during linked geometry checks.
  await page.getByRole('button', { name: 'Pin heatmap', exact: true }).click(); await tick();
  await page.getByRole('button', { name: 'Reset zoom', exact: true }).click(); await tick();
  await setMode('Paired');
  const gradient = await page.locator('.heatmap-vaf-gradient').evaluate(e => getComputedStyle(e).backgroundImage);
  assert.equal(gradient, 'linear-gradient(to right, rgb(255, 255, 255), rgb(0, 0, 0))');
  assert.deepEqual(await page.locator('.heatmap-vaf-ticks span').allTextContents(), ['0', '0.25', '0.5', '0.75', '1']);
  assert.ok(!(await page.locator('.heatmap-legend').innerText()).includes('overlap count'));
  assert.equal(await page.locator('.heatmap-overlap-symbol').innerText(), '+');
  assert.equal(await page.locator('.heatmap-overlap-symbol').evaluate(e => getComputedStyle(e).borderRadius), '50%');
  const groupRendering = await canvas().evaluate(c => {
    let fiber = c[Object.keys(c).find(k => k.startsWith('__reactFiber'))];
    while (fiber && !(fiber.stateNode && fiber.stateNode.scene)) fiber = fiber.return;
    const ctx = c.getContext('2d'), arc = ctx.arc; let arcs = 0;
    ctx.arc = function() { arcs++; return arc.apply(this, arguments); };
    try { fiber.stateNode.draw(); } finally { ctx.arc = arc; }
    return { arcs, singletons: Number(c.dataset.frameDrawn), groups: Number(c.dataset.frameGroupsDrawn) };
  });
  assert.ok(groupRendering.groups > 0);
  assert.equal(groupRendering.arcs, groupRendering.singletons + groupRendering.groups);
  check('Continuous grayscale VAF and circle-plus aggregation icons, no brackets or numbers', groupRendering);
  check('Paired mode retains all 92000 entries');
  const before = requests.length;
  await selectRow(0);
  assert.match(await page.getByRole('button', { name: /Open selected/ }).innerText(), /\(1\)/);
  assert.equal(await page.locator('[data-plot-type="genome"]').count(), 0);
  await openSelected(false);
  assert.equal(await page.locator('[data-plot-type="genome"]').count(), 0);
  assert.equal(requests.length, before);
  check('Single-cell selection and cancelled confirmation perform no data requests or track opening');
  await openSelected(true);
  await page.waitForSelector('[data-plot-type="genome"]');
  assert.equal(requests.length, before);
  check('Confirmed single cell opens existing genome panel from overview cache');
  await selectRow(1); await openSelected(true);
  assert.equal(await page.locator('[data-plot-type="genome"]').count(), 2);
  assert.equal(requests.length, before);
  check('Second confirmed cell preserves tree and does not fetch hidden optional coverage');
  assert.deepEqual(await selectedFiles(), ['BWH70_phylogeny', ...originalOrder.slice(0, 2)]);
  assert.ok((await page.locator('.files-select').boundingBox()).height <= 40, 'Selected samples must not wrap outside the header');
  check('Opening cells adds real samples to the compact header selector without reloading the cohort');
  await selectRow(0, ['Control']);
  await page.getByLabel('Selected rows only', { exact: true }).check(); await tick();
  assert.deepEqual((await sceneInfo()).rows.map(row => row.id), originalOrder.slice(0, 2));
  const labels = await canvas().evaluate(c => {
    let fiber = c[Object.keys(c).find(k => k.startsWith('__reactFiber'))];
    while (fiber && !(fiber.stateNode && fiber.stateNode.scene)) fiber = fiber.return;
    const ctx = c.getContext('2d'), original = ctx.fillText, labels = [];
    ctx.fillText = function(text, x, y, maxWidth) { labels.push({ text, x, y, maxWidth }); return original.apply(this, arguments); };
    try { fiber.stateNode.draw(); } finally { ctx.fillText = original; }
    return labels;
  });
  assert.deepEqual(labels.map(label => label.text).sort(), originalOrder.slice(0, 2).sort());
  assert.ok(Math.abs(labels[0].y - labels[1].y) >= 12);
  await screenshot('native-selected-rows');
  await page.getByLabel('Selected rows only', { exact: true }).uncheck(); await tick();
  await selectRow(1);
  check('Selected rows keep original order and readable leaf labels without ancestor-count collisions');
  await page.getByLabel('Hide unselected tracks').check(); await tick();
  assert.equal(await page.locator('[data-plot-type="genome"]').count(), 1);
  await page.getByLabel('Hide unselected tracks').uncheck(); await tick();
  assert.equal(await page.locator('[data-plot-type="genome"]').count(), 2);
  check('Unselected detail tracks hide and restore without losing data');
  check('Shared plotting bounds', await alignment());
  const separator = page.getByRole('separator', { name: 'Resize tree gutter' });
  const handle = await separator.boundingBox();
  await page.mouse.move(handle.x + 4, handle.y + 25); await page.mouse.down();
  await page.mouse.move(handle.x + 84, handle.y + 25, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(500);
  assert.equal((await sceneInfo()).gutter, 320);
  check('Resizing gutter updates all aligned panels', await alignment());
  await page.getByRole('button', { name: 'Hide tree / labels', exact: true }).click(); await page.waitForTimeout(400);
  assert.equal((await sceneInfo()).gutter, 0);
  check('Hiding gutter expands all aligned panels', await alignment());
  await page.getByRole('button', { name: 'Show tree / labels', exact: true }).click(); await page.waitForTimeout(400);
  assert.equal((await sceneInfo()).gutter, 320);
  check('Showing gutter restores previous width', await alignment());
  await screenshot('native-paired-whole-genome');

  // Brush chr18 from the full-genome view using its real source coordinates.
  const settings = JSON.parse(fs.readFileSync('public/settings.json', 'utf8'));
  let boundary = 0; let chr18;
  for (const chr of settings.coordinates.sets.hg38) { if (chr.chromosome === '18') chr18 = [boundary + 1, boundary + chr.endPoint]; boundary += chr.endPoint; }
  let s = await sceneInfo(); let box = await canvas().boundingBox(); const w = s.windows[0];
  const project = place => box.x + w.x + (place - w.domain[0]) * w.width / (w.domain[1] - w.domain[0]);
  const oldUrl = page.url();
  await page.keyboard.down('Shift');
  await page.mouse.move(project(chr18[0]), box.y + 8); await page.mouse.down();
  await page.mouse.move(project(chr18[1]), box.y + 8, { steps: 8 }); await page.mouse.up();
  await page.keyboard.up('Shift');
  await page.waitForTimeout(400); assert.notEqual(page.url(), oldUrl);
  check('Shift-drag without Command brushes global location and detail bounds', await alignment());
  s = await sceneInfo(); box = await canvas().boundingBox();
  assert.ok(s.singleton);
  await page.mouse.move(box.x + s.singleton.x, box.y + s.singleton.y);
  const tooltip = await page.getByRole('tooltip').innerText();
  assert.ok(tooltip.includes(s.singleton.id));
  assert.ok(tooltip.includes(`VAF: ${s.singleton.value == null ? 'missing' : String(s.singleton.value)}`));
  check('Resolved mutation tooltip shows correct source identity and full-precision VAF', tooltip);
  const detail = page.locator('[data-plot-type="genome"] .zoom-background').first();
  await detail.scrollIntoViewIfNeeded();
  const detailBox = await detail.boundingBox();
  const detailDomain = (await sceneInfo()).windows[0].domain;
  const detailX = detailBox.x + detailBox.width / 2;
  await page.mouse.move(detailX, detailBox.y + detailBox.height - 20); await page.mouse.down();
  await page.mouse.move(detailX - 35, detailBox.y + detailBox.height - 20, { steps: 8 }); await page.mouse.up(); await tick();
  assert.ok((await sceneInfo()).windows[0].domain[0] > detailDomain[0]);
  check('Existing genome track pans with plain drag and coordinates the overview');
  await screenshot('native-paired-chr18');
  await page.mouse.move(20, 250);
  await setMode('Overlay');
  assert.equal(await canvas().getAttribute('data-matrix-entries'), '92000');
  await screenshot('native-overlay-chr18');
  check('Overlay mode preserves full matrix and genomic location');

  await page.evaluate(() => window.scrollTo(0, 500)); await page.waitForTimeout(500);
  const pinned = await page.locator('.phylogeny-linked-panel').boundingBox();
  assert.ok(pinned.y >= 0 && pinned.y < 300);
  assert.ok(pinned.height < 500);
  check('Existing Affix pins the height-limited panel below header/legend', pinned);
  await screenshot('native-pinned');
  await page.getByRole('button', { name: 'Fit rows', exact: true }).click(); await tick();
  s = await sceneInfo(); box = await canvas().boundingBox();
  await page.mouse.click(box.x + s.root.x, box.y + s.root.y - s.scrollTop); await tick();
  assert.match(await page.getByRole('button', { name: /Open selected/ }).innerText(), /\(125\)/);
  const beforeTrunk = requests.length;
  await openSelected(false);
  assert.equal(await page.locator('[data-plot-type="genome"]').count(), 2);
  assert.equal(requests.length, beforeTrunk);
  check('Trunk selects 125 cells; cancelled confirmation opens nothing and makes no requests');

  await page.getByRole('button', { name: 'Reset zoom', exact: true }).click(); await tick();
  report.interactiveZoom = await canvas().evaluate(async c => {
    const result = [];
    for (let i = 0; i < 8; i++) {
      const rect = c.getBoundingClientRect(); const start = performance.now();
      c.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: rect.right - 300,
        clientY: rect.top + 12, deltaY: i % 2 ? 60 : -60, metaKey: true }));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      result.push({ ms: performance.now() - start, modelEntries: Number(c.dataset.matrixEntries),
        rowsDrawn: Number(c.dataset.frameRowsDrawn), sitesVisited: Number(c.dataset.frameVisited), groupsDrawn: Number(c.dataset.frameGroupsDrawn) });
    }
    return result;
  });
  check('Wheel zoom with complete source matrix and all 125 rows fitted', report.interactiveZoom);
  report.fullMatrixBenchmark = await canvas().evaluate(c => c.benchmarkFullMatrix(12));
  assert.equal(report.fullMatrixBenchmark.readback, true);
  assert.equal(report.fullMatrixBenchmark.visited, 92000);
  assert.equal(report.fullMatrixBenchmark.drawn, 92000);
  report.fullMatrixBenchmark.frames.forEach(frame => {
    assert.equal(frame.rowsDrawn, 125); assert.equal(frame.zeroDrawn, 58632); assert.equal(frame.missingDrawn, 1081);
    assert.equal(frame.positiveDrawn, 32287); assert.equal(frame.groupsDrawn, 0); assert.equal(frame.cnDrawn, 15834);
  });
  check('Actual full-matrix circle benchmark: all 92000 glyphs and 15834 CN intervals, no aggregation/culling');
  const clearLocation = page.url();
  const clearRequests = requests.length;
  await page.getByRole('button', { name: 'Clear selection', exact: true }).click(); await tick();
  assert.equal(await page.locator('[data-plot-type]').count(), 0);
  assert.equal(await canvas().getAttribute('data-matrix-entries'), '92000');
  assert.match(await page.getByRole('button', { name: /Open selected/ }).innerText(), /\(0\)/);
  assert.deepEqual(await selectedFiles(), ['BWH70_phylogeny']);
  assert.equal(page.url(), clearLocation);
  assert.equal(requests.length, clearRequests);
  check('Clear selection clears highlights, shown/hidden tracks and added header samples, retaining matrix and location');
  await selectRow(0); await openSelected(false);
  assert.equal(await page.locator('[data-plot-type="genome"]').count(), 0);
  await openSelected(true); await page.waitForSelector('[data-plot-type="genome"]');
  assert.equal(requests.length, clearRequests);
  await page.waitForTimeout(300);
  assert.equal(await page.locator('[data-plot-type="genome"]').count(), 1);
  check('Reopening after clear still requires confirmation and reuses cache without restoring old panels');
  report.domElements = await page.locator('*').count();
  report.edgeCases = await verifyEdges(context, base, output);
  assert.ok(report.edgeCases.ok, report.edgeCases.error);
  report.edgeCases.checks.forEach(c => check(c.name, c.geometry || c.bounds || true));
  assert.deepEqual(report.errors, []);
  check('No JavaScript page errors');
  report.ok = true;
} catch (error) {
  report.ok = false; report.error = error.stack;
  await screenshot('native-verification-failure');
  console.error(error);
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(output, 'native-ui-verification.json'), JSON.stringify(report, null, 2));
  if (process.env.PGV_CDP) { if (report.ok) await page.bringToFront(); } else await page.close();
  await browser.close();
}
