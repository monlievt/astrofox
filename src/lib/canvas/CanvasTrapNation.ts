import Entity from '@/lib/core/Entity';
import type { CanvasContext, CanvasElement } from '@/lib/types';
import { resetCanvas } from '@/lib/utils/canvas';
import { clamp } from '@/lib/utils/math';

interface Particle {
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  alpha: number;
}

export default class CanvasTrapNation extends Entity {
  canvas: CanvasElement;
  context: CanvasContext;
  particles: Particle[] = [];
  image: HTMLImageElement | null = null;
  currentSrc = '';

  static defaultProperties = {
    src: '',
    radius: 120,
    barWidth: 4,
    barCount: 96,
    color: ['#704dd8', '#ff007f'],
    bassPulsing: true,
    bassSensitivity: 1.5,
    mirrorMode: false,
    particleCount: 100,
  };

  constructor(properties: Record<string, unknown>, canvas: CanvasElement) {
    super('CanvasTrapNation', { ...CanvasTrapNation.defaultProperties, ...properties });

    this.canvas = canvas;
    this.context = this.canvas.getContext('2d') as CanvasContext;
    this.initParticles();
  }

  initParticles() {
    const count = (this.properties.particleCount as number) || 100;
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * 854,
        y: Math.random() * 480,
        size: Math.random() * 2 + 0.5,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -Math.random() * 0.8 - 0.2, // Move upwards
        alpha: Math.random() * 0.6 + 0.2,
      });
    }
  }

  updateImage() {
    const { src } = this.properties as Record<string, string>;
    if (src && src !== this.currentSrc) {
      this.currentSrc = src;
      this.image = new Image();
      this.image.crossOrigin = 'anonymous';
      this.image.src = src;
    } else if (!src) {
      this.image = null;
      this.currentSrc = '';
    }
  }

  render(fft: Float32Array | number[]) {
    this.updateImage();

    const { canvas, context } = this;
    const {
      radius,
      barWidth,
      barCount,
      color,
      bassPulsing,
      bassSensitivity,
      mirrorMode,
      particleCount,
    } = this.properties as Record<string, unknown>;

    const r = radius as number;
    const bw = barWidth as number;
    const count = barCount as number;
    const sensitivity = bassSensitivity as number;
    const isPulsing = bassPulsing as boolean;
    const isMirror = mirrorMode as boolean;

    const width = 854;
    const height = 480;

    resetCanvas(canvas, width, height);

    const ctx = context as CanvasRenderingContext2D;
    const cx = width / 2;
    const cy = height / 2;

    // 1. Draw and update background particles
    if (this.particles.length !== particleCount) {
      this.initParticles();
    }

    ctx.save();
    for (const p of this.particles) {
      // Update particle position
      p.x += p.vx;
      p.y += p.vy;

      // Wrap around screen
      if (p.y < 0) {
        p.y = height;
        p.x = Math.random() * width;
      }
      if (p.x < 0 || p.x > width) {
        p.x = Math.random() * width;
      }

      ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 2. Parse bass from FFT for pulsing
    let bass = 0;
    if (fft.length > 0) {
      const bassCount = Math.min(6, fft.length);
      let sum = 0;
      for (let i = 0; i < bassCount; i++) {
        sum += fft[i] || 0;
      }
      bass = sum / bassCount;
    }

    const pulseMultiplier = isPulsing ? 1.0 + bass * sensitivity * 0.25 : 1.0;
    const activeRadius = r * pulseMultiplier;

    // 3. Render circular spectrum
    ctx.save();

    if (Array.isArray(color)) {
      const gradient = ctx.createRadialGradient(cx, cy, activeRadius, cx, cy, activeRadius + 80);
      for (let i = 0; i < (color as string[]).length; i++) {
        gradient.addColorStop(i / ((color as string[]).length - 1), (color as string[])[i]);
      }
      ctx.fillStyle = gradient;
    } else {
      ctx.fillStyle = color as string;
    }

    if (isMirror) {
      // Mirror mode: render only bottom 180° (from left to right, i.e. 0 to π)
      // and mirror bars symmetrically: left side mirrors right side
      const halfCount = Math.floor(count / 2);
      const values = new Float32Array(halfCount);
      const dataLen = fft.length;
      for (let i = 0; i < halfCount; i++) {
        const dataIndex = Math.floor((i / halfCount) * dataLen);
        values[i] = clamp(fft[dataIndex] || 0, 0, 1);
      }

      for (let i = 0; i < halfCount; i++) {
        const val = values[i];
        const barHeight = val * 80 * (1.0 + bass * 0.5);
        if (barHeight < 1) continue;

        // Map i to angle range: bottom half spread from -π/2 to π/2 (right side)
        // Mirror: i=0 at right (angle=0), i=halfCount-1 at left (angle=π)
        const t = i / (halfCount - 1); // 0..1
        const angleRight = t * Math.PI; // 0 to π (bottom half: right to left going down)

        // Right bar (angle from 0 → π, i.e. 3 o'clock → 9 o'clock going bottom)
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angleRight);
        ctx.fillRect(-bw / 2, -activeRadius, bw, -barHeight);
        ctx.restore();

        // Mirror bar (top half: -π to 0, i.e. 9 o'clock → 3 o'clock going top)
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-angleRight);
        ctx.fillRect(-bw / 2, -activeRadius, bw, -barHeight);
        ctx.restore();
      }
    } else {
      // Full 360° mode (original)
      const values = new Float32Array(count);
      const dataLen = fft.length;
      for (let i = 0; i < count; i++) {
        const dataIndex = Math.floor((i / count) * dataLen);
        values[i] = clamp(fft[dataIndex] || 0, 0, 1);
      }

      const angleStep = (Math.PI * 2) / count;
      for (let i = 0; i < count; i++) {
        const val = values[i];
        const barHeight = val * 80 * (1.0 + bass * 0.5);
        if (barHeight < 1) continue;

        const angle = angleStep * i - Math.PI / 2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.fillRect(-bw / 2, -activeRadius, bw, -barHeight);
        ctx.restore();
      }
    }

    ctx.restore();

    // 4. Render Center Logo
    if (this.image && this.image.naturalWidth > 0) {
      ctx.save();
      const imgSize = activeRadius * 1.6;

      // Draw circular clipping path for logo
      ctx.beginPath();
      ctx.arc(cx, cy, activeRadius - 4, 0, Math.PI * 2);
      ctx.clip();

      ctx.drawImage(this.image, cx - imgSize / 2, cy - imgSize / 2, imgSize, imgSize);
      ctx.restore();

      // Add clean border ring
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, activeRadius - 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}
