# Phylogeny-linked CN, mutation and junction inspection

The existing `PhylogenyPanel` Card now hosts a canvas tree/heatmap child when its
leaf IDs can be matched to genome plots in `datafiles.json`. Existing genome,
coverage, walk, gene, and BigWig panels remain the detail views. Tree-only datasets
without a matched cohort retain the original Phylocanvas component.

## Inputs: existing PGV formats

- Phylogeny: the existing Newick source in a `type: "phylogeny"` plot.
- Copy number: existing genome JSON `intervals[].y`, matched by leaf ID to a
  manifest file ID or a genome plot's `sample`. Multi-sample manifest files are
  matched to the individual genome/sample, not their first genome.
- Allelic CN: optional `allelic.json`, configured on the matched genome plot as
  `allelicSource`, with explicit major/minor fields or paired interval values.
- Mutations: optional standalone native Plotly figure JSON, or the compact
  ordered sparse format below. Both adapters feed the same renderer; replacing
  the source format does not require changing the renderer.
- Junction CN: optional ordered cell-by-junction JSON. It shares the right-hand
  viewport renderer with mutations, not the genomic CN interval layout.

Add optional metadata to the relevant existing phylogeny plot:

```json
{
  "type": "phylogeny",
  "source": "tumor.newick",
  "visible": true,
  "title": "Tumor phylogeny",
  "heatmap": {
    "mutationSource": "mutations.sparse.json",
    "mutationFormat": "sparse",
    "junctionSource": "junctions.json"
  }
}
```

`mutationSource` and `junctionSource` are relative to that manifest dataset's
directory, e.g. `public/data/my_phylogeny/mutations.sparse.json`, even if the
Newick file is in a subdirectory. For the retained Plotly source, set
`mutationSource` to `mutations.json` and `mutationFormat` to `plotly`.
Neither mutation nor junction metadata is needed for CN-only inspection.

### Allelic copy number

Configure `genome.allelicSource` on each relevant genome plot in the manifest:

```json
{
  "type": "genome",
  "source": "genome.json",
  "allelicSource": "allelic.json"
}
```

This path is relative to the genome's dataset directory. Allelic intervals may
supply `majorCn` and `minorCn` explicitly. The real downloaded `allelic.json`
instead supplies two `intervals[].y` observations at each exact genomic locus
(`chromosome`, `startPoint`, `endPoint`). Major CN is the larger value; Minor CN
is the smaller. **Colors and IIDs do not identify major/minor alleles.** Paired
values join Total CN by exact locus, not by drawing color or primitive IID.
Each such locus must have exactly two observations; if either is null, both
ranked channels remain missing. No major/minor values are inferred from Total
CN, and unavailable allelic views are disabled.

### Ordered sparse mutations

The sparse contract keeps prepared matrix order explicit while avoiding repeated
site metadata:

```json
{
  "schemaVersion": 1,
  "variants": [
    { "id": "chr2_81627555_T_A", "chromosome": "2", "position": 81627555, "ref": "T", "alt": "A" }
  ],
  "countFields": ["refCount", "altCount"],
  "cells": {
    "cellA": [
      { "variantId": "chr2_81627555_T_A", "vaf": 0.9, "refCount": 1, "altCount": 9 }
    ],
    "cellB": []
  }
}
```

`variants` array order is the heatmap column order; the readable `id` is the
stable join key and observations refer to it by `variantId`, never by array
index. For the active tree, the adapter retains the union of sites with a nonzero
VAF, ref count or alt count, preserving their relative catalog order. This tree-specific
catalog construction is separate from viewport culling; selection and scrolling
never discard matrix entries.

Observations contain `vaf`, `refCount` and `altCount`. The counts are
reference/alternate read counts, not copy number; tooltip labels are **ref count**
and **alt count**. Omitted/null fields and missing cell/site observations default
to zero for all three metrics under the sparse display convention. Both
`refCounts` and `altCounts` are always returned as row-major `Float64Array`
channels. Optional `countFields` metadata lists supplied count fields, not whether
the buffers exist. VAF statistics include implicit zeros in the retained matrix.
This display convention does not change the converted source JSON, whose nulls
remain null.

### Junction copy number

```json
{
  "schemaVersion": 1,
  "cellIds": ["cellA", "cellB"],
  "junctions": [{ "id": "2:20+ <-> 1:10-" }],
  "values": [[2.1234567890123457], [null]]
}
```

`values` is row-major: rows follow `cellIds`, columns follow `junctions` exactly.
Junction IDs are stable plain-text labels, not genomic mutation IDs or HTML.
The adapter validates unique identities and exact dimensions, retaining catalog
order and mapping displayed rows by cell identity. Null JCN stays missing, never
zero; values remain full-precision doubles with a separate missingness mask.
Junction CN uses the common Total CN palette (0–10, 11+, and missing), with the
full unrounded value and junction ID in its tooltip. Palette categories do not
round or replace the underlying values.

### Convert local RDS inputs

With R and an already-installed `jsonlite` package:

```sh
Rscript scripts/convert-phylogeny-rds.R \
  /path/to/local/snvs.rds \
  /path/to/local/jcn.rds \
  public/data/my_phylogeny
```

The converter requires exactly these three arguments and writes
`mutations.sparse.json` and `junctions.json` in the output directory. It reads
local inputs only, requires no `data.table`, installs/downloads nothing, and
never modifies the inputs. It refuses to overwrite **either existing output**,
even if identical; use a new output directory for another conversion. Files are
staged and verified before publication, with another existence check before
renaming them into place.

The SNV RDS must provide `pair`, `mutation`, `vaf`, `ref.count.t`, and
`alt.count.t`. These map respectively to cell ID, variant ID, `vaf`, `refCount`,
and `altCount`; the output declares `countFields: ["refCount", "altCount"]`.
First-seen cell/site order and within-cell observation order are preserved.
The JCN RDS must be a numeric matrix with unique cell rownames and junction
colnames, whose order is retained. IDs, duplicate pairs, dimensions, nonnegative
finite numbers and VAF bounds are validated; R `NA` becomes JSON `null`.
Every observation, including zeros and missing values, is written.

Numeric values are emitted with **17 significant digits** for exact IEEE-double
round trips, avoiding `jsonlite`'s possible 15-digit rounding. The converter then
independently decodes both staged files with `jsonlite` and compares **every
scalar**, including missingness, with the RDS using exact numeric equality after
normalizing integer/double storage. It also checks cell/site/observation order,
count names and JCN dimensions. These are exhaustive precision checks, not
rounded digests or sampled comparisons; successful completion prints verified
data counts.

### Retained lossless Plotly input

The original Plotly mutation source remains available losslessly and is not
replaced or rewritten by the RDS conversion. To extract the approved
htmlwidgets/Plotly export without executing JavaScript:

```sh
python3 scripts/extract-plotly-mutations.py \
  source-with-mutations.html \
  public/data/my_phylogeny/mutations.json
```

The utility preserves the source trace/layout, numeric precision, ordering, zero
and null values, checks every cell/site pair, and prints counts and SHA-256 hashes.
It refuses to overwrite a different existing file. It does not access remote
servers. It extracts a fixture; the browser never scrapes or executes Plotly HTML.

The Plotly runtime adapter validates IDs, dimensions, complete pair coverage,
duplicate pairs, alleles, chromosome mapping, and VAF bounds. It keeps a full row-major
`Float64Array` and a separate missingness mask. It reads `marker.color`, **not
rounded tooltip VAF strings**. Tree rows are mapped by cell identity, never by
matrix row offset. Variant labels supply their genomic positions and alleles;
Plotly's synthetic mutation `x`/`base` coordinates are not used for genomic layout.
This legacy source has no read counts: both `refCounts` and `altCounts` are
`Float64Array` channels filled with `NaN` to signal unavailable counts. They are
never derived from VAF or unrecognized extra fields. The VAF missingness mask
remains unchanged and separate from count availability.

CN and mutation placement uses PGV's existing internal genomic-place convention
(`chromoBins[chromosome].startPlace + source position`) to preserve alignment with
legacy genome panels. Original positions/interval boundaries remain unchanged for
inspection. This feature does not globally revise the legacy coordinate convention.

For Plotly inputs, screen rows match the original y-axis orientation, not matrix
storage order: the BWH70 ascending y-axis displays tick rows in reverse top-to-bottom
order. The adapter supplies `displayCellIds`; the renderer still looks up every
value by cell identity. Without numeric Plotly row metadata it uses reversed
Newick leaf traversal. Source arrays and topology are never reordered.

The CN palette matches all **12 original categories: 0–10 and 11+**. Missing total
CN has a separate gray swatch. Allelic views use the same category colors with
CN 1 as their white baseline. VAF uses the original **continuous white-to-black
gradient**, with exact values retained in tooltips; it is not binned into a few
colors. CN rows meet without white separators; chromosome boundaries are the
only vertical structural separators in the genomic CN view. Hover and selection
use blue outlines without changing matrix fills. Hovering a tree node or branch
highlights it in blue with a small node box; this does not change selection.
Phylogeny titles use the source title without a sample/file prefix.

## Controls

- **Show mutations / Hide mutations:** a button, not a mode menu; the matrix
  starts hidden. There are no Overlay or Paired choices. When visible, **Right heatmap
  data: Mutations / Junction CN** selects the right-hand matrix; the button then
  names the selected data (for example, **Hide junctions**). Both sources share
  the same viewport renderer, vertical rows and independent horizontal scrolling.
  Full matrices load and validate even while hidden or not selected for display.
- **Mutation color: VAF / Ref count / Alt count** changes only mutation-matrix
  coloring. VAF remains continuous grayscale; read-count colors use a zero-safe
  **logarithmic** scale across the full cohort, so a few high-depth observations
  do not flatten ordinary counts into one color. The legend explicitly says
  **log scale** and shows raw-count ticks and the actual upper limit. Colors use
  `log1p(count) / log1p(maximum)`; values are not clipped, averaged or changed.
  The domain stays fixed while scrolling/filtering. Tooltips show the original
  **ref count** and **alt count**, not transformed values.
  Sparse inputs use zero defaults; legacy Plotly read counts are unavailable.
  Junction CN instead uses the common CN palette and exact-value tooltips.
- **CN view: Total / Major / Minor:** Total uses the existing `genome.json`
  `intervals[].y`. Major and Minor use the optional allelic source described
  above, with a white CN 1 baseline. With the heatmap focused, Left/Right cycles
  available views. Shortcuts do not intercept form controls.
- **Fit rows / Readable rows:** both modes expand visible rows to fill the
  available height, including when **Selected rows only** is enabled. Readable
  rows have a minimum height of 22 px (32 px in legacy paired mode), scrolling
  the tree and matrix together when needed. Fit rows removes that minimum so
  all visible cells fit without vertical scrolling. For **mutations** it also fits
  the entire ordered site catalog into the right-hand width: adjacent sites share
  screen columns when necessary. Each summary column is colored by the fraction
  of sites with a positive value for the chosen metric (VAF, ref count or alt
  count), not mean VAF/count. Hover reports its source-ordered range and the
  positive/zero/missing counts. All-missing columns stay gray. Click a summary
  column or Shift-drag to zoom to its source sites; drag to pan, use the same
  wheel/Command-wheel setting as the genomic heatmap, and double-click or use
  Reset to show the full catalog. Keyboard focus on the matrix supports +/−
  to zoom, Alt+Left/Right to pan and Home to reset. At sufficient zoom each site shows its exact
  original value and tooltip. Mutation catalog zoom does not change genomic
  domains; neither summaries nor gestures cluster or reorder input sites.
  Readable rows retains the original exact, horizontally scrollable mutation
  matrix. Junction CN keeps its existing horizontally scrollable view in both
  row modes. Only visible rows/columns are rasterized in a viewport-sized
  Canvas; horizontal scrolling does not allocate one giant full-width raster.
  This bounds Canvas raster size, not source data: full matrices remain loaded,
  with catalog order and all values intact.
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
- **Display** has aligned rows: **Tree** (source and visibility), **Copy number**
  (CN channel), **Right heatmap** (visibility, data and color), and **Layout**
  (row fitting, height and Reset zoom). Controls wrap at narrow widths.
  **Selection & tracks** separately contains opening/clearing and row/track
  filters. **Reset zoom** returns to the whole-genome view.
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
  legend and pinned genes. Existing pinned-height clamping is unchanged; pin
  policy changes remain deferred.
- Each selected cohort contributes one phylogeny panel. If its manifest has
  multiple Newicks, **Display → Tree** provides a tree selector; the first
  tree is the default. The selector remains accessible for tree-only fallback,
  missing cohort data and load/parse errors, so another tree can always be chosen.
  Phylogeny panels can be removed with the same track close control used by detail
  panels. Chromosome boundaries are vertical separators in every genomic CN view.
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

## Display is not biological inference

The exact right-hand matrix retains each cell/site or cell/junction position in
catalog order. Fit rows adds a display-only mutation overview: when necessary,
adjacent sites share a screen column colored by positive-site fraction. Its
summary never replaces or averages source observations. At detail zoom every
site is displayed individually; scrolling changes only what is rasterized. Legacy genomic marker grouping remains an internal
rendering/benchmark path, not an Overlay/Paired UI choice. Its neutral circle-plus
icons represent overlapping display footprints, never inferred sites or mean VAF.

Sparse VAF/ref count/alt count display zeros for omitted/null fields or absent
observations are a display convention, not a biological absence call. JCN retains
missingness; the original Plotly adapter keeps observed VAF zeros distinct from
nulls and leaves unavailable read counts missing. The viewer does not infer
clones, call mutations, estimate evolutionary timing, or invent depth/quality
metadata.

## Local data and verification

The local default is now the **real RDS-derived sparse mutation data**: **125
active tumor cells by 8,878 sites**, or **130 cells including normal cells**.
The junction source is **125 cells by 67 junctions**; cells absent from that
source remain missing in the junction view. All 125 tumor genome JSON files
supply 15,834 CN intervals, with paired allelic inputs at the same loci.

The original lossless Plotly mutation fixture is retained separately: **125
cells by 736 SNVs**, with 58,632 zero, 1,081 missing and 32,287 positive entries.
Its 92,000 entries are not the size of the new default matrix. The inputs are
**not interchangeable exports of the same data**:

- Only **601** original sites occur in the RDS; **135** are absent, and the RDS
  contains **8,277** additional sites. Catalog ordering differs too.
- On shared cell/site identities, **7,811** VAF entries differ beyond floating
  roundoff or in missingness. For example, `BWH70_MR_1_pl1_10a` at
  `chr17_26867125_G_A` has original VAF `0.818181818181818` versus RDS
  `0.7142857142857143`. Both adapters reproduce their respective sources.
- The older Plotly CN export contains **8,151** rectangles versus **15,834**
  current genome intervals. Merging adjacent equal-total-CN intervals yields
  **8,146** versus **15,806**, so this is not merely finer splitting of identical
  CN values. Numeric CN profiles disagree on **819 of 3,000** cell/chromosome
  profiles, affecting all 125 cells.
- For example, `BWH70_MR_1_pl1_10a`, chromosome 16 positions
  **49,538,986–60,797,334**, has **CN 1** in the original Plotly profile but
  **CN 2** in the current genome JSON.
- All current allelic intervals match total-CN coordinates, but the two supplied
  allele values sum to a different value than the supplied total at **1,067**
  loci across 75 cells. Total and allelic views preserve their own sources; the
  viewer does not silently reconcile or infer replacement values.

The original inputs and new downloads match remote checksum records. No upstream
R/notebook generator was found in the supplied example/data directories. Different
calling/preprocessing/version history is plausible, but the exact upstream reason
cannot be determined from these exports alone. Do not infer filters, reorder
sites into invented clusters, or blend the two VAF matrices to force agreement.
The choice of which mutation source should be the default remains unresolved.

**Remote originals are read-only.** All downloaded real biological inputs
(including RDS, genome and allelic files), extracted/generated outputs, and local
manifest configuration stay in Git-ignored local paths such as `remote-repo/`,
`public/data/` and `public/datafiles.json`. They are not committed or deployed;
the code and format documentation do not bundle these fixtures.

This legacy CRA 4 checkout has been tested with installed Node 16.20.1. Node 23
fails on its installed PostCSS package exports; no runtime dependency was added
for the heatmap. Node 16 is a local compatibility workaround, not a recommendation
for a new deployment.

```sh
# Use the compatible Node installation on PATH.
CI=true npm test -- --watchAll=false --runInBand
npm run build

# Browser checks are being rewritten for the repaired UI and new data.
# With Playwright and the full local fixtures/dev server, once updated:
PGV_URL=http://127.0.0.1:3005 node scripts/verify-phylogeny-browser.mjs
```

`PLAYWRIGHT_MODULE` can point to an existing Playwright installation instead of
adding a package. `PGV_CDP` optionally connects to an isolated test browser;
omitting it launches a fresh headless browser. Results/screenshots go to
`remote-repo/phylogeny/logs`, or `PGV_RESULTS_DIR`.

Portable tests cover adapter contracts and the retained Plotly full-matrix case.
Local-fixture tests compare every converted SNV VAF/read count and junction entry,
and real allelic pairing across the tumor cohort; they skip when their ignored
fixtures are absent. Converter round-trip tests additionally require local R and
`jsonlite`. These checks distinguish source precision/order from display
conventions and viewport culling.

**Browser checks are being rewritten** for Show/Hide, the shared Mutations /
Junction CN view, real allelic input and the new default matrix. No updated
browser pass counts or performance results are claimed here; earlier counts do
not verify this repair.

The development canvas retains `benchmarkFullMatrix(iterations)` as a legacy
full-source genomic-rendering diagnostic. It renders the loaded mutation cohort
with aggregation and culling disabled, varies projection, and restores the live
view. It reports `submissionMs` separately from total `ms`; full-canvas readback,
when available, includes raster synchronization. These timings are not FPS or
proof of right-matrix viewport performance. The right-hand mutation/junction
matrix uses viewport-sized rectangle rasterization instead of a full-width
Canvas; all matrix data remain resident.

The separate **10,000-cell scalability work remains deferred**. Visible-column
culling is only a Canvas raster-size repair, not completion or validation of that
work, and it does not change the existing pin policy.
