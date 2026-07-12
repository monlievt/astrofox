export default class CanvasBinauralResonance {
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
      ringPairs = 2,
      mirrorEnabled = true,
      corePulse = true,
      amplitude = 90,
      baseRadius = 135,
      pointCount = 120,
      colorLeft = '#00f3ff',
      colorRight = '#b624ff',
      glowColor = '#00f3ff',
      glowIntensity = 15,
      lineWidth = 1.5,
      webOpacity = 0.15,
      sensitivity = 1.2,
      rotationSpeed = 1.0,
      x: offsetX = 0,
      y: offsetY = 0,
    } = this.properties;

    const width = this.canvas.width;
    const height = this.canvas.height;

    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2 + Number(offsetX);
    const centerY = height / 2 - Number(offsetY);

    // Update phase/time animation
    this.phase += Number(rotationSpeed) * 0.012;

    const numPoints = Math.max(20, Math.min(300, Math.round(Number(pointCount) || 120)));
    const amp = Number(amplitude);
    const rad = Number(baseRadius);
    const sens = Number(sensitivity);
    const lineW = Number(lineWidth);
    const opacityWeb = Number(webOpacity);

    // Total rings is ringPairs * 2
    const numRings = Math.max(2, Math.min(8, Math.round(Number(ringPairs) * 2)));

    // Arrays to store point positions for each nested ring
    const ringsPoints: { x: number; y: number }[][] = [];

    // Calculate points for all nested rings
    for (let r = 0; r < numRings; r++) {
      const ringPoints: { x: number; y: number }[] = [];
      const isLeftRing = r % 2 === 0;

      // Radial nesting factor (rings get smaller as they go inwards)
      const ringRadius = rad * 0.85 ** r;

      // Asymmetric rotations: Left/Right rings rotate in opposite directions at varying speeds
      const rotSpeedFactor = 0.6 - r * 0.06;
      const ringRotation = isLeftRing
        ? this.phase * rotSpeedFactor
        : -this.phase * rotSpeedFactor * 0.85;

      for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2 + ringRotation;

        // ─── DYNAMIC AUDIO SPECTRUM MAPPING ───
        let binPercent = i / numPoints;
        if (mirrorEnabled) {
          // Mirroring: left and right halves of the circle dance identically
          const halfPoints = numPoints / 2;
          const normIdx = i < halfPoints ? i : numPoints - 1 - i;
          binPercent = normIdx / halfPoints;
        }

        // Active range: map only to the first 65% of the FFT (where the actual music notes reside)
        const maxActiveBins = Math.floor(fft.length * 0.65);
        let binIdx = Math.floor(binPercent * maxActiveBins);

        // Separate Left (Even Bins) and Right (Odd Bins) frequencies for stereo depth
        if (isLeftRing) {
          binIdx = (binIdx * 2) % fft.length;
        } else {
          binIdx = (binIdx * 2 + 1) % fft.length;
        }

        const audioVal = (fft[binIdx] || 0) * sens;

        // Smooth wave ripples around the ring to add extra geometric flare
        const frequencyMod = isLeftRing ? 6 : 8;
        const waveMod = Math.sin(angle * frequencyMod + this.phase * (isLeftRing ? 2.5 : -1.8)) * 4;

        // Calculate final point position
        const currentRadius = ringRadius + waveMod + audioVal * amp;
        const x = centerX + Math.cos(angle) * currentRadius;
        const y = centerY + Math.sin(angle) * currentRadius;

        ringPoints.push({ x, y });
      }

      ringsPoints.push(ringPoints);
    }

    ctx.save();

    // Enable basic line properties
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // ─── 1. DRAW RESONATING CORE PULSE (Glowing core energy) ───
    if (corePulse) {
      let fftSum = 0;
      const activeCount = Math.floor(fft.length * 0.6);
      for (let b = 0; b < activeCount; b++) {
        fftSum += fft[b] || 0;
      }
      const avgVolume = fftSum / Math.max(1, activeCount);

      // Core pulse scale expands based on overall volume
      const pulseRad = rad * 0.55 * (0.2 + avgVolume * sens * 1.5);
      if (pulseRad > 5) {
        const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, pulseRad);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
        grad.addColorStop(
          0.4,
          (colorLeft.startsWith('#') && colorLeft.length === 7 ? colorLeft : '#00f3ff') + '22',
        );
        grad.addColorStop(
          0.8,
          (colorRight.startsWith('#') && colorRight.length === 7 ? colorRight : '#b624ff') + '11',
        );
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.save();
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(centerX, centerY, pulseRad, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // ─── 2. DRAW INTER-RING CONNECTING WEB LATTICE ───
    if (opacityWeb > 0 && numRings > 1) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${opacityWeb})`;
      ctx.lineWidth = lineW * 0.35;
      ctx.shadowBlur = 0; // Keep lines clean

      ctx.beginPath();
      for (let r = 1; r < numRings; r++) {
        const outerRing = ringsPoints[r - 1];
        const innerRing = ringsPoints[r];

        for (let i = 0; i < numPoints; i++) {
          // Connect matching index points
          ctx.moveTo(outerRing[i].x, outerRing[i].y);
          ctx.lineTo(innerRing[i].x, innerRing[i].y);

          // Diagonal connection to create a robust moiré pattern
          const nextIdx = (i + 1) % numPoints;
          ctx.moveTo(outerRing[i].x, outerRing[i].y);
          ctx.lineTo(innerRing[nextIdx].x, innerRing[nextIdx].y);
        }
      }
      ctx.stroke();
    }

    // ─── 3. DRAW NEON GLOWING WAVE RINGS ───
    const useGlow = Number(glowIntensity) > 0;

    for (let r = numRings - 1; r >= 0; r--) {
      const isLeftRing = r % 2 === 0;
      const ringColor = isLeftRing ? colorLeft : colorRight;

      if (useGlow) {
        ctx.shadowColor = ringColor;
        ctx.shadowBlur = Number(glowIntensity) * (1.0 - r * 0.1); // Fade glow slightly for inner rings
      }

      ctx.strokeStyle = ringColor;
      ctx.lineWidth = lineW * (1.0 - r * 0.08); // Thinner inner rings

      ctx.beginPath();
      ctx.moveTo(ringsPoints[r][0].x, ringsPoints[r][0].y);
      for (let i = 1; i < numPoints; i++) {
        ctx.lineTo(ringsPoints[r][i].x, ringsPoints[r][i].y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // ─── 4. DRAW RESONATING ACCENT DOTS ───
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';

    for (let r = 0; r < numRings; r++) {
      const step = 6 + r * 2;
      for (let i = 0; i < numPoints; i += step) {
        const p = ringsPoints[r][i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, lineW * 0.9 * (1.0 - r * 0.1), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }
}
