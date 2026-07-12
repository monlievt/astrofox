import Display from '@/lib/core/Display';
import { stageHeight, stageWidth } from '@/lib/utils/controls';

export default class LEDSpectrumDisplay extends Display {
  static config = {
    name: 'LEDSpectrumDisplay',
    description:
      'Multi-mode spectrum display with LED panel, Block, Rounded, and Split styles. Features peak hold indicators and a 3-stop color gradient. Inspired by wav2bar-reborn.',
    type: 'display',
    label: 'LED Bar Spectrum',
    defaultProperties: {
      mode: 'LED',
      barCount: 64,
      barWidth: 10,
      barGap: 2,
      ledCount: 20,
      ledGap: 2,
      colorStart: '#00ff00',
      colorMid: '#ffff00',
      colorEnd: '#ff0000',
      showPeaks: true,
      peakColor: '#ffffff',
      smoothing: 0.75,
      sensitivity: 1.2,
      x: 0,
      y: 0,
      width: 854,
      height: 200,
      opacity: 1.0,
    },
    controls: {
      mode: {
        label: 'Display Mode',
        type: 'select',
        options: ['Block', 'LED', 'Rounded', 'Split'],
      },
      barCount: {
        label: 'Bar Count',
        type: 'number',
        min: 8,
        max: 256,
        step: 1,
        withRange: true,
      },
      barWidth: {
        label: 'Bar Width',
        type: 'number',
        min: 2,
        max: 40,
        step: 1,
        withRange: true,
      },
      barGap: {
        label: 'Bar Gap',
        type: 'number',
        min: 0,
        max: 20,
        step: 1,
        withRange: true,
      },
      ledCount: {
        label: 'LED Segments (LED mode)',
        type: 'number',
        min: 5,
        max: 60,
        step: 1,
        withRange: true,
      },
      colorStart: {
        label: 'Color Low (Green)',
        type: 'color',
      },
      colorMid: {
        label: 'Color Mid (Yellow)',
        type: 'color',
      },
      colorEnd: {
        label: 'Color High (Red)',
        type: 'color',
      },
      showPeaks: {
        label: 'Show Peak Hold',
        type: 'toggle',
      },
      peakColor: {
        label: 'Peak Color',
        type: 'color',
      },
      smoothing: {
        label: 'Smoothing',
        type: 'number',
        min: 0.0,
        max: 0.99,
        step: 0.01,
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
      height: {
        label: 'Height',
        type: 'number',
        min: 40,
        max: stageHeight(),
        step: 10,
        withRange: true,
      },
      width: {
        label: 'Width',
        type: 'number',
        min: 100,
        max: stageWidth(),
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
    super(LEDSpectrumDisplay, properties);
  }
}
