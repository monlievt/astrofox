import Display from '@/lib/core/Display';
import { stageHeight, stageWidth } from '@/lib/utils/controls';

export default class QuantumDNADisplay extends Display {
  static config = {
    name: 'QuantumDNADisplay',
    description:
      'Two intertwined 3D rotating helices of glowing particles. Mid and high frequencies trigger glowing bridge connections (base pairs) to spark in between the strands, perfect for Solfeggio healing frequencies and DNA repair meditation music.',
    type: 'display',
    label: 'Quantum DNA Helix',
    defaultProperties: {
      sphereRadius: 80, // Helix Radius
      waveCycles: 3.0,
      rotationSpeed: 1.0,
      colorA: '#ff007f',
      colorB: '#00f3ff',
      bridgeColor: '#ffffff',
      bridgeDensity: 25,
      dotSize: 2.5,
      dotGap: 6.0,
      glowIntensity: 12,
      glowColor: '#00f3ff',
      sensitivity: 1.5,
      width: 854,
      height: 480,
      x: 0,
      y: 0,
      opacity: 1.0,
    },
    controls: {
      sphereRadius: {
        label: 'Helix Radius',
        type: 'number',
        min: 20,
        max: 250,
        step: 5,
        withRange: true,
      },
      waveCycles: {
        label: 'Helix Cycles',
        type: 'number',
        min: 1.0,
        max: 8.0,
        step: 0.2,
        withRange: true,
      },
      rotationSpeed: {
        label: 'Rotation Speed',
        type: 'number',
        min: 0.1,
        max: 3.0,
        step: 0.1,
        withRange: true,
      },
      bridgeDensity: {
        label: 'Bridge Distance',
        type: 'number',
        min: 10,
        max: 100,
        step: 5,
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
        min: 2.0,
        max: 15.0,
        step: 0.5,
        withRange: true,
      },
      colorA: {
        label: 'Strand A Color',
        type: 'color',
      },
      colorB: {
        label: 'Strand B Color',
        type: 'color',
      },
      bridgeColor: {
        label: 'Bridge Color',
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
      x: {
        label: 'Position X',
        type: 'number',
        min: stageWidth(n => -n),
        max: stageWidth(),
        step: 10,
      },
      y: {
        label: 'Position Y',
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
    super(QuantumDNADisplay, properties);
  }
}
