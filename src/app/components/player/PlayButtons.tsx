import { clsx as classNames } from 'cnfast';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import useAppStore from '@/app/actions/app';
import useAudioStore, {
  playNextTrack,
  playPreviousTrack,
  setLiveModeEnabled,
} from '@/app/actions/audio';
import { player } from '@/app/global';
import useForceUpdate from '@/app/hooks/useForceUpdate';
import { Pause, Play, SkipBack, SkipForward, Stop } from '@/app/icons';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function PlayButtons() {
  const { t } = useTranslation(undefined, { keyPrefix: 'player' });
  const forceUpdate = useForceUpdate();
  const isVideoRecording = useAppStore(state => state.isVideoRecording);
  const { liveModeEnabled, mode, playbackMode, playlist } = useAudioStore(
    useShallow(state => ({
      liveModeEnabled: state.liveModeEnabled,
      mode: state.mode,
      playbackMode: state.playbackMode,
      playlist: state.playlist,
    })),
  );
  const playing = player.isPlaying();
  const hasSource = liveModeEnabled ? player.hasSource() : true;
  const PlayPauseIcon = isVideoRecording ? Play : playing ? Pause : Play;

  const hasMultipleTracks = playlist && playlist.length > 1;
  const showNavButtons = playbackMode === 'sequential' && hasMultipleTracks;

  useEffect(() => {
    player.on('playback-change', forceUpdate);
    player.on('source-change', forceUpdate);

    return () => {
      player.off('playback-change', forceUpdate);
      player.off('source-change', forceUpdate);
    };
  }, [forceUpdate]);

  function handlePlayButtonClick() {
    console.log(
      '[PlayButtons] play button clicked! isVideoRecording:',
      isVideoRecording,
      'hasSource:',
      hasSource,
    );
    if (isVideoRecording || !hasSource) {
      console.log('[PlayButtons] Click ignored due to recording or no source.');
      return;
    }

    console.log('[PlayButtons] Calling player.play()...');
    player.play();
  }

  function handleStopButtonClick() {
    if (!hasSource) {
      return;
    }

    if (liveModeEnabled && mode === 'desktop') {
      setLiveModeEnabled(false);
      return;
    }

    player.stop();
  }

  const playTitle = isVideoRecording
    ? t('recording')
    : !liveModeEnabled
      ? playing
        ? t('pause')
        : t('play')
      : hasSource
        ? playing
          ? mode === 'file'
            ? t('pause')
            : t('pause-live-input')
          : mode === 'file'
            ? t('play')
            : t('start-live-input')
        : mode === 'microphone'
          ? t('connect-microphone')
          : mode === 'desktop'
            ? t('capture-desktop-audio')
            : mode === 'midi'
              ? t('connect-midi')
              : t('load-audio');
  const stopTitle = hasSource
    ? !liveModeEnabled || mode === 'file'
      ? t('stop')
      : t('stop-live-input')
    : t('no-active-input');

  return (
    <div className={'whitespace-nowrap flex items-center gap-1.5'}>
      {/* Previous Track Button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                className={classNames(
                  'text-neutral-100 bg-transparent p-0 inline-flex items-center justify-center border-2 border-neutral-700 h-10 w-10 rounded-full transition-[all_0.2s]',
                  {
                    'hover:border-primary active:border-neutral-100 cursor-pointer':
                      showNavButtons && !isVideoRecording,
                    'opacity-40 cursor-not-allowed': !showNavButtons || isVideoRecording,
                  },
                )}
                disabled={!showNavButtons || isVideoRecording}
                onClick={playPreviousTrack}
              />
            }
          >
            <SkipBack className={'w-5 h-5'} />
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            sideOffset={6}
            className="rounded bg-neutral-950 px-3 py-2 text-sm text-neutral-200 shadow-lg z-100"
          >
            {t('previous-track', 'Previous Track')}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Play/Pause Button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                className={classNames(
                  'text-neutral-100 bg-transparent p-0 inline-flex items-center justify-center border-2 h-10 w-10 rounded-full transition-[all_0.2s]',
                  {
                    'border-neutral-700 hover:border-primary active:border-neutral-100 cursor-pointer':
                      !isVideoRecording && (!liveModeEnabled || hasSource),
                    'border-primary/60 cursor-not-allowed':
                      isVideoRecording || (liveModeEnabled && !hasSource),
                  },
                )}
                disabled={isVideoRecording || (liveModeEnabled && !hasSource)}
                onClick={handlePlayButtonClick}
              />
            }
          >
            <div className="relative inline-flex items-center justify-center">
              {isVideoRecording && (
                <span className="pointer-events-none absolute -inset-1 rounded-full border-2 border-transparent border-t-primary border-r-primary/50 animate-spin" />
              )}
              <PlayPauseIcon
                className={classNames('w-6 h-6', {
                  'translate-x-px': !playing,
                  'text-primary': isVideoRecording,
                })}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            sideOffset={6}
            className="rounded bg-neutral-950 px-3 py-2 text-sm text-neutral-200 shadow-lg z-100"
          >
            {playTitle}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Next Track Button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                className={classNames(
                  'text-neutral-100 bg-transparent p-0 inline-flex items-center justify-center border-2 border-neutral-700 h-10 w-10 rounded-full transition-[all_0.2s]',
                  {
                    'hover:border-primary active:border-neutral-100 cursor-pointer':
                      showNavButtons && !isVideoRecording,
                    'opacity-40 cursor-not-allowed': !showNavButtons || isVideoRecording,
                  },
                )}
                disabled={!showNavButtons || isVideoRecording}
                onClick={playNextTrack}
              />
            }
          >
            <SkipForward className={'w-5 h-5'} />
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            sideOffset={6}
            className="rounded bg-neutral-950 px-3 py-2 text-sm text-neutral-200 shadow-lg z-100"
          >
            {t('next-track', 'Next Track')}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Stop Button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                className={classNames(
                  'text-neutral-100 bg-transparent p-0 inline-flex items-center justify-center border-2 border-neutral-700 h-10 w-10 rounded-full transition-[all_0.2s] hover:border-primary active:border-neutral-100',
                  {
                    'cursor-not-allowed opacity-60': liveModeEnabled && !hasSource,
                    'cursor-pointer': !liveModeEnabled || hasSource,
                  },
                )}
                disabled={liveModeEnabled && !hasSource}
                onClick={handleStopButtonClick}
              />
            }
          >
            <Stop className={'w-6 h-6'} />
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            sideOffset={6}
            className="rounded bg-neutral-950 px-3 py-2 text-sm text-neutral-200 shadow-lg z-100"
          >
            {isVideoRecording ? t('stop-recording') : stopTitle}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
