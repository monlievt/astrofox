import { PanelBottom, PanelLeft, PanelRight, ListMusic } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import useAppStore, {
  handleMenuAction,
  toggleBottomPanelVisibility,
  toggleLeftPanelVisibility,
  toggleRightPanelVisibility,
} from '@/app/actions/app';
import useProject, { DEFAULT_PROJECT_NAME } from '@/app/actions/project';
import { showModal } from '@/app/actions/modals';
import LanguageSelector from '@/app/components/window/LanguageSelector';
import { env } from '@/app/global';
import { Button } from '@/components/ui/button';

export default function TitleBar() {
  const { t } = useTranslation(undefined, { keyPrefix: 'title-bar' });
  const isLeftPanelVisible = useAppStore(state => state.isLeftPanelVisible);
  const isBottomPanelVisible = useAppStore(state => state.isBottomPanelVisible);
  const isRightPanelVisible = useAppStore(state => state.isRightPanelVisible);
  const projectName = useProject(state => state.projectName);
  const title =
    projectName && projectName !== DEFAULT_PROJECT_NAME ? projectName : t('default-project-name');

  const panelButtons = [
    {
      key: 'left',
      label: isLeftPanelVisible ? t('hide-layers-panel') : t('show-layers-panel'),
      isVisible: isLeftPanelVisible,
      icon: PanelLeft,
      onClick: toggleLeftPanelVisibility,
    },
    {
      key: 'bottom',
      label: isBottomPanelVisible ? t('hide-player-panel') : t('show-player-panel'),
      isVisible: isBottomPanelVisible,
      icon: PanelBottom,
      onClick: toggleBottomPanelVisibility,
    },
    {
      key: 'right',
      label: isRightPanelVisible ? t('hide-controls-panel') : t('show-controls-panel'),
      isVisible: isRightPanelVisible,
      icon: PanelRight,
      onClick: toggleRightPanelVisibility,
    },
  ];

  return (
    <div className={'flex items-center relative h-10 bg-neutral-900 border-b border-b-neutral-700'}>
      <div className={'flex items-center gap-1.5 ml-3 max-w-[45vw]'}>
        <img
          alt=""
          aria-hidden="true"
          className="h-8 w-8 shrink-0 opacity-90"
          draggable={false}
          src="/icon.svg"
        />
        <Button
          variant="ghost"
          size="sm"
          className="bg-transparent text-neutral-400 truncate max-w-[32vw] hover:text-neutral-100 hover:bg-neutral-800"
          onClick={() => handleMenuAction('edit-canvas')}
        >
          {title}
        </Button>
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 text-sm leading-10 tracking-widest uppercase cursor-default max-[700px]:hidden text-neutral-400">
        {env.APP_NAME}
      </div>
      <div className="absolute top-1 right-2 flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 hover:text-violet-200 text-xs px-2.5 h-7 gap-1"
          onClick={() => showModal('RenderQueueModal')}
        >
          <ListMusic size={13} className="fill-current" />
          Antrian Render
        </Button>
        {panelButtons.map(button => {
          const Icon = button.icon;

          return (
            <Button
              key={button.key}
              variant="ghost"
              size="icon-sm"
              className={`${
                button.isVisible
                  ? 'bg-transparent text-neutral-400'
                  : 'bg-transparent text-neutral-500'
              } hover:bg-neutral-800 hover:text-neutral-100`}
              aria-label={button.label}
              aria-pressed={button.isVisible}
              onClick={button.onClick}
            >
              <Icon size={16} />
            </Button>
          );
        })}
        <LanguageSelector />
      </div>
    </div>
  );
}
