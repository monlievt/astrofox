import Display from '@/lib/core/Display';
import { stageHeight, stageWidth } from '@/lib/utils/controls';

export default class MultiWaveDisplay extends Display {
  static config = {
    name: 'MultiWaveDisplay',
    description:
      'Interweaving glowing wave strands that spiral and morph dynamically to different audio frequency bands — perfect for EDM, Chill, and Ambient beats.',
    type: 'display',
    label: 'Interweaving Waveforms',
    defaultProperties: {
      strandCount: 3,
      amplitude: 70,
      waveFrequency: 2.2,
      speed: 1.5,
      particleSize: 3.0,
      particleSpacing: 6,
      lineWidth: 1.5,
      renderMode: 'Dots', // 'Lines' | 'Dots' | 'Both'
      color: ['#00ff66', '#00f0ff'],
      glowColor: '#00ff66',
      glowIntensity: 15,
      sensitivity: 1.2,
      pinchWidth: 100, // area in the center where the waves pinch/meet
      width: 854,
      height: 240,
      x: 0,
      y: 0,
      opacity: 1.0,
    },
    controls: {
      width: {
        label: 'Width',
        type: 'number',
        min: 100,
        max: 1920,
        step: 10,
        withRange: true,
      },
      height: {
        label: 'Height',
        type: 'number',
        min: 50,
        max: 1080,
        step: 10,
        withRange: true,
      },
      strandCount: {
        label: 'Wave Strands',
        type: 'number',
        min: 1,
        max: 6,
        step: 1,
        withRange: true,
      },
      amplitude: {
        label: 'Amplitude',
        type: 'number',
        min: 10,
        max: 300,
        step: 5,
        withRange: true,
      },
      waveFrequency: {
        label: 'Wave Peaks',
        type: 'number',
        min: 0.5,
        max: 8.0,
        step: 0.1,
        withRange: true,
      },
      speed: {
        label: 'Travel Speed',
        type: 'number',
        min: 0.1,
        max: 5.0,
        step: 0.1,
        withRange: true,
      },
      renderMode: {
        label: 'Render Style',
        type: 'select',
        options: ['Lines', 'Dots', 'Both'],
      },
      particleSize: {
        label: 'Dot Size',
        type: 'number',
        min: 1.0,
        max: 8.0,
        step: 0.5,
        withRange: true,
      },
      particleSpacing: {
        label: 'Dot Spacing',
        type: 'number',
        min: 2,
        max: 20,
        step: 1,
        withRange: true,
      },
      lineWidth: {
        label: 'Line Width',
        type: 'number',
        min: 0.5,
        max: 6.0,
        step: 0.5,
        withRange: true,
      },
      color: {
        label: 'Strands Gradient',
        type: 'color',
        isGradient: true,
      },
      glowColor: {
        label: 'Glow Color',
        type: 'color',
      },
      glowIntensity: {
        label: 'Glow Intensity',
        type: 'number',
        min: 0,
        max: 40,
        step: 1,
        withRange: true,
      },
      sensitivity: {
        label: 'Audio Sensitivity',
        type: 'number',
        min: 0.2,
        max: 4.0,
        step: 0.1,
        withRange: true,
      },
      pinchWidth: {
        label: 'Center Gap',
        type: 'number',
        min: 0,
        max: 400,
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
    super(MultiWaveDisplay, properties);
  }
}
