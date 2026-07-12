import Entity from '@/lib/core/Entity';
import type { CanvasContext, CanvasElement } from '@/lib/types';
import { resetCanvas } from '@/lib/utils/canvas';
import { clamp } from '@/lib/utils/math';

type LedMode = 'Block' | 'LED' | 'Rounded' | 'Split';

export default class CanvasLEDSpectrum extends Entity {
  canvas: CanvasElement;
  context: CanvasContext;
  smoothedValues: Float32Array = new Float32Array(0);
  peakValues: Float32Array = new Float32Array(0);
  peakHoldTimers: Float32Array = new Float32Array(0);

  static defaultProperties = {
    mode: 'LED' as LedMode,
    barCount: 64,
    barWidth: 10,
    barGap: 2,
    ledCount: 20,
    ledGap: 2,
    colorStart: '#00ff00',
    colorMid: '#ffff00',
    colorEnd: '#ff0000',
    showPeaks: true,
    peakColor: '#ffffff',
    smoothing: 0.75,
    sensitivity: 1.2,
    x: 0,
    y: 0,
    width: 854,
    height: 200,
    opacity: 1.0,
  };

  constructor(properties: Record<string, unknown>, canvas: CanvasElement) {
    super('CanvasLEDSpectrum', { ...CanvasLEDSpectrum.defaultProperties, ...properties });
    this.canvas = canvas;
    this.context = this.canvas.getContext('2d') as CanvasContext;
  }

  initBuffers(count: number) {
    if (this.smoothedValues.length !== count) {
      this.smoothedValues = new Float32Array(count);
      this.peakValues = new Float32Array(count);
      this.peakHoldTimers = new Float32Array(count);
    }
  }

  render(fft: Float32Array | number[]) {
    const { canvas, context } = this;
    const {
      mode,
      barCount,
      barWidth,
      barGap,
      ledCount,
      ledGap,
      colorStart,
      colorMid,
      colorEnd,
      showPeaks,
      peakColor,
      smoothing,
      sensitivity,
      x: offsetX,
      y: offsetY,
      width: dispWidth,
      height: dispHeight,
    } = this.properties as Record<string, unknown>;

    const W = 854;
    const H = 480;
    resetCanvas(canvas, W, H);
    const ctx = context as CanvasRenderingContext2D;

    const count = barCount as number;
    const bw = barWidth as number;
    const bg = barGap as number;
    const lc = ledCount as number;
    const lg = ledGap as number;
    const dw = dispWidth as number;
    const dh = dispHeight as number;
    const sens = sensitivity as number;
    const smooth = smoothing as number;
    const renderMode = mode as LedMode;
    const hasPeak = showPeaks as boolean;
    const pColor = peakColor as string;

    this.initBuffers(count);

    // Center the display
    const startX = W / 2 + (offsetX as number) - dw / 2;
    const baseY = H / 2 - (offsetY as number);

    // Get FFT values, map to bar count, smooth
    const dataLen = fft.length;
    for (let i = 0; i < count; i++) {
      const dataIdx = Math.floor((i / count) * dataLen);
      const raw = clamp(((fft[dataIdx] as number) || 0) * sens, 0, 1);
      this.smoothedValues[i] = this.smoothedValues[i] * smooth + raw * (1 - smooth);

      // Peak hold
      if (this.smoothedValues[i] >= this.peakValues[i]) {
        this.peakValues[i] = this.smoothedValues[i];
        this.peakHoldTimers[i] = 30;
      } else {
        if (this.peakHoldTimers[i] > 0) this.peakHoldTimers[i]--;
        else this.peakValues[i] = Math.max(0, this.peakValues[i] - 0.01);
      }
    }

    // Color helper: interpolate 3-stop gradient (green → yellow → red)
    const parseHex = (h: string) => [
      parseInt(h.slice(1, 3), 16),
      parseInt(h.slice(3, 5), 16),
      parseInt(h.slice(5, 7), 16),
    ];
    const cs = parseHex((colorStart as string) || '#00ff00');
    const cm = parseHex((colorMid as string) || '#ffff00');
    const ce = parseHex((colorEnd as string) || '#ff0000');

    const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);

    const barColor = (val: number): string => {
      const t = clamp(val, 0, 1);
      let r, g, b;
      if (t < 0.5) {
        const t2 = t * 2;
        r = lerp(cs[0], cm[0], t2);
        g = lerp(cs[1], cm[1], t2);
        b = lerp(cs[2], cm[2], t2);
      } else {
        const t2 = (t - 0.5) * 2;
        r = lerp(cm[0], ce[0], t2);
        g = lerp(cm[1], ce[1], t2);
        b = lerp(cm[2], ce[2], t2);
      }
      return `rgb(${r},${g},${b})`;
    };

    const totalBarWidth = bw + bg;

    for (let i = 0; i < count; i++) {
      const val = this.smoothedValues[i];
      const barH = val * dh;
      const bx = startX + i * totalBarWidth;

      if (renderMode === 'Block') {
        // Solid filled bar
        ctx.fillStyle = barColor(val);
        ctx.fillRect(bx, baseY - barH, bw, barH);
      } else if (renderMode === 'LED') {
        // LED segments growing from bottom baseline upwards
        const ledH = (dh - lg * (lc - 1)) / lc;
        const activeLeds = Math.round(val * lc);
        for (let j = 0; j < activeLeds; j++) {
          const ledY = baseY - (j + 1) * (ledH + lg) + lg;
          const ledVal = j / lc;
          ctx.fillStyle = barColor(ledVal);
          ctx.fillRect(bx, ledY, bw, ledH);
        }
      } else if (renderMode === 'Rounded') {
        // Rounded bars
        const radius = bw / 2;
        ctx.fillStyle = barColor(val);
        ctx.beginPath();
        if (barH > bw) {
          ctx.roundRect(bx, baseY - barH, bw, barH, [radius, radius, 0, 0]);
        } else {
          ctx.arc(bx + radius, baseY - radius, radius, 0, Math.PI * 2);
        }
        ctx.fill();
      } else if (renderMode === 'Split') {
        // Split bar (up and down from center)
        const halfH = barH / 2;
        ctx.fillStyle = barColor(val);
        ctx.fillRect(bx, baseY - halfH, bw, halfH);
        ctx.fillStyle = barColor(val * 0.7);
        ctx.fillRect(bx, baseY, bw, halfH);
      }

      // Peak indicator
      if (hasPeak && this.peakValues[i] > 0.02) {
        const peakY = baseY - this.peakValues[i] * dh;
        ctx.fillStyle = pColor;
        ctx.fillRect(bx, peakY - 2, bw, 2);
      }
    }
  }
}
