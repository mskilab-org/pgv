import { Table } from "apache-arrow";
import * as d3 from "d3";

export async function loadArrowTable(file) {
  let results = await Table.from(fetch(file));
  let table = await results;
  return results;
}

export function rgbtoInteger(color) {
  let rgb = d3.rgb(color);
  return (
    Math.floor(rgb.r) * 65536 + Math.floor(rgb.g) * 256 + Math.floor(rgb.b)
  );
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
    return { WebkitTransition: 'opacity 0.75s ease-in-out' };
  } else if (!inViewport) {
    return { WebkitTransition: 'none', opacity: '0' };
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
    chromo.scaleToGenome = d3.scaleLinear().domain([chromo.startPoint, chromo.endPoint]).range([chromo.startPlace, chromo.endPlace]);
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
    if (
      to <= chromoBins[key].endPlace &&
      to >= chromoBins[key].startPlace
    ) {
      genomeRange.push(
        `${key}:${
          to - chromoBins[key].startPlace + chromoBins[key].startPoint
        }`
      );
    } 
  });
  return genomeRange.join("-");
}

export function domainsToLocation(chromoBins, domains) {
  return domains.map(d => locateGenomeRange(chromoBins, d)).join("|");
}

export function locationToDomains(chromoBins, loc) {
  let domains = [];
  loc.split("|").forEach((d,i) => {
    let domainString = d.split("-").map(e => e.split(":"));
    let domain = [];
    domain.push(chromoBins[domainString[0][0]].startPlace + (+domainString[0][1]) - chromoBins[domainString[0][0]].startPoint);
    domain.push(chromoBins[domainString[1][0]].startPlace + (+domainString[1][1]) - chromoBins[domainString[1][0]].startPoint);
    domains.push(domain);
  });
  console.log(domains)
  return domains;
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
      return (((1+Math.random())*0x10000)|0).toString(16).substring(1); 
  }
  // then to call it, plus stitch in '4' in the third group
  return (S4() + S4() + "-" + S4() + "-4" + S4().substr(0,3) + "-" + S4() + "-" + S4() + S4() + S4()).toLowerCase();
}