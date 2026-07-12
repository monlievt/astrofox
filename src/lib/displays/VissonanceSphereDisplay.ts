import Display from '@/lib/core/Display';
import { stageHeight, stageWidth } from '@/lib/utils/controls';

export default class VissonanceSphereDisplay extends Display {
  static config = {
    name: 'VissonanceSphereDisplay',
    description:
      "Neon wireframe sphere with vertex displacement driven by audio. Lines glow and pulse outward with the music. Directly inspired by Vissonance's WebGL audio visualizer.",
    type: 'display',
    label: 'Vissonance Sphere',
    defaultProperties: {
      radius: 130,
      lineColor: '#00ffff',
      glowColor: '#00ffff',
      glowIntensity: 18,
      sensitivity: 1.2,
      detail: 32,
      rotationSpeedX: 0.2,
      rotationSpeedY: 0.5,
      displacementScale: 60,
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
      lineColor: {
        label: 'Line Color',
        type: 'color',
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
      sensitivity: {
        label: 'Audio Sensitivity',
        type: 'number',
        min: 0.1,
        max: 5.0,
        step: 0.1,
        withRange: true,
      },
      displacementScale: {
        label: 'Displacement Scale',
        type: 'number',
        min: 0,
        max: 200,
        step: 5,
        withRange: true,
      },
      detail: {
        label: 'Sphere Detail',
        type: 'number',
        min: 8,
        max: 64,
        step: 4,
        withRange: true,
      },
      rotationSpeedX: {
        label: 'Rotation X',
        type: 'number',
        min: -3.0,
        max: 3.0,
        step: 0.1,
        withRange: true,
      },
      rotationSpeedY: {
        label: 'Rotation Y',
        type: 'number',
        min: -3.0,
        max: 3.0,
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
    super(VissonanceSphereDisplay, properties);
  }
}
