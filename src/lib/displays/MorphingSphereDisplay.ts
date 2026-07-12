import Display from '@/lib/core/Display';
import { stageHeight, stageWidth } from '@/lib/utils/controls';

export default class MorphingSphereDisplay extends Display {
  static config = {
    name: 'MorphingSphereDisplay',
    description:
      'A morphing 3D sphere whose geometry is displaced by audio frequencies. Bass warps the shape, treble adds surface detail. Inspired by morphing-visualizer-starter + WebGL Music Visualizer.',
    type: 'display',
    label: 'Morphing Sphere',
    defaultProperties: {
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
      detail: 64,
      x: 0,
      y: 0,
      opacity: 1.0,
    },
    controls: {
      radius: {
        label: 'Sphere Radius',
        type: 'number',
        min: 30,
        max: 280,
        step: 5,
        withRange: true,
      },
      colorA: {
        label: 'Color A (Bass)',
        type: 'color',
      },
      colorB: {
        label: 'Color B (Mid)',
        type: 'color',
      },
      colorC: {
        label: 'Color C (Treble)',
        type: 'color',
      },
      bassSensitivity: {
        label: 'Bass Displacement',
        type: 'number',
        min: 0.0,
        max: 5.0,
        step: 0.1,
        withRange: true,
      },
      midSensitivity: {
        label: 'Mid Displacement',
        type: 'number',
        min: 0.0,
        max: 5.0,
        step: 0.1,
        withRange: true,
      },
      trebleSensitivity: {
        label: 'Treble Detail',
        type: 'number',
        min: 0.0,
        max: 5.0,
        step: 0.1,
        withRange: true,
      },
      wireframe: {
        label: 'Wireframe Mode',
        type: 'toggle',
      },
      glowColor: {
        label: 'Glow Color',
        type: 'color',
      },
      glowIntensity: {
        label: 'Glow Intensity',
        type: 'number',
        min: 0,
        max: 60,
        step: 1,
        withRange: true,
      },
      rotationSpeed: {
        label: 'Rotation Speed',
        type: 'number',
        min: 0.0,
        max: 3.0,
        step: 0.1,
        withRange: true,
      },
      detail: {
        label: 'Sphere Detail',
        type: 'number',
        min: 16,
        max: 128,
        step: 8,
        withRange: true,
      },
      opacity: {
        label: 'Opacity',
        type: 'number',
        min: 0,
        max: 1.0,
        step: 0.01,
        withRange: true,
        withReactor: true,
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
    super(MorphingSphereDisplay, properties);
  }
}
