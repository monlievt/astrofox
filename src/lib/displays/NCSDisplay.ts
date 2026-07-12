import Display from '@/lib/core/Display';
import { stageHeight, stageWidth } from '@/lib/utils/controls';

export default class NCSDisplay extends Display {
  static config = {
    name: 'NCSDisplay',
    description: 'Displays a clean circular spectrum with screen shake and dynamic color morphing.',
    type: 'display',
    label: 'NCS Style Visualizer',
    defaultProperties: {
      x: 0,
      y: 0,
      radius: 120,
      barWidth: 4,
      barCount: 128,
      shakeEnabled: true,
      shakeSensitivity: 1.0,
      colorMorphing: true,
      morphSpeed: 1.0,
      baseColor: ['#00d2ff', '#3a7bd5'],
      opacity: 1.0,
    },
    controls: {
      radius: {
        label: 'Radius',
        type: 'number',
        min: 30,
        max: stageWidth(n => n / 2),
        withRange: true,
      },
      barWidth: {
        label: 'Bar Width',
        type: 'number',
        min: 1,
        max: 20,
        withRange: true,
      },
      barCount: {
        label: 'Bar Count',
        type: 'number',
        min: 16,
        max: 256,
        withRange: true,
      },
      baseColor: {
        label: 'Base Color',
        type: 'colorrange',
      },
      shakeEnabled: {
        label: 'Screen Shake',
        type: 'toggle',
      },
      shakeSensitivity: {
        label: 'Shake Sensitivity',
        type: 'number',
        min: 0.1,
        max: 3.0,
        step: 0.1,
        withRange: true,
      },
      colorMorphing: {
        label: 'Color Morphing',
        type: 'toggle',
      },
      morphSpeed: {
        label: 'Morph Speed',
        type: 'number',
        min: 0.1,
        max: 5.0,
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
    super(NCSDisplay, properties);
  }
}
