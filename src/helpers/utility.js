import { tableFromIPC } from "apache-arrow";
import * as d3 from "d3";

export async function loadArrowTable(file) {
  return await tableFromIPC(fetch(file));
}

export function rgbtoInteger(color) {
  let rgb = d3.rgb(color);
  return (
    Math.floor(rgb.r) * 65536 + Math.floor(rgb.g) * 256 + Math.floor(rgb.b)
  );
}

export function getFloatArray(dense, length) {
  var blob = window.atob(dense); // Base64 string converted to a char array
  var fLen = blob.length / Float32Array.BYTES_PER_ELEMENT; // How many floats can be made, but be even
  var dView = new DataView(new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT)); // ArrayBuffer/DataView to convert 4 bytes into 1 float.
  var fAry = new Float32Array(fLen); // Final Output at the correct size
  var p = 0; // Position

  for (var j = 0; j < fLen; j++) {
    p = j * 4;
    dView.setUint8(0, blob.charCodeAt(p));
    dView.setUint8(1, blob.charCodeAt(p + 1));
    dView.setUint8(2, blob.charCodeAt(p + 2));
    dView.setUint8(3, blob.charCodeAt(p + 3));
    fAry[j] = dView.getFloat32(0, true);
  }
  if (length) {
    fAry = Array(1024)
      .fill(NaN)
      .map((d, i) => fAry[i] || d);
  }
  return fAry;
}

export function measureText(string, fontSize = 10) {
  const widths = [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0.278125, 0.278125, 0.35625, 0.55625, 0.55625,
    0.890625, 0.6671875, 0.1921875, 0.334375, 0.334375, 0.390625, 0.584375,
    0.278125, 0.334375, 0.278125, 0.278125, 0.55625, 0.55625, 0.55625, 0.55625,
    0.55625, 0.55625, 0.55625, 0.55625, 0.55625, 0.55625, 0.278125, 0.278125,
    0.584375, 0.584375, 0.584375, 0.55625, 1.015625, 0.6703125, 0.6671875,
    0.7234375, 0.7234375, 0.6671875, 0.6109375, 0.778125, 0.7234375, 0.278125,
    0.5, 0.6671875, 0.55625, 0.834375, 0.7234375, 0.778125, 0.6671875, 0.778125,
    0.7234375, 0.6671875, 0.6109375, 0.7234375, 0.6671875, 0.9453125, 0.6671875,
    0.6671875, 0.6109375, 0.278125, 0.278125, 0.278125, 0.4703125, 0.584375,
    0.334375, 0.55625, 0.55625, 0.5, 0.55625, 0.55625, 0.3125, 0.55625, 0.55625,
    0.2234375, 0.2703125, 0.5, 0.2234375, 0.834375, 0.55625, 0.55625, 0.55625,
    0.55625, 0.346875, 0.5, 0.278125, 0.55625, 0.5, 0.7234375, 0.5, 0.5, 0.5,
    0.334375, 0.2609375, 0.334375, 0.584375,
  ];
  const avg = 0.528733552631579;
  return (
    string
      .split("")
      .map((c) =>
        c.charCodeAt(0) < widths.length ? widths[c.charCodeAt(0)] : avg
      )
      .reduce((cur, acc) => acc + cur) * fontSize
  );
}

export function humanize(str) {
  return str
    .replace(/^[\s_]+|[\s_]+$/g, "")
    .replace(/[_\s]+/g, " ")
    .replace(/^[a-z]/, function (m) {
      return m.toUpperCase();
    });
}

export function transitionStyle(inViewport) {
  if (inViewport) {
    return { WebkitTransition: "opacity 0.75s ease-in-out" };
  } else if (!inViewport) {
    return { WebkitTransition: "none", opacity: "0" };
  }
}

export function magnitude(n) {
  let order = Math.floor(Math.log(n) / Math.LN10 + 0.000000001); // because float math sucks like that
  return Math.pow(10, order);
}

export function updateChromoBins(coordinateSet) {
  let genomeLength = coordinateSet.reduce(
    (acc, elem) => acc + elem.endPoint,
    0
  );
  let boundary = 0;
  let chromoBins = coordinateSet.reduce((hash, element) => {
    let chromo = element;
    chromo.length = chromo.endPoint;
    chromo.startPlace = boundary + chromo.startPoint;
    chromo.endPlace = boundary + chromo.endPoint;
    chromo.scaleToGenome = d3
      .scaleLinear()
      .domain([chromo.startPoint, chromo.endPoint])
      .range([chromo.startPlace, chromo.endPlace]);
    hash[element.chromosome] = chromo;
    boundary += chromo.length;
    return hash;
  }, {});
  return { genomeLength, chromoBins };
}

export function locateGenomeRange(chromoBins, domain) {
  let from = domain[0];
  let to = domain[1];
  let genomeRange = [];
  Object.keys(chromoBins).forEach((key, i) => {
    if (
      from <= chromoBins[key].endPlace &&
      from >= chromoBins[key].startPlace
    ) {
      genomeRange.push(
        `${key}:${
          from - chromoBins[key].startPlace + chromoBins[key].startPoint
        }`
      );
    }
    if (to <= chromoBins[key].endPlace && to >= chromoBins[key].startPlace) {
      genomeRange.push(
        `${key}:${to - chromoBins[key].startPlace + chromoBins[key].startPoint}`
      );
    }
  });
  return genomeRange.join("-");
}

export function domainsToLocation(chromoBins, domains) {
  return domains.map((d) => locateGenomeRange(chromoBins, d)).join("|");
}

export function locationToDomains(chromoBins, loc) {
  let domains = [];
  loc.split("|").forEach((d, i) => {
    let domainString = d.split("-").map((e) => e.split(":"));
    let domain = [];
    domain.push(
      chromoBins[domainString[0][0]].startPlace +
        +domainString[0][1] -
        chromoBins[domainString[0][0]].startPoint
    );
    domain.push(
      chromoBins[domainString[1][0]].startPlace +
        +domainString[1][1] -
        chromoBins[domainString[1][0]].startPoint
    );
    domains.push(domain);
  });
  return domains;
}

export function cluster(
  annotatedIntervals,
  genomeLength,
  maxClusters = 6,
  minDistance = 1e7
) {
  let annotated = annotatedIntervals.sort((a, b) =>
    d3.ascending(a.startPlace, b.startPlace)
  );
  let clusters = [
    { startPlace: annotated[0].startPlace, endPlace: annotated[0].endPlace },
  ];
  for (let i = 0; i < annotated.length - 1; i++) {
    if (annotated[i + 1].startPlace - annotated[i].endPlace > minDistance) {
      clusters.push({
        startPlace: annotated[i + 1].startPlace,
        endPlace: annotated[i + 1].endPlace,
      });
    } else {
      clusters[clusters.length - 1].endPlace = annotated[i + 1].endPlace;
    }
  }
  while (clusters.length > maxClusters) {
    clusters = clusters.sort((a, b) =>
      d3.ascending(a.startPlace, b.startPlace)
    );
    let minDistance = Number.MAX_SAFE_INTEGER;
    let minIndex = 0;
    for (let i = 0; i < clusters.length - 1; i++) {
      if (clusters[i + 1].startPlace - clusters[i].endPlace < minDistance) {
        minDistance = clusters[i + 1].startPlace - clusters[i].endPlace;
        minIndex = i;
      }
    }
    clusters = clusters
      .slice(0, minIndex)
      .concat([
        {
          startPlace: clusters[minIndex].startPlace,
          endPlace: clusters[minIndex + 1].endPlace,
        },
      ])
      .concat(clusters.slice(minIndex + 2, clusters.length));
  }
  clusters = merge(
    clusters.map((d, i) => {
      return {
        startPlace: d3.max([
          d.startPlace - 0.16 * (d.endPlace - d.startPlace),
          1,
        ]),
        endPlace: d3.min([
          d.endPlace + 0.16 * (d.endPlace - d.startPlace),
          genomeLength,
        ]),
      };
    })
  ).sort((a, b) => d3.ascending(a.startPlace, b.startPlace));
  return clusters.map((d, i) => [
    Math.floor(d.startPlace),
    Math.floor(d.endPlace),
  ]);
}

export function merge(intervals) {
  // test if there are at least 2 intervals
  if (intervals.length <= 1) {
    return intervals;
  }

  var stack = [];
  var topp = null;

  // sort the intervals based on their start values
  intervals = intervals.sort((a, b) => {
    return a.startPlace - b.startPlace;
  });

  // push the 1st interval into the stack
  stack.push(intervals[0]);

  // start from the next interval and merge if needed
  for (var i = 1; i < intervals.length; i++) {
    // get the topp element
    topp = stack[stack.length - 1];

    // if the current interval doesn't overlap with the
    // stack topp element, push it to the stack
    if (topp.endPlace < intervals[i].startPlace) {
      stack.push(intervals[i]);
    }
    // otherwise update the end value of the topp element
    // if end of current interval is higher
    else if (topp.endPlace < intervals[i].endPlace) {
      topp.endPlace = intervals[i].endPlace;
      stack.pop();
      stack.push(topp);
    }
  }

  return stack;
}

export function downloadCanvasAsPng(canvas, filename) {
  /// create an "off-screen" anchor tag
  var lnk = document.createElement("a"),
    e;

  /// the key here is to set the download attribute of the a tag
  lnk.download = filename;

  /// convert canvas content to data-uri for link. When download
  /// attribute is set the content pointed to by link will be
  /// pushed as "download" in HTML5 capable browsers
  lnk.href = canvas.toDataURL("image/png;base64");

  /// create a "fake" click-event to trigger the download
  if (document.createEvent) {
    e = document.createEvent("MouseEvents");
    e.initMouseEvent(
      "click",
      true,
      true,
      window,
      0,
      0,
      0,
      0,
      0,
      false,
      false,
      false,
      false,
      0,
      null
    );

    lnk.dispatchEvent(e);
  } else if (lnk.fireEvent) {
    lnk.fireEvent("onclick");
  }
}

export function guid() {
  function S4() {
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
  }
  // then to call it, plus stitch in '4' in the third group
  return (
    S4() +
    S4() +
    "-" +
    S4() +
    "-4" +
    S4().substr(0, 3) +
    "-" +
    S4() +
    "-" +
    S4() +
    S4() +
    S4()
  ).toLowerCase();
}

/**
 * K-combinations
 *
 * Get k-sized combinations of elements in a set.
 *
 * Usage:
 *   k_combinations(set, k)
 *
 * Parameters:
 *   set: Array of objects of any type. They are treated as unique.
 *   k: size of combinations to search for.
 *
 * Return:
 *   Array of found combinations, size of a combination is k.
 *
 * Examples:
 *
 *   k_combinations([1, 2, 3], 1)
 *   -> [[1], [2], [3]]
 *
 *   k_combinations([1, 2, 3], 2)
 *   -> [[1,2], [1,3], [2, 3]
 *
 *   k_combinations([1, 2, 3], 3)
 *   -> [[1, 2, 3]]
 *
 *   k_combinations([1, 2, 3], 4)
 *   -> []
 *
 *   k_combinations([1, 2, 3], 0)
 *   -> []
 *
 *   k_combinations([1, 2, 3], -1)
 *   -> []
 *
 *   k_combinations([], 0)
 *   -> []
 */
export function k_combinations(set, k) {
  var i, j, combs, head, tailcombs;

  // There is no way to take e.g. sets of 5 elements from
  // a set of 4.
  if (k > set.length || k <= 0) {
    return [];
  }

  // K-sized set has only one K-sized subset.
  if (k === set.length) {
    return [set];
  }

  // There is N 1-sized subsets in a N-sized set.
  if (k === 1) {
    combs = [];
    for (i = 0; i < set.length; i++) {
      combs.push([set[i]]);
    }
    return combs;
  }

  // Assert {1 < k < set.length}

  // Algorithm description:
  // To get k-combinations of a set, we want to join each element
  // with all (k-1)-combinations of the other elements. The set of
  // these k-sized sets would be the desired result. However, as we
  // represent sets with lists, we need to take duplicates into
  // account. To avoid producing duplicates and also unnecessary
  // computing, we use the following approach: each element i
  // divides the list into three: the preceding elements, the
  // current element i, and the subsequent elements. For the first
  // element, the list of preceding elements is empty. For element i,
  // we compute the (k-1)-computations of the subsequent elements,
  // join each with the element i, and store the joined to the set of
  // computed k-combinations. We do not need to take the preceding
  // elements into account, because they have already been the i:th
  // element so they are already computed and stored. When the length
  // of the subsequent list drops below (k-1), we cannot find any
  // (k-1)-combs, hence the upper limit for the iteration:
  combs = [];
  for (i = 0; i < set.length - k + 1; i++) {
    // head is a list that includes only our current element.
    head = set.slice(i, i + 1);
    // We take smaller combinations from the subsequent elements
    tailcombs = k_combinations(set.slice(i + 1), k - 1);
    // For each (k-1)-combination we join it with the current
    // and store it to the set of k-combinations.
    for (j = 0; j < tailcombs.length; j++) {
      combs.push(head.concat(tailcombs[j]));
    }
  }
  return combs;
}

/**
 * Combinations
 *
 * Get all possible combinations of elements in a set.
 *
 * Usage:
 *   combinations(set)
 *
 * Examples:
 *
 *   combinations([1, 2, 3])
 *   -> [[1],[2],[3],[1,2],[1,3],[2,3],[1,2,3]]
 *
 *   combinations([1])
 *   -> [[1]]
 */
export function combinations(set) {
  var k, i, combs, k_combs;
  combs = [];

  // Calculate all non-empty k-combinations
  for (k = 1; k <= set.length; k++) {
    k_combs = k_combinations(set, k);
    for (i = 0; i < k_combs.length; i++) {
      combs.push(k_combs[i]);
    }
  }
  return combs;
}
