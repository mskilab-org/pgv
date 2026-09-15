# Phylogeny-linked CN and mutation inspection

The existing `PhylogenyPanel` Card now hosts a canvas tree/heatmap child when its
leaf IDs can be matched to genome plots in `datafiles.json`. Existing genome,
coverage, walk, gene, and BigWig panels remain the detail views. Tree-only datasets
without a matched cohort retain the original Phylocanvas component.

## Inputs: existing PGV formats

- Phylogeny: the existing Newick source in a `type: "phylogeny"` plot.
- Copy number: existing genome JSON `intervals[].y`, matched by leaf ID to a
  manifest file ID or a genome plot's `sample`. Multi-sample manifest files are
  matched to the individual genome/sample, not their first genome.
- Mutations: optional standalone **native Plotly figure JSON**, containing the
  original mutation trace and layout. This is the approved initial adapter;
  replacing the source format does not require changing the renderer.

Add optional metadata to the relevant existing phylogeny plot:

```json
{
  "type": "phylogeny",
  "source": "tumor.newick",
  "visible": true,
  "title": "Tumor phylogeny",
  "heatmap": {
    "mutationSource": "mutations.plotly.json",
    "mutationFormat": "plotly"
  }
}
```

`mutationSource` is relative to that manifest dataset's directory, e.g.
`public/data/my_phylogeny/mutations.plotly.json`, even if the Newick file is in a
subdirectory. No mutation metadata is needed for CN-only inspection.

To extract the approved htmlwidgets/Plotly export without executing JavaScript:

```sh
python3 scripts/extract-plotly-mutations.py \
  source-with-mutations.html \
  public/data/my_phylogeny/mutations.plotly.json
```

The utility preserves the source trace/layout, numeric precision, ordering, zero
and null values, checks every cell/site pair, and prints counts and SHA-256 hashes.
It refuses to overwrite a different existing file. It does not access remote
servers. It extracts a fixture; the browser never scrapes or executes Plotly HTML.

The runtime adapter validates IDs, dimensions, complete pair coverage, duplicate
pairs, alleles, chromosome mapping, and VAF bounds. It keeps a full row-major
`Float64Array` and a separate missingness mask. It reads `marker.color`, **not
rounded tooltip VAF strings**. Tree rows are mapped by cell identity, never by
matrix row offset. Variant labels supply their genomic positions and alleles;
Plotly's synthetic mutation `x`/`base` coordinates are not used for genomic layout.

CN and mutation placement uses PGV's existing internal genomic-place convention
(`chromoBins[chromosome].startPlace + source position`) to preserve alignment with
legacy genome panels. Original positions/interval boundaries remain unchanged for
inspection. This feature does not globally revise the legacy coordinate convention.

Screen rows match the original Plotly y-axis orientation, not matrix storage
order: the BWH70 ascending y-axis displays tick rows in reverse top-to-bottom
order. The adapter supplies `displayCellIds`; the renderer still looks up every
value by cell identity. Without numeric Plotly row metadata it uses reversed
Newick leaf traversal. Source arrays and topology are never reordered.

The CN palette matches all **12 original categories: 0–10 and 11+**. Missing CN
has a separate gray swatch. VAF uses the original **continuous white-to-black
gradient**, with exact values retained in tooltips; it is not binned into a few
colors. CN rows meet without white separators; hover and selection use blue
outlines without changing CN/VAF fills. Phylogeny titles use the source title
without a sample/file prefix.

## Controls

- **Mutations: Hidden / Overlay / Paired**, initially Hidden. The entire source
  matrix still loads; Hidden skips drawing it, not loading or validation.
- **Overlay:** opaque VAF-colored circles with contrasting borders over CN.
  Paired mode uses the same circles. White outlined circles are zero; gray crossed
  circles are missing.
- **Paired:** CN and mutation sublanes for each cell, sharing a single tree tip.
- **Fit rows / Readable rows:** fit the cohort or scroll the tree and matrix
  together. Viewport culling never removes entries from the source matrix.
- **Hide tree / labels:** hide the shared gutter. Show restores its previous
  width. Drag its separator or use left/right arrow keys to resize. Detail plots
  share the corresponding inset; their original panel headers stay accessible.
- Click a leaf/row or branch to select cells. **Shift-click** selects the inclusive
  range from the last clicked row/branch, in visible tree order. **Ctrl-click** or
  **Command-click** toggles individual cells/descendant groups; Ctrl/Command+Shift
  appends a range. Repeated Shift-clicks keep the original anchor; Clear selection
  resets it. Keyboard cell buttons support the same modifiers.
- **Clear selection** clears highlights and closes all detail panels, including
  hidden ones, cancelling pending cell loading. Genomic location, genes, phylogeny,
  the complete matrix and reusable cached inputs remain. The UI explicitly calls
  two independent operations (`clearSelection` and `clearTracks`); neither
  underlying operation implicitly invokes the other. Reopening still requires
  confirmation.
- Controls are grouped into **Display** and **Selection & tracks**.
  **Reset zoom**, inside Display, returns to the whole-genome view.
- **Height** defaults to **640 px**. Drag the panel's bottom grip or edit the number
  (140–1600 px). The focused grip supports arrow keys and Home/End. Unpinned height
  is not silently limited by the viewport. `PanelResizeHandle` is a reusable child
  of the existing Card; PGV has no shared base-panel class to replace.
- **Open selected:** always displays confirmation, including one cell. Cancel
  has default focus. Selection alone never opens tracks. A pending confirmation
  is invalidated if the dataset changes. Successfully opened genomes also add
  their real manifest samples to the top selector, deduplicated by owner file;
  optional-track failures do not hide an otherwise successfully opened genome.
  Clearing removes these automatically added choices but retains the originally
  selected datasets. The compact selector summarizes overflow without dropping
  any choices. This synchronization is session-only: it does not change URL
  `file`, whose legacy reload semantics would open every detail group per file.
- **Hide unselected tracks** filters existing detail panels independently from
  **Selected rows only**, which filters overview rows but retains ancestors and
  hidden-descendant counts in branch tooltips and the footer. Only leaf labels are
  printed beside the filtered tree, avoiding stacked ancestor-count labels.
- **Pin heatmap:** uses the existing Ant Design Affix, below the measured header,
  legend and pinned genes. Height is capped to leave room for detail inspection.
- **Plain click-drag pans**, in both the overview and linked detail plots.
  **Shift-drag brushes the overview**, without Command. With PGV's command-zoom
  setting enabled, **Command-scroll** zooms; the modifier gates only wheel events.
  Double-click resets the overview's pointed genomic window;
  Reset zoom resets the global view. Disjoint windows retain their separate
  bounds and gaps. Hover exposes original CN, variant identity, and exact VAF.

Track loading uses the existing Redux saga flow: at most three cells perform I/O
at once, with cached raw genomes, progress, cancellation, retryable errors, and
stale-response guards. Hidden optional coverage is fetched on expansion, not
while opening a genome. Heavy legacy plots retain their existing viewport guards.
Cancel stops queued work and suppresses stale results; Arrow's existing loader
cannot abort an already-started transfer, which retains its queue slot until it
settles. Cached bulk opens periodically yield so cancellation remains usable.

## Display aggregation is not biological inference

At the current scale, sites less than six CSS pixels apart are grouped when their
marker footprints would overlap. This is one sorted sweep, shared across every
cell. Groups never cross chromosomes or disjoint windows. Panning does not
reorganize interior groups; zooming or resizing changes the available spacing.

Groups use a neutral **circle-plus icon**, with no brackets or inline numbers and
**no mean VAF color**. The icon sits at the midpoint of the group's visible extent;
it is a display-group marker, not an inferred variant position. Hover reports site
counts and positive, zero and missing entries for that cell; clicking the icon
zooms to the member sites. Individual VAFs become visible when sites separate. All original
entries remain available. Zero is an observed zero, not a confident wild-type
call; missing is explicitly different. The viewer does not infer clones, call
mutations, estimate evolutionary timing, or invent depth/quality metadata.

## Full-data verification

The local BWH70 fixture contains **125 cells, 736 SNVs, and 92,000 matrix entries**:
58,632 zero, 1,081 missing, and 32,287 positive. All 125 current genome JSON files
supply 15,834 CN intervals. There are no indels in this exported mutation catalog.
The older Plotly CN export has 8,151 displayed rectangles; it is not assumed to
have the same segmentation as the current genome inputs.

This legacy CRA 4 checkout has been tested with installed Node 16.20.1. Node 23
fails on its installed PostCSS package exports; no runtime dependency was added
for the heatmap. Node 16 is a local compatibility workaround, not a recommendation
for a new deployment.

```sh
# Use the compatible Node installation on PATH.
CI=true npm test -- --watchAll=false --runInBand
npm run build

# With Playwright installed and the full local BWH70 fixtures/dev server present:
PGV_URL=http://127.0.0.1:3005 node scripts/verify-phylogeny-browser.mjs
```

`PLAYWRIGHT_MODULE` can point to an existing Playwright installation instead of
adding a package. `PGV_CDP` optionally connects to an isolated test browser;
omitting it launches a fresh headless browser. Results/screenshots go to
`remote-repo/phylogeny/logs`, or `PGV_RESULTS_DIR`.

Portable tests construct all 92,000 entries. Additional local-fixture tests check
**every actual value and all 15,834 CN intervals**; those tests are explicitly
skipped only if the large, Git-ignored biological fixtures are absent. They were
not skipped during BWH70 verification. Coverage includes legacy multi-sample
DEMO matching, duplicate-source walk/binset views, BigWig menu identity and tile
races, always-confirmed opening, cancellation, missingness, and all display modes.

The development canvas exposes `benchmarkFullMatrix(iterations)`. It uses the same
renderer to draw all 125 rows and all 736 individual sites, including every zero
and null, with **aggregation and culling disabled**. The benchmark changes the
projection while keeping every site in range and restores the live view. It
reports exact glyph counts and per-frame `submissionMs` separately from total
`ms`. When readback is available, each frame calls full-canvas `getImageData` to
force rasterization before the next clear; total time includes preparation,
rendering, synchronization and readback. `readback` and `timing` disclose that
measurement. These timings exclude canvas setup/restoration and presentation;
they are not FPS or directly comparable to the older submission-only benchmark.
The browser script also measures wheel interaction through two animation frames.

A single giant Canvas path had a slow cold tessellation. CN uses direct rectangle
primitives; mutation circles use color-matched paths capped at **16 circles per
path**, with no sampling or averaging. Full-fixture readback experiments favored
small paths over sprites and large paths. Keep full, changing-projection and
cold-frame tests rather than relying on a reduced matrix or identical cached
geometry. Plotly comparisons must also account for its different CN segmentation
and DOM-based drawing.
