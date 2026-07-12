export default class CanvasQuantumParticleWave {
  properties: Record<string, any>;
  canvas: HTMLCanvasElement;

  // Persistent array to hold smoothed audio registers for each wave
  smoothRegisters: number[] = [];
  dust: { x: number; y: number; size: number; speed: number }[] = [];

  constructor(properties: Record<string, any>, canvas: HTMLCanvasElement) {
    this.properties = properties;
    this.canvas = canvas;
  }

  update(properties: Record<string, any>) {
    this.properties = properties;
  }

  render(data: any) {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    const { fft, time } = data;
    const {
      dotSize = 2.0,
      dotGap = 5.0,
      waveAmplitude = 60,
      waveCount = 6,
      spectrogramStyle = 'Capsule',
      centerWidth = 260,
      centerHeight = 220,
      centerColumns = 32,
      centerColor = '#ffffff',
      ambientDust = true,
      dustCount = 80,
      dustSpeed = 0.6,
      dustReaction = 1.2,
      color = '#d8b4fe',
      glowColor = '#818cf8',
      glowIntensity = 12,
      sensitivity = 1.8,
      y = 0,
    } = this.properties;

    const width = this.canvas.width;
    const height = this.canvas.height;
    const centerY = height / 2 + Number(y);

    const count = Math.max(1, Number(waveCount));

    // Initialize or resize persistent smoothed registers
    if (this.smoothRegisters.length !== count) {
      this.smoothRegisters = new Array(count).fill(0);
    }

    ctx.clearRect(0, 0, width, height);

    // ─── DRAW AMBIENT FLOATING DUST (Constrained inside the waves) ───
    const isAmbientDustEnabled = ambientDust === true || ambientDust === 'true';
    if (isAmbientDustEnabled) {
      const dCount = Math.max(10, Math.min(250, Number(dustCount) || 80));
      const dSpeed = Number(dustSpeed);
      const dReaction = Number(dustReaction);
      const sens = Number(sensitivity);
      const bandHeight = Math.max(40, Number(waveAmplitude) * 2.4);
      const halfBand = bandHeight / 2;

      // Re-initialize dust particles if count changed
      if (this.dust.length !== dCount) {
        this.dust = [];
        for (let i = 0; i < dCount; i++) {
          this.dust.push({
            x: Math.random() * width,
            y: centerY + (Math.random() - 0.5) * bandHeight,
            size: 0.5 + Math.random() * 1.5,
            speed: 0.2 + Math.random() * 0.8,
          });
        }
      }

      // Calculate average volume for reactivity pulsing
      let audioSum = 0;
      const activeCount = Math.floor(fft.length * 0.5);
      for (let b = 0; b < activeCount; b++) {
        audioSum += fft[b] || 0;
      }
      const avgVol = (audioSum / Math.max(1, activeCount) / 255) * sens;

      ctx.save();
      ctx.shadowBlur = Number(glowIntensity) * 0.4;
      ctx.shadowColor = glowColor;
      ctx.fillStyle = color;

      for (let i = 0; i < this.dust.length; i++) {
        const p = this.dust[i];

        // Float upwards
        p.y -= p.speed * dSpeed;

        // Add subtle horizontal drift
        p.x += Math.sin(time * 0.5 + i) * 0.15;

        // Wrap around boundaries of the horizontal wave band
        if (p.y < centerY - halfBand) {
          p.y = centerY + halfBand;
          p.x = Math.random() * width;
        }
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;

        // Audio reactivity: particles expand on beats
        const currentSize = p.size * (1.0 + avgVol * dReaction * 2.5);

        // Fade out as the dust particle approaches the top or bottom edge of the wave band
        const distFromCenter = Math.abs(p.y - centerY);
        const edgeFade = Math.max(0, 1.0 - distFromCenter / halfBand);
        const opacity = 0.35 * edgeFade * (1.0 + avgVol * 1.5);

        ctx.globalAlpha = Math.max(0.04, Math.min(0.7, opacity));
        ctx.beginPath();
        ctx.arc(p.x, p.y, currentSize, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Apply glow effects
    const useGlow = Number(glowIntensity) > 0;
    if (useGlow) {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = Number(glowIntensity);
    }
    ctx.fillStyle = color;

    // Record Y coordinates of all waves at each X coordinate to calculate the envelope boundaries
    const waveYAtX: Record<number, number[]> = {};

    // ─── 1. DRAW HIGH-DYNAMIC SNAP-BACK ATTACK/DECAY LASSO WAVE TRAILS ───
    for (let w = 0; w < count; w++) {
      const segmentSize = Math.max(2, Math.floor(80 / count));
      const startBin = w * segmentSize;
      const endBin = Math.min(127, startBin + segmentSize);

      let rawVal = 0;
      for (let i = startBin; i < endBin; i++) {
        rawVal += fft[i] || 0;
      }
      rawVal = (rawVal / (endBin - startBin)) * Number(sensitivity);

      // Noise Gate
      const noiseThreshold = 0.18;
      let gatedVal = Math.max(0, rawVal - noiseThreshold);
      gatedVal = (gatedVal * 1.25) ** 2.0;

      // Snappy Envelope Follower
      const currentSmooth = this.smoothRegisters[w] || 0;
      if (gatedVal > currentSmooth) {
        this.smoothRegisters[w] = currentSmooth * 0.2 + gatedVal * 0.8;
      } else {
        this.smoothRegisters[w] = currentSmooth * 0.5 + gatedVal * 0.5;
      }

      const response = this.smoothRegisters[w] < 0.005 ? 0 : this.smoothRegisters[w];

      // Wave parameters
      const phaseOffset = w * ((Math.PI * 1.5) / count);
      const direction = w % 2 === 0 ? 1 : -1;
      const baseSpeed = 1.2 + w * 0.25;
      const activeSpeed = baseSpeed * (1.0 + response * 0.3) * direction;
      const waveFreq = 0.004 + w * 0.0015;
      const activeAmplitude = Number(waveAmplitude) * response * 1.6;

      const gap = Number(dotGap);
      for (let x = 0; x < width; x += gap) {
        const xNormalized = (x / width) * 2.0 - 1.0;
        const borderFade = 0.05 + 0.95 * Math.cos((xNormalized * Math.PI) / 2);

        const angle = x * waveFreq - time * activeSpeed + phaseOffset;
        const subAngle = x * (waveFreq * 1.8) + time * (activeSpeed * 0.5) + phaseOffset;

        const mainWave = Math.sin(angle) * activeAmplitude;
        const subWave = Math.sin(subAngle) * (activeAmplitude * 0.25);

        const waveY = centerY + (mainWave + subWave) * borderFade;

        // Record wave Y for later vertical fill calculation
        if (!waveYAtX[x]) {
          waveYAtX[x] = [];
        }
        waveYAtX[x].push(waveY);

        // Draw the dot particle of the wave strand
        const opacity = (0.15 + 0.8 * response) * borderFade;
        ctx.globalAlpha = Math.max(0.08, Math.min(0.9, opacity));

        ctx.beginPath();
        ctx.arc(x, waveY, Number(dotSize), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ─── 2. DRAW DENSE PARTICLES FILL STRICTLY INSIDE THE WAVE ENVELOPE ───
    if (spectrogramStyle !== 'None') {
      const sWidth = Number(centerWidth);
      const startX = width / 2 - sWidth / 2;
      const endX = width / 2 + sWidth / 2;

      ctx.fillStyle = centerColor || color;

      const gap = Number(dotGap);
      for (let x = 0; x < width; x += gap) {
        // Only render the vertical fill within the specified center width
        if (x < startX || x > endX) continue;

        const yVals = waveYAtX[x];
        if (!yVals || yVals.length === 0) continue;

        // Find the upper (min Y) and lower (max Y) boundaries of the wave strands at this X coordinate
        let minY = Math.min(...yVals);
        let maxY = Math.max(...yVals);

        // Apply a capsule window shape (Hann window) to smooth the edges of the fill area
        if (spectrogramStyle === 'Capsule') {
          const percent = (x - startX) / sWidth;
          const envelope = Math.sin(percent * Math.PI);

          const halfSpan = (maxY - minY) / 2;
          const localCenter = (minY + maxY) / 2;
          minY = localCenter - halfSpan * envelope;
          maxY = localCenter + halfSpan * envelope;
        }

        const colHeight = maxY - minY;

        // Draw the vertical column of dots strictly between the wave lines
        if (colHeight > 4) {
          const step = Math.max(2.5, gap * 0.95);
          ctx.save();
          if (useGlow) {
            ctx.shadowColor = glowColor;
            ctx.shadowBlur = Number(glowIntensity) * 0.7;
          }

          for (let y = minY; y <= maxY; y += step) {
            // Fade out particles near the top and bottom wave lines for a soft glow
            const yOffset = y - (minY + maxY) / 2;
            const verticalFade = 1.0 - Math.abs(yOffset / Math.max(1, colHeight / 2));

            // Sinuous warping to break the rigid grid and make the particles look scattered, fluid, and abstract
            const warpX = Math.sin(y * 0.09 + time * 3.0 + x * 0.04) * 7.5;
            const warpY = Math.cos(x * 0.08 - time * 2.2 + y * 0.03) * 5.0;

            ctx.globalAlpha = Math.max(0.08, Math.min(0.95, verticalFade * 0.85));
            ctx.beginPath();
            ctx.arc(x + warpX, y + warpY, Number(dotSize) * 0.85, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      }
    }

    // Reset styles
    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0;
  }
}
