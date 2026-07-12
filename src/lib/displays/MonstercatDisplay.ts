import Display from '@/lib/core/Display';
import { stageHeight, stageWidth } from '@/lib/utils/controls';

export default class MonstercatDisplay extends Display {
  static config = {
    name: 'MonstercatDisplay',
    description:
      'Displays a clean vertical bar equalizer with ambient falling snow/dust particles.',
    type: 'display',
    label: 'Monstercat Style Visualizer',
    defaultProperties: {
      x: 0,
      y: 120, // default positioned towards the lower part
      width: 800,
      height: 200,
      barWidth: 8,
      barSpacing: 4,
      color: ['#ffffff', '#cccccc'],
      particleCount: 80,
      particleSpeed: 1.0,
      align: 'bottom',
      opacity: 1.0,
    },
    controls: {
      width: {
        label: 'Width',
        type: 'number',
        min: 100,
        max: stageWidth(),
        withRange: true,
      },
      height: {
        label: 'Height',
        type: 'number',
        min: 50,
        max: stageHeight(),
        withRange: true,
      },
      barWidth: {
        label: 'Bar Width',
        type: 'number',
        min: 1,
        max: 50,
        withRange: true,
      },
      barSpacing: {
        label: 'Bar Spacing',
        type: 'number',
        min: 0,
        max: 20,
        withRange: true,
      },
      color: {
        label: 'Equalizer Color',
        type: 'colorrange',
      },
      particleCount: {
        label: 'Snow/Dust Count',
        type: 'number',
        min: 0,
        max: 300,
        withRange: true,
      },
      particleSpeed: {
        label: 'Falling Speed',
        type: 'number',
        min: 0.1,
        max: 5.0,
        step: 0.1,
        withRange: true,
      },
      align: {
        label: 'Alignment',
        type: 'select',
        items: ['bottom', 'center'],
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
    super(MonstercatDisplay, properties);
  }
}
