function parseHex(hex: string) {
  const clean = hex.replace('#', '');
  const num =
    parseInt(
      clean.length === 3
        ? clean
            .split('')
            .map(c => c + c)
            .join('')
        : clean,
      16,
    ) || 0;
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function interpolateColor(color1: string, color2: string, factor: number) {
  const c1 = parseHex(color1);
  const c2 = parseHex(color2);
  const r = Math.round(c1.r + factor * (c2.r - c1.r));
  const g = Math.round(c1.g + factor * (c2.g - c1.g));
  const b = Math.round(c1.b + factor * (c2.b - c1.b));
  return `rgb(${r}, ${g}, ${b})`;
}

export default class CanvasQuantumDNA {
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
      sphereRadius = 80, // Used as helix radius
      waveCycles = 3.0,
      rotationSpeed = 1.0,
      colorA = '#ff007f', // Strand A color (Magenta)
      colorB = '#00f3ff', // Strand B color (Cyan)
      bridgeColor = '#ffffff',
      bridgeDensity = 25, // Distance between horizontal base-pair bridges
      dotSize = 2.5,
      dotGap = 6.0,
      glowIntensity = 12,
      glowColor = '#00f3ff',
      sensitivity = 1.5,
      x: offsetX = 0,
      y: offsetY = 0,
    } = this.properties;

    const width = this.canvas.width;
    const height = this.canvas.height;
    const centerY = height / 2 - Number(offsetY);

    ctx.clearRect(0, 0, width, height);

    // Dynamic rotation phase
    const time = this.phase;
    this.phase += 0.012 * Number(rotationSpeed);

    const sens = Number(sensitivity);
    const rad = Number(sphereRadius || 80);
    const cycles = Number(waveCycles);
    const dGap = Number(dotGap);
    const bDens = Number(bridgeDensity);
    const dSize = Number(dotSize);

    // Calculate separate audio frequency bands to modulate bridges and strands
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

    const avgVol = (bass + mids + highs) / 3;

    // Reactively expand helix radius on beats
    const activeRad = rad * (1.0 + bass * 0.35);

    // We store positions of Strand A and Strand B to draw the base pair bridges between them
    const pointsA: { x: number; y: number; zDepth: number }[] = [];
    const pointsB: { x: number; y: number; zDepth: number }[] = [];

    // Calculate 3D helix coordinates projected onto 2D
    for (let x = 0; x <= width; x += dGap) {
      const xPercent = x / width;
      const angle = xPercent * cycles * Math.PI * 2 + time * 3.0;

      // Base sine wave wobble of the entire DNA strand
      const macroWobble = Math.sin(xPercent * Math.PI * 3 + time * 1.5) * 20 * (0.5 + mids * 1.0);

      // Strand A: rotated at angle
      const yA = centerY + Math.sin(angle) * activeRad + macroWobble;
      const zDepthA = Math.cos(angle); // Z-depth: -1 (background) to +1 (foreground)

      // Strand B: rotated 180 degrees (Math.PI) out of phase
      const yB = centerY + Math.sin(angle + Math.PI) * activeRad + macroWobble;
      const zDepthB = Math.cos(angle + Math.PI);

      pointsA.push({ x: x + Number(offsetX), y: yA, zDepth: zDepthA });
      pointsB.push({ x: x + Number(offsetX), y: yB, zDepth: zDepthB });
    }

    const useGlow = Number(glowIntensity) > 0;

    // ─── 1. DRAW BASE PAIR BRIDGES (Connecting lines/dots between Strand A and B) ───
    ctx.save();
    for (let i = 0; i < pointsA.length; i++) {
      const ptA = pointsA[i];
      const ptB = pointsB[i];

      // Check if we should place a bridge at this X coordinate
      if (Math.round(ptA.x) % bDens < dGap) {
        // Sample audio band based on X position to make bridges spark individually
        const binIdx = Math.floor((ptA.x / width) * activeCount) % activeCount;
        const localAudio = (fft[binIdx] || 0) * sens;

        // Bridge opacity and glow are highly audio-reactive (quantum sparks!)
        const bridgeOpa = 0.08 + localAudio * 0.75 + avgVol * 0.12;

        if (bridgeOpa > 0.1) {
          ctx.strokeStyle = bridgeColor;
          ctx.lineWidth = 1.0 + localAudio * 2.0;

          if (useGlow && localAudio > 0.12) {
            ctx.shadowColor = bridgeColor;
            ctx.shadowBlur = Number(glowIntensity) * (0.4 + localAudio * 0.6);
          } else {
            ctx.shadowBlur = 0;
          }

          // Draw the bridge as a series of floating dots with 3D Z-depth scaling
          const steps = 6;
          ctx.fillStyle = bridgeColor;
          for (let j = 1; j < steps; j++) {
            const t = j / steps;
            const bx = ptA.x + t * (ptB.x - ptA.x);
            const by = ptA.y + t * (ptB.y - ptA.y);

            // Interpolate Z-depth for 3D perspective shading
            const bz = ptA.zDepth + t * (ptB.zDepth - ptA.zDepth);
            const depthScale = (bz + 1.0) / 2.0;

            const dotOpa = bridgeOpa * (0.35 + depthScale * 0.65);
            ctx.globalAlpha = Math.max(0.04, Math.min(0.9, dotOpa));

            ctx.beginPath();
            ctx.arc(bx, by, dSize * 0.55 * (0.6 + depthScale * 0.4), 0, Math.PI * 2);
            ctx.fill();
          }

          // Draw a bright quantum energy spark in the middle of active bridges
          if (localAudio > 0.15) {
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = Number(glowIntensity);
            ctx.globalAlpha = 0.95;
            ctx.beginPath();
            ctx.arc(
              (ptA.x + ptB.x) / 2,
              (ptA.y + ptB.y) / 2,
              dSize * (0.9 + localAudio * 0.8),
              0,
              Math.PI * 2,
            );
            ctx.fill();
          }
        }
      }
    }
    ctx.restore();

    // ─── 2. DRAW STRAND A AND STRAND B PARTICLES (Separate passes for correct Z-ordering) ───
    // We merge points to sort them by Z-depth, so background dots are drawn first and foreground dots are drawn on top!
    const allDots: { x: number; y: number; zDepth: number; color: string; glow: string }[] = [];

    for (let i = 0; i < pointsA.length; i++) {
      allDots.push({
        ...pointsA[i],
        color: colorA,
        glow: colorA,
      });
      allDots.push({
        ...pointsB[i],
        color: colorB,
        glow: colorB,
      });
    }

    // Sort by zDepth ascending (lowest Z-depth/background first)
    allDots.sort((a, b) => a.zDepth - b.zDepth);

    ctx.save();
    for (let i = 0; i < allDots.length; i++) {
      const dot = allDots[i];

      // 3D Depth projection calculations: size and opacity are modulated by depth
      const depthScale = (dot.zDepth + 1.0) / 2.0; // scales from 0.0 to 1.0

      // Foreground dots are larger, background dots are smaller
      const currentSize = dSize * (0.65 + depthScale * 0.7) * (1.0 + mids * 0.15);

      // Fade out background dots slightly for atmospheric depth
      const baseOpacity = 0.22 + depthScale * 0.72;
      const opacity = baseOpacity * (0.85 + avgVol * 0.15);

      ctx.fillStyle = dot.color;
      ctx.globalAlpha = Math.max(0.1, Math.min(1.0, opacity));

      if (useGlow) {
        ctx.shadowColor = dot.glow;
        ctx.shadowBlur = Number(glowIntensity) * (0.35 + depthScale * 0.65);
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();
      ctx.arc(dot.x, dot.y, currentSize, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
