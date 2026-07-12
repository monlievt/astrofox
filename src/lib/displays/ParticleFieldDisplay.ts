import Display from '@/lib/core/Display';
import { stageHeight, stageWidth } from '@/lib/utils/controls';

export default class ParticleFieldDisplay extends Display {
  static config = {
    name: 'ParticleFieldDisplay',
    description:
      '3D Particle Terrain Field — A waving grid of glowing particles in 3D space that flows like a gentle energy landscape, reacting to the audio spectrum. Ideal for meditation, ambient, and chill beats.',
    type: 'display',
    label: 'Particle Terrain (3D)',
    defaultProperties: {
      gridSize: 32,
      spacing: 24,
      amplitude: 60,
      particleSize: 4.5,
      colorA: '#00ffcc',
      colorB: '#ff00ff',
      glowIntensity: 18,
      speed: 1.0,
      sensitivity: 1.2,
      opacity: 1.0,
      x: 0,
      y: -100,
      z: -200,
    },
    controls: {
      gridSize: {
        label: 'Grid Density',
        type: 'number',
        min: 10,
        max: 64,
        step: 2,
        withRange: true,
      },
      spacing: {
        label: 'Spacing',
        type: 'number',
        min: 10,
        max: 50,
        step: 1,
        withRange: true,
      },
      amplitude: {
        label: 'Wave Height',
        type: 'number',
        min: 10,
        max: 300,
        step: 5,
        withRange: true,
      },
      particleSize: {
        label: 'Particle Size',
        type: 'number',
        min: 1.0,
        max: 20.0,
        step: 0.5,
        withRange: true,
      },
      colorA: {
        label: 'Primary Color',
        type: 'color',
      },
      colorB: {
        label: 'Secondary Color',
        type: 'color',
      },
      glowIntensity: {
        label: 'Glow Intensity',
        type: 'number',
        min: 0,
        max: 100,
        step: 1,
        withRange: true,
      },
      speed: {
        label: 'Flow Speed',
        type: 'number',
        min: 0.1,
        max: 3.0,
        step: 0.1,
        withRange: true,
      },
      sensitivity: {
        label: 'Audio Sensitivity',
        type: 'number',
        min: 0.2,
        max: 4.0,
        step: 0.1,
        withRange: true,
      },
      opacity: {
        label: 'Opacity',
        type: 'number',
        min: 0,
        max: 1.0,
        step: 0.01,
        withRange: true,
      },
      x: {
        label: 'X Offset',
        type: 'number',
        min: -600,
        max: 600,
        step: 5,
        withRange: true,
      },
      y: {
        label: 'Y Offset',
        type: 'number',
        min: -400,
        max: 400,
        step: 5,
        withRange: true,
      },
      z: {
        label: 'Z Offset',
        type: 'number',
        min: -1000,
        max: 500,
        step: 10,
        withRange: true,
      },
    },
  };

  constructor(properties?: Record<string, unknown>) {
    super(ParticleFieldDisplay, properties);
  }
}
