import { BLANK_IMAGE } from '@/app/constants';
import Display from '@/lib/core/Display';
import { stageHeight, stageWidth } from '@/lib/utils/controls';

interface TrapNationDisplayInstance {
  hasImage: boolean;
  properties: Record<string, unknown>;
}

const disabled = (display: TrapNationDisplayInstance) => !display.hasImage;

export default class TrapNationDisplay extends Display {
  static config = {
    name: 'TrapNationDisplay',
    description:
      'Displays a Trap Nation styled audio visualizer with a pulsing center logo and background particles.',
    type: 'display',
    label: 'Trap Nation Visualizer',
    defaultProperties: {
      src: BLANK_IMAGE,
      x: 0,
      y: 0,
      radius: 120,
      barWidth: 4,
      barCount: 96,
      color: ['#704dd8', '#ff007f'],
      bassPulsing: true,
      bassSensitivity: 1.5,
      mirrorMode: false,
      particleCount: 100,
      opacity: 1.0,
    },
    controls: {
      src: {
        label: 'Logo Image',
        type: 'image',
      },
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
      color: {
        label: 'Spectrum Color',
        type: 'colorrange',
      },
      bassPulsing: {
        label: 'Bass Pulsing Logo',
        type: 'toggle',
        disabled,
      },
      bassSensitivity: {
        label: 'Bass Sensitivity',
        type: 'number',
        min: 0.1,
        max: 4.0,
        step: 0.1,
        withRange: true,
        disabled,
      },
      particleCount: {
        label: 'Background Particles',
        type: 'number',
        min: 0,
        max: 300,
        withRange: true,
      },
      mirrorMode: {
        label: 'Mirror Mode (180°)',
        type: 'toggle',
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
    super(TrapNationDisplay, properties);
  }

  get hasImage() {
    return (this.properties as Record<string, unknown>).src !== BLANK_IMAGE;
  }
}
