#!/usr/bin/env Rscript
# Usage: Rscript scripts/convert-phylogeny-rds.R SNVS_RDS JCN_RDS OUTPUT_DIR
# Requires an already-installed jsonlite; no data.table dependency or downloads.
# Writes NEW files only (refuses existing output paths):
#   mutations.sparse.json: schemaVersion=1, variants=[{id}], countFields=[...],
#     cells={cellId:[{variantId,vaf,refCount,altCount}, ...]}.
#     pair -> cellId, mutation -> variantId, ref.count.t -> refCount,
#     alt.count.t -> altCount. These are NOT major/minor allele counts or CN.
#   junctions.json: schemaVersion=1, cellIds=[...], junctions=[{id}],
#     values=[[...], ...] (cell-major, junction-minor).
# First-seen SNV cell/site order and within-cell observation order are retained;
# JCN dimname order is retained. Every observation, including zero/NA, is written.
# NA is JSON null. The legacy sparse UI may display missing VAF as zero; this
# conversion does not. Successful completion verifies all source values/order.

args <- commandArgs(trailingOnly = TRUE)
if (length(args) != 3L) stop("Usage: convert-phylogeny-rds.R SNVS_RDS JCN_RDS OUTPUT_DIR", call. = FALSE)
if (!requireNamespace("jsonlite", quietly = TRUE)) stop("jsonlite must already be installed", call. = FALSE)
input_paths <- normalizePath(args[1:2], mustWork = TRUE)
output_dir <- args[[3L]]
output_names <- c("mutations.sparse.json", "junctions.json")
output_paths <- file.path(output_dir, output_names)
if (any(file.exists(output_paths))) stop("Refusing to overwrite existing output: ", paste(output_paths[file.exists(output_paths)], collapse = ", "), call. = FALSE)

# jsonlite 1.8 can round doubles to 15 significant digits even with digits=NA.
# Encode only validated numeric vectors as verbatim 17-digit JSON to guarantee
# IEEE-double round trips. jsonlite still owns all string escaping and structure.
json <- function(x, ...) as.character(jsonlite::toJSON(x, digits = NA, na = "null", null = "null", json_verbatim = TRUE, ...))
raw_json <- function(x) structure(x, class = "json")
numbers <- function(x) {
  answer <- sprintf("%.17g", x)
  answer[is.na(x)] <- "null"
  answer
}
check_numbers <- function(x, label, maximum = Inf) {
  if (!is.numeric(x) || any(is.nan(x)) || any(!is.na(x) & (!is.finite(x) | x < 0 | x > maximum))) stop("Invalid numeric values in ", label, call. = FALSE)
}
check_ids <- function(x, label, cells = FALSE) {
  if (!is.character(x) || anyNA(x) || any(!nzchar(trimws(x))) || any(grepl("[[:cntrl:]]", x))) stop("Invalid IDs in ", label, call. = FALSE)
  if (cells && (any(grepl("[<>]", x)) || any(x %in% c("__proto__", "prototype", "constructor")))) stop("Unsafe cell IDs in ", label, call. = FALSE)
}

snvs <- as.data.frame(readRDS(input_paths[[1L]]))
required <- c("pair", "mutation", "vaf", "ref.count.t", "alt.count.t")
if (!all(required %in% names(snvs))) stop("SNVs require columns: ", paste(required, collapse = ", "), call. = FALSE)
cell <- as.character(snvs$pair)
site <- as.character(snvs$mutation)
check_ids(cell, "SNV pair", cells = TRUE)
check_ids(site, "SNV mutation")
if (any(!grepl("^[A-Za-z0-9][A-Za-z0-9.-]*_[0-9]+_[ACGTRYSWKMBDHVNacgtryswkmbdhvn*-]+_[ACGTRYSWKMBDHVNacgtryswkmbdhvn*-]+$", site))) stop("Malformed SNV mutation ID", call. = FALSE)
check_numbers(snvs$vaf, "SNV vaf", 1)
check_numbers(snvs$ref.count.t, "SNV ref.count.t")
check_numbers(snvs$alt.count.t, "SNV alt.count.t")
if (anyDuplicated(paste(cell, site, sep = "\r"))) stop("Duplicate SNV cell/site observation", call. = FALSE)
cell_ids <- unique(cell)
variant_ids <- unique(site)
rows_by_cell <- split(seq_len(nrow(snvs)), factor(cell, levels = cell_ids))

jcn <- readRDS(input_paths[[2L]])
if (!is.matrix(jcn) || !is.numeric(jcn)) stop("JCN must be a numeric matrix", call. = FALSE)
jcn_cells <- rownames(jcn)
jcn_ids <- colnames(jcn)
check_ids(jcn_cells, "JCN rownames", cells = TRUE)
check_ids(jcn_ids, "JCN colnames")
if (length(jcn_cells) != nrow(jcn) || length(jcn_ids) != ncol(jcn) || anyDuplicated(jcn_cells) || anyDuplicated(jcn_ids)) stop("Invalid or duplicate JCN dimnames", call. = FALSE)
check_numbers(jcn, "JCN")

if (!dir.exists(output_dir) && !dir.create(output_dir, recursive = TRUE)) stop("Cannot create output directory", call. = FALSE)
# Stage and verify before publishing either file; never write into input paths.
staged <- vapply(output_names, function(name) tempfile(paste0(".", name, "-"), tmpdir = output_dir), character(1))
convert <- function() {
  on.exit(unlink(staged), add = TRUE)
  encoded_sites <- vapply(variant_ids, function(id) json(id, auto_unbox = TRUE), character(1))
  encoded_cells <- vapply(cell_ids, function(id) json(id, auto_unbox = TRUE), character(1))
  site_index <- match(site, variant_ids)
  connection <- file(staged[[1L]], open = "wt", encoding = "UTF-8")
  tryCatch({
    writeLines(paste0('{"schemaVersion":1,"variants":', json(data.frame(id = variant_ids)),
      ',"countFields":["refCount","altCount"],"cells":{'), connection)
    for (i in seq_along(cell_ids)) {
      rows <- rows_by_cell[[i]]
      records <- paste0('{"variantId":', encoded_sites[site_index[rows]],
        ',"vaf":', numbers(snvs$vaf[rows]), ',"refCount":', numbers(snvs$ref.count.t[rows]),
        ',"altCount":', numbers(snvs$alt.count.t[rows]), '}')
      writeLines(paste0(if (i > 1L) "," else "", encoded_cells[[i]], ":[", paste(records, collapse = ","), "]"), connection)
    }
    writeLines("}}", connection)
  }, finally = close(connection))

  values <- lapply(seq_len(nrow(jcn)), function(row) raw_json(paste0("[", paste(numbers(jcn[row, ]), collapse = ","), "]")))
  junction_source <- list(schemaVersion = jsonlite::unbox(1L), cellIds = jcn_cells,
    junctions = data.frame(id = jcn_ids), values = values)
  writeLines(json(junction_source), staged[[2L]], useBytes = TRUE)

  # Independent jsonlite decoding verifies every scalar and sequence, not a
  # rounded digest or a sample. normalize numeric storage (integer vs double).
  equal_numbers <- function(actual, expected, label) {
    if (!identical(as.numeric(actual), as.numeric(expected))) stop("Round-trip mismatch: ", label, call. = FALSE)
  }
  decoded <- jsonlite::fromJSON(staged[[1L]])
  if (!identical(names(decoded$cells), cell_ids) || !identical(decoded$variants$id, variant_ids) ||
      !identical(decoded$countFields, c("refCount", "altCount"))) stop("SNV order/count labels changed", call. = FALSE)
  for (i in seq_along(cell_ids)) {
    actual <- decoded$cells[[i]]
    rows <- rows_by_cell[[i]]
    if (!identical(names(actual), c("variantId", "vaf", "refCount", "altCount")) || !identical(actual$variantId, site[rows])) stop("SNV observation order/labels changed", call. = FALSE)
    equal_numbers(actual$vaf, snvs$vaf[rows], "VAF")
    equal_numbers(actual$refCount, snvs$ref.count.t[rows], "refCount")
    equal_numbers(actual$altCount, snvs$alt.count.t[rows], "altCount")
  }
  decoded_jcn <- jsonlite::fromJSON(staged[[2L]])
  if (!identical(decoded_jcn$cellIds, jcn_cells) || !identical(decoded_jcn$junctions$id, jcn_ids) ||
      !identical(dim(decoded_jcn$values), dim(jcn))) stop("JCN dimensions/order changed", call. = FALSE)
  equal_numbers(decoded_jcn$values, jcn, "JCN values")
  if (any(file.exists(output_paths))) stop("Output appeared during conversion; refusing overwrite", call. = FALSE)
  for (i in seq_along(output_paths)) if (!file.rename(staged[[i]], output_paths[[i]])) stop("Could not publish ", output_paths[[i]], call. = FALSE)
  cat(sprintf("Verified %s: %d cells, %d variants, %d observations; vaf/refCount/altCount exactly equal to RDS.\n", output_paths[[1L]], length(cell_ids), length(variant_ids), nrow(snvs)))
  cat(sprintf("Verified %s: %d cells, %d junctions, %d entries, %d missing; values exactly equal to RDS.\n", output_paths[[2L]], nrow(jcn), ncol(jcn), length(jcn), sum(is.na(jcn))))
}
convert()
