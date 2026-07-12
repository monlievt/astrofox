import { useTranslation } from 'react-i18next';
import SectionAddMenu from './SectionAddMenu';

interface Add2DDisplaysMenuProps {
  sceneId: string;
}

export default function Add2DDisplaysMenu({ sceneId }: Add2DDisplaysMenuProps) {
  const { t } = useTranslation(undefined, { keyPrefix: 'add-menu' });

  const categories = [
    {
      label: 'Media & Shapes',
      items: [
        'Text',
        'Image',
        'Video',
        'Shape',
      ],
    },
    {
      label: 'Classic Spectrums',
      items: [
        'Bar Spectrum',
        'Radial Spectrum',
        'Wave Spectrum',
        'Waveform Ring',
        'Sound Wave',
        'LED Bar Spectrum',
        'Interweaving Waveforms',
      ],
    },
    {
      label: 'Advanced & Particles',
      items: [
        'Starfield Particles',
        'Trap Nation Visualizer',
        'NCS Style Visualizer',
        'Monstercat Style Visualizer',
        'Frequency Ripple Rings',
        'Particle Burst',
      ],
    },
    {
      label: 'Quantum & Meditation (Special)',
      items: [
        'Sacred Mandala',
        'Quantum Particle Wave',
        'Binaural Phased Resonance',
        'Quantum Neural Web',
        'Neuro Flow Field',
        'Quantum Siri Sphere',
        'Quantum DNA Helix',
        'Chakra Aura',
        'Wave Horizon',
      ],
    },
  ];

  return (
    <SectionAddMenu
      sceneId={sceneId}
      entityType="displays"
      categories={categories}
      ariaLabel={t('add-2d-display')}
    />
  );
}
