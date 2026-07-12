import Display from '@/lib/core/Display';
import { stageHeight, stageWidth } from '@/lib/utils/controls';

export default class StarfieldDisplay extends Display {
  static config = {
    name: 'StarfieldDisplay',
    description: 'Displays a reactive starfield particle system.',
    type: 'display',
    label: 'Starfield Particles',
    defaultProperties: {
      x: 0,
      y: 0,
      baseSpeed: 2.0,
      musicSensitivity: 0.5,
      starColor: '#FFFFFF',
      starSize: 2.0,
      gravity: 0.0,
      particleCount: 200,
      opacity: 1.0,
    },
    controls: {
      baseSpeed: {
        label: 'Base Speed',
        type: 'number',
        min: 0.1,
        max: 10.0,
        step: 0.1,
        withRange: true,
      },
      musicSensitivity: {
        label: 'Music Sensitivity',
        type: 'number',
        min: 0.0,
        max: 3.0,
        step: 0.1,
        withRange: true,
      },
      starColor: {
        label: 'Star Color',
        type: 'color',
      },
      starSize: {
        label: 'Star Size',
        type: 'number',
        min: 0.5,
        max: 10.0,
        step: 0.1,
        withRange: true,
      },
      gravity: {
        label: 'Gravity',
        type: 'number',
        min: -5.0,
        max: 5.0,
        step: 0.1,
        withRange: true,
      },
      particleCount: {
        label: 'Star Count',
        type: 'number',
        min: 10,
        max: 500,
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
        label: 'Center X',
        type: 'number',
        min: stageWidth(n => -n),
        max: stageWidth(),
        withRange: true,
        hideFill: true,
      },
      y: {
        label: 'Center Y',
        type: 'number',
        min: stageHeight(n => -n),
        max: stageHeight(),
        withRange: true,
        hideFill: true,
      },
    },
  };

  constructor(properties?: Record<string, unknown>) {
    super(StarfieldDisplay, properties);
  }
}
