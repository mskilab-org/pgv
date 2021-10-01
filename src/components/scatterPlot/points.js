class Points {
  constructor(regl, pointSize) {
    this.regl = regl;
    this.positions = [[0.0, 0.0]];
    this.pointSize = pointSize || this.pixelRatio;
    let common = {
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
      varying vec4 vColor;
      varying vec2 vPos;
      attribute float dataX, dataY, color;
      uniform vec2 domainX, domainY;
      uniform float stageWidth, stageHeight, pointSize;

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

          float posX = kx * (dataX - domainX.x);
          float posY = stageHeight + ky * (dataY - domainY.x);

          float vecX = position.x + posX;
          float vecY = position.y + posY;

          vec2 v = normalizeCoords(vec2(vecX,vecY));
          vPos = v;

          gl_PointSize = pointSize;
          gl_Position = vec4(v, 0, 1);
          float red = floor(color / 65536.0);
          float green = floor((color - red * 65536.0) / 256.0);
          float blue = color - red * 65536.0 - green * 256.0;
          vColor = vec4(red / 255.0, green / 255.0, blue / 255.0, 1.0);
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
        pointSize: regl.prop("pointSize") || this.pointSize,
        domainX: regl.prop("domainX"),
        domainY: regl.prop("domainY"),
      },

      count: this.positions.length,
      instances: regl.prop("instances"),
    };
    this.draw = regl(common);
  }

  load(
    width,
    height,
    pointSize,
    dataPointsX,
    dataPointsY,
    dataPointsColor,
    domainX,
    domainY
  ) {
    const dataX = this.regl.buffer(dataPointsX);
    const dataY = this.regl.buffer(dataPointsY);
    let color = this.regl.buffer(dataPointsColor);
    const instances = dataPointsX.length;
    this.dataBuffer = {
      dataX,
      dataY,
      color,
      domainX,
      domainY,
      instances,
      width,
      height,
      pointSize,
    };
  }

  rescaleXY(domainX, domainY) {
    this.dataBuffer.domainX = domainX;
    this.dataBuffer.domainY = domainY;
    this.render();
  }

  render() {
    this.draw(this.dataBuffer);
  }
}

export default Points;
