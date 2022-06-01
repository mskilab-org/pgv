#!/usr/bin/env node

import { readFileSync } from "fs";
import { tableFromIPC } from "apache-arrow";
import { RecordBatchFileWriter, tableFromArrays } from "apache-arrow";
import * as d3 from "d3";
import * as fs from "fs";

const settings = JSON.parse(fs.readFileSync("./public/settings.json"));

const args = process.argv.slice(2);

let inputFile = args[0];

inputFile || process.exit(1);

let outputFile = inputFile.replace(".csv", ".arrow");
let reference = args[2] || settings["coordinates"]["default"];
let chromoset = settings["coordinates"]["sets"][reference];

let genomeLength = chromoset
  .map((d) => d["endPoint"])
  .reduce((a, b) => a + b, 0);

let boundary = 0;

let chromoBins = {};
chromoset.forEach((chromo) => {
  chromo["length"] = chromo["endPoint"];
  chromo["startPlace"] = boundary;
  let color = d3.rgb(chromo["color"]);
  chromo["colorValue"] = color.r * 65536 + color.g * 256 + color.b;
  boundary += chromo["endPoint"];
  chromoBins[chromo["chromosome"]] = chromo;
});

console.log(`Got csv file ${args[0]}, using reference ${reference}`);

let data = fs
  .readFileSync(args[0], "utf8")
  .split(/\r?\n/)
  .slice(1)
  .map((d) => {
    let dat = d.split(",");
    return { x: +dat[0], y: +dat[1], chromosome: dat[2] };
  });

let x = [];
let y = [];
let color = [];
data.slice(1).forEach((d, i) => {
  let chromo = chromoBins[d["chromosome"]];
  x.push(1.0 * chromo["startPlace"] + d["x"]);
  y.push(1.0 * d["y"]);
  color.push(chromo["colorValue"]);
});

const resultsTable = tableFromArrays({
  x: Float32Array.from(x),
  y: Float32Array.from(y),
  color: Float32Array.from(color),
});

const writer = RecordBatchFileWriter.writeAll(resultsTable);
const buffer = await writer.toUint8Array();

fs.writeFileSync(outputFile, buffer);

const arrow = readFileSync(outputFile);
const table = [...tableFromIPC(arrow)];

console.log(
  `Printing first 10 out of ${table.length} rows in the generated file ${outputFile}`
);
console.table([...table].slice(0,10));
