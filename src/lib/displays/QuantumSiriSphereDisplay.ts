import Display from '@/lib/core/Display';
import { stageHeight, stageWidth } from '@/lib/utils/controls';

export default class QuantumSiriSphereDisplay extends Display {
  static config = {
    name: 'QuantumSiriSphereDisplay',
    description:
      'A 3D-like morphing spherical particle swarm resembling a glowing Siri assistant, bordered by segment-rotating outer rings and a horizontal background assistant wave.',
    type: 'display',
    label: 'Quantum Siri Sphere',
    defaultProperties: {
      sphereRadius: 160,
      dotDensity: 4.0,
      innerColor: '#ff007f',
      outerColor: '#0055ff',
      glowIntensity: 15,
      glowColor: '#00f3ff',
      ringColor1: '#39ff14',
      ringColor2: '#00f3ff',
      sensitivity: 1.5,
      wiggleSpeed: 1.0,
      width: 854,
      height: 480,
      x: 0,
      y: 0,
      opacity: 1.0,
    },
    controls: {
      sphereRadius: {
        label: 'Sphere Radius',
        type: 'number',
        min: 50,
        max: 400,
        step: 5,
        withRange: true,
      },
      dotDensity: {
        label: 'Particle Density',
        type: 'number',
        min: 2.0,
        max: 10.0,
        step: 0.5,
        withRange: true,
      },
      innerColor: {
        label: 'Sphere Inner Color',
        type: 'color',
      },
      outerColor: {
        label: 'Sphere Outer Color',
        type: 'color',
      },
      glowIntensity: {
        label: 'Glow Intensity',
        type: 'number',
        min: 0,
        max: 30,
        step: 1,
        withRange: true,
      },
      glowColor: {
        label: 'Glow Color',
        type: 'color',
      },
      ringColor1: {
        label: 'Ring Color Start',
        type: 'color',
      },
      ringColor2: {
        label: 'Ring Color End',
        type: 'color',
      },
      sensitivity: {
        label: 'Audio Sensitivity',
        type: 'number',
        min: 0.5,
        max: 4.0,
        step: 0.1,
        withRange: true,
      },
      wiggleSpeed: {
        label: 'Idle Wiggle Speed',
        type: 'number',
        min: 0.1,
        max: 3.0,
        step: 0.1,
        withRange: true,
      },
      x: {
        label: 'X Offset',
        type: 'number',
        min: stageWidth(n => -n),
        max: stageWidth(),
        step: 10,
      },
      y: {
        label: 'Y Offset',
        type: 'number',
        min: stageHeight(n => -n),
        max: stageHeight(),
        step: 10,
      },
      opacity: {
        label: 'Opacity',
        type: 'number',
        min: 0,
        max: 1.0,
        step: 0.05,
      },
    },
  };

  constructor(properties?: Record<string, unknown>) {
    super(QuantumSiriSphereDisplay, properties);
  }
}
