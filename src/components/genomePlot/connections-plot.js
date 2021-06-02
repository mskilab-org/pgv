class ConnectionsPlot {
  constructor(regl) {
    this.regl = regl;
    this.connectionSampling = 10; 
    this.positions = (new Array(this.connectionSampling + 1)).fill().map((x, i) => {
      return [ i / this.connectionSampling, 0 ]
    });
    this.commonSpecConnections = {
      frag: `
      precision highp float;
      varying vec4 vColor;
      void main() {
        gl_FragColor = vColor;
      }`,

      vert: `
      precision highp float;
      attribute vec2 position;
      attribute float color;
      attribute vec2 startPlace, endPlace;
      uniform vec2 domainX, domainY;
      varying vec4 vColor;
      uniform float stageWidth, stageHeight;

      vec2 normalizeCoords(vec2 position) {
        // read in the positions into x and y vars
        float x = position[0];
        float y = position[1];

        return vec2(
          2.0 * ((x / stageWidth) - 0.5),
          -(2.0 * ((y / stageHeight) - 0.5)));
      }

      vec2 bezier(vec2 A, vec2 B, vec2 C, vec2 D, vec2 E, float t) {
        vec2 A1 = mix(A, B, t);
        vec2 B1 = mix(B, C, t);
        vec2 C1 = mix(C, D, t);
        vec2 D1 = mix(D, E, t);

        vec2 A2 = mix(A1, B1, t);
        vec2 B2 = mix(B1, C1, t);
        vec2 C2 = mix(C1, D1, t);

        vec2 A3 = mix(A2, B2, t);
        vec2 B3 = mix(B2, C2, t);

        vec2 P = mix(A3, B3, t);

        return P;
      }

      void main() {
        float kx = stageWidth / (domainX.y - domainX.x);
        float ky = -stageHeight / (domainY.y - domainY.x);

        vec2 pointA = vec2(kx * (startPlace.x - domainX.x), stageHeight + ky * (startPlace.y - domainY.x));
        vec2 pointE = vec2(kx * (endPlace.x - domainX.x), stageHeight + ky * (endPlace.y - domainY.x));

        vec2 pointB = vec2(pointA.x + 2.0, pointA.y);
        vec2 pointD = vec2(pointE.x - 2.0, pointE.y);

        vec2 pointC = vec2(0.5 * (pointA.x + pointE.x), 0.5 * (pointA.y + pointE.y));
        if (startPlace.y == endPlace.y) {
          pointC = vec2(0.5 * (pointA.x + pointE.x), pointA.y - 100.0);
        }

        vec2 pos = bezier(pointA, pointB, pointC, pointD, pointE, position.x);

        vec2 v = normalizeCoords(pos);

        gl_Position = vec4(v, 0, 1);

        float red = floor(color / 65536.0);
        float green = floor((color - red * 65536.0) / 256.0);
        float blue = color - red * 65536.0 - green * 256.0;
        vColor = vec4(red / 255.0, green / 255.0, blue / 255.0, 1.0);
      }`,

      attributes: {
        position: this.positions,

        startPlace: {
          buffer: regl.prop("startPlace"),
          divisor: 1
        },

        endPlace: {
          buffer: regl.prop("endPlace"),
          divisor: 1
        },

        color: {
          buffer: regl.prop("color"),
          divisor: 1
        }
      },

      primitive: "line strip",

      depth: {
        enable: false
      },

      uniforms: {
        stageWidth: regl.prop("stageWidth"),
        stageHeight: regl.prop("stageHeight"),
        domainX: regl.prop("domainX"),
        domainY: regl.prop("domainY")
      },

      count: this.connectionSampling,
      instances: regl.prop('instances')
    };
    this.draw = regl(this.commonSpecConnections);
  }

  load(
    stageWidth,
    stageHeight,
    domainX,
    domainY,
    connections
  ) {
    this.dataBufferConnections = {
      stageWidth,
      stageHeight,
      startPlace: this.regl.buffer(connections.map(e => e.edges[0])), 
      endPlace: this.regl.buffer(connections.map(e => e.edges[1])), 
      color: this.regl.buffer(connections.map(e => e.color)), 
      domainX: domainX, domainY: domainY, instances: connections.length};
  }

  rescaleXY(domainX, domainY) {
    this.dataBufferConnections.domainX = domainX;
    this.dataBufferConnections.domainY = domainY;
    this.render();
  }

  render() {
    this.draw(this.dataBufferConnections);
  }
}

export default ConnectionsPlot;
