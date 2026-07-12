import Display from '@/lib/core/Display';
import { stageHeight, stageWidth } from '@/lib/utils/controls';

export default class ParticleBurstDisplay extends Display {
  static config = {
    name: 'ParticleBurstDisplay',
    description:
      "Particles explode outward on every beat drop. Inspired by Uberviz's explosive reactive particle style. Great for high-energy music drops.",
    type: 'display',
    label: 'Particle Burst',
    defaultProperties: {
      burstCount: 120,
      particleSize: 4.5,
      particleSpeed: 14.0,
      lifetime: 100,
      colorA: '#ff007f',
      colorB: '#704dd8',
      beatThreshold: 0.65,
      trailFade: 0.06,
      glowIntensity: 18,
      width: 854,
      height: 480,
      smoothing: 0.8,
      x: 0,
      y: 0,
      opacity: 1.0,
    },
    controls: {
      burstCount: {
        label: 'Particles per Burst',
        type: 'number',
        min: 10,
        max: 200,
        step: 5,
        withRange: true,
      },
      particleSize: {
        label: 'Particle Size',
        type: 'number',
        min: 0.5,
        max: 15.0,
        step: 0.5,
        withRange: true,
      },
      particleSpeed: {
        label: 'Burst Speed',
        type: 'number',
        min: 1.0,
        max: 20.0,
        step: 0.5,
        withRange: true,
      },
      lifetime: {
        label: 'Particle Lifetime',
        type: 'number',
        min: 10,
        max: 120,
        step: 5,
        withRange: true,
      },
      colorA: {
        label: 'Color A',
        type: 'color',
      },
      colorB: {
        label: 'Color B',
        type: 'color',
      },
      beatThreshold: {
        label: 'Beat Threshold',
        type: 'number',
        min: 0.1,
        max: 1.0,
        step: 0.05,
        withRange: true,
      },
      trailFade: {
        label: 'Motion Blur',
        type: 'number',
        min: 0.02,
        max: 0.8,
        step: 0.01,
        withRange: true,
      },
      glowIntensity: {
        label: 'Glow',
        type: 'number',
        min: 0,
        max: 40,
        step: 1,
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
        min: 50,
        max: 1080,
        step: 10,
        withRange: true,
      },
      smoothing: {
        label: 'Smoothing',
        type: 'number',
        min: 0,
        max: 0.99,
        step: 0.01,
        withRange: true,
      },
    },
  };

  constructor(properties?: Record<string, unknown>) {
    super(ParticleBurstDisplay, properties);
  }
}
