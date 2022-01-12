import * as d3 from "d3";

class Plot {
  constructor(regl, gapX, gapY) {
    this.regl = regl;
    this.gap = gapX;
    this.offsetY = gapY;
    this.domainY = [-3, 3];
    this.positions = [
      [1.0, 0.0],
      [0.0, 0.5],
      [1.0, 0.5],
      [1.0, -0.5],
      [0.0, -0.5],
      [0.0, 0.5],
    ];
    this.rectangleHeight = 10.0;
    this.commonSpecIntervals = {
      frag: `
      precision highp float;
      varying vec4 vColor;
      varying vec2 vPos;
      varying float diff;
      uniform float windowWidth;

      void main() {
        if (vPos.x < 0.0 || vPos.x > windowWidth || abs(diff) < 0.5) {
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
      varying float diff;
      uniform float rectangleHeight;
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

        diff = max(pos2X - pos1X, 0.5);

        float vecX = diff * position.x + pos1X;
        float vecY = rectangleHeight * position.y + posY;

        vPos = vec2(vecX,vecY);

        vec2 v = normalizeCoords(vec2(vecX + offsetX,vecY - offsetY));

        v.y = clamp(v.y, -1.0, 1.0); 

        gl_Position = vec4(v, 0, 1);

        float red = floor(color / 65536.0);
        float green = floor((color - red * 65536.0) / 256.0);
        float blue = color - red * 65536.0 - green * 256.0;
        vColor = vec4(red / 255.0, green / 255.0, blue / 255.0, 1.0);
      }`,

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
        rectangleHeight: regl.prop("rectangleHeight"),
        domainX: regl.prop("domainX"),
        domainY: regl.prop("domainY"),
        offsetX: regl.prop("offsetX"),
        offsetY: regl.prop("offsetY"),
      },

      count: this.positions.length,
      instances: regl.prop("instances"),
    };
    this.draw = regl(this.commonSpecIntervals);
  }

  load(
    width,
    height,
    genesStartPoint,
    genesEndPoint,
    genesY,
    genesColor,
    domains
  ) {
    this.genesStartPoint = genesStartPoint;
    this.genesEndPoint = genesEndPoint;
    this.genesY = genesY;
    this.genesColor = genesColor;
    this.startPoint = this.regl.buffer(genesStartPoint);
    this.endPoint = this.regl.buffer(genesEndPoint);
    this.color = this.regl.buffer(genesColor);
    this.valY = this.regl.buffer(genesY);
    this.instances = genesStartPoint.length;
    this.width = Math.floor(width);
    this.height = Math.floor(height);
    let windowWidth =
      (this.width - (domains.length - 1) * this.gap) / domains.length;
    let windowHeight = this.height;
    this.instances = genesStartPoint.length;
    this.dataBufferList = domains.map((domainX, i) => {
      return {
        startPoint: this.startPoint,
        endPoint: this.endPoint,
        valY: this.valY,
        color: this.color,
        domainX,
        domainY: this.domainY,
        instances: this.instances,
        rectangleHeight: this.rectangleHeight,
        width: this.width,
        height: this.height,
        windowWidth,
        windowHeight,
        offsetX: i * (this.gap + windowWidth),
        offsetY: this.offsetY,
      };
    });
    let colorFbo = this.regl.buffer(genesColor.map((d, i) => i + 3000));
    this.fboIntervals = this.regl.framebuffer({
      width: this.width,
      height: this.height,
      colorFormat: "rgba",
    });
    this.drawFboIntervals = this.regl({
      ...this.commonSpecIntervals,
      framebuffer: this.fboIntervals,
    });
    this.dataBufferFboList = domains.map((domainX, i) => {
      return {
        startPoint: this.startPoint,
        endPoint: this.endPoint,
        valY: this.valY,
        color: colorFbo,
        domainX,
        domainY: this.domainY,
        instances: this.instances,
        rectangleHeight: this.rectangleHeight,
        width: this.width,
        height: this.height,
        windowWidth,
        windowHeight,
        offsetX: i * (this.gap + windowWidth),
        offsetY: this.offsetY,
      };
    });
  }

  rescaleX(domains) {
    let windowWidth =
      (this.width - (domains.length - 1) * this.gap) / domains.length;
    let windowHeight = this.height;

    this.dataBufferList = domains.map((domainX, i) => {
      return {
        startPoint: this.startPoint,
        endPoint: this.endPoint,
        valY: this.valY,
        color: this.color,
        domainX,
        domainY: this.domainY,
        instances: this.instances,
        rectangleHeight: this.rectangleHeight,
        width: this.width,
        height: this.height,
        windowWidth,
        windowHeight,
        offsetX: i * (this.gap + windowWidth),
        offsetY: this.offsetY,
      };
    });
    let colorFbo = this.regl.buffer(this.genesColor.map((d, i) => i + 3000));
    this.fboIntervals = this.regl.framebuffer({
      width: this.width,
      height: this.height,
      colorFormat: "rgba",
    });
    this.drawFboIntervals = this.regl({
      ...this.commonSpecIntervals,
      framebuffer: this.fboIntervals,
    });
    this.dataBufferFboList = domains.map((domainX, i) => {
      return {
        startPoint: this.startPoint,
        endPoint: this.endPoint,
        valY: this.valY,
        color: colorFbo,
        domainX,
        domainY: this.domainY,
        instances: this.instances,
        rectangleHeight: this.rectangleHeight,
        width: this.width,
        height: this.height,
        windowWidth,
        windowHeight,
        offsetX: i * (this.gap + windowWidth),
        offsetY: this.offsetY,
      };
    });
    this.render();
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
    this.drawFboIntervals(this.dataBufferFboList);
  }
}

export default Plot;
