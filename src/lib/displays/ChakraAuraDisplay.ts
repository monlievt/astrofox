import Display from '@/lib/core/Display';
import { stageHeight, stageWidth } from '@/lib/utils/controls';

export default class ChakraAuraDisplay extends Display {
  static config = {
    name: 'ChakraAuraDisplay',
    description:
      'An organic chakra energy field emitting glowing particles from a breathing central core. Bass beats trigger physical expanding shockwaves that push particles outwards, while high frequencies cause them to twinkle like stars — ideal for chakra alignment and aura meditation videos.',
    type: 'display',
    label: 'Chakra Aura',
    defaultProperties: {
      sphereRadius: 50, // Core Radius
      dotDensity: 150, // Max Particles
      innerColor: '#8f00ff', // Violet (Crown Chakra)
      outerColor: '#ffd700', // Gold (Solar Plexus)
      glowIntensity: 15,
      glowColor: '#8f00ff',
      sensitivity: 1.5,
      wiggleSpeed: 1.0, // Drift speed
      width: 854,
      height: 480,
      x: 0,
      y: 0,
      opacity: 1.0,
    },
    controls: {
      sphereRadius: {
        label: 'Core Radius',
        type: 'number',
        min: 10,
        max: 200,
        step: 5,
        withRange: true,
      },
      dotDensity: {
        label: 'Max Particles',
        type: 'number',
        min: 30,
        max: 400,
        step: 10,
        withRange: true,
      },
      innerColor: {
        label: 'Core Chakra Color',
        type: 'color',
      },
      outerColor: {
        label: 'Outer Aura Color',
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
      sensitivity: {
        label: 'Audio Sensitivity',
        type: 'number',
        min: 0.5,
        max: 4.0,
        step: 0.1,
        withRange: true,
      },
      wiggleSpeed: {
        label: 'Particle Drift Speed',
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
        withRange: true,
      },
    },
  };

  constructor(properties?: Record<string, unknown>) {
    super(ChakraAuraDisplay, properties);
  }
}
