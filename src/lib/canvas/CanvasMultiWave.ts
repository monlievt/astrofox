export default class CanvasMultiWave {
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
      strandCount = 3,
      amplitude = 70,
      waveFrequency = 2.2,
      speed = 1.5,
      particleSize = 3.0,
      particleSpacing = 6,
      lineWidth = 1.5,
      renderMode = 'Dots',
      color = ['#00ff66', '#00f0ff'],
      glowColor = '#00ff66',
      glowIntensity = 15,
      sensitivity = 1.2,
      pinchWidth = 100,
      x: offsetX = 0,
      y: offsetY = 0,
    } = this.properties;

    const width = this.canvas.width;
    const height = this.canvas.height;

    // Clear canvas before drawing a new frame
    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2 + Number(offsetX);
    const centerY = height / 2 - Number(offsetY);

    // Update phase/time animation
    this.phase += Number(speed) * 0.05;

    // Prepare colors
    const colors = Array.isArray(color) ? color : [color];
    const gradStart = colors[0] || '#00ff66';
    const gradEnd = colors[1] || gradStart;

    // Parse audio bands for each strand
    const fLen = fft.length;
    const audioBands = [];
    const numStrands = Math.max(1, Math.min(6, Math.round(Number(strandCount) || 1)));

    for (let s = 0; s < numStrands; s++) {
      // Divide spectrum equally for strands
      const startBin = Math.floor((s / numStrands) * (fLen * 0.6));
      const endBin = Math.max(startBin + 1, Math.floor(((s + 1) / numStrands) * (fLen * 0.6)));

      let sum = 0;
      for (let i = startBin; i < endBin; i++) {
        sum += fft[i] || 0;
      }
      const avg = sum / (endBin - startBin);
      // Boost sensitivity
      audioBands.push(avg * Number(sensitivity));
    }

    const maxAmplitude = Number(amplitude);
    const resolvedPinch = Number(pinchWidth);
    const startX = resolvedPinch / 2;
    const halfWidth = width / 2;

    ctx.save();

    // Setup neon glow
    const useGlow = Number(glowIntensity) > 0;
    if (useGlow) {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = Number(glowIntensity);
    }

    // Set line cap and join
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Loop left and right sides
    const sides = [-1, 1];

    for (const side of sides) {
      for (let s = 0; s < numStrands; s++) {
        const audioVal = audioBands[s] ?? 0.2;
        const phaseOffset = (s / numStrands) * Math.PI * 2;
        const strandColor = mixColors(gradStart, gradEnd, s / Math.max(1, numStrands - 1));

        // ─── UNIQUE STRAND MOTION PARAMETERS ───
        // Vary frequency and speed per strand so they weave together asynchronously
        const strandFreqFactor = 1.0 + s * 0.16;
        const strandSpeedFactor = 1.0 - s * 0.12;
        const strandPhaseOffset = phaseOffset + s * Math.PI * 0.15;

        ctx.strokeStyle = strandColor;
        ctx.fillStyle = strandColor;

        const pathPoints = [];

        // Sample points from the pinch boundary to the screen edge
        // Step size is determined by particleSpacing
        const step = Math.max(2, Math.round(Number(particleSpacing) || 4));
        const limitX = Math.max(10, side === -1 ? centerX : width - centerX);

        for (let relativeX = startX; relativeX < limitX; relativeX += step) {
          // Normalized coordinate (0 = center/pinch, 1 = screen edge)
          const t = (relativeX - startX) / Math.max(1, limitX - startX);

          // Pinch envelope: pinches wave to 0 at the center logo, scales up as it goes out
          const envelope = Math.sin((t * Math.PI) / 2);

          // Asymmetric phase and speed offset between left and right sides
          const sidePhase = side === -1 ? 0 : Math.PI * 0.75;
          const sideSpeed = side === -1 ? 1.0 : 0.82;

          // Compute strand specific velocity and wavelength
          const strandFreq = Number(waveFrequency) * strandFreqFactor;
          const strandSpeed = sideSpeed * strandSpeedFactor;

          // ─── ASYMMETRICAL WAVE SHAPING ───
          // 1. Main wave: Sharpen peaks, flatten/widen troughs
          const angle =
            t * strandFreq * Math.PI * 2 - this.phase * strandSpeed + strandPhaseOffset + sidePhase;
          let mainSin = Math.sin(angle);
          if (mainSin > 0) {
            mainSin = mainSin ** 1.6;
          } else {
            mainSin = -(Math.abs(mainSin) ** 0.72);
          }

          // 2. Secondary wave: Sharpen peaks, flatten/widen troughs
          const subAngle =
            t * (strandFreq * 1.5) - this.phase * 0.7 * strandSpeed + strandPhaseOffset + sidePhase;
          let subCos = Math.cos(subAngle);
          if (subCos > 0) {
            subCos = subCos ** 1.4;
          } else {
            subCos = -(Math.abs(subCos) ** 0.8);
          }

          let waveY = mainSin * maxAmplitude * envelope * (0.2 + audioVal);
          waveY += subCos * 15 * envelope * (1.0 + audioVal * 0.5);

          const px = centerX + relativeX * side;
          const py = centerY + waveY;

          pathPoints.push({ x: px, y: py });
        }

        if (pathPoints.length === 0) continue;

        // Draw Lines
        if (renderMode === 'Lines' || renderMode === 'Both') {
          ctx.beginPath();
          ctx.lineWidth = Number(lineWidth);
          ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
          for (let i = 1; i < pathPoints.length; i++) {
            ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
          }
          ctx.stroke();
        }

        // Draw Dots
        if (renderMode === 'Dots' || renderMode === 'Both') {
          const dotSize = Number(particleSize);
          for (let i = 0; i < pathPoints.length; i++) {
            const p = pathPoints[i];

            // Draw every point, or draw larger dots on the peaks!
            ctx.beginPath();
            ctx.arc(p.x, p.y, dotSize, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    ctx.restore();
  }
}

// Helpers
function mixColors(c1: string, c2: string, weight: number): string {
  const parse = (c: string) => {
    if (c.startsWith('#')) {
      if (c.length === 4) {
        return [parseInt(c[1] + c[1], 16), parseInt(c[2] + c[2], 16), parseInt(c[3] + c[3], 16)];
      }
      return [
        parseInt(c.substring(1, 3), 16),
        parseInt(c.substring(3, 5), 16),
        parseInt(c.substring(5, 7), 16),
      ];
    }
    return [0, 255, 100];
  };

  const rgb1 = parse(c1);
  const rgb2 = parse(c2);

  const r = Math.round(rgb1[0] + (rgb2[0] - rgb1[0]) * weight);
  const g = Math.round(rgb1[1] + (rgb2[1] - rgb1[1]) * weight);
  const b = Math.round(rgb1[2] + (rgb2[2] - rgb1[2]) * weight);

  return `rgb(${r}, ${g}, ${b})`;
}
