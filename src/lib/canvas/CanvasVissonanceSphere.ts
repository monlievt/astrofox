import Entity from '@/lib/core/Entity';
import type { CanvasContext, CanvasElement } from '@/lib/types';
import { resetCanvas } from '@/lib/utils/canvas';
import { clamp } from '@/lib/utils/math';

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// Wireframe sphere with neon glow — Vissonance style
export default class CanvasVissonanceSphere extends Entity {
  canvas: CanvasElement;
  context: CanvasContext;

  rotX = 0;
  rotY = 0;
  time = 0;
  baseVertices: Vec3[] = [];
  edges: [number, number][] = [];

  static defaultProperties = {
    radius: 130,
    lineColor: '#00ffff',
    glowColor: '#00ffff',
    glowIntensity: 18,
    sensitivity: 1.2,
    detail: 24,
    rotationSpeedX: 0.2,
    rotationSpeedY: 0.5,
    displacementScale: 60,
    x: 0,
    y: 0,
  };

  constructor(properties: Record<string, unknown>, canvas: CanvasElement) {
    super('CanvasVissonanceSphere', { ...CanvasVissonanceSphere.defaultProperties, ...properties });
    this.canvas = canvas;
    this.context = this.canvas.getContext('2d') as CanvasContext;
    this.buildSphere((properties.detail as number) || 24);
  }

  buildSphere(detail: number) {
    const lat = Math.max(6, Math.floor(detail / 2));
    const lon = detail;
    this.baseVertices = [];
    this.edges = [];

    // Build lat/lon grid vertices
    for (let i = 0; i <= lat; i++) {
      for (let j = 0; j <= lon; j++) {
        const theta = (i / lat) * Math.PI;
        const phi = (j / lon) * Math.PI * 2;
        this.baseVertices.push({
          x: Math.sin(theta) * Math.cos(phi),
          y: Math.cos(theta),
          z: Math.sin(theta) * Math.sin(phi),
        });
      }
    }

    // Build edges (latitude lines + longitude lines)
    for (let i = 0; i <= lat; i++) {
      for (let j = 0; j < lon; j++) {
        const a = i * (lon + 1) + j;
        const b = a + 1;
        this.edges.push([a, b]); // longitude edge
        if (i < lat) {
          const c = (i + 1) * (lon + 1) + j;
          this.edges.push([a, c]); // latitude edge
        }
      }
    }
  }

  project(v: Vec3, fov: number, cx: number, cy: number): [number, number, number] {
    // Y rotation
    const cosY = Math.cos(this.rotY);
    const sinY = Math.sin(this.rotY);
    const x1 = v.x * cosY - v.z * sinY;
    const z1 = v.x * sinY + v.z * cosY;
    // X rotation
    const cosX = Math.cos(this.rotX);
    const sinX = Math.sin(this.rotX);
    const y2 = v.y * cosX - z1 * sinX;
    const z2 = v.y * sinX + z1 * cosX;

    const depth = z2 + 3;
    const scale = fov / depth;
    return [cx + x1 * scale, cy - y2 * scale, depth];
  }

  render(fft: Float32Array | number[]) {
    const { canvas, context } = this;
    const {
      radius,
      lineColor,
      glowColor,
      glowIntensity,
      sensitivity,
      detail,
      rotationSpeedX,
      rotationSpeedY,
      displacementScale,
      x: offsetX,
      y: offsetY,
    } = this.properties as Record<string, unknown>;

    const width = 854;
    const height = 480;
    const cx = width / 2 + (offsetX as number);
    const cy = height / 2 - (offsetY as number);

    resetCanvas(canvas, width, height);
    const ctx = context as CanvasRenderingContext2D;

    this.time++;

    // Rebuild sphere if detail changed
    const det = detail as number;

    const fLen = fft.length;
    const bassEnd = Math.floor(fLen * 0.05);
    let bass = 0;
    for (let i = 0; i < bassEnd; i++) bass += (fft[i] as number) || 0;
    bass = clamp((bass / bassEnd) * (sensitivity as number), 0, 2);

    // Compute overall energy for rotation speed boost
    let totalEnergy = 0;
    for (let i = 0; i < fLen; i++) totalEnergy += (fft[i] as number) || 0;
    totalEnergy /= fLen;

    // Advance rotation
    this.rotY += (rotationSpeedY as number) * 0.008 * (1 + bass * 0.5);
    this.rotX += (rotationSpeedX as number) * 0.004 * (1 + totalEnergy * 0.3);

    const r = radius as number;
    const fov = r * 2.5;
    const dispScale = displacementScale as number;

    // Displace vertices by FFT
    const displaced: Vec3[] = this.baseVertices.map((v, i) => {
      const bandIdx = Math.floor((i / this.baseVertices.length) * fLen);
      const binVal = clamp((fft[bandIdx] as number) || 0, 0, 1);
      const disp = r + binVal * dispScale * (sensitivity as number);
      return { x: v.x * disp, y: v.y * disp, z: v.z * disp };
    });

    const projected = displaced.map(v => this.project(v, fov, cx, cy));

    const col = lineColor as string;
    const glow = glowColor as string;
    const glowBlur = (glowIntensity as number) * (1 + bass * 0.8);

    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = glowBlur;
    ctx.strokeStyle = col;

    // Draw edges, vary alpha by depth
    for (const [aIdx, bIdx] of this.edges) {
      const pa = projected[aIdx];
      const pb = projected[bIdx];
      if (!pa || !pb) continue;

      // Skip back-facing edges (both behind camera)
      if (pa[2] < 0.5 || pb[2] < 0.5) continue;

      // Depth-based alpha: closer = brighter
      const avgDepth = (pa[2] + pb[2]) / 2;
      const alpha = clamp(1.2 - avgDepth * 0.2, 0.05, 1.0);

      ctx.globalAlpha = alpha;
      ctx.lineWidth = 0.5 + bass * 0.5;
      ctx.beginPath();
      ctx.moveTo(pa[0], pa[1]);
      ctx.lineTo(pb[0], pb[1]);
      ctx.stroke();
    }

    ctx.restore();
  }
}
