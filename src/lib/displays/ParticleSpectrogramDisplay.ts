import Display from '@/lib/core/Display';
import { stageHeight, stageWidth } from '@/lib/utils/controls';

export default class ParticleSpectrogramDisplay extends Display {
  static config = {
    name: 'ParticleSpectrogramDisplay',
    description:
      '3D Scrolling Particle Spectrogram — A flowing 3D landscape of glowing dots where audio frequencies enter from the right and scroll horizontally to the left, creating a real-time waterfall of music peaks.',
    type: 'display',
    label: 'Spectrogram Terrain (3D)',
    defaultProperties: {
      columns: 60,
      rows: 32,
      spacingX: 12,
      spacingZ: 16,
      amplitude: 140,
      particleSize: 5.0,
      colorA: '#a855f7', // Purple
      colorB: '#00f0ff', // Cyan
      glowIntensity: 25,
      scrollSpeed: 1.0,
      sensitivity: 1.4,
      opacity: 1.0,
      x: 0,
      y: -140,
      z: -380,
    },
    controls: {
      columns: {
        label: 'History Columns (Width)',
        type: 'number',
        min: 20,
        max: 100,
        step: 2,
        withRange: true,
      },
      rows: {
        label: 'Frequency Bands (Depth)',
        type: 'number',
        min: 8,
        max: 64,
        step: 2,
        withRange: true,
      },
      spacingX: {
        label: 'Spacing X',
        type: 'number',
        min: 5,
        max: 30,
        step: 1,
        withRange: true,
      },
      spacingZ: {
        label: 'Spacing Z',
        type: 'number',
        min: 5,
        max: 30,
        step: 1,
        withRange: true,
      },
      amplitude: {
        label: 'Peak Height',
        type: 'number',
        min: 10,
        max: 400,
        step: 5,
        withRange: true,
      },
      particleSize: {
        label: 'Dot Size',
        type: 'number',
        min: 1.0,
        max: 30.0,
        step: 0.5,
        withRange: true,
      },
      colorA: {
        label: 'Spectrum Peak Color',
        type: 'color',
      },
      colorB: {
        label: 'Spectrum Base Color',
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
      scrollSpeed: {
        label: 'Scroll Speed',
        type: 'number',
        min: 0.2,
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
    super(ParticleSpectrogramDisplay, properties);
  }
}
