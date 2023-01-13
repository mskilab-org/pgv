import * as d3 from "d3";
import { humanize } from "../../helpers/utility";
import Interval from "../genomePlot/interval";

class WalkInterval extends Interval {
  constructor(hap, wlk) {
    super(hap);
    this.walk = wlk;
    this.uid = this.walk.pid + "#" + this.iid;
    this.primaryKey = this.uid;
    this.coordinates = `${this.chromosome}-${this.startPoint}-${this.endPoint}`;
    this.margins = { arrow: 5 };
    this.fullTitle =
      "Walk Interval #" + this.title + " of walk #" + this.walk.pid;
    this.y = this.y + (this.strand === "+" ? 0.001 : 0);
  }

  get tooltipContent() {
    let attributes = [
      { label: "walk", value: this.walk.title },
      { label: "iid", value: this.fullTitle },
      { label: "Chromosome", value: this.chromosome },
      { label: "Y", value: d3.format(",")(this.y) },
      { label: "Start Point", value: d3.format(",")(this.startPoint) },
      { label: "End Point", value: d3.format(",")(this.endPoint) },
      {
        label: "Length",
        value: d3.format(",")(this.endPoint - this.startPoint),
      },
    ];
    if (this.strand) {
      attributes.push({ label: "Strand", value: this.strand });
    }
    if (this.walk) {
      attributes.push({ label: "Weight", value: this.walk.cn });
    }
    Object.keys(this.metadata).forEach((key) => {
      attributes.push({ label: humanize(key), value: this.metadata[key] });
    });
    return attributes;
  }

  points(scale) {
    this.range = [scale(this.startPlace), scale(this.endPlace)];
    this.shapeWidth = this.range[1] - this.range[0];
    let pointsArray = [];
    if (this.shapeWidth > this.margins.arrow) {
      if (this.strand === "+") {
        pointsArray = [
          0,
          0,
          d3.max([this.shapeWidth - this.margins.arrow, 0]),
          0,
          this.shapeWidth,
          0.5 * this.shapeHeight,
          d3.max([this.shapeWidth - this.margins.arrow, 0]),
          this.shapeHeight,
          0,
          this.shapeHeight,
        ];
      } else if (this.strand === "-") {
        pointsArray = [
          0,
          0.5 * this.shapeHeight,
          d3.max([this.margins.arrow, 0]),
          this.shapeHeight,
          this.shapeWidth,
          this.shapeHeight,
          this.shapeWidth,
          0,
          d3.max([this.margins.arrow, 0]),
          0,
        ];
      }
    } else {
      pointsArray = [
        0,
        0,
        this.shapeWidth,
        0,
        this.shapeWidth,
        this.shapeHeight,
        0,
        this.shapeHeight,
      ];
    }
    return pointsArray;
  }
}
export default WalkInterval;
