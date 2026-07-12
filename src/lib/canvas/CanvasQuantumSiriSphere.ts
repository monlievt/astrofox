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

export default class CanvasQuantumSiriSphere {
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
      sphereRadius = 160,
      dotDensity = 4.0,
      innerColor = '#ff007f',
      outerColor = '#0055ff',
      glowIntensity = 15,
      glowColor = '#00f3ff',
      ringColor1 = '#39ff14',
      ringColor2 = '#00f3ff',
      sensitivity = 1.5,
      wiggleSpeed = 1.0,
      x: offsetX = 0,
      y: offsetY = 0,
    } = this.properties;

    const width = this.canvas.width;
    const height = this.canvas.height;
    const centerX = width / 2 + Number(offsetX);
    const centerY = height / 2 - Number(offsetY);

    ctx.clearRect(0, 0, width, height);

    // Increment time phase for flowing waves
    const time = this.phase;
    this.phase += 0.018 * Number(wiggleSpeed);

    const sens = Number(sensitivity);
    const maxR = Number(sphereRadius);
    const density = Math.max(3.5, Number(dotDensity) * 1.3);

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

    const avgVol = (bass + mids + highs) / 3;

    // ─── 1. DRAW 3D GLASSY SPHERICAL GLOW CASING ───
    ctx.save();

    // Background radial shading to create a glassy orb look
    const radialGrad = ctx.createRadialGradient(
      centerX - maxR * 0.15,
      centerY - maxR * 0.15,
      maxR * 0.1,
      centerX,
      centerY,
      maxR * 1.15,
    );
    radialGrad.addColorStop(0, 'rgba(255, 255, 255, 0.06)');
    radialGrad.addColorStop(0.65, 'rgba(5, 5, 25, 0.15)');
    radialGrad.addColorStop(0.93, 'rgba(0, 243, 255, 0.04)');
    radialGrad.addColorStop(0.98, 'rgba(0, 243, 255, 0.22)');
    radialGrad.addColorStop(1.0, 'rgba(0, 243, 255, 0.6)');

    ctx.fillStyle = radialGrad;
    ctx.beginPath();
    ctx.arc(centerX, centerY, maxR * 1.14, 0, Math.PI * 2);
    ctx.fill();

    // Draw the two overlapping neon glass orbits rotating in opposite directions
    const ringSpeed1 = time * 0.45;
    const ringSpeed2 = -time * 0.55;

    if (Number(glowIntensity) > 0) {
      ctx.shadowColor = ringColor2;
      ctx.shadowBlur = Number(glowIntensity) * 0.9;
    }

    // Outer Glass Orbit 1 (Cyan)
    ctx.strokeStyle = ringColor2 + '44';
    ctx.lineWidth = 8.0;
    ctx.beginPath();
    ctx.arc(centerX, centerY, maxR * 1.1, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = ringColor2;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, maxR * 1.1, ringSpeed1, ringSpeed1 + Math.PI * 0.85);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(centerX, centerY, maxR * 1.1, ringSpeed1 + Math.PI * 1.15, ringSpeed1 + Math.PI * 1.85);
    ctx.stroke();

    // Outer Glass Orbit 2 (Green)
    if (Number(glowIntensity) > 0) {
      ctx.shadowColor = ringColor1;
    }
    ctx.strokeStyle = ringColor1 + '33';
    ctx.lineWidth = 5.0;
    ctx.beginPath();
    ctx.arc(centerX, centerY, maxR * 1.13, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = ringColor1;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(centerX, centerY, maxR * 1.13, ringSpeed2, ringSpeed2 + Math.PI * 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(centerX, centerY, maxR * 1.13, ringSpeed2 + Math.PI * 1.0, ringSpeed2 + Math.PI * 1.5);
    ctx.stroke();

    ctx.restore();

    // ─── 2. DRAW Siri 3D SPHERICAL WAVE MESH (Rectangular grid masked to circle) ───
    ctx.save();

    const useGlow = Number(glowIntensity) > 0;

    // Scan rectangular grid and mask it to a circle
    for (let x = -maxR; x <= maxR; x += density) {
      for (let y = -maxR; y <= maxR; y += density) {
        const d = Math.sqrt(x * x + y * y);

        if (d <= maxR) {
          const normD = d / maxR;

          // Spherical envelope factor (Z-depth projection): 1.0 in center, 0.0 at circle edges
          const sphereFactor = Math.sqrt(1.0 - normD * normD);

          // Multiple flowing sine waves going horizontally (left-to-right)
          // NO IDLE WIGGLE: wave amplitude is strictly scaled by active audio volume!
          const wave1 = Math.sin(x * 0.016 - time * 3.0) * bass * 38;
          const wave2 = Math.sin(x * 0.036 + time * 2.0) * mids * 22;
          const wave3 = Math.cos(x * 0.062 - time * 4.0) * highs * 12;

          // Displacement is largest at the center and becomes exactly 0 at the boundary ring
          const totalDisplacement = (wave1 + wave2 + wave3) * sphereFactor;

          const drawX = centerX + x;
          const drawY = centerY + y + totalDisplacement;

          // Color gradient: pink/magenta in center, deep blue/purple at outer ring
          const dotColor = interpolateColor(innerColor, outerColor, normD);
          ctx.fillStyle = dotColor;

          if (useGlow && avgVol > 0.06) {
            ctx.shadowColor = dotColor;
            ctx.shadowBlur = Number(glowIntensity) * (0.3 + avgVol * 0.7);
          } else {
            ctx.shadowBlur = 0;
          }

          // Particle sizing: center is slightly larger, scaling dynamically with volume
          const pSize = (1.15 - normD * 0.45) * (1.1 + avgVol * 1.6);
          ctx.globalAlpha = 0.25 + 0.65 * sphereFactor * (0.8 + avgVol * 0.2);

          ctx.beginPath();
          ctx.arc(drawX, drawY, Math.max(0.7, pSize), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }
}
