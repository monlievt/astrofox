import Display from '@/lib/core/Display';
import { stageHeight, stageWidth } from '@/lib/utils/controls';

export default class WaveHorizonDisplay extends Display {
  static config = {
    name: 'WaveHorizonDisplay',
    description:
      'Three stacked layers of dot-mesh horizontal landscapes scrolling dynamically at different speeds. The front layer reacts to Bass, the middle layer reacts to Mids, and the background layer reacts to Highs/Gamma frequencies, creating a calming 3D parallax wave horizon.',
    type: 'display',
    label: 'Wave Horizon',
    defaultProperties: {
      waveCycles: 2.5,
      innerColor: '#00f3ff', // Foreground (Cyan)
      outerColor: '#ff007f', // Midground (Magenta)
      glowColor: '#8f00ff', // Background (Violet)
      glowIntensity: 12,
      dotSize: 2.5,
      dotGap: 8.0,
      wiggleSpeed: 1.0, // Parallax scroll speed
      sensitivity: 1.5,
      width: 854,
      height: 480,
      x: 0,
      y: 0,
      opacity: 1.0,
    },
    controls: {
      waveCycles: {
        label: 'Wave Cycles',
        type: 'number',
        min: 1.0,
        max: 6.0,
        step: 0.2,
        withRange: true,
      },
      dotSize: {
        label: 'Dot Size',
        type: 'number',
        min: 1.0,
        max: 6.0,
        step: 0.5,
        withRange: true,
      },
      dotGap: {
        label: 'Dot Spacing',
        type: 'number',
        min: 3.0,
        max: 15.0,
        step: 0.5,
        withRange: true,
      },
      innerColor: {
        label: 'Foreground Color',
        type: 'color',
      },
      outerColor: {
        label: 'Midground Color',
        type: 'color',
      },
      glowColor: {
        label: 'Background Color',
        type: 'color',
      },
      glowIntensity: {
        label: 'Glow Intensity',
        type: 'number',
        min: 0,
        max: 25,
        step: 1,
        withRange: true,
      },
      wiggleSpeed: {
        label: 'Parallax Speed',
        type: 'number',
        min: 0.1,
        max: 3.0,
        step: 0.1,
        withRange: true,
      },
      sensitivity: {
        label: 'Audio Sensitivity',
        type: 'number',
        min: 0.5,
        max: 4.0,
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
        withRange: true,
      },
    },
  };

  constructor(properties?: Record<string, unknown>) {
    super(WaveHorizonDisplay, properties);
  }
}
