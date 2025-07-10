class Points {
  constructor(regl, gapX, gapY) {
    this.regl = regl;
    this.gap = gapX;
    this.offsetY = gapY;
    this.pointSize = 10;

    // GPU buffers will be set in setData(...)
    this.dataX = null;
    this.dataY = null;
    this.color = null;
    this.instances = 0;

    // A single position array for instancing (one vertex).
    const positions = [[0.0, 0.0]];

    // Define the draw command once and store it.
    this.drawCommand = regl({
      frag: `
        precision highp float;
        varying vec4 vColor;
        varying vec2 vPos;
        uniform float windowWidth;
        void main() {
          // Round point into a circle
          vec2 cxy = 2.0 * gl_PointCoord - 1.0;
          float r = dot(cxy, cxy);

          // Discard fragments outside of the circle or out of bounds
          if (vPos.x < 0.0 || vPos.x > windowWidth || r > 1.0) {
            discard;
          }
          gl_FragColor = vColor;
        }
      `,

      vert: `
        precision highp float;
        attribute vec2 position;
        attribute float dataX, dataY, color;

        varying vec4 vColor;
        varying vec2 vPos;

        uniform vec2 domainX, domainY;
        uniform float stageWidth, stageHeight;
        uniform float windowWidth, windowHeight, pointSize;
        uniform float offsetX, offsetY;

        // Convert from [0..stageWidth/stageHeight] to clip space [-1..1].
        vec2 normalizeCoords(vec2 xy) {
          float x = xy[0];
          float y = xy[1];
          return vec2(
            2.0 * ((x / stageWidth) - 0.5),
            -(2.0 * ((y / stageHeight) - 0.5))
          );
        }

        void main() {
          // Convert dataX, dataY to screen coords (posX, posY)
          float kx = windowWidth / (domainX.y - domainX.x);
          float ky = -windowHeight / (domainY.y - domainY.x);

          float posX = kx * (dataX - domainX.x);
          float posY = windowHeight + ky * (dataY - domainY.x);

          float vecX = position.x + posX;
          float vecY = position.y + posY;

          // Pass screen-space position to fragment for out-of-bounds check
          vPos = vec2(vecX, vecY);

          // Convert to normalized clip space for gl_Position
          vec2 clip = normalizeCoords(vec2(vecX + offsetX, vecY - offsetY));
          // Optionally clamp if needed
          clip.y = clamp(clip.y, -1.0, 1.0);

          gl_PointSize = pointSize;
          gl_Position = vec4(clip, 0.0, 1.0);

          // Convert packed color to normalized RGBA
          float red   = floor(color / 65536.0);
          float green = floor((color - red * 65536.0) / 256.0);
          float blue  = color - red * 65536.0 - green * 256.0;
          vColor = vec4(red / 255.0, green / 255.0, blue / 255.0, 0.5);
        }
      `,

      attributes: {
        position: positions,    // Single vertex, instanced
        dataX: { buffer: regl.prop('dataX'), divisor: 1 },
        dataY: { buffer: regl.prop('dataY'), divisor: 1 },
        color: { buffer: regl.prop('color'), divisor: 1 },
      },

      // We'll draw one point, instanced 'instances' times
      primitive: 'points',
      count: positions.length,
      instances: regl.prop('instances'),

      uniforms: {
        stageWidth: regl.prop('width'),
        stageHeight: regl.prop('height'),
        windowWidth: regl.prop('windowWidth'),
        windowHeight: regl.prop('windowHeight'),
        pointSize: regl.prop('pointSize'),
        domainX: regl.prop('domainX'),
        domainY: regl.prop('domainY'),
        offsetX: regl.prop('offsetX'),
        offsetY: regl.prop('offsetY'),
      },

      depth: { enable: false },
      blend: {
        enable: true,
        func: {
          srcRGB: 'src alpha',
          srcAlpha: 1,
          dstRGB: 'one minus src alpha',
          dstAlpha: 1,
        },
        equation: { rgb: 'add', alpha: 'add' },
        color: [0, 0, 0, 0],
      },
    });
  }

  /**
   * Upload data to the GPU exactly once (or whenever the dataset changes).
   */
  setData(dataPointsX, dataPointsY, dataPointsColor) {
    // Store references if needed
    this.dataPointsX = dataPointsX;
    this.dataPointsY = dataPointsY;
    this.dataPointsColor = dataPointsColor;

    // Create buffers on the GPU
    this.dataX = this.regl.buffer(dataPointsX);
    this.dataY = this.regl.buffer(dataPointsY);
    this.color = this.regl.buffer(dataPointsColor);

    // Keep track of how many points we have (for instancing).
    this.instances = dataPointsX.length;
  }

  /**
   * Update domain, window size, and offsets for each chart/window.
   * No buffer uploads here; just uniform updates.
   */
  updateDomains(width, height, domains, maxYValues) {
    // Compute the width of each sub-window
    const windowWidth = (width - (domains.length - 1) * this.gap) / domains.length;
    const windowHeight = height;

    // Build an array of uniform-prop sets, one for each domain.
    this.dataBufferList = domains.map((domainX, i) => {
      return {
        // Buffers (they never change unless setData is called)
        dataX: this.dataX,
        dataY: this.dataY,
        color: this.color,

        // Instancing count
        instances: this.instances,

        // Uniforms (width, height, domain, etc.)
        width,
        height,
        windowWidth,
        windowHeight,
        pointSize: this.pointSize,
        domainX,
        domainY: [0, maxYValues[i]],

        // Position each domain sub-plot
        offsetX: i * (this.gap + windowWidth),
        offsetY: this.offsetY,
      };
    });
  }

  /**
   * Render the points using the current uniform set (domain info) 
   * and the GPU buffers (points data).
   */
  render() {
    try {
      // Clear if you want a fresh background each time
      this.regl.clear({
        color: [0, 0, 0, 0],
        depth: false,
        stencil: true,
      });

      // Poll for changes in some browsers; ensures correct draw ordering
      this.regl.poll();

      // Draw once for each domain in our dataBufferList
      this.drawCommand(this.dataBufferList);
    } catch (err) {
      console.error(`Scatterplot WebGL rendering failed: ${err}`);
    }
  }
}

export default Points;