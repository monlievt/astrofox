import Entity from '@/lib/core/Entity';
import type { CanvasContext, CanvasElement } from '@/lib/types';
import { resetCanvas } from '@/lib/utils/canvas';

interface Particle {
  x: number;
  y: number;
  z: number;
  color: string;
}

export default class CanvasStarfield extends Entity {
  canvas: CanvasElement;
  context: CanvasContext;
  stars: Particle[] = [];

  static defaultProperties = {
    baseSpeed: 2.0,
    musicSensitivity: 0.5,
    starColor: '#FFFFFF',
    starSize: 2.0,
    gravity: 0.0,
    particleCount: 200,
  };

  constructor(properties: Record<string, unknown>, canvas: CanvasElement) {
    super('CanvasStarfield', { ...CanvasStarfield.defaultProperties, ...properties });

    this.canvas = canvas;
    this.context = this.canvas.getContext('2d') as CanvasContext;
    this.initStars();
  }

  initStars() {
    const count = (this.properties.particleCount as number) || 200;
    this.stars = [];
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: Math.random() * 2 - 1,
        y: Math.random() * 2 - 1,
        z: Math.random(),
        color: this.properties.starColor as string,
      });
    }
  }

  render(gain: number) {
    const { canvas, context } = this;
    const { baseSpeed, musicSensitivity, starColor, starSize, gravity, particleCount } = this
      .properties as Record<string, unknown>;

    // musicSensitivity=0 means constant speed, higher values = more reactive
    const sensitivity = (musicSensitivity as number) ?? 0.5;
    const speed = (baseSpeed as number) * (1.0 + gain * sensitivity);
    const size = starSize as number;
    const grav = gravity as number;

    const width = 854;
    const height = 480;

    resetCanvas(canvas, width, height);

    const ctx = context as CanvasRenderingContext2D;
    const cx = width / 2;
    const cy = height / 2;

    // Reinitialize if particle count changed
    if (this.stars.length !== particleCount) {
      this.initStars();
    }

    ctx.fillStyle = starColor as string;

    for (const star of this.stars) {
      // Move star closer (decrease z)
      star.z -= speed * 0.002;

      // If star goes off-screen or gets too close, reset it to the background
      if (star.z <= 0) {
        star.x = Math.random() * 2 - 1;
        star.y = Math.random() * 2 - 1;
        star.z = 1.0;
      }

      // Apply gravity to the y coordinate
      if (grav !== 0) {
        star.y += grav * 0.005 * (1.0 - star.z);
      }

      // Project 3D coordinate to 2D
      const px = cx + (star.x * cx) / star.z;
      const py = cy + (star.y * cy) / star.z;

      // Check if within bounds
      if (px >= 0 && px < width && py >= 0 && py < height) {
        const currentSize = size * (1.0 - star.z) + 0.5;
        ctx.beginPath();
        ctx.arc(px, py, Math.max(0.5, currentSize), 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Reset if offscreen
        star.x = Math.random() * 2 - 1;
        star.y = Math.random() * 2 - 1;
        star.z = 1.0;
      }
    }
  }
}
