#!/usr/bin/env python3
"""Losslessly extract an htmlwidgets mutation trace as native Plotly figure JSON.

Reads local files only; never executes JavaScript or rounds mutation values.
Usage: python3 scripts/extract-plotly-mutations.py SOURCE.html OUTPUT.json
"""
import argparse
import hashlib
from html.parser import HTMLParser
import json
import math
from pathlib import Path
import re


class WidgetScripts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.active = False
        self.buffer = []
        self.scripts = []

    def handle_starttag(self, tag, attrs):
        if tag == "script" and dict(attrs).get("type") == "application/json":
            self.active = True
            self.buffer = []

    def handle_data(self, data):
        if self.active:
            self.buffer.append(data)

    def handle_endtag(self, tag):
        if tag == "script" and self.active:
            self.scripts.append("".join(self.buffer))
            self.active = False


def extract(source):
    parser = WidgetScripts()
    parser.feed(source.decode("utf-8"))
    candidates = []
    for script in parser.scripts:
        widget = json.loads(script)
        figure = widget.get("x", {}) if isinstance(widget, dict) else {}
        if not isinstance(figure, dict):
            continue
        for index, trace in enumerate(figure.get("data", [])):
            marker = trace.get("marker", {})
            if trace.get("type") == "bar" and isinstance(marker.get("color"), list) and marker.get("showscale"):
                candidates.append((figure, trace, index))
    if len(candidates) != 1:
        raise ValueError("Expected exactly one numeric-color mutation bar trace")
    figure, trace, index = candidates[0]
    values = trace["marker"]["color"]
    count = len(values)
    if not count or any(len(trace[key]) != count for key in ["x", "base", "y", "text"]):
        raise ValueError("Mutation array lengths disagree or are empty")
    axis = figure["layout"]["yaxis"]
    if len(axis["tickvals"]) != len(axis["ticktext"]) or len(set(axis["tickvals"])) != len(axis["tickvals"]) or len(set(axis["ticktext"])) != len(axis["ticktext"]):
        raise ValueError("Duplicate or inconsistent cell row metadata")
    row_map = dict(zip(axis["tickvals"], axis["ticktext"]))
    variants, pairs = set(), set()
    for row, text, value in zip(trace["y"], trace["text"], values):
        identity = re.fullmatch(r"<b>([^<]+)</b><br>([^<]+)<br>Value: (.+)", text)
        if not identity:
            raise ValueError("Unexpected cell/site label structure")
        cell, variant, displayed = identity.groups()
        if row_map.get(row) != cell or (cell, variant) in pairs:
            raise ValueError("Cell row mismatch or duplicate cell/site pair")
        if not re.fullmatch(r"chr[^_]+_[0-9]+_[^_]+_[^_]+", variant):
            raise ValueError("Variant label does not encode chromosome, position and alleles")
        if value is not None and (isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value) or not 0 <= value <= 1):
            raise ValueError("Invalid VAF")
        if (displayed == "NA") != (value is None):
            raise ValueError("Missingness disagrees with the source label")
        variants.add(variant)
        pairs.add((cell, variant))
    if count != len(row_map) * len(variants):
        raise ValueError("Incomplete mutation matrix")
    output = {"data": [trace], "layout": figure["layout"]}
    encoded = (json.dumps(output, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n").encode("utf-8")
    if json.loads(encoded) != output:
        raise ValueError("JSON round trip changed the source data")
    return encoded, {"sourceTraceIndex": index, "cells": len(row_map), "variants": len(variants), "entries": count,
                     "missing": sum(v is None for v in values), "zero": sum(v == 0 for v in values if v is not None)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    source = args.source.read_bytes()
    encoded, counts = extract(source)
    if args.output.exists() and args.output.read_bytes() != encoded:
        parser.error("Output exists with different contents; choose a new output path")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(encoded)
    print(json.dumps({"source": str(args.source), "sourceSha256": hashlib.sha256(source).hexdigest(),
                      "output": str(args.output), "outputSha256": hashlib.sha256(encoded).hexdigest(),
                      "outputBytes": len(encoded), **counts}, indent=2))


if __name__ == "__main__":
    main()
