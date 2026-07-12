export default class CanvasMandala {
  properties: Record<string, any>;
  canvas: HTMLCanvasElement;
  rotation: number = 0;

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
      symmetry = 8,
      scale = 180,
      complexity = 3,
      lineWidth = 1.5,
      color = ['#ff0055', '#7000ff'],
      glowColor = '#ff0055',
      glowIntensity = 15,
      rotationSpeed = 0.4,
      sensitivity = 1.2,
      pulseMode = 'Bass',
      x: offsetX = 0,
      y: offsetY = 0,
    } = this.properties;

    const width = this.canvas.width;
    const height = this.canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2 + Number(offsetX);
    const centerY = height / 2 - Number(offsetY);

    // Update rotation angle
    this.rotation += Number(rotationSpeed) * 0.015;

    // Prepare colors
    const colors = Array.isArray(color) ? color : [color];
    const gradStart = colors[0] || '#ff0055';
    const gradEnd = colors[1] || gradStart;

    // Parse audio bands
    const fLen = fft.length;
    let bass = 0;
    let mid = 0;
    let treble = 0;

    let bassSum = 0;
    for (let i = 0; i < 8; i++) bassSum += fft[i] || 0;
    bass = (bassSum / 8) * Number(sensitivity);

    let midSum = 0;
    const startMid = Math.floor(fLen * 0.1);
    const endMid = Math.floor(fLen * 0.4);
    for (let i = startMid; i < endMid; i++) midSum += fft[i] || 0;
    mid = (midSum / (endMid - startMid)) * Number(sensitivity);

    let trebSum = 0;
    const startTreb = Math.floor(fLen * 0.4);
    const endTreb = Math.floor(fLen * 0.8);
    for (let i = startTreb; i < endTreb; i++) trebSum += fft[i] || 0;
    treble = (trebSum / (endTreb - startTreb)) * Number(sensitivity);

    const energy = (bass + mid + treble) / 3;

    // Decide main pulse multiplier
    let pulse = 1.0;
    if (pulseMode === 'Bass') {
      pulse += bass * 0.25;
    } else if (pulseMode === 'Energy') {
      pulse += energy * 0.25;
    }

    ctx.save();
    ctx.translate(centerX, centerY);

    // Neon Glow
    if (Number(glowIntensity) > 0) {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = Number(glowIntensity);
    }

    ctx.lineWidth = Number(lineWidth);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const numLayers = Math.max(1, Math.min(6, Math.round(Number(complexity) || 3)));
    const baseRadius = Number(scale) * pulse;

    for (let l = 0; l < numLayers; l++) {
      const layerMix = l / Math.max(1, numLayers - 1);
      const layerColor = mixColors(gradStart, gradEnd, layerMix);

      ctx.strokeStyle = layerColor;
      ctx.fillStyle = 'transparent';

      // Alternate rotation directions
      const direction = l % 2 === 0 ? 1 : -1;
      const layerRotation = this.rotation * direction * (1.0 + l * 0.2);

      // Layer radius reacts to a specific audio band
      let layerAudio = 0;
      if (l === 0) layerAudio = treble;
      else if (l === numLayers - 1) layerAudio = bass;
      else layerAudio = mid;

      const r = baseRadius * ((l + 1) / numLayers) * (1.0 + layerAudio * 0.12);

      // Render type 1: Sacred Flower geometry
      if (l % 2 === 0) {
        for (let i = 0; i < symmetry; i++) {
          const angle = (i / symmetry) * Math.PI * 2 + layerRotation;
          const px = Math.cos(angle) * r;
          const py = Math.sin(angle) * r;

          ctx.beginPath();
          // Draw overlapping circles
          ctx.arc(px, py, r * 0.6, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      // Render type 2: Concentric star polygons
      else {
        ctx.beginPath();
        for (let i = 0; i < symmetry; i++) {
          const angle = (i / symmetry) * Math.PI * 2 + layerRotation;
          const px = Math.cos(angle) * r;
          const py = Math.sin(angle) * r;

          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();

        // Draw star cords connecting alternate vertices
        if (symmetry > 4) {
          ctx.beginPath();
          const step = Math.floor(symmetry / 2) - 1 || 2;
          for (let i = 0; i < symmetry; i++) {
            const angleA = (i / symmetry) * Math.PI * 2 + layerRotation;
            const angleB = (((i + step) % symmetry) / symmetry) * Math.PI * 2 + layerRotation;

            ctx.moveTo(Math.cos(angleA) * r, Math.sin(angleA) * r);
            ctx.lineTo(Math.cos(angleB) * r, Math.sin(angleB) * r);
          }
          ctx.stroke();
        }
      }

      // Draw small accent points on the outer boundary of the layers
      ctx.fillStyle = layerColor;
      for (let i = 0; i < symmetry; i++) {
        const angle = (i / symmetry) * Math.PI * 2 + layerRotation;
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * r, Math.sin(angle) * r, Number(lineWidth) * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Outer radial audio spectrum ring to make the mandala extremely reactive to music frequencies
    const rOut = baseRadius * 1.05;
    const numBars = 120;
    ctx.lineWidth = Math.max(1.0, Number(lineWidth) * 0.8);

    for (let i = 0; i < numBars; i++) {
      const halfBars = numBars / 2;
      const index = i < halfBars ? i : numBars - i;
      const bin = Math.min(fLen - 1, Math.floor((index / halfBars) * (fLen * 0.45)));

      const val = (fft[bin] || 0) * Number(sensitivity) * 45.0;

      const angle = (i / numBars) * Math.PI * 2 + this.rotation * 0.25;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // Color transitions along the radial spectrum
      ctx.strokeStyle = mixColors(gradStart, gradEnd, index / halfBars);

      ctx.beginPath();
      ctx.moveTo(cosA * rOut, sinA * rOut);
      ctx.lineTo(cosA * (rOut + val), sinA * (rOut + val));
      ctx.stroke();

      // Draw tiny glowing accent stars at the peak of each spectrum bar
      if (val > 3.0) {
        ctx.fillStyle = gradEnd;
        ctx.beginPath();
        ctx.arc(
          cosA * (rOut + val),
          sinA * (rOut + val),
          Math.max(1.5, Number(lineWidth) * 0.8),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }

    // Central core accent circle
    ctx.strokeStyle = gradStart;
    ctx.beginPath();
    ctx.arc(0, 0, 15 * (1.0 + bass * 0.2), 0, Math.PI * 2);
    ctx.stroke();

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
    return [255, 0, 85];
  };

  const rgb1 = parse(c1);
  const rgb2 = parse(c2);

  const r = Math.round(rgb1[0] + (rgb2[0] - rgb1[0]) * weight);
  const g = Math.round(rgb1[1] + (rgb2[1] - rgb1[1]) * weight);
  const b = Math.round(rgb1[2] + (rgb2[2] - rgb1[2]) * weight);

  return `rgb(${r}, ${g}, ${b})`;
}
