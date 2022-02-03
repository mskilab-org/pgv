import * as d3 from "d3";
import { guid, humanize } from "../../helpers/utility";

const connectionsStyleMap = {
  ALT: {
    color: d3.rgb("red").toString(),
    strokeWidth: 1.2,
    dash: null,
    opacity: 1,
  },
  REF: {
    color: d3.rgb("gray").toString(),
    strokeWidth: 1,
    dash: null,
    opacity: 0.33,
  },
  LOOSE: {
    color: d3.rgb("steelblue").toString(),
    strokeWidth: 1,
    dash: [3, 1],
    opacity: 0.75,
  },
};

class Connection {
  constructor(con) {
    this.identifier = guid();
    this.primaryKey = `cid-${con.cid}`;
    this.cid = con.cid;
    this.source = con.source
      ? { sign: Math.sign(con.source), intervalId: Math.abs(con.source) }
      : null;
    this.sink = con.sink
      ? { sign: Math.sign(con.sink), intervalId: Math.abs(con.sink) }
      : null;
    this.title = con.title;
    this.type = con.type;
    this.weight = con.weight;
    this.metadata = con.metadata || {};
    this.annotation = con.annotation;
    this.annotationArray = con.annotation ? con.annotation.split("|") : [];
    this.styleClass = `popovered connection local ${con.type}`;
    this.clipPath = 'url("#clip")';
    this.line = d3
      .line()
      .curve(d3.curveBasis)
      .x((d) => d[0])
      .y((d) => d[1]);
    this.color = connectionsStyleMap[con.type].color;
    this.fill = "none";
    this.strokeWidth = connectionsStyleMap[con.type].strokeWidth;
    this.dash = connectionsStyleMap[con.type].dash;
    this.opacity = connectionsStyleMap[con.type].opacity;
    this.errors = [];
  }

  get isSubConnection() {
    return this.mode === "subconnection";
  }

  get isDoubleClickable() {
    return this.source.place && this.sink.place;
  }

  pinpoint(intervalBins) {
    if (this.source) {
      this.source.interval = intervalBins[this.source.intervalId];
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
      this.sink.interval = intervalBins[this.sink.intervalId];
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

  locateAnchor(fragment) {
    this.kind = "ANCHOR";
    this.styleClass = `popovered connection anchor`;
    if (
      this.source.place <= fragment.domain[1] &&
      this.source.place >= fragment.domain[0]
    ) {
      this.source.scale = fragment.scale;
      this.touchPlaceX =
        this.source.sign > 0
          ? this.source.interval.endPlace
          : this.source.interval.startPlace;
      this.touchPlaceY = this.source.y;
      this.touchPlaceSign = this.source.sign;
      this.color = "#000";
      this.fill = d3.rgb(this.sink.interval.color);
      this.dash = null;
      this.stroke = "#000";
      this.strokeWidth = 1;
      this.opacity = 1.0;
      this.otherEnd = this.sink;
    } else {
      this.sink.scale = fragment.scale;
      this.touchPlaceX =
        this.sink.sign > 0
          ? this.sink.interval.endPlace
          : this.sink.interval.startPlace;
      this.touchPlaceY = this.sink.y;
      this.touchPlaceSign = this.sink.sign;
      this.color = "#000";
      this.fill = d3.rgb(this.source.interval.color);
      this.stroke = "#000";
      this.strokeWidth = 1;
      this.dash = null;
      this.opacity = 1.0;
      this.otherEnd = this.source;
    }
    this.touchScale = fragment.scale;

    this.identifier = guid();
  }

  get transform() {
    if (this.kind === "ANCHOR") {
      this.points = [
        this.touchScale(this.touchPlaceX),
        this.yScale(this.touchPlaceY),
      ];
      return "translate(" + this.points + ")";
    } else {
      return "translate(0,0)";
    }
  }

  get render() {
    if (this.kind === "ANCHOR") {
      this.path = this.arc(this.touchPlaceSign);
    } else {
      this.points =
        this.type === "LOOSE"
          ? this.looseConnectorEndpoints
          : this.interConnectorEndpoints;
      this.path = this.line(this.points);
    }
    return this.path;
  }

  // Calculate the points for inter-chromosome connections
  get interConnectorEndpoints() {
    var points = [];

    var origin = d3.min([
      this.source.scale(this.source.place),
      this.sink.scale(this.sink.place),
    ]);
    var target =
      origin === this.source.scale(this.source.place)
        ? this.sink.scale(this.sink.place)
        : this.source.scale(this.source.place);
    var originSign =
      origin === this.source.scale(this.source.place)
        ? this.source.sign
        : this.sink.sign;
    var targetSign =
      originSign === this.source.sign ? this.sink.sign : this.source.sign;
    var originY =
      origin === this.source.scale(this.source.place)
        ? this.source.y
        : this.sink.y;
    var targetY = originY === this.source.y ? this.sink.y : this.source.y;
    var midPointX = 0.5 * origin + 0.5 * target;
    var midPointY = 0.5 * originY + 0.5 * targetY;

    if (this.type === "ALT" && this.mode !== "subconnection") {
      if (Math.abs(this.source.y) === Math.abs(this.sink.y)) {
        points = [
          [origin, this.yScale(originY)],
          [
            d3.min([origin + Math.sign(originSign) * 5, midPointX - 5]),
            this.yScale(originY),
          ],
          [
            d3.min([origin + Math.sign(originSign) * 25, midPointX - 5]),
            this.yScale(midPointY + (midPointY < 10 ? 0.5 : 1)),
          ],
          [midPointX, this.yScale(midPointY + (midPointY < 10 ? 0.75 : 2))],
          [
            d3.max([target + Math.sign(targetSign) * 25, midPointX + 5]),
            this.yScale(midPointY + (midPointY < 10 ? 0.5 : 1)),
          ],
          [
            d3.max([target + Math.sign(targetSign) * 5, midPointX + 5]),
            this.yScale(targetY),
          ],
          [target, this.yScale(targetY)],
        ];
      } else {
        points = [
          [origin, this.yScale(originY)],
          [origin + Math.sign(originSign) * 5, this.yScale(originY)],
          [
            origin + Math.sign(originSign) * 25,
            this.yScale(
              originY + Math.sign(targetY - originY) * (originY < 10 ? 0.25 : 2)
            ),
          ],
          [
            target + Math.sign(targetSign) * 25,
            this.yScale(
              targetY - Math.sign(targetY - originY) * (targetY < 10 ? 0.25 : 2)
            ),
          ],
          [target + Math.sign(targetSign) * 5, this.yScale(targetY)],
          [target, this.yScale(targetY)],
        ];
      }
    } else {
      points = [
        [origin, this.yScale(originY)],
        [target, this.yScale(targetY)],
      ];
    }
    return points;
  }

  // The array of points forming the loose connections with one endpoint missing
  get looseConnectorEndpoints() {
    return [
      [this.touchScale(this.touchPlaceX), this.yScale(this.touchPlaceY)],
      [
        this.touchScale(this.touchPlaceX) + this.touchPlaceSign * 15,
        this.yScale(this.touchPlaceY) - 5,
      ],
      [
        this.touchScale(this.touchPlaceX) + this.touchPlaceSign * 5,
        this.yScale(this.touchPlaceY) - 15,
      ],
    ];
  }

  get location() {
    return `${!this.source ? "Unknown" : this.source.interval.chromosome}: 
       ${!this.source ? "Unknown" : this.source.point} | 
       ${!this.sink ? "Unknown" : this.sink.interval.chromosome}: 
       ${!this.sink ? "Unknown" : this.sink.point}
      `;
  }

  get tooltipContent() {
    let attributes = [
      { label: "cid", value: this.cid },
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

  get toString() {
    return `identifier: ${this.identifier},
      cid: ${this.cid},
      source: ${this.source},
      sink: ${this.sink},
      title: ${this.title},
      type: ${this.type}
      weight: ${this.weight}
      `;
  }
}

export default Connection;
