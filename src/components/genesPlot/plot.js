class Plot {
  constructor(regl, rectangleHeight = 10.0) {
    this.regl = regl;
    this.positions = [[1.0, 0.0], [0.0, 0.5], [1.0,0.5], [1.0, -0.5], [0.0, -0.5],[0.0, 0.5]];
    this.rectangleHeight = rectangleHeight;
    this.strokeWidth = 0.66;
    this.commonSpecIntervals = {
      frag: `
      precision highp float;
      varying vec4 vColor;
      varying vec2 vPos;
      varying float diff;

      void main() {
        if (abs(vPos.x) > 1.0 || abs(vPos.y) > 1.0 || abs(diff) < 0.5) {
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

      uniform float stageWidth, stageHeight, rectangleHeight, offset;

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

        diff = max(pos2X - pos1X, 0.5);

        float vecX = diff * position.x + pos1X;
        float vecY = rectangleHeight * position.y + posY;

        vPos = normalizeCoords(vec2(vecX,vecY));

        gl_Position = vec4(vPos, 0, 1);
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
        stageWidth: regl.prop("stageWidth"),
        stageHeight: regl.prop("stageHeight"),
        rectangleHeight: this.rectangleHeight,
        domainX: regl.prop("domainX"),
        domainY: regl.prop("domainY"),
      },

      count: this.positions.length,
      instances: regl.prop("instances"),
    };
    this.draw = regl(this.commonSpecIntervals);
  }

  load(
    width,
    height,
    geneStruct
  ) {
    const {genesStartPoint, genesEndPoint, genesY, genesStroke, domainX, domainY} = geneStruct;
    const startPoint = this.regl.buffer(genesStartPoint);
    const endPoint = this.regl.buffer(genesEndPoint);
    const stroke = this.regl.buffer(genesStroke);
    const valY = this.regl.buffer(genesY);
    const instances = genesStartPoint.length;
    const stageWidth = width;
    const stageHeight = height;
    let color = stroke;
    this.dataBufferStroke = {stageWidth, stageHeight, startPoint, endPoint, color, valY, domainX, domainY, instances};
    color = this.regl.buffer(genesStroke.map((d,i) => i + 3000));
    this.fboIntervals = this.regl.framebuffer({
      width: stageWidth,
      height: stageHeight,
      colorFormat: 'rgba',
    });
    this.drawFboIntervals = this.regl({...this.commonSpecIntervals, framebuffer: this.fboIntervals});
    this.dataBufferFboIntervals = {stageWidth, stageHeight, startPoint, endPoint, color, valY, domainX, domainY, instances};
  }

  rescaleX(domainX) {
    this.dataBufferStroke.domainX = domainX;
    this.fboIntervals = this.regl.framebuffer({
      width: this.dataBufferFboIntervals.stageWidth,
      height: this.dataBufferFboIntervals.stageHeight,
      colorFormat: 'rgba',
    });
    this.drawFboIntervals = this.regl({...this.commonSpecIntervals, framebuffer: this.fboIntervals});
    this.dataBufferFboIntervals.domainX = domainX;
    this.render();
  }

  render() {
    this.draw(this.dataBufferStroke);
    this.drawFboIntervals(this.dataBufferFboIntervals);
  }
}

export default Plot;
