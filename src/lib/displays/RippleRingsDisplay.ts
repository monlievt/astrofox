import Display from '@/lib/core/Display';
import { stageHeight, stageWidth } from '@/lib/utils/controls';

export default class RippleRingsDisplay extends Display {
  static config = {
    name: 'RippleRingsDisplay',
    description:
      'Concentric ripple rings that each react to a different frequency band. Bass drives the outer rings, treble drives the inner rings.',
    type: 'display',
    label: 'Frequency Ripple Rings',
    defaultProperties: {
      ringCount: 10,
      baseRadius: 30,
      ringSpacing: 20,
      color: '#7c3aed',
      colorEnd: '#00ffff',
      strokeWidth: 2.0,
      sensitivity: 1.5,
      glowIntensity: 8,
      x: 0,
      y: 0,
      opacity: 1.0,
    },
    controls: {
      ringCount: {
        label: 'Ring Count',
        type: 'number',
        min: 3,
        max: 24,
        step: 1,
        withRange: true,
      },
      baseRadius: {
        label: 'Inner Radius',
        type: 'number',
        min: 10,
        max: 200,
        step: 5,
        withRange: true,
      },
      ringSpacing: {
        label: 'Ring Spacing',
        type: 'number',
        min: 5,
        max: 60,
        step: 1,
        withRange: true,
      },
      color: {
        label: 'Color (Inner)',
        type: 'color',
      },
      colorEnd: {
        label: 'Color (Outer)',
        type: 'color',
      },
      strokeWidth: {
        label: 'Ring Width',
        type: 'number',
        min: 0.5,
        max: 10.0,
        step: 0.5,
        withRange: true,
      },
      sensitivity: {
        label: 'Sensitivity',
        type: 'number',
        min: 0.1,
        max: 5.0,
        step: 0.1,
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
    },
  };

  constructor(properties?: Record<string, unknown>) {
    super(RippleRingsDisplay, properties);
  }
}
