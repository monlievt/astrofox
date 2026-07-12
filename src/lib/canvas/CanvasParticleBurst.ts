import Entity from '@/lib/core/Entity';
import type { CanvasContext, CanvasElement } from '@/lib/types';
import { resetCanvas } from '@/lib/utils/canvas';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: number;
  saturation: number;
}

export default class CanvasParticleBurst extends Entity {
  canvas: CanvasElement;
  context: CanvasContext;
  trailCanvas: HTMLCanvasElement;
  trailCtx: CanvasRenderingContext2D;
  particles: Particle[] = [];
  lastBass = 0;
  beatCooldown = 0;

  // Dynamic running average for self-calibrating beat detection
  bassAverage = 0.15;

  static defaultProperties = {
    burstCount: 120,
    particleSize: 4.5,
    particleSpeed: 14.0,
    lifetime: 100,
    colorA: '#ff007f',
    colorB: '#704dd8',
    beatThreshold: 0.35,
    trailFade: 0.06,
    glowIntensity: 18,
    sensitivity: 1.8,
    x: 0,
    y: 0,
  };

  constructor(properties: Record<string, unknown>, canvas: CanvasElement) {
    super('CanvasParticleBurst', { ...CanvasParticleBurst.defaultProperties, ...properties });
    this.canvas = canvas;
    this.context = this.canvas.getContext('2d') as CanvasContext;

    this.trailCanvas = document.createElement('canvas');
    this.trailCanvas.width = canvas.width || 854;
    this.trailCanvas.height = canvas.height || 480;
    this.trailCtx = this.trailCanvas.getContext('2d') as CanvasRenderingContext2D;
  }

  burst(
    cx: number,
    cy: number,
    count: number,
    speed: number,
    size: number,
    lifetime: number,
    colorA: string,
    colorB: string,
  ) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = speed * (0.3 + Math.random() * 0.7);
      const hue = Math.random() < 0.5 ? this.hexToHue(colorA) : this.hexToHue(colorB);

      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: lifetime,
        maxLife: lifetime,
        size: size * (0.5 + Math.random()),
        hue,
        saturation: 80 + Math.random() * 20,
      });
    }
  }

  hexToHue(hex: string): number {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    const d = max - min;
    if (d !== 0) {
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    return h * 360;
  }

  render(fft: Float32Array | number[]) {
    const { canvas, context } = this;
    const {
      burstCount,
      particleSize,
      particleSpeed,
      lifetime,
      colorA,
      colorB,
      beatThreshold,
      trailFade,
      glowIntensity,
      sensitivity,
      x: offsetX,
      y: offsetY,
    } = this.properties as Record<string, unknown>;

    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2 + (offsetX as number);
    const cy = height / 2 - (offsetY as number);

    resetCanvas(canvas, width, height);
    const ctx = context as CanvasRenderingContext2D;
    const tCtx = this.trailCtx;

    if (this.trailCanvas.width !== width || this.trailCanvas.height !== height) {
      this.trailCanvas.width = width;
      this.trailCanvas.height = height;
    }

    // Compute bass energy and apply sensitivity
    const bassEnd = Math.min(8, fft.length);
    let bass = 0;
    for (let i = 0; i < bassEnd; i++) bass += (fft[i] as number) || 0;
    bass = (bass / bassEnd) * Number(sensitivity || 1.8);

    // Dynamic auto-thresholding running average
    this.bassAverage = this.bassAverage * 0.98 + bass * 0.02;

    // Self-calibrating trigger
    const thresholdFactor = beatThreshold as number;
    const triggerRatio = 1.1 + thresholdFactor * 0.45;
    const isBeat = bass > this.bassAverage * triggerRatio && bass > 0.1 && this.beatCooldown <= 0;

    if (isBeat) {
      // DYNAMIC EXPLOSION SPEED: particles shoot outward with velocity proportional to beat loudness
      const dynamicSpeed = (particleSpeed as number) * (0.35 + bass * 1.25);

      this.burst(
        cx,
        cy,
        burstCount as number,
        dynamicSpeed,
        particleSize as number,
        lifetime as number,
        colorA as string,
        colorB as string,
      );
      this.beatCooldown = 7;
    }
    this.lastBass = bass;
    if (this.beatCooldown > 0) this.beatCooldown--;

    // Continuous reactive spawning of ambient sparks
    const spawnChance = Math.min(0.85, bass * 1.5);
    if (Math.random() < spawnChance) {
      const count = Math.max(1, Math.floor(bass * 3));
      // DYNAMIC AMBIENT DRIFT SPEED: drifting velocity matches real-time music volume
      const dynamicAmbientSpeed = (particleSpeed as number) * (0.1 + bass * 0.6);

      this.burst(
        cx,
        cy,
        count,
        dynamicAmbientSpeed,
        (particleSize as number) * 0.7,
        (lifetime as number) * 0.8,
        colorA as string,
        colorB as string,
      );
    }

    // Clean, direct pixel alpha decay
    try {
      const imgData = tCtx.getImageData(0, 0, width, height);
      const data = imgData.data;
      const decay = 1 - (trailFade as number);
      for (let i = 3; i < data.length; i += 4) {
        data[i] = data[i] * decay;
      }
      tCtx.putImageData(imgData, 0, 0);
    } catch (e) {
      tCtx.save();
      tCtx.globalCompositeOperation = 'destination-out';
      tCtx.fillStyle = `rgba(255, 255, 255, ${trailFade as number})`;
      tCtx.fillRect(0, 0, width, height);
      tCtx.restore();
    }

    // Update and draw particles
    const glow = glowIntensity as number;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.992;
      p.vy *= 0.992;
      p.life--;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      const lifeRatio = p.life / p.maxLife;
      const alpha = lifeRatio;
      const currentSize = p.size * lifeRatio;

      tCtx.save();
      tCtx.globalAlpha = alpha;
      tCtx.shadowColor = `hsl(${p.hue}, ${p.saturation}%, 60%)`;
      tCtx.shadowBlur = glow * lifeRatio;
      tCtx.fillStyle = `hsl(${p.hue}, ${p.saturation}%, 60%)`;
      tCtx.beginPath();
      tCtx.arc(p.x, p.y, Math.max(0.5, currentSize), 0, Math.PI * 2);
      tCtx.fill();
      tCtx.restore();
    }

    ctx.drawImage(this.trailCanvas, 0, 0);
  }
}
