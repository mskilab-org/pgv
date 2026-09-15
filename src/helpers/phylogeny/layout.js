import { scaleLinear } from "d3";

function validDomain(domain) {
  return Array.isArray(domain) && domain.length === 2 &&
    Number.isFinite(domain[0]) && Number.isFinite(domain[1]) &&
    domain[1] > domain[0] && Number.isFinite(domain[1] - domain[0]);
}

/**
 * Legacy genomic panel geometry: scales are LOCAL [0, panelWidth], x is the
 * absolute left offset. An unusable viewport has no windows, never negative ones.
 */
export function layoutDomains(domains, width, gutter = 0, gap = 24) {
  if (!Array.isArray(domains) || !domains.length ||
      !Number.isFinite(width) || width <= 0 ||
      !Number.isFinite(gutter) || gutter < 0 ||
      !Number.isFinite(gap) || gap < 0) return [];
  for (const domain of domains) {
    if (!validDomain(domain)) return [];
  }
  const available = width - gutter - 2 * gap;
  const each = (available - (domains.length - 1) * gap) / domains.length;
  if (!Number.isFinite(each) || each <= 0 || domains.some((domain) =>
    !Number.isFinite(each / (domain[1] - domain[0])) || each / (domain[1] - domain[0]) <= 0
  )) return [];
  return domains.map((domain, index) => {
    const scale = scaleLinear().domain(domain).range([0, each]);
    return {
      index,
      domain: domain.slice(),
      x: gutter + gap + index * (each + gap),
      width: each,
      scale,
      invert: scale.invert,
    };
  });
}

/**
 * Build display-only groups once per scale/window, shared by every cell row.
 * Merge adjacent footprints in the FULL chromosome before viewport filtering:
 * panning cannot change a group's membership. Values/missingness are untouched.
 * start/end and x1/x2 are site-center extents; a singleton has zero extent and
 * the renderer supplies its visible glyph width. Projected extents may be offscreen.
 */
export function groupMutations(variants, domain, width, minSpacing = 6, aggregate = true) {
  if (!validDomain(domain) || !Number.isFinite(width) || width <= 0 ||
      !Number.isFinite(minSpacing) || minSpacing < 0) return [];
  const pixelsPerPlace = width / (domain[1] - domain[0]);
  if (!Number.isFinite(pixelsPerPlace) || pixelsPerPlace <= 0) return [];
  if (!Array.isArray(variants)) throw new Error("Mutation variants must be an array");
  const indices = variants.map((variant, index) => {
    if (!variant || !Number.isFinite(variant.place) ||
        typeof variant.chromosome !== "string" || !variant.chromosome.trim()) {
      throw new Error(`Invalid mutation site at index ${index}`);
    }
    return index;
  });
  indices.sort((a, b) => variants[a].place - variants[b].place || a - b);
  const groups = [];
  const lastByChromosome = new Map();
  for (const index of indices) {
    const { chromosome, place } = variants[index];
    const previous = lastByChromosome.get(chromosome);
    // Distance (rather than subtracting projected x) makes the decision pan-invariant.
    if (aggregate && previous && (place - previous.end) * pixelsPerPlace < minSpacing) {
      previous.indices.push(index);
      previous.end = place;
    } else {
      const group = { indices: [index], chromosome, start: place, end: place };
      groups.push(group);
      lastByChromosome.set(chromosome, group);
    }
  }
  // Groups were created in increasing start order, even with interleaved chromosomes.
  return groups.filter((group) => group.start <= domain[1] && group.end >= domain[0])
    .map((group) => ({
      ...group,
      x1: (group.start - domain[0]) * pixelsPerPlace,
      x2: (group.end - domain[0]) * pixelsPerPlace,
    }));
}
