class Bars {
  constructor(regl) {
    this.regl = regl;
    this.positions = [[0.0, 0.0], [0.0, 1.0], [1.0,1.0], [1.0, 0.0]];
    this.rectangleHeight = 10.0;
    this.strokeWidth = 0.66;
    let commonSpecIntervals = {
      frag: `
      precision highp float;
      varying vec4 vColor;
      varying vec2 vPos;
      void main() {
        if (abs(vPos.x) > 1.0 || abs(vPos.y) > 1.0) {
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
      uniform float stageWidth, stageHeight, rectangleHeight;

      vec2 normalizeCoords(vec2 position) {
        // read in the positions into x and y vars
        float x = position[0];
        float y = position[1];

        return vec2(
          2.0 * ((x / stageWidth) - 0.5),
          -(2.0 * ((y / stageHeight) - 0.5)));
      }

      void main() {
        float kx = stageWidth / (domainX.y - domainX.x);
        float ky = -stageHeight / (domainY.y - domainY.x);

        float pos1X = kx * (startPoint - domainX.x);
        float pos2X = kx * (endPoint - domainX.x);
        float posY = stageHeight + ky * (valY - domainY.x);

        float vecX = (pos2X - pos1X) * position.x + pos1X;
        float vecY = (stageHeight - posY) * position.y + 1.0 * posY;

        vPos = normalizeCoords(vec2(vecX,vecY));

        gl_Position = vec4(vPos, 0, 1);
      
        float red = floor(color / 65536.0);
        float green = floor((color - red * 65536.0) / 256.0);
        float blue = color - red * 65536.0 - green * 256.0;
        vColor = vec4(red / 255.0, green / 255.0, blue / 255.0, 0.88);
      }`,

      blend: {
        enable: true,
        func: {
          srcRGB:   'src alpha',
          srcAlpha: 'src alpha',
          dstRGB:   'one minus src alpha',
          dstAlpha: 'one minus src alpha'
        }
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
        stageWidth: regl.prop("stageWidth"),
        stageHeight: regl.prop("stageHeight"),
        rectangleHeight: this.rectangleHeight,
        domainX: regl.prop("domainX"),
        domainY: regl.prop("domainY"),
      },

      count: this.positions.length,
      instances: regl.prop("instances"),
    };
    this.draw = regl(commonSpecIntervals);
  }

  load(
    width,
    height,
    barsStruct
  ) {
    const {barsStartPoint, barsEndPoint, barsY, barsFill, domainX, domainY} = barsStruct;
    const startPoint = this.regl.buffer(barsStartPoint);
    const endPoint = this.regl.buffer(barsEndPoint);
    const fill = this.regl.buffer(barsFill);
    const valY = this.regl.buffer(barsY);
    const instances = barsStartPoint.length;
    const stageWidth = width;
    const stageHeight = height;
    let color = fill;
    this.dataBufferFill = {stageWidth, stageHeight, startPoint, endPoint, color, valY, domainX, domainY, instances};
  }

  rescaleXY(domainX, domainY) {
    this.dataBufferFill.domainX = domainX;
    this.dataBufferFill.domainY = domainY;
    this.render();
  }

  render() {
    this.draw(this.dataBufferFill);
  }
}

export default Bars;
