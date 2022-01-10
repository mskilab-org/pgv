import * as d3 from "d3";

class Bars {
  constructor(regl, gapX, gapY) {
    this.regl = regl;
    this.gap = gapX;
    this.offsetY = gapY;
    this.positions = [
      [0.0, 0.0],
      [0.0, 1.0],
      [1.0, 1.0],
      [1.0, 0.0],
    ];
    let commonSpecIntervals = {
      frag: `
      precision highp float;
      varying vec4 vColor;
      varying vec2 vPos;
      uniform float windowWidth;
      void main() {
        if (vPos.x < 0.0 || vPos.x > windowWidth) {
          discard;
        }
        gl_FragColor = vColor;
      }`,

      vert: `
      precision highp float;
      attribute vec2 position;
      attribute float startPoint, endPoint, valY, color;
      uniform vec2 domainX, domainY;
      varying vec4 vColor;
      varying vec2 vPos;
      uniform float stageWidth, stageHeight;
      uniform float windowWidth, windowHeight;
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

        float pos1X = kx * (startPoint - domainX.x);
        float pos2X = kx * (endPoint - domainX.x);
        float posY = windowHeight + ky * (valY - domainY.x);

        float vecX = (pos2X - pos1X) * position.x + pos1X;
        float vecY = (windowHeight - posY) * position.y + 1.0 * posY;

        vPos = vec2(vecX,vecY);

        vec2 v = normalizeCoords(vec2(vecX + offsetX,vecY - offsetY));

        v.y = clamp(v.y, -1.0, 1.0); 

        gl_Position = vec4(v, 0, 1);
      
        float red = floor(color / 65536.0);
        float green = floor((color - red * 65536.0) / 256.0);
        float blue = color - red * 65536.0 - green * 256.0;
        vColor = vec4(red / 255.0, green / 255.0, blue / 255.0, 1.0);
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

        startPoint: {
          buffer: regl.prop("startPoint"),
          divisor: 1,
        },

        endPoint: {
          buffer: regl.prop("endPoint"),
          divisor: 1,
        },

        valY: {
          buffer: regl.prop("valY"),
          divisor: 1,
        },

        color: {
          buffer: regl.prop("color"),
          divisor: 1,
        },
      },

      primitive: "triangle fan",

      depth: {
        enable: false,
      },

      uniforms: {
        stageWidth: regl.prop("width"),
        stageHeight: regl.prop("height"),
        windowWidth: regl.prop("windowWidth"),
        windowHeight: regl.prop("windowHeight"),
        domainX: regl.prop("domainX"),
        domainY: regl.prop("domainY"),
        offsetX: regl.prop("offsetX"),
        offsetY: regl.prop("offsetY"),
      },

      count: this.positions.length,
      instances: regl.prop("instances"),
    };
    this.draw = regl(commonSpecIntervals);
  }

  load(width, height, barsStartPoint, barsEndPoint, barsY, barsFill, domains) {
    this.barsStartPoint = barsStartPoint;
    this.barsEndPoint = barsEndPoint;
    this.barsY = barsY;
    this.maxBarsY = d3.max(barsY);
    this.startPoint = this.regl.buffer(barsStartPoint);
    this.endPoint = this.regl.buffer(barsEndPoint);
    this.color = this.regl.buffer(barsFill);
    this.valY = this.regl.buffer(barsY);
    this.width = width;
    this.height = height;
    let windowWidth =
      (this.width - (domains.length - 1) * this.gap) / domains.length;
    let windowHeight = this.height;
    this.instances = barsStartPoint.length;

    this.dataBufferList = domains.map((domainX, i) => {
      let matched = [];
      this.barsStartPoint.forEach((startPoint, i) => {
        let endPoint = this.barsEndPoint[i];
        if (!(startPoint > domainX[1] || endPoint < domainX[0])) {
          matched.push(this.barsY[i]);
        }
      });

      let points = [
        ...new Set(matched.map((e, j) => Math.round(e * 10) / 10)),
      ].sort((a, b) => d3.descending(a, b));
      let domainY = [
        0,
        points[Math.floor(0.1 * points.length)] || this.maxBarsY,
      ];
      return {
        startPoint: this.startPoint,
        endPoint: this.endPoint,
        valY: this.valY,
        color: this.color,
        domainX,
        domainY,
        instances: this.instances,
        width,
        height,
        windowWidth,
        windowHeight,
        offsetX: i * (this.gap + windowWidth),
        offsetY: this.offsetY,
      };
    });
  }

  rescaleXY(domains) {
    let windowWidth =
      (this.width - (domains.length - 1) * this.gap) / domains.length;
    let windowHeight = this.height;
    this.dataBufferList = domains.map((domainX, i) => {
      let matched = [];
      this.barsStartPoint.forEach((startPoint, i) => {
        let endPoint = this.barsEndPoint[i];
        if (!(startPoint > domainX[1] || endPoint < domainX[0])) {
          matched.push(this.barsY[i]);
        }
      });

      let points = [
        ...new Set(matched.map((e, j) => Math.round(e * 10) / 10)),
      ].sort((a, b) => d3.descending(a, b));
      let domainY = [
        0,
        points[Math.floor(0.1 * points.length)] || this.maxBarsY,
      ];
      return {
        startPoint: this.startPoint,
        endPoint: this.endPoint,
        valY: this.valY,
        color: this.color,
        domainX,
        domainY,
        instances: this.instances,
        width: this.width,
        height: this.height,
        windowWidth,
        windowHeight,
        offsetX: i * (this.gap + windowWidth),
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

export default Bars;
