import Display from '@/lib/core/Display';
import { stageHeight, stageWidth } from '@/lib/utils/controls';

export default class MandalaDisplay extends Display {
  static config = {
    name: 'MandalaDisplay',
    description:
      'Glowing Sacred Geometry Mandala — Multiple concentric polygons and overlapping circles that rotate and pulsate in perfect symmetry to different audio frequency bands. Perfect for meditation and binaural beats.',
    type: 'display',
    label: 'Sacred Mandala (2D)',
    defaultProperties: {
      symmetry: 8,
      scale: 180,
      complexity: 3,
      lineWidth: 1.5,
      color: ['#ff0055', '#7000ff'],
      glowColor: '#ff0055',
      glowIntensity: 15,
      rotationSpeed: 0.4,
      sensitivity: 1.2,
      pulseMode: 'Bass', // 'Bass' | 'Energy' | 'None'
      width: 854,
      height: 480,
      x: 0,
      y: 0,
      opacity: 1.0,
    },
    controls: {
      symmetry: {
        label: 'Symmetry (Petals)',
        type: 'number',
        min: 4,
        max: 24,
        step: 1,
        withRange: true,
      },
      scale: {
        label: 'Outer Radius',
        type: 'number',
        min: 20,
        max: 400,
        step: 5,
        withRange: true,
      },
      complexity: {
        label: 'Geometric Layers',
        type: 'number',
        min: 1,
        max: 6,
        step: 1,
        withRange: true,
      },
      lineWidth: {
        label: 'Line Width',
        type: 'number',
        min: 0.5,
        max: 6.0,
        step: 0.5,
        withRange: true,
      },
      color: {
        label: 'Color Gradient',
        type: 'color',
        isGradient: true,
      },
      glowColor: {
        label: 'Glow Color',
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
      rotationSpeed: {
        label: 'Rotation Speed',
        type: 'number',
        min: 0,
        max: 3.0,
        step: 0.05,
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
      pulseMode: {
        label: 'Pulse Mode',
        type: 'select',
        options: ['Bass', 'Energy', 'None'],
      },
      width: {
        label: 'Width',
        type: 'number',
        min: 100,
        max: 1920,
        step: 10,
        withRange: true,
      },
      height: {
        label: 'Height',
        type: 'number',
        min: 100,
        max: 1080,
        step: 10,
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
        min: stageWidth(n => -n),
        max: stageWidth(),
        withRange: true,
        hideFill: true,
      },
      y: {
        label: 'Y Offset',
        type: 'number',
        min: stageHeight(n => -n),
        max: stageHeight(),
        withRange: true,
        hideFill: true,
      },
    },
  };

  constructor(properties?: Record<string, unknown>) {
    super(MandalaDisplay, properties);
  }
}
