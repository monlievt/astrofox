import Display from '@/lib/core/Display';
import { stageHeight, stageWidth } from '@/lib/utils/controls';

export default class NeuroFlowFieldDisplay extends Display {
  static config = {
    name: 'NeuroFlowFieldDisplay',
    description:
      'A fluid particle swarm floating through a neural vector flow field. Audio beats trigger a swirling vortex that pulls particles into a spiral galaxy, and dynamic connections light up as particles collide — perfect for ambient, binaural focus, and space music.',
    type: 'display',
    label: 'Neuro Flow Field',
    defaultProperties: {
      particleCount: 150,
      speed: 1.0,
      trailLength: 0.92,
      vortexIntensity: 1.5,
      connectDistance: 50,
      amplitude: 60,
      color: '#00f3ff',
      glowColor: '#00f3ff',
      glowIntensity: 12,
      sensitivity: 1.2,
      width: 854,
      height: 854,
      x: 0,
      y: 0,
      opacity: 1.0,
    },
    controls: {
      width: {
        label: 'Width',
        type: 'number',
        min: 100,
        max: 2000,
        step: 10,
        withRange: true,
      },
      height: {
        label: 'Height',
        type: 'number',
        min: 100,
        max: 2000,
        step: 10,
        withRange: true,
      },
      particleCount: {
        label: 'Particle Count',
        type: 'number',
        min: 20,
        max: 400,
        step: 10,
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
      trailLength: {
        label: 'Trail Length',
        type: 'number',
        min: 0.75,
        max: 0.99,
        step: 0.01,
        withRange: true,
      },
      vortexIntensity: {
        label: 'Swirl Vortex Power',
        type: 'number',
        min: 0.0,
        max: 4.0,
        step: 0.2,
        withRange: true,
      },
      connectDistance: {
        label: 'Connect Range',
        type: 'number',
        min: 0,
        max: 120,
        step: 5,
        withRange: true,
      },
      amplitude: {
        label: 'Reactivity Scale',
        type: 'number',
        min: 5,
        max: 150,
        step: 5,
        withRange: true,
      },
      color: {
        label: 'Particle Color',
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
        max: 40,
        step: 1,
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
    super(NeuroFlowFieldDisplay, properties);
  }
}
