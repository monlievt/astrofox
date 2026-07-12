import Entity from '@/lib/core/Entity';
import type { CanvasContext, CanvasElement } from '@/lib/types';
import { resetCanvas } from '@/lib/utils/canvas';
import { clamp } from '@/lib/utils/math';

interface Ring {
  baseRadius: number;
  bandStart: number;
  bandEnd: number;
  hue: number;
}

export default class CanvasRippleRings extends Entity {
  canvas: CanvasElement;
  context: CanvasContext;
  rippleTrail: { radius: number; alpha: number; hue: number; x: number; y: number }[] = [];

  static defaultProperties = {
    ringCount: 10,
    baseRadius: 30,
    ringSpacing: 20,
    color: '#7c3aed',
    colorEnd: '#00ffff',
    strokeWidth: 2.0,
    sensitivity: 1.5,
    glowIntensity: 8,
    rippleSpeed: 1.5,
    x: 0,
    y: 0,
  };

  constructor(properties: Record<string, unknown>, canvas: CanvasElement) {
    super('CanvasRippleRings', { ...CanvasRippleRings.defaultProperties, ...properties });
    this.canvas = canvas;
    this.context = this.canvas.getContext('2d') as CanvasContext;
  }

  render(fft: Float32Array | number[]) {
    const { canvas, context } = this;
    const {
      ringCount,
      baseRadius,
      ringSpacing,
      color,
      colorEnd,
      strokeWidth,
      sensitivity,
      glowIntensity,
      rippleSpeed,
      x: offsetX,
      y: offsetY,
    } = this.properties as Record<string, unknown>;

    const width = 854;
    const height = 480;
    const cx = width / 2 + (offsetX as number);
    const cy = height / 2 - (offsetY as number);

    resetCanvas(canvas, width, height);
    const ctx = context as CanvasRenderingContext2D;

    const count = ringCount as number;
    const dataLen = fft.length;
    const sens = sensitivity as number;
    const glow = glowIntensity as number;
    const baseR = baseRadius as number;
    const spacing = ringSpacing as number;
    const lw = strokeWidth as number;

    // Parse color for interpolation
    const hexToRgb = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return [r, g, b];
    };

    const colStart = hexToRgb((color as string).startsWith('#') ? (color as string) : '#7c3aed');
    const colEnd = hexToRgb(
      (colorEnd as string).startsWith('#') ? (colorEnd as string) : '#00ffff',
    );

    // Draw concentric rings, each reacting to a different frequency band
    for (let i = 0; i < count; i++) {
      const t = i / Math.max(count - 1, 1); // 0..1

      // Map ring i to a frequency band
      const bandStart = Math.floor((i / count) * dataLen);
      const bandEnd = Math.floor(((i + 1) / count) * dataLen);
      let energy = 0;
      for (let j = bandStart; j < bandEnd && j < dataLen; j++) {
        energy += (fft[j] as number) || 0;
      }
      energy /= Math.max(bandEnd - bandStart, 1);
      const amplitude = clamp(energy * sens, 0, 1.5);

      // Base ring radius + displacement from audio energy
      const r = baseR + i * spacing + amplitude * 50;

      // Interpolate color between colorStart and colorEnd
      const R = Math.round(colStart[0] + t * (colEnd[0] - colStart[0]));
      const G = Math.round(colStart[1] + t * (colEnd[1] - colStart[1]));
      const B = Math.round(colStart[2] + t * (colEnd[2] - colStart[2]));
      const alpha = clamp(1.0 - t * 0.4 + amplitude * 0.3, 0.1, 1.0);

      ctx.save();
      ctx.strokeStyle = `rgba(${R},${G},${B},${alpha})`;
      ctx.lineWidth = lw * (1 + amplitude * 0.5);
      ctx.shadowColor = `rgb(${R},${G},${B})`;
      ctx.shadowBlur = glow * (1 + amplitude);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}
