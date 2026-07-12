import Entity from '@/lib/core/Entity';
import type { CanvasContext, CanvasElement } from '@/lib/types';
import { resetCanvas } from '@/lib/utils/canvas';
import { clamp } from '@/lib/utils/math';

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// Simple 3D sphere with vertex displacement rendered via Canvas2D perspective projection
export default class CanvasMorphingSphere extends Entity {
  canvas: CanvasElement;
  context: CanvasContext;
  trailCanvas: HTMLCanvasElement;
  trailCtx: CanvasRenderingContext2D;

  rotX = 0;
  rotY = 0;

  // Base sphere vertices (icosphere-like, lat/lon grid)
  baseVertices: Vec3[] = [];
  faces: [number, number, number, number][] = []; // quad faces

  static defaultProperties = {
    radius: 120,
    colorA: '#704dd8',
    colorB: '#ff007f',
    colorC: '#00ffff',
    bassSensitivity: 1.5,
    midSensitivity: 1.0,
    trebleSensitivity: 0.8,
    wireframe: false,
    glowColor: '#704dd8',
    glowIntensity: 20,
    rotationSpeed: 0.3,
    detail: 32,
    x: 0,
    y: 0,
  };

  constructor(properties: Record<string, unknown>, canvas: CanvasElement) {
    super('CanvasMorphingSphere', { ...CanvasMorphingSphere.defaultProperties, ...properties });
    this.canvas = canvas;
    this.context = this.canvas.getContext('2d') as CanvasContext;

    this.trailCanvas = document.createElement('canvas');
    this.trailCanvas.width = 854;
    this.trailCanvas.height = 480;
    this.trailCtx = this.trailCanvas.getContext('2d') as CanvasRenderingContext2D;

    this.buildSphere((properties.detail as number) || 32);
  }

  buildSphere(detail: number) {
    const lat = Math.max(8, Math.floor(detail / 2));
    const lon = Math.max(8, detail);
    this.baseVertices = [];
    this.faces = [];

    for (let i = 0; i <= lat; i++) {
      const theta = (i / lat) * Math.PI;
      for (let j = 0; j <= lon; j++) {
        const phi = (j / lon) * Math.PI * 2;
        this.baseVertices.push({
          x: Math.sin(theta) * Math.cos(phi),
          y: Math.cos(theta),
          z: Math.sin(theta) * Math.sin(phi),
        });
      }
    }

    for (let i = 0; i < lat; i++) {
      for (let j = 0; j < lon; j++) {
        const a = i * (lon + 1) + j;
        const b = a + 1;
        const c = a + (lon + 1);
        const d = c + 1;
        this.faces.push([a, b, d, c]);
      }
    }
  }

  project(v: Vec3, fov: number, cx: number, cy: number): [number, number, number] {
    // Rotate around Y axis
    const cosY = Math.cos(this.rotY);
    const sinY = Math.sin(this.rotY);
    const x1 = v.x * cosY - v.z * sinY;
    const z1 = v.x * sinY + v.z * cosY;
    // Rotate around X axis
    const cosX = Math.cos(this.rotX);
    const sinX = Math.sin(this.rotX);
    const y2 = v.y * cosX - z1 * sinX;
    const z2 = v.y * sinX + z1 * cosX;

    const depth = z2 + 3; // perspective offset
    const scale = fov / depth;
    return [cx + x1 * scale, cy - y2 * scale, depth];
  }

  hexToRgb(hex: string): [number, number, number] {
    return [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ];
  }

  lerpColor(a: [number, number, number], b: [number, number, number], t: number): string {
    const r = Math.round(a[0] + (b[0] - a[0]) * t);
    const g = Math.round(a[1] + (b[1] - a[1]) * t);
    const bl = Math.round(a[2] + (b[2] - a[2]) * t);
    return `rgb(${r},${g},${bl})`;
  }

  render(fft: Float32Array | number[]) {
    const { canvas, context } = this;
    const {
      radius,
      colorA,
      colorB,
      colorC,
      bassSensitivity,
      midSensitivity,
      trebleSensitivity,
      wireframe,
      glowColor,
      glowIntensity,
      rotationSpeed,
      detail,
      x: offsetX,
      y: offsetY,
    } = this.properties as Record<string, unknown>;

    const width = 854;
    const height = 480;
    const cx = width / 2 + (offsetX as number);
    const cy = height / 2 - (offsetY as number);

    resetCanvas(canvas, width, height);
    const ctx = context as CanvasRenderingContext2D;

    // Rebuild sphere if detail changed
    const det = detail as number;

    // Get frequency band energies
    const fLen = fft.length;
    const bassEnd = Math.floor(fLen * 0.05);
    const midEnd = Math.floor(fLen * 0.3);

    let bass = 0,
      mid = 0,
      treble = 0;
    for (let i = 0; i < bassEnd; i++) bass += (fft[i] as number) || 0;
    bass = (bass / bassEnd) * (bassSensitivity as number);

    for (let i = bassEnd; i < midEnd; i++) mid += (fft[i] as number) || 0;
    mid = (mid / (midEnd - bassEnd)) * (midSensitivity as number);

    for (let i = midEnd; i < fLen; i++) treble += (fft[i] as number) || 0;
    treble = (treble / (fLen - midEnd)) * (trebleSensitivity as number);

    // Advance rotation
    const speed = (rotationSpeed as number) * 0.01;
    this.rotY += speed * (1 + bass * 0.5);
    this.rotX += speed * 0.4 * (1 + mid * 0.3);

    const r = radius as number;
    const fov = r * 3;

    // Compute displaced vertices
    const displaced: Vec3[] = this.baseVertices.map((v, i) => {
      // Map vertex index to FFT bin for displacement
      const bandIdx = Math.floor((i / this.baseVertices.length) * fLen);
      const binVal = (fft[bandIdx] as number) || 0;

      // Noise-like displacement: use vertex position + fft
      const noiseDisplace = binVal * (bass * 40 + mid * 20 + treble * 10);
      const displace = r + noiseDisplace;

      return {
        x: v.x * displace,
        y: v.y * displace,
        z: v.z * displace,
      };
    });

    const projected = displaced.map(v => this.project(v, fov, cx, cy));

    // Color parsing
    const cA = this.hexToRgb((colorA as string) || '#704dd8');
    const cB = this.hexToRgb((colorB as string) || '#ff007f');
    const cC = this.hexToRgb((colorC as string) || '#00ffff');

    ctx.save();
    ctx.shadowColor = glowColor as string;
    ctx.shadowBlur = (glowIntensity as number) * (1 + bass * 0.5);

    // Sort faces by depth (painter's algorithm)
    const sortedFaces = this.faces
      .map(face => {
        const avgDepth =
          (projected[face[0]][2] +
            projected[face[1]][2] +
            projected[face[2]][2] +
            projected[face[3]][2]) /
          4;
        return { face, avgDepth };
      })
      .sort((a, b) => b.avgDepth - a.avgDepth);

    for (const { face, avgDepth } of sortedFaces) {
      const [pa, pb, pc, pd] = face.map(i => projected[i]);
      if (!pa || !pb || !pc || !pd) continue;

      // Depth-based color + audio reactive color blend
      const t = clamp((avgDepth - 1) / 4, 0, 1);
      const colorMix =
        t < 0.5 ? this.lerpColor(cA, cB, t * 2) : this.lerpColor(cB, cC, (t - 0.5) * 2);

      ctx.beginPath();
      ctx.moveTo(pa[0], pa[1]);
      ctx.lineTo(pb[0], pb[1]);
      ctx.lineTo(pc[0], pc[1]);
      ctx.lineTo(pd[0], pd[1]);
      ctx.closePath();

      if (wireframe) {
        ctx.strokeStyle = colorMix;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      } else {
        ctx.fillStyle = colorMix + 'aa';
        ctx.fill();
        ctx.strokeStyle = colorMix + '44';
        ctx.lineWidth = 0.3;
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}
