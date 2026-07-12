import Display from '@/lib/core/Display';
import { stageHeight, stageWidth } from '@/lib/utils/controls';

export default class QuantumParticleWaveDisplay extends Display {
  static config = {
    name: 'QuantumParticleWaveDisplay',
    description:
      'Glowing audio-reactive flowing horizontal wave curves of particles, modulated in real-time by Bass, Mid, and Treble ranges.',
    type: 'display',
    label: 'Quantum Particle Wave',
    defaultProperties: {
      dotSize: 2.0,
      dotGap: 5.0,
      waveAmplitude: 60,
      waveCount: 4,
      spectrogramStyle: 'Capsule',
      centerWidth: 260,
      centerHeight: 220,
      centerColumns: 32,
      centerColor: '#ffffff',
      ambientDust: true,
      dustCount: 80,
      dustSpeed: 0.6,
      dustReaction: 1.2,
      color: '#d8b4fe',
      glowColor: '#818cf8',
      glowIntensity: 12,
      sensitivity: 1.8,
      width: 854,
      height: 480,
      x: 0,
      y: 0,
      opacity: 1.0,
    },
    controls: {
      dotSize: {
        label: 'Dot Size',
        type: 'number',
        min: 1.0,
        max: 8.0,
        step: 0.5,
      },
      dotGap: {
        label: 'Dot Spacing',
        type: 'number',
        min: 2.0,
        max: 15.0,
        step: 0.5,
      },
      waveAmplitude: {
        label: 'Wave Amplitude',
        type: 'number',
        min: 10,
        max: 200,
        step: 5,
      },
      waveCount: {
        label: 'Horizontal Waves',
        type: 'number',
        min: 1,
        max: 8,
        step: 1,
      },
      spectrogramStyle: {
        label: 'Center Spectrogram',
        type: 'select',
        items: ['Capsule', 'Spikes', 'None'],
      },
      centerWidth: {
        label: 'Center Width',
        type: 'number',
        min: 50,
        max: 800,
        step: 10,
        withRange: true,
      },
      centerHeight: {
        label: 'Center Height',
        type: 'number',
        min: 20,
        max: 600,
        step: 10,
        withRange: true,
      },
      centerColumns: {
        label: 'Center Columns',
        type: 'number',
        min: 10,
        max: 60,
        step: 2,
        withRange: true,
      },
      centerColor: {
        label: 'Center Color',
        type: 'color',
      },
      color: {
        label: 'Primary Color',
        type: 'color',
      },
      glowColor: {
        label: 'Glow Color',
        type: 'color',
      },
      glowIntensity: {
        label: 'Glow Intensity',
        type: 'number',
        min: 0,
        max: 25,
        step: 1,
      },
      ambientDust: {
        label: 'Ambient Floating Dust',
        type: 'toggle',
      },
      dustCount: {
        label: 'Dust Particle Count',
        type: 'number',
        min: 20,
        max: 250,
        step: 5,
        withRange: true,
      },
      dustSpeed: {
        label: 'Dust Float Speed',
        type: 'number',
        min: 0.1,
        max: 2.5,
        step: 0.1,
        withRange: true,
      },
      dustReaction: {
        label: 'Dust Audio Reactivity',
        type: 'number',
        min: 0.0,
        max: 3.0,
        step: 0.1,
        withRange: true,
      },
      sensitivity: {
        label: 'Sensitivity',
        type: 'number',
        min: 0.5,
        max: 4.0,
        step: 0.1,
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
      },
    },
  };

  constructor(properties?: Record<string, unknown>) {
    super(QuantumParticleWaveDisplay, properties);
  }
}
