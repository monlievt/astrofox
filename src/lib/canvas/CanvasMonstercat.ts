import Entity from '@/lib/core/Entity';
import type { CanvasContext, CanvasElement } from '@/lib/types';
import { resetCanvas } from '@/lib/utils/canvas';
import { clamp } from '@/lib/utils/math';

interface Particle {
  x: number;
  y: number;
  size: number;
  vy: number;
  alpha: number;
}

export default class CanvasMonstercat extends Entity {
  canvas: CanvasElement;
  context: CanvasContext;
  particles: Particle[] = [];

  static defaultProperties = {
    width: 800,
    height: 200,
    barWidth: 8,
    barSpacing: 4,
    color: ['#ffffff', '#cccccc'],
    particleCount: 80,
    particleSpeed: 1.0,
    align: 'bottom',
  };

  constructor(properties: Record<string, unknown>, canvas: CanvasElement) {
    super('CanvasMonstercat', { ...CanvasMonstercat.defaultProperties, ...properties });

    this.canvas = canvas;
    this.context = this.canvas.getContext('2d') as CanvasContext;
    this.initParticles();
  }

  initParticles() {
    const count = (this.properties.particleCount as number) || 80;
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * 854,
        y: Math.random() * 480,
        size: Math.random() * 1.5 + 0.5,
        vy: Math.random() * 0.4 + 0.2, // slow falling
        alpha: Math.random() * 0.5 + 0.1,
      });
    }
  }

  render(fft: Float32Array | number[]) {
    const { canvas, context } = this;
    const { width, height, barWidth, barSpacing, color, particleCount, particleSpeed, align } = this
      .properties as Record<string, unknown>;

    const w = width as number;
    const h = height as number;
    const bw = barWidth as number;
    const bs = barSpacing as number;
    const pCount = particleCount as number;
    const speed = particleSpeed as number;
    const alignment = align as string;

    const totalWidth = 854;
    const totalHeight = 480;

    resetCanvas(canvas, totalWidth, totalHeight);

    const ctx = context as CanvasRenderingContext2D;

    // 1. Draw falling particles (Snow/Dust)
    if (this.particles.length !== pCount) {
      this.initParticles();
    }

    ctx.save();
    for (const p of this.particles) {
      p.y += p.vy * speed;
      // add slight side drift
      p.x += (Math.random() - 0.5) * 0.1;

      if (p.y > totalHeight) {
        p.y = 0;
        p.x = Math.random() * totalWidth;
      }
      if (p.x < 0 || p.x > totalWidth) {
        p.x = Math.random() * totalWidth;
      }

      ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 2. Draw vertical bars
    const barCount = Math.floor(w / (bw + bs));
    const values = new Float32Array(barCount);
    const dataLen = fft.length;
    for (let i = 0; i < barCount; i++) {
      const dataIndex = Math.floor((i / barCount) * dataLen);
      values[i] = clamp(fft[dataIndex] || 0, 0, 1);
    }

    ctx.save();
    // Center the equalizer horizontally
    const startX = (totalWidth - (barCount * (bw + bs) - bs)) / 2;
    const startY = totalHeight - 120; // default baseline

    if (Array.isArray(color)) {
      const gradient = ctx.createLinearGradient(0, startY - h, 0, startY);
      for (let i = 0; i < (color as string[]).length; i++) {
        gradient.addColorStop(i / ((color as string[]).length - 1), (color as string[])[i]);
      }
      ctx.fillStyle = gradient;
    } else {
      ctx.fillStyle = color as string;
    }

    for (let i = 0; i < barCount; i++) {
      const val = values[i];
      const barHeight = val * h;

      if (barHeight < 1) continue;

      const x = startX + i * (bw + bs);

      if (alignment === 'center') {
        const y = startY - barHeight / 2;
        ctx.fillRect(x, y, bw, barHeight);
      } else {
        const y = startY - barHeight;
        ctx.fillRect(x, y, bw, barHeight);
      }
    }
    ctx.restore();
  }
}
