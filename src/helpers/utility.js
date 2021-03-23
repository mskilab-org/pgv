import { Table } from "apache-arrow";
import * as d3 from "d3";

export async function loadArrowTable(file) {
  let results = await Table.from(fetch(file));
  let table = await results;
  return results;
}

export function rgbtoInteger(color) {
  let rgb = d3.rgb(color);
  return Math.floor(rgb.r) * 65536 + Math.floor(rgb.g) * 256 + Math.floor(rgb.b);
}