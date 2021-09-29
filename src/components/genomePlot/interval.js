import * as d3 from "d3";
import { humanize, guid } from "../../helpers/utility";

class Interval {

  constructor(inter) {
    this.identifier = guid();
    this.primaryKey = `iid-${inter.iid}`;
    this.iid = inter.iid;
    this.siid = inter.siid;
    this.chromosome = inter.chromosome;
    this.startPoint = inter.startPoint;
    this.endPoint = inter.endPoint;
    this.annotation = inter.annotation;
    this.metadata = inter.metadata || {};
    this.annotationArray = inter.annotation ? inter.annotation.split('|') : [];
    this.intervalLength = this.endPoint - this.startPoint;
    this.y = inter.y;
    this.title = inter.title;
    this.type = inter.type;
    this.strand = inter.strand;
    this.sequence = inter.sequence;
    this.errors = [];
    this.attributes = [
      {label: 'Chromosome', value: this.chromosome}, 
      {label: 'Y', value: this.y}, 
      {label: 'Start Point (chromosome)', value: d3.format(',')(this.startPoint)},
      {label: 'End Point (chromosome)', value: d3.format(',')(this.endPoint - 1)}, // because endpoint is inclusive 
      {label: 'Interval Length', value: d3.format(',')(this.intervalLength)}];
    if (this.strand) {
      this.attributes.push({label: 'Strand', value: this.strand});
    }
    if (this.sequence) {
      this.attributes.push({label: 'Sequence', value: this.sequence});
    }
  }

  get isSubInterval() {
    return this.mode === 'subinterval';
  }

  get location() {
    return `${this.chromosome}: ${this.startPoint} - ${this.endPoint}`;
  }

  get tooltipContent() {
    let attributes = [
      { label: "iid", value: this.iid },
      { label: "annotation", value: this.annotation },
      { label: "Chromosome", value: this.chromosome },
      { label: "Y", value: this.y },
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
    if (this.sequence) {
      attributes.push({ label: "Sequence", value: this.sequence });
    }
    Object.keys(this.metadata).forEach((key) => {
      attributes.push({ label: humanize(key), value: this.metadata[key] });
    });
    return attributes;
  }

  get toString() {
    return `identifier: ${this.identifier},
    iid: ${this.iid},
    chromosome: ${this.chromosome},
    startPoint: ${this.startPoint},
    endPoint: ${this.endPoint},
    y: ${this.y},
    title: ${this.title},
    type: ${this.type},
    strand: ${this.strand}
    strand: ${this.strand}
    sequence: ${this.sequence}
    `;
  }
}
export default Interval;