export default class CanvasWaveHorizon {
  properties: Record<string, any>;
  canvas: HTMLCanvasElement;
  phase: number = 0;

  constructor(properties: Record<string, any>, canvas: HTMLCanvasElement) {
    this.properties = properties;
    this.canvas = canvas;
  }

  update(properties: Record<string, any>) {
    this.properties = properties;
  }

  render(fft: Float32Array) {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    const {
      waveCycles = 2.5,
      innerColor = '#00f3ff', // Foreground layer color (Cyan)
      outerColor = '#ff007f', // Midground layer color (Magenta)
      glowColor = '#8f00ff', // Background layer color (Violet)
      glowIntensity = 12,
      dotSize = 2.5,
      dotGap = 8.0,
      sensitivity = 1.5,
      wiggleSpeed = 1.0,
      x: offsetX = 0,
      y: offsetY = 0,
    } = this.properties;

    const width = this.canvas.width;
    const height = this.canvas.height;
    const centerY = height / 2 - Number(offsetY);

    ctx.clearRect(0, 0, width, height);

    // Dynamic shift phases for parallax scrolling
    const time = this.phase;
    this.phase += 0.012 * Number(wiggleSpeed);

    const sens = Number(sensitivity);
    const dSize = Number(dotSize);
    const dGap = Number(dotGap);
    const cycles = Number(waveCycles);

    // Calculate audio frequency bands
    const activeCount = Math.floor(fft.length * 0.6);
    let bass = 0;
    let mids = 0;
    let highs = 0;

    const bCount = Math.floor(activeCount * 0.2);
    const mCount = Math.floor(activeCount * 0.4);

    for (let i = 0; i < bCount; i++) bass += fft[i] || 0;
    for (let i = bCount; i < bCount + mCount; i++) mids += fft[i] || 0;
    for (let i = bCount + mCount; i < activeCount; i++) highs += fft[i] || 0;

    bass = (bass / Math.max(1, bCount)) * sens;
    mids = (mids / Math.max(1, mCount)) * sens;
    highs = (highs / Math.max(1, activeCount - bCount - mCount)) * sens;

    const useGlow = Number(glowIntensity) > 0;

    // We render 3 layers in parallax: Back (Highs) -> Middle (Mids) -> Front (Bass)
    const layers = [
      {
        // 1. BACKGROUND LAYER (Highs/Gamma, slow scroll, violet color)
        baseY: centerY - 45,
        color: glowColor,
        audioVal: highs,
        scrollSpeed: 0.15,
        waveScale: 1.8,
        heightOffset: -30,
        lineCount: 4,
        amp: 10 + highs * 18,
      },
      {
        // 2. MIDGROUND LAYER (Mids, medium scroll, magenta color)
        baseY: centerY + 15,
        color: outerColor,
        audioVal: mids,
        scrollSpeed: 0.45,
        waveScale: 1.3,
        heightOffset: 0,
        lineCount: 5,
        amp: 14 + mids * 28,
      },
      {
        // 3. FOREGROUND LAYER (Bass, fast scroll, cyan color)
        baseY: centerY + 75,
        color: innerColor,
        audioVal: bass,
        scrollSpeed: 1.0,
        waveScale: 0.85,
        heightOffset: 40,
        lineCount: 5,
        amp: 18 + bass * 45,
      },
    ];

    ctx.save();

    for (const layer of layers) {
      ctx.fillStyle = layer.color;

      if (useGlow) {
        ctx.shadowColor = layer.color;
        ctx.shadowBlur = Number(glowIntensity) * (0.35 + layer.audioVal * 0.65);
      } else {
        ctx.shadowBlur = 0;
      }

      // Draw multiple parallel lines within each layer to represent Z-depth grid
      for (let l = 0; l < layer.lineCount; l++) {
        // Line depth ratio (0.0 = back of layer, 1.0 = front of layer)
        const lineDepth = l / Math.max(1, layer.lineCount - 1);

        // Vertical spacing between parallel mesh lines
        const lineY = layer.baseY + layer.heightOffset * (lineDepth - 0.5) + l * 12;

        // Scan horizontally from left to right
        for (let x = 0; x <= width; x += dGap) {
          const xPercent = x / width;

          // Phase calculation with parallax scroll speed and depth spacing
          const phase =
            xPercent * cycles * Math.PI * 2 * layer.waveScale +
            time * layer.scrollSpeed * 2.5 -
            lineDepth * 1.5;

          // Displacement is modulated by the specific audio band and depth factor
          const wiggle = Math.sin(phase) * layer.amp * (0.45 + lineDepth * 0.55);

          const drawX = x + Number(offsetX);
          const drawY = lineY + wiggle;

          // 3D perspective shading: foreground dots are larger and brighter
          const size = dSize * (0.55 + lineDepth * 0.55) * (1.0 + layer.audioVal * 0.18);
          const opacity = (0.2 + lineDepth * 0.65) * (0.8 + layer.audioVal * 0.2);

          ctx.globalAlpha = Math.max(0.04, Math.min(1.0, opacity));

          ctx.beginPath();
          ctx.arc(drawX, drawY, Math.max(0.6, size), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }
}
