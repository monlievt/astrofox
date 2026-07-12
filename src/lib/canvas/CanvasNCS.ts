import Entity from '@/lib/core/Entity';
import type { CanvasContext, CanvasElement } from '@/lib/types';
import { resetCanvas } from '@/lib/utils/canvas';
import { clamp } from '@/lib/utils/math';

export default class CanvasNCS extends Entity {
  canvas: CanvasElement;
  context: CanvasContext;
  hueOffset = 0;

  static defaultProperties = {
    radius: 120,
    barWidth: 4,
    barCount: 128,
    shakeEnabled: true,
    shakeSensitivity: 1.0,
    colorMorphing: true,
    morphSpeed: 1.0,
    baseColor: ['#00d2ff', '#3a7bd5'],
  };

  constructor(properties: Record<string, unknown>, canvas: CanvasElement) {
    super('CanvasNCS', { ...CanvasNCS.defaultProperties, ...properties });

    this.canvas = canvas;
    this.context = this.canvas.getContext('2d') as CanvasContext;
  }

  render(fft: Float32Array | number[]) {
    const { canvas, context } = this;
    const {
      radius,
      barWidth,
      barCount,
      shakeEnabled,
      shakeSensitivity,
      colorMorphing,
      morphSpeed,
      baseColor,
    } = this.properties as Record<string, unknown>;

    const r = radius as number;
    const bw = barWidth as number;
    const count = barCount as number;
    const isShake = shakeEnabled as boolean;
    const shakeSens = shakeSensitivity as number;
    const isMorph = colorMorphing as boolean;
    const speed = morphSpeed as number;

    const width = 854;
    const height = 480;

    resetCanvas(canvas, width, height);

    const ctx = context as CanvasRenderingContext2D;

    // Calculate bass for screen shake
    let bass = 0;
    if (fft.length > 0) {
      const bassCount = Math.min(6, fft.length);
      let sum = 0;
      for (let i = 0; i < bassCount; i++) {
        sum += fft[i] || 0;
      }
      bass = sum / bassCount;
    }

    let cx = width / 2;
    let cy = height / 2;

    // Apply Screen Shake if bass drop is high
    if (isShake && bass > 0.4) {
      const shakeFactor = bass * shakeSens * 12;
      cx += (Math.random() - 0.5) * shakeFactor;
      cy += (Math.random() - 0.5) * shakeFactor;
    }

    // Calculate Morphed Colors
    let fillStyle: string | CanvasGradient;
    if (isMorph) {
      this.hueOffset = (this.hueOffset + speed * 0.5) % 360;
      const gradient = ctx.createRadialGradient(cx, cy, r, cx, cy, r + 80);
      gradient.addColorStop(0, `hsl(${this.hueOffset}, 90%, 55%)`);
      gradient.addColorStop(1, `hsl(${(this.hueOffset + 80) % 360}, 95%, 45%)`);
      fillStyle = gradient;
    } else {
      if (Array.isArray(baseColor)) {
        const gradient = ctx.createRadialGradient(cx, cy, r, cx, cy, r + 80);
        for (let i = 0; i < (baseColor as string[]).length; i++) {
          gradient.addColorStop(
            i / ((baseColor as string[]).length - 1),
            (baseColor as string[])[i],
          );
        }
        fillStyle = gradient;
      } else {
        fillStyle = baseColor as string;
      }
    }

    ctx.fillStyle = fillStyle;

    // Resample fft
    const values = new Float32Array(count);
    const dataLen = fft.length;
    for (let i = 0; i < count; i++) {
      const dataIndex = Math.floor((i / count) * dataLen);
      values[i] = clamp(fft[dataIndex] || 0, 0, 1);
    }

    // Draw symmetric circular bars
    ctx.save();
    const angleStep = (Math.PI * 2) / count;

    for (let i = 0; i < count; i++) {
      const val = values[i];
      const barHeight = val * 70;

      if (barHeight < 1) continue;

      const angle = angleStep * i - Math.PI / 2;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.fillRect(-bw / 2, -r, bw, -barHeight);
      ctx.restore();
    }
    ctx.restore();
  }
}
