import * as d3 from "d3";

class Points {
  constructor(regl, gapX, gapY) {
    this.pointSize = 10;
    this.gap = gapX;
    this.offsetY = gapY;
    this.regl = regl;
    this.positions = [[0.0, 0.0]];
    let common = {
      frag: `
      precision highp float;
      varying vec4 vColor;
      varying vec2 vPos;
      uniform float windowWidth;
      void main() {
        vec2 cxy = 2.0 * gl_PointCoord - 1.0;
        float r = dot(cxy, cxy);
        if (vPos.x < 0.0 || vPos.x > windowWidth || r > 1.0) {
          discard;
        }
        gl_FragColor = vColor;
      }`,

      vert: `
      precision highp float;
      attribute vec2 position;
      varying vec4 vColor;
      varying vec2 vPos;
      attribute float dataX, dataY, color;
      uniform vec2 domainX, domainY;
      uniform float stageWidth, stageHeight;
      uniform float windowWidth, windowHeight, pointSize;
      uniform float offsetX, offsetY;

      vec2 normalizeCoords(vec2 position) {
        // read in the positions into x and y vars
        float x = position[0];
        float y = position[1];

        return vec2(
          2.0 * ((x / stageWidth) - 0.5),
          -(2.0 * ((y / stageHeight) - 0.5)));
        }

        void main() {

          float kx = windowWidth / (domainX.y - domainX.x);
          float ky = -windowHeight / (domainY.y - domainY.x);

          float posX = kx * (dataX - domainX.x);
          float posY = windowHeight + ky * (dataY - domainY.x);

          float vecX = position.x + posX;
          float vecY = position.y + posY;
          
          vPos = vec2(vecX,vecY);

          vec2 v = normalizeCoords(vec2(vecX + offsetX,vecY - offsetY));

          v.y = clamp(v.y, -1.0, 0.95); 

          gl_PointSize = pointSize;
          gl_Position = vec4(v, 0, 1);
          float red = floor(color / 65536.0);
          float green = floor((color - red * 65536.0) / 256.0);
          float blue = color - red * 65536.0 - green * 256.0;
          vColor = vec4(red / 255.0, green / 255.0, blue / 255.0, 0.50);
        }`,

      blend: {
        enable: true,
        func: {
          srcRGB: "src alpha",
          srcAlpha: 1,
          dstRGB: "one minus src alpha",
          dstAlpha: 1,
        },
        equation: {
          rgb: "add",
          alpha: "add",
        },
        color: [0, 0, 0, 0],
      },

      attributes: {
        position: this.positions,

        dataX: {
          buffer: regl.prop("dataX"),
          divisor: 1,
        },

        dataY: {
          buffer: regl.prop("dataY"),
          divisor: 1,
        },

        color: {
          buffer: regl.prop("color"),
          divisor: 1,
        },
      },

      primitive: "points",

      depth: {
        enable: false,
      },

      uniforms: {
        stageWidth: regl.prop("width"),
        stageHeight: regl.prop("height"),
        windowWidth: regl.prop("windowWidth"),
        windowHeight: regl.prop("windowHeight"),
        pointSize: regl.prop("pointSize"),
        domainX: regl.prop("domainX"),
        domainY: regl.prop("domainY"),
        offsetX: regl.prop("offsetX"),
        offsetY: regl.prop("offsetY"),
      },

      count: this.positions.length,
      instances: regl.prop("instances"),
    };
    this.draw = regl(common);
  }

  load(width, height, dataPointsX, dataPointsY, dataPointsColor, domains) {
    this.dataPointsX = dataPointsX;
    this.dataPointsY = dataPointsY;
    this.maxDataPointsY = d3.max(dataPointsY);
    this.dataX = this.regl.buffer(dataPointsX);
    this.dataY = this.regl.buffer(dataPointsY);
    this.color = this.regl.buffer(dataPointsColor);
    this.width = width;
    this.height = height;
    let windowWidth =
      (this.width - (domains.length - 1) * this.gap) / domains.length;
    let windowHeight = this.height;
    this.instances = dataPointsX.length;

    this.dataBufferList = domains.map((domainX, i) => {
      let matched = [];
      dataPointsX.forEach((d, i) => {
        if (d >= domainX[0] && d <= domainX[1]) {
          matched.push(dataPointsY[i]);
        }
      });

      let points = [
        ...new Set(matched.map((e, j) => Math.round(e * 10) / 10)),
      ].sort((a, b) => d3.descending(a, b));
      let domainY = [
        0,
        points[Math.floor(0.1 * points.length)] || this.maxDataPointsY,
      ];
      return {
        dataX: this.dataX,
        dataY: this.dataY,
        color: this.color,
        domainX,
        domainY,
        instances: this.instances,
        width,
        height,
        windowWidth,
        windowHeight,
        pointSize: this.pointSize,
        offsetX: i * (this.gap + windowWidth),
        offsetY: this.offsetY,
      };
    });
  }

  rescaleXY(domains) {
    let windowWidth =
      (this.width - (domains.length - 1) * this.gap) / domains.length;
    this.dataBufferList = domains.map((domainX, i) => {
      let matched = [];
      this.dataPointsX.forEach((d, i) => {
        if (d >= domainX[0] && d <= domainX[1]) {
          matched.push(this.dataPointsY[i]);
        }
      });

      let points = [
        ...new Set(matched.map((e, j) => Math.round(e * 10) / 10)),
      ].sort((a, b) => d3.descending(a, b));
      let domainY = [
        0,
        points[Math.floor(0.1 * points.length)] || this.maxDataPointsY,
      ];
      return {
        dataX: this.dataX,
        dataY: this.dataY,
        color: this.color,
        domainX,
        domainY,
        instances: this.instances,
        width: this.width,
        height: this.height,
        windowWidth,
        windowHeight: this.height,
        pointSize: this.pointSize,
        offsetX: (this.gap + windowWidth) * i,
        offsetY: this.offsetY,
      };
    });
    this.render(this.dataBufferList);
  }

  render() {
    this.regl.cache = {};

    this.regl.clear({
      color: [0, 0, 0, 0.0],
      stencil: true,
      depth: false,
    });

    this.regl.poll();
    this.draw(this.dataBufferList);
  }
}

export default Points;
