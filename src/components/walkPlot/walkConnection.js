import * as d3 from "d3";
import { humanize } from "../../helpers/utility";
import Connection from "../genomePlot/connection";

class WalkConnection extends Connection {
  constructor(con, wlk) {
    super(con);
    this.styleClass = `popovered walk-connection connection local ${con.type}`;
    this.walk = wlk;
    this.primaryKey = `${this.walk.pid}-${this.cid}`;
    this.fullTitle =
      "Connection #" +
      this.cid +
      " - " +
      this.type +
      " of walk #" +
      this.walk.pid;
  }

  pinpoint() {
    if (this.source) {
      this.source.interval = this.walk.intervals.find(
        (d, i) => this.source.intervalId === d.iid
      );
      this.source.y = this.source.interval.y;
      this.source.point =
        this.source.sign > 0
          ? this.source.interval.endPoint
          : this.source.interval.startPoint;
      this.source.place =
        this.source.sign > 0
          ? this.source.interval.endPlace
          : this.source.interval.startPlace;
      this.touchPlaceX = this.source.place;
      this.touchPlaceY = this.source.y;
      this.touchPlaceSign = this.source.sign;
    }
    if (this.sink) {
      this.sink.interval = this.walk.intervals.find(
        (d, i) => this.sink.intervalId === d.iid
      );
      this.sink.y = this.sink.interval.y;
      this.sink.point =
        this.sink.sign > 0
          ? this.sink.interval.endPoint
          : this.sink.interval.startPoint;
      this.sink.place =
        this.sink.sign > 0
          ? this.sink.interval.endPlace
          : this.sink.interval.startPlace;
      this.touchPlaceX = this.sink.place;
      this.touchPlaceY = this.sink.y;
      this.touchPlaceSign = this.sink.sign;
    }
    this.distance =
      this.source && this.sink
        ? d3.format(",")(Math.abs(this.sink.place - this.source.place))
        : "-";
  }

  get tooltipContent() {
    let attributes = [
      { label: "cid", value: this.fullTitle },
      { label: "type", value: this.type },
      { label: "title", value: this.title },
      { label: "annotation", value: this.annotation },
      {
        label: "Source Chromosome",
        value: !this.source ? "Unknown" : this.source.interval.chromosome,
      },
      {
        label: "Sink Chromosome",
        value: !this.sink ? "Unknown" : this.sink.interval.chromosome,
      },
      {
        label: "Source Interval",
        value: !this.source
          ? "Unknown"
          : this.source.intervalId +
            (this.source.sign > 0 ? " (right)" : " (left)"),
      },
      {
        label: "Sink Interval",
        value: !this.sink
          ? "Unknown"
          : this.sink.intervalId +
            (this.sink.sign > 0 ? " (right)" : " (left)"),
      },
      {
        label: "Source Point",
        value: !this.source ? "Unknown" : d3.format(",")(this.source.point),
      },
      {
        label: "Sink Point",
        value: !this.sink ? "Unknown" : d3.format(",")(this.sink.point),
      },
      {
        label: "Source Y",
        value: !this.source ? "Unknown" : d3.format(".2f")(this.source.y),
      },
      {
        label: "Sink Y",
        value: !this.sink ? "Unknown" : d3.format(".2f")(this.sink.y),
      },
      { label: "Weight", value: this.weight },
    ];
    Object.keys(this.metadata).forEach((key) => {
      attributes.push({ label: humanize(key), value: this.metadata[key] });
    });
    return attributes;
  }
}

export default WalkConnection;
