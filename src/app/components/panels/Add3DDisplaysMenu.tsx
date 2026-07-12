import { useTranslation } from 'react-i18next';
import SectionAddMenu from './SectionAddMenu';

interface Add3DDisplaysMenuProps {
  sceneId: string;
}

export default function Add3DDisplaysMenu({ sceneId }: Add3DDisplaysMenuProps) {
  const { t } = useTranslation(undefined, { keyPrefix: 'add-menu' });

  const categories = [
    {
      label: t('category-3d'),
      items: ['Geometry', 'Tunnel', 'Cubes', 'Mesh Grid', 'Morphing Sphere', 'Vissonance Sphere', 'Particle Galaxy', 'Particle Terrain', 'Spectrogram Terrain'],
    },
  ];

  return (
    <SectionAddMenu
      sceneId={sceneId}
      entityType="displays"
      categories={categories}
      ariaLabel={t('add-3d-display')}
    />
  );
}
