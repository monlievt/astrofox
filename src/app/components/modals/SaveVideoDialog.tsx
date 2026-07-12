import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  chooseVideoSaveLocation,
  clearVideoExportSegment,
  type FileHandleLike,
  type PlaylistExportTrack,
  setVideoExportSegment,
  startPlaylistVideoRecording,
  startVideoRecording,
  VIDEO_QUALITY_PRESETS,
  type VideoQualityPresetKey,
} from '@/app/actions/app';
import { chooseAudioFile, inspectAudioFile } from '@/app/actions/audio';
import { raiseError } from '@/app/actions/error';
import { snapshotProject, default as projectStore } from '@/app/actions/project';
import renderQueueStore from '@/app/actions/renderQueue';
import DualRangeInput from '@/app/components/inputs/DualRangeInput';
import TimeInput from '@/app/components/inputs/TimeInput';
import ExportWaveform from '@/app/components/modals/ExportWaveform';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';

type SaveVideoDialogProps = {
  onClose: () => void;
  fileHandle?: FileHandleLike | null;
  filePath?: string;
  defaultPath?: string;
  extension?: string;
  audioSource?: File | null;
  audioFileName?: string;
  audioBuffer?: AudioBuffer | null;
  totalDuration: number;
  startTime?: number;
  endTime?: number;
  includeAudio?: boolean;
};

const MIN_EXPORT_DURATION = 5;

const PRESET_BADGE_COLORS: Record<VideoQualityPresetKey, string> = {
  streaming: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  youtube: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  youtube_hq: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  qhd_2k: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  uhd_4k: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30',
  master: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
};

interface TrackEntry {
  id: string;
  file: File;
  name: string;
  duration: number;
  buffer: AudioBuffer | null;
  startTime: number;
  endTime: number;
}

export default function SaveVideoDialog({
  onClose,
  fileHandle: initialFileHandle = null,
  filePath: initialFilePath = '',
  defaultPath: initialDefaultPath = '',
  extension = 'webm',
  audioSource: initialAudioSource = null,
  audioFileName: initialAudioFileName = '',
  audioBuffer: initialAudioBuffer = null,
  totalDuration: initialTotalDuration,
  startTime = 0,
  endTime = initialTotalDuration,
  includeAudio = true,
}: SaveVideoDialogProps) {
  const { t } = useTranslation(undefined, { keyPrefix: 'save-video' });
  const { t: tc } = useTranslation(undefined, { keyPrefix: 'common' });
  const { t: te } = useTranslation(undefined, { keyPrefix: 'errors' });

  const [fileHandle, setFileHandle] = useState(initialFileHandle);
  const [filePath, setFilePath] = useState(initialFilePath);
  const [shouldIncludeAudio, setShouldIncludeAudio] = useState(includeAudio);
  const [validationMessage, setValidationMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChoosingLocation, setIsChoosingLocation] = useState(false);
  const [selectedQualityPreset, setSelectedQualityPreset] = useState<VideoQualityPresetKey>('youtube');

  const [exportFormat, setExportFormat] = useState<'webm' | 'mp4'>('mp4');
  const [videoCodec, setVideoCodec] = useState<'vp9' | 'h264' | 'hevc'>('hevc');

  const handleFormatChange = (fmt: 'webm' | 'mp4') => {
    setExportFormat(fmt);
    if (fmt === 'webm') {
      setVideoCodec('vp9');
      if (filePath) {
        setFilePath(prev => prev.replace(/\.mp4$/, '.webm'));
      }
    } else {
      setVideoCodec('hevc');
      if (filePath) {
        setFilePath(prev => prev.replace(/\.webm$/, '.mp4'));
      }
    }
  };

  // Playlist state automatically synchronized with Astrofox active playlist
  const [tracks, setTracks] = useState<TrackEntry[]>(() => {
    const audioState = audioStore.getState();
    const playlist = audioState.playlist || [];
    if (playlist.length > 0) {
      return playlist.map(trk => ({
        id: trk.id,
        file: trk.file as File,
        name: trk.name,
        duration: trk.duration,
        buffer: trk.audio?.buffer ?? null,
        startTime: 0,
        endTime: trk.duration,
      }));
    }
    if (initialAudioSource && initialAudioFileName) {
      return [
        {
          id: Math.random().toString(36).slice(7),
          file: initialAudioSource,
          name: initialAudioFileName,
          duration: initialTotalDuration,
          buffer: initialAudioBuffer,
          startTime: startTime,
          endTime: endTime > 0 ? endTime : initialTotalDuration,
        },
      ];
    }
    return [];
  });

  // For waveform preview — show the selected (focused) track
  const [focusedTrackId, setFocusedTrackId] = useState<string | null>(
    tracks[0]?.id ?? null,
  );

  const keepSegmentOverlayRef = useRef(false);

  const focusedTrack = tracks.find(t => t.id === focusedTrackId) ?? tracks[0] ?? null;

  const totalExportDuration = tracks.reduce((sum, trk) => sum + (trk.endTime - trk.startTime), 0);

  useEffect(() => {
    if (focusedTrack) {
      setVideoExportSegment(focusedTrack.startTime, focusedTrack.endTime, focusedTrack.duration);
    }
  }, [focusedTrack?.startTime, focusedTrack?.endTime, focusedTrack?.duration]);

  useEffect(() => {
    return () => {
      if (!keepSegmentOverlayRef.current) {
        clearVideoExportSegment();
      }
    };
  }, []);

  async function handleAddTrack() {
    try {
      const file = await chooseAudioFile();
      if (!file) return;
      const audio = await inspectAudioFile(file);
      const newTrack: TrackEntry = {
        id: Math.random().toString(36).slice(7),
        file: audio.file,
        name: audio.name,
        duration: audio.duration,
        buffer: audio.buffer ?? null,
        startTime: 0,
        endTime: audio.duration,
      };
      setTracks(prev => [...prev, newTrack]);
      setFocusedTrackId(newTrack.id);
    } catch (error) {
      raiseError(te('choose-audio-file-failed'), error);
    }
  }

  function handleRemoveTrack(id: string) {
    setTracks(prev => {
      const next = prev.filter(t => t.id !== id);
      if (focusedTrackId === id) {
        setFocusedTrackId(next[0]?.id ?? null);
      }
      return next;
    });
  }

  function handleMoveTrack(id: string, dir: -1 | 1) {
    setTracks(prev => {
      const idx = prev.findIndex(t => t.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
  }

  function updateTrackTimes(id: string, startTime: number, endTime: number) {
    setTracks(prev => prev.map(t => t.id === id ? { ...t, startTime, endTime } : t));
  }

  async function handleChooseLocation() {
    setIsChoosingLocation(true);
    try {
      const selection = await chooseVideoSaveLocation(filePath, exportFormat);
      if (!selection.canceled) {
        setFileHandle(selection.fileHandle || null);
        setFilePath(selection.filePath || selection.defaultPath);
      }
    } catch (error) {
      raiseError(te('choose-video-save-location-failed'), error);
    } finally {
      setIsChoosingLocation(false);
    }
  }

  function handleCancel() {
    if (isSubmitting) return;
    keepSegmentOverlayRef.current = false;
    onClose();
  }

  function formatDuration(secs: number): string {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  async function handleSave() {
    if (tracks.length === 0) {
      setValidationMessage('Tambahkan minimal 1 track audio terlebih dahulu.');
      return;
    }

    if (!filePath && !fileHandle?.name) {
      setValidationMessage(t('validation-no-location'));
      return;
    }

    setValidationMessage('');
    setIsSubmitting(true);

    try {
      const preset = VIDEO_QUALITY_PRESETS[selectedQualityPreset];
      const playlistTracks: PlaylistExportTrack[] = tracks.map(trk => ({
        file: trk.file,
        name: trk.name,
        startTime: trk.startTime,
        endTime: trk.endTime,
      }));

      let started: boolean;
      if (tracks.length === 1) {
        // Single track — use simpler original path
        started = await startVideoRecording({
          fileHandle,
          filePath,
          defaultPath: initialDefaultPath,
          startTime: tracks[0].startTime,
          endTime: tracks[0].endTime,
          includeAudio: shouldIncludeAudio,
          audioSource: tracks[0].file,
          videoBitrate: preset.bitrate,
          exportFormat,
          videoCodec,
        });
      } else {
        started = await startPlaylistVideoRecording({
          fileHandle,
          filePath,
          defaultPath: initialDefaultPath,
          includeAudio: shouldIncludeAudio,
          videoBitrate: preset.bitrate,
          tracks: playlistTracks,
          exportFormat,
          videoCodec,
        });
      }

      if (started) {
        keepSegmentOverlayRef.current = true;
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAddToQueue() {
    if (tracks.length === 0) {
      setValidationMessage('Tambahkan minimal 1 track audio terlebih dahulu.');
      return;
    }

    if (!filePath && !fileHandle?.name) {
      setValidationMessage(t('validation-no-location'));
      return;
    }

    setValidationMessage('');
    const projectSnapshot = snapshotProject();
    const preset = VIDEO_QUALITY_PRESETS[selectedQualityPreset];
    const qStore = renderQueueStore.getState();

    tracks.forEach((trk) => {
      const trkCleanName = trk.name.replace(/\.[^/.]+$/, "");
      const cleanFilePath = filePath
        ? filePath.replace(/(\.[^/.]+)$/, `-${trkCleanName}$1`)
        : `video-${trkCleanName}.${extension}`;

      qStore.addItem({
        projectName: `${projectStore.getState().projectName} - ${trk.name}`,
        projectSnapshot,
        audioFileName: trk.name,
        audioSource: trk.file,
        startTime: trk.startTime,
        endTime: trk.endTime,
        videoBitrate: preset.bitrate,
        includeAudio: shouldIncludeAudio,
        filePath: cleanFilePath,
        fileHandle: fileHandle,
      });
    });

    setValidationMessage(`Berhasil menambahkan ${tracks.length} track ke Antrian Render!`);
    
    setTimeout(() => {
      keepSegmentOverlayRef.current = false;
      onClose();
    }, 1500);
  }

  const presetKeys = Object.keys(VIDEO_QUALITY_PRESETS) as VideoQualityPresetKey[];

  return (
    <div className="flex w-[600px] max-w-full flex-col">
      <div className="flex max-h-[75vh] flex-col gap-4 overflow-auto px-4 py-4">

        {/* ── Playlist / Audio Tracks ── */}
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-neutral-100">Playlist Audio</h3>
              <p className="text-[11px] text-neutral-500">
                Total durasi: {formatDuration(totalExportDuration)}
                {tracks.length > 1 && ` (${tracks.length} track)`}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              onClick={handleAddTrack}
            >
              + Tambah Track
            </Button>
          </div>

          {tracks.length === 0 ? (
            <div
              className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-neutral-600 py-6 text-sm text-neutral-500 hover:border-neutral-400 hover:text-neutral-300"
              onClick={handleAddTrack}
            >
              Klik untuk memilih file audio
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {tracks.map((trk, idx) => (
                <div
                  key={trk.id}
                  onClick={() => setFocusedTrackId(trk.id)}
                  className={[
                    'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 transition-all',
                    focusedTrackId === trk.id
                      ? 'border-violet-500/50 bg-violet-500/10'
                      : 'border-neutral-700 bg-neutral-900 hover:border-neutral-500',
                  ].join(' ')}
                >
                  {/* Track number */}
                  <span className="w-5 shrink-0 text-center text-xs font-bold text-neutral-500">
                    {idx + 1}
                  </span>

                  {/* Track name and duration */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-neutral-200">{trk.name}</p>
                    <p className="text-[10px] text-neutral-500">
                      {formatDuration(trk.startTime)} – {formatDuration(trk.endTime)}
                      {' · '}
                      {formatDuration(trk.endTime - trk.startTime)}
                    </p>
                  </div>

                  {/* Controls */}
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={e => { e.stopPropagation(); handleMoveTrack(trk.id, -1); }}
                      className="rounded p-1 text-neutral-500 hover:text-neutral-200 disabled:opacity-30"
                      title="Pindah ke atas"
                    >▲</button>
                    <button
                      type="button"
                      disabled={idx === tracks.length - 1}
                      onClick={e => { e.stopPropagation(); handleMoveTrack(trk.id, 1); }}
                      className="rounded p-1 text-neutral-500 hover:text-neutral-200 disabled:opacity-30"
                      title="Pindah ke bawah"
                    >▼</button>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); handleRemoveTrack(trk.id); }}
                      className="rounded p-1 text-neutral-500 hover:text-red-400"
                      title="Hapus track"
                    >✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Time Range for Focused Track ── */}
        {focusedTrack && (
          <section className="space-y-2 rounded-lg border border-neutral-700 bg-neutral-900/60 px-3 py-3">
            <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
              Potong Track: <span className="text-neutral-200">{focusedTrack.name}</span>
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wide text-neutral-500">Start</label>
                <TimeInput
                  name="startTime"
                  value={focusedTrack.startTime}
                  min={0}
                  max={Math.max(0, focusedTrack.endTime - MIN_EXPORT_DURATION)}
                  width="100%"
                  disabled={false}
                  onChange={(_n, v) => updateTrackTimes(focusedTrack.id, v, focusedTrack.endTime)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wide text-neutral-500">End</label>
                <TimeInput
                  name="endTime"
                  value={focusedTrack.endTime}
                  min={focusedTrack.startTime + MIN_EXPORT_DURATION}
                  max={focusedTrack.duration}
                  width="100%"
                  disabled={false}
                  onChange={(_n, v) => updateTrackTimes(focusedTrack.id, focusedTrack.startTime, v)}
                />
              </div>
            </div>
            <ExportWaveform
              audioBuffer={focusedTrack.buffer}
              startTime={focusedTrack.startTime}
              endTime={focusedTrack.endTime}
              duration={focusedTrack.duration}
            />
            <DualRangeInput
              name="trackRange"
              value={[focusedTrack.startTime, focusedTrack.endTime]}
              min={0}
              max={Math.max(focusedTrack.duration, 0)}
              step={0.01}
              disabled={focusedTrack.duration <= 0}
              onChange={(_n, v: [number, number]) => updateTrackTimes(focusedTrack.id, v[0], v[1])}
              onUpdate={(_n, v: [number, number]) => updateTrackTimes(focusedTrack.id, v[0], v[1])}
            />
          </section>
        )}

        {/* ── Format & Codec Video ── */}
        <section className="space-y-2 rounded-lg border border-neutral-700 bg-neutral-900/40 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Format & Codec Video</h3>
          <div className="grid grid-cols-2 gap-3 mt-1.5">
            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase tracking-wider text-neutral-500 font-bold">Format Wadah (Container)</label>
              <select
                value={exportFormat}
                disabled={isSubmitting}
                onChange={e => handleFormatChange(e.target.value as 'webm' | 'mp4')}
                className="w-full h-8 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-200 outline-none focus:border-violet-500 transition-colors"
              >
                <option value="mp4">MP4 (.mp4 — Kompatibel & Cepat)</option>
                <option value="webm">WebM (.webm — Standar Web)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase tracking-wider text-neutral-500 font-bold">Codec Video</label>
              <select
                value={videoCodec}
                disabled={isSubmitting || exportFormat === 'webm'}
                onChange={e => setVideoCodec(e.target.value as 'vp9' | 'h264' | 'hevc')}
                className="w-full h-8 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-200 outline-none focus:border-violet-500 transition-colors disabled:opacity-40"
              >
                {exportFormat === 'mp4' ? (
                  <>
                    <option value="hevc">H.265 / HEVC (Akselerasi GPU Mac M4)</option>
                    <option value="h264">H.264 / AVC (Universalnya)</option>
                  </>
                ) : (
                  <option value="vp9">VP9 (Default WebM)</option>
                )}
              </select>
            </div>
          </div>
        </section>

        {/* ── Save Location ── */}
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium text-neutral-100">{t('save-location')}</h3>
            <Button
              variant="outline"
              size="sm"
              disabled={isSubmitting || isChoosingLocation}
              onClick={handleChooseLocation}
            >
              {isChoosingLocation ? tc('choosing') : tc('choose')}
            </Button>
          </div>
          <input
            type="text"
            readOnly
            value={filePath}
            placeholder={t('no-video-selected')}
            className="w-full rounded border border-border-input bg-neutral-900 px-3 py-2 font-mono text-xs text-neutral-300 outline-none"
          />
        </section>

        {/* ── Quality Preset ── */}
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-neutral-100">Quality Preset</h3>
          <div className="grid grid-cols-2 gap-2">
            {presetKeys.map(key => {
              const preset = VIDEO_QUALITY_PRESETS[key];
              const isSelected = selectedQualityPreset === key;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setSelectedQualityPreset(key)}
                  className={[
                    'flex flex-col gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-all',
                    isSelected
                      ? `${PRESET_BADGE_COLORS[key]} ring-1 ring-current`
                      : 'border-neutral-700 bg-neutral-900 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200',
                  ].join(' ')}
                >
                  <span className="text-xs font-semibold leading-tight">{preset.label}</span>
                  <span className="text-[10px] leading-tight opacity-70">{preset.description}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Include Audio ── */}
        <section>
          <div className="flex items-center justify-between gap-4 py-1">
            <label htmlFor="video-export-include-audio" className="text-sm text-neutral-100">
              {t('include-audio')}
            </label>
            <Switch
              id="video-export-include-audio"
              checked={shouldIncludeAudio}
              disabled={isSubmitting}
              onCheckedChange={setShouldIncludeAudio}
            />
          </div>
        </section>

        {validationMessage ? (
          <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {validationMessage}
          </div>
        ) : null}
      </div>

      <div className="shrink-0 bg-neutral-800 px-4 py-3">
        <DialogFooter className="justify-end sm:justify-end">
          <Button
            variant="outline"
            size="sm"
            disabled={isSubmitting || isChoosingLocation || tracks.length === 0}
            onClick={handleAddToQueue}
            className="border-violet-500/40 text-violet-400 hover:bg-violet-500/10 hover:text-violet-300"
          >
            Masukkan Antrian Render
          </Button>
          <Button
            variant="default"
            size="sm"
            disabled={isSubmitting || isChoosingLocation || tracks.length === 0}
            onClick={handleSave}
          >
            {isSubmitting
              ? `Merekam... (${tracks.length} track)`
              : tracks.length > 1
                ? `Export ${tracks.length} Track sebagai 1 Video`
                : t('save-video')}
          </Button>
          <Button variant="outline" size="sm" disabled={isSubmitting} onClick={handleCancel}>
            {tc('cancel')}
          </Button>
        </DialogFooter>
      </div>
    </div>
  );
}
