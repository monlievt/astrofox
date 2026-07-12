import { create } from 'zustand';
import audioStore, {
  connectMicrophone,
  connectMidiInput,
  loadAudioFile,
  openAudioFile,
} from '@/app/actions/audio';
import { raiseError } from '@/app/actions/error';
import { showModal } from '@/app/actions/modals';
import {
  checkUnsavedChanges,
  newProject,
  openProjectBrowser,
  saveProject,
} from '@/app/actions/project';
import { api, audioContext, library, logger, player, renderBackend, renderer } from '@/app/global';
import { t } from '@/i18n/config';
import Plugin from '@/lib/core/Plugin';
import * as displays from '@/lib/displays';
import * as effects from '@/lib/effects';
import { exportVideoOffline } from '@/lib/video/WebCodecsExporter';
import { loadAudioData } from '@/lib/utils/audio';

export interface VideoExportSegment {
  startPosition: number;
  endPosition: number;
}

interface AppState {
  statusText: string;
  showReactor: boolean;
  activeReactorId: string | null;
  activeElementId: string | null;
  cameraModeEnabled: boolean;
  displayTransformModeEnabled: boolean;
  isLeftPanelVisible: boolean;
  isBottomPanelVisible: boolean;
  isRightPanelVisible: boolean;
  isVideoRecording: boolean;
  isStagePictureInPictureActive: boolean;
  videoExportSegment: VideoExportSegment | null;
}

export interface FileHandleLike {
  name: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<{
    write: (blob: Blob) => Promise<void>;
    close: () => Promise<void>;
  }>;
}

interface VideoSaveLocationResult {
  canceled: boolean;
  defaultPath: string;
  extension: string;
  fileHandle?: FileHandleLike | null;
  filePath?: string;
}

interface StartVideoRecordingOptions {
  fileHandle?: FileHandleLike | null;
  filePath?: string;
  defaultPath?: string;
  startTime?: number;
  endTime?: number;
  includeAudio?: boolean;
  audioSource?: File | null;
  videoBitrate?: number;
  exportFormat?: 'webm' | 'mp4';
  videoCodec?: 'vp9' | 'h264' | 'hevc';
}

export interface PlaylistExportTrack {
  file: File;
  name: string;
  startTime?: number;
  endTime?: number;
}

export const VIDEO_QUALITY_PRESETS = {
  streaming: {
    label: 'Streaming (Live)',
    description: 'Twitch / YouTube Live — 5 Mbps',
    bitrate: 5_000_000,
  },
  youtube: {
    label: 'YouTube Standard',
    description: 'YouTube 1080p Upload — 8 Mbps',
    bitrate: 8_000_000,
  },
  youtube_hq: {
    label: 'YouTube High Quality',
    description: 'YouTube 1080p/1440p HQ — 12 Mbps',
    bitrate: 12_000_000,
  },
  qhd_2k: {
    label: 'YouTube 2K (1440p)',
    description: 'High Bitrate QHD — 25 Mbps',
    bitrate: 25_000_000,
  },
  uhd_4k: {
    label: 'YouTube 4K (2160p)',
    description: 'Ultra High Bitrate UHD — 45 Mbps',
    bitrate: 45_000_000,
  },
  master: {
    label: 'Master / Archive',
    description: 'Highest quality, large file — 60 Mbps',
    bitrate: 60_000_000,
  },
} as const;

export type VideoQualityPresetKey = keyof typeof VIDEO_QUALITY_PRESETS;

interface CaptureStreamCanvas {
  captureStream: (frameRate?: number) => MediaStream;
}

interface PluginConfig {
  name: string;
  label: string;
  type: string;
  defaultProperties: Record<string, unknown>;
  icon?: string;
}

interface PluginModuleLike {
  config: PluginConfig;
  prototype: Record<string, unknown>;
  [key: string]: unknown;
}

type LibraryModule = {
  config: PluginConfig;
};

type LibraryConstructor = (new (properties?: Record<string, unknown>) => unknown) & LibraryModule;

type PluginDescriptor = {
  src: string;
  icon?: string;
};

const initialState: AppState = {
  statusText: '',
  showReactor: false,
  activeReactorId: null,
  activeElementId: null,
  cameraModeEnabled: false,
  displayTransformModeEnabled: false,
  isLeftPanelVisible: true,
  isBottomPanelVisible: true,
  isRightPanelVisible: true,
  isVideoRecording: false,
  isStagePictureInPictureActive: false,
  videoExportSegment: null,
};

const appStore = create<AppState>(() => ({
  ...initialState,
}));

let appInitPromise: Promise<void> | null = null;
let appInitialized = false;
let activeVideoRecorder: MediaRecorder | null = null;
let stagePictureInPictureVideo: HTMLVideoElement | null = null;
let stagePictureInPictureStream: MediaStream | null = null;

const DEFAULT_VIDEO_FPS = 60;
const RECORDING_TIMESLICE_MS = 250;
const VIDEO_BITS_PER_SECOND = 8_000_000;
const VIDEO_MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4',
];

function getSupportedVideoMimeType(): string | null {
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') {
    return null;
  }

  return (
    VIDEO_MIME_CANDIDATES.find(mimeType => window.MediaRecorder.isTypeSupported(mimeType)) || null
  );
}

function getExtensionFromMimeType(mimeType: string): string {
  return mimeType.includes('mp4') ? 'mp4' : 'webm';
}

function cleanupStagePictureInPictureStream() {
  for (const track of stagePictureInPictureStream?.getTracks() || []) {
    track.stop();
  }

  stagePictureInPictureStream = null;

  if (stagePictureInPictureVideo) {
    stagePictureInPictureVideo.srcObject = null;
  }
}

function handleStagePictureInPictureLeave() {
  cleanupStagePictureInPictureStream();
  appStore.setState({ isStagePictureInPictureActive: false });
}

function ensureStagePictureInPictureVideo(): HTMLVideoElement | null {
  if (typeof document === 'undefined') {
    return null;
  }

  if (stagePictureInPictureVideo) {
    return stagePictureInPictureVideo;
  }

  const video = document.createElement('video');
  video.muted = true;
  video.autoplay = true;
  video.playsInline = true;
  video.setAttribute('aria-hidden', 'true');
  video.style.position = 'fixed';
  video.style.top = '-9999px';
  video.style.left = '-9999px';
  video.style.width = '1px';
  video.style.height = '1px';
  video.style.opacity = '0';
  video.style.pointerEvents = 'none';
  video.addEventListener('leavepictureinpicture', handleStagePictureInPictureLeave);
  document.body.appendChild(video);
  stagePictureInPictureVideo = video;

  return stagePictureInPictureVideo;
}

export function isStagePictureInPictureSupported() {
  if (typeof document === 'undefined') {
    return false;
  }

  const video = document.createElement('video');

  return Boolean(
    document.pictureInPictureEnabled && typeof video.requestPictureInPicture === 'function',
  );
}

function getVideoRecordingSetup(): {
  canvas: CaptureStreamCanvas;
  mimeType: string;
  extension: string;
} | null {
  if (activeVideoRecorder && activeVideoRecorder.state === 'recording') {
    raiseError(t('errors.video-recording-in-progress'));
    return null;
  }

  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') {
    raiseError(t('errors.video-recording-unsupported'));
    return null;
  }

  const canvas = renderBackend.getCanvas?.() as CaptureStreamCanvas | null;

  if (!canvas || typeof canvas.captureStream !== 'function') {
    raiseError(t('errors.stage-canvas-video-access-failed'));
    return null;
  }

  const mimeType = getSupportedVideoMimeType();

  if (!mimeType) {
    raiseError(t('errors.no-supported-video-format'));
    return null;
  }

  return {
    canvas,
    mimeType,
    extension: getExtensionFromMimeType(mimeType),
  };
}

export async function chooseVideoSaveLocation(
  preferredPath?: string,
  extension = 'webm',
): Promise<VideoSaveLocationResult> {
  const defaultPath = preferredPath || `video-${Date.now()}.${extension}`;
  const filters = [{ name: extension.toUpperCase(), extensions: [extension] }];
  const { fileHandle, filePath, canceled } = await api.showSaveDialog({
    defaultPath,
    filters,
  });

  if (canceled) {
    return {
      canceled: true,
      defaultPath,
      extension,
    };
  }

  return {
    canceled: false,
    fileHandle,
    filePath: filePath || fileHandle?.name || defaultPath,
    defaultPath,
    extension,
  };
}

export async function saveImage() {
  const { fileHandle, filePath, canceled } = await api.showSaveDialog({
    defaultPath: `image-${Date.now()}.png`,
    filters: [
      { name: 'PNG', extensions: ['png'] },
      { name: 'JPEG', extensions: ['jpg'] },
    ],
  });

  if (!canceled) {
    try {
      const data = renderer.getFrameData(0);

      renderBackend.render(data);

      const fileName = filePath || fileHandle?.name || `image-${Date.now()}.png`;
      const isJpeg = /jpe?g$/i.test(fileName);
      const mimeType = isJpeg ? 'image/jpeg' : 'image/png';
      const buffer = renderBackend.getImage(mimeType);

      await api.saveImageFile(fileHandle || fileName, buffer, {
        mimeType,
        fileName,
      });

      logger.log('Image saved:', fileName);
    } catch (error) {
      raiseError(t('errors.save-image-failed'), error);
    }
  }
}

export async function saveVideo() {
  const setup = getVideoRecordingSetup();

  if (!setup) {
    return;
  }

  const audioState = audioStore.getState() as {
    file?: string;
    source?: File | null;
    duration?: number;
  };
  const audioBuffer =
    (player.getAudio?.() as { buffer?: AudioBuffer | null } | undefined)?.buffer ?? null;
  const totalDuration = Number(audioState.duration ?? 0);

  showModal(
    'SaveVideoDialog',
    { titleKey: 'save-video.save-video', showCloseButton: false },
    {
      fileHandle: null,
      filePath: '',
      defaultPath: `video-${Date.now()}.${setup.extension}`,
      extension: setup.extension,
      audioSource: audioState.source ?? null,
      audioFileName: audioState.file ?? '',
      audioBuffer,
      totalDuration,
      startTime: 0,
      endTime: totalDuration,
      includeAudio: true,
    },
  );
}

export function setVideoExportSegment(startTime: number, endTime: number, totalDuration: number) {
  if (!Number.isFinite(totalDuration) || totalDuration <= 0) {
    appStore.setState({ videoExportSegment: null });
    return;
  }

  const startPosition = Math.max(0, Math.min(1, startTime / totalDuration));
  const endPosition = Math.max(0, Math.min(1, endTime / totalDuration));
  const isFullDuration = startPosition <= 0 && endPosition >= 1;

  if (endPosition <= startPosition || isFullDuration) {
    appStore.setState({ videoExportSegment: null });
    return;
  }

  appStore.setState({
    videoExportSegment: {
      startPosition,
      endPosition,
    },
  });
}

export function clearVideoExportSegment() {
  appStore.setState({ videoExportSegment: null });
}

export async function startVideoRecording({
  fileHandle,
  filePath,
  defaultPath,
  startTime = 0,
  endTime,
  includeAudio = true,
  audioSource = null,
  videoBitrate = VIDEO_BITS_PER_SECOND,
  exportFormat = 'webm',
  videoCodec = 'vp9',
}: StartVideoRecordingOptions): Promise<boolean> {
  if (audioSource) {
    await loadAudioFile(audioSource, false);
  }

  const setup = getVideoRecordingSetup();

  if (!setup) {
    return false;
  }

  if (!player.hasAudio()) {
    raiseError(t('errors.choose-audio-before-saving-video'));
    return false;
  }

  const totalDuration = player.getDuration();

  if (!Number.isFinite(totalDuration) || totalDuration <= 0) {
    raiseError(t('errors.video-duration-failed'));
    return false;
  }

  const clampedStartTime = Math.max(0, startTime);
  const clampedEndTime = Math.min(totalDuration, endTime ?? totalDuration);

  if (clampedEndTime <= clampedStartTime) {
    raiseError(t('errors.video-end-before-start'));
    return false;
  }

  const durationMs = Math.max(250, Math.round((clampedEndTime - clampedStartTime) * 1000));
  let targetPath =
    filePath || fileHandle?.name || defaultPath || `video-${Date.now()}.${exportFormat === 'mp4' ? 'mp4' : setup.extension}`;
  if (exportFormat === 'mp4' && targetPath.endsWith('.webm')) {
    targetPath = targetPath.replace(/\.webm$/, '.mp4');
  }
  const previousLoop = player.isLooping();
  let audioDestination: MediaStreamAudioDestinationNode | null = null;
  let recordingStream: MediaStream | null = null;

  try {
    // ── GPU-Accelerated Offline WebCodecs Rendering Path (Faster than Real-time) ──
    if (typeof VideoEncoder !== 'undefined' && typeof AudioEncoder !== 'undefined') {
      const audioState = audioStore.getState();
      const activeTrack = audioState.playlist?.find(t => t.id === audioState.activeTrackId) || audioState.playlist?.[0];
      const audioBuffer = activeTrack?.audio?.buffer ?? null;

      const trackInfo = {
        file: audioSource || (activeTrack?.file as File),
        name: activeTrack?.name || 'audio',
        startTime: clampedStartTime,
        endTime: clampedEndTime,
        duration: totalDuration,
        buffer: audioBuffer,
      };

      appStore.setState({ isVideoRecording: true });

      try {
        const videoBlob = await exportVideoOffline({
          canvas: setup.canvas as unknown as HTMLCanvasElement,
          renderer,
          tracks: [trackInfo],
          fps: DEFAULT_VIDEO_FPS,
          bitrate: videoBitrate,
          onProgress: (progress, statusText) => {
            appStore.setState({ statusText });
          },
          exportFormat,
          videoCodec,
        });

        await api.saveVideoFile(fileHandle || targetPath, videoBlob, {
          mimeType: exportFormat === 'mp4' ? 'video/mp4' : 'video/webm',
          fileName: targetPath,
        });

        logger.log('[WebCodecsExport] Offline video saved successfully:', targetPath);
        return true;
      } catch (error) {
        raiseError(t('errors.save-video-file-failed'), error);
        return false;
      } finally {
        appStore.setState({ isVideoRecording: false, statusText: '' });
      }
    }

    // ── Fallback Real-time MediaRecorder Path ──
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    const canvasStream = setup.canvas.captureStream(DEFAULT_VIDEO_FPS);
    const tracks = [...canvasStream.getVideoTracks()];

    if (includeAudio) {
      audioDestination = audioContext.createMediaStreamDestination();
      player.volume.connect(audioDestination);
      tracks.push(...audioDestination.stream.getAudioTracks());
    }

    recordingStream = new MediaStream(tracks);
    const recorder = new window.MediaRecorder(recordingStream, {
      mimeType: setup.mimeType,
      videoBitsPerSecond: videoBitrate,
    });

    activeVideoRecorder = recorder;
    const chunks: Blob[] = [];
    const fileName = targetPath;
    let stopTimer: number | null = null;
    let recordingFailed = false;

    const onPlayerStop = () => {
      if (recorder.state === 'recording') {
        recorder.stop();
      }
    };

    const cleanup = () => {
      if (stopTimer) {
        window.clearTimeout(stopTimer);
        stopTimer = null;
      }

      player.off('stop', onPlayerStop);
      player.setLoop(previousLoop);

      if (audioDestination) {
        try {
          player.volume.disconnect(audioDestination);
        } catch (_error) {
          // Ignore disconnect errors from stale nodes.
        }
      }

      for (const track of recordingStream?.getTracks() || []) {
        track.stop();
      }

      if (player.isPlaying()) {
        player.stop();
      }

      activeVideoRecorder = null;
      appStore.setState({
        isVideoRecording: false,
        videoExportSegment: null,
      });
    };

    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    recorder.onerror = (event: Event & { error?: DOMException }) => {
      recordingFailed = true;
      cleanup();
      raiseError(t('errors.record-video-failed'), event?.error || event);
    };

    recorder.onstop = async () => {
      if (recordingFailed) {
        cleanup();
        return;
      }

      try {
        const blob = new Blob(chunks, { type: setup.mimeType });

        await api.saveVideoFile(fileHandle || fileName, blob, {
          mimeType: setup.mimeType,
          fileName,
        });

        logger.log('Video saved:', fileName);
      } catch (error) {
        raiseError(t('errors.save-video-file-failed'), error);
      } finally {
        cleanup();
      }
    };

    player.stop();
    player.setLoop(false);
    player.seek(clampedStartTime / totalDuration);
    player.on('stop', onPlayerStop);

    recorder.start(RECORDING_TIMESLICE_MS);
    appStore.setState({ isVideoRecording: true });
    player.play();

    stopTimer = window.setTimeout(() => {
      player.stop();
    }, durationMs);
    return true;
  } catch (error) {
    player.setLoop(previousLoop);

    if (audioDestination) {
      try {
        player.volume.disconnect(audioDestination);
      } catch (_error) {
        // Ignore disconnect errors from stale nodes.
      }
    }

    if (recordingStream) {
      for (const track of recordingStream.getTracks()) {
        track.stop();
      }
    }

    activeVideoRecorder = null;
    appStore.setState({ isVideoRecording: false });
    raiseError(t('errors.start-video-recording-failed'), error);
    return false;
  }
}

/**
 * Export multiple audio tracks as a single continuous video file.
 * Records each track back-to-back using the same MediaRecorder stream,
 * collects all chunk blobs, then saves them as one concatenated WebM/MP4.
 */
export async function startPlaylistVideoRecording({
  fileHandle,
  filePath,
  defaultPath,
  includeAudio = true,
  videoBitrate = VIDEO_BITS_PER_SECOND,
  tracks,
  exportFormat = 'webm',
  videoCodec = 'vp9',
}: {
  fileHandle?: FileHandleLike | null;
  filePath?: string;
  defaultPath?: string;
  includeAudio?: boolean;
  videoBitrate?: number;
  tracks: PlaylistExportTrack[];
  exportFormat?: 'webm' | 'mp4';
  videoCodec?: 'vp9' | 'h264' | 'hevc';
}): Promise<boolean> {
  if (!tracks || tracks.length === 0) {
    raiseError(t('errors.choose-audio-before-saving-video'));
    return false;
  }

  const setup = getVideoRecordingSetup();
  if (!setup) return false;

  let audioDestination: MediaStreamAudioDestinationNode | null = null;
  let recordingStream: MediaStream | null = null;
  const allChunks: Blob[] = [];
  let targetPath =
    filePath || fileHandle?.name || defaultPath || `playlist-${Date.now()}.${exportFormat === 'mp4' ? 'mp4' : setup.extension}`;
  if (exportFormat === 'mp4' && targetPath.endsWith('.webm')) {
    targetPath = targetPath.replace(/\.webm$/, '.mp4');
  }

  try {
    // ── GPU-Accelerated Offline WebCodecs Rendering Path for Playlists ──
    if (typeof VideoEncoder !== 'undefined' && typeof AudioEncoder !== 'undefined') {
      appStore.setState({ isVideoRecording: true });

      try {
        appStore.setState({ statusText: 'Membaca data audio...' });
        const exporterTracks = [];
        for (const track of tracks) {
          const fileData = await api.readAudioFile(track.file);
          const audio = await loadAudioData(fileData);
          exporterTracks.push({
            file: track.file,
            name: track.name,
            startTime: track.startTime ?? 0,
            endTime: track.endTime ?? audio.getDuration(),
            duration: audio.getDuration(),
            buffer: audio.buffer,
          });
        }

        const videoBlob = await exportVideoOffline({
          canvas: setup.canvas as unknown as HTMLCanvasElement,
          renderer,
          tracks: exporterTracks,
          fps: DEFAULT_VIDEO_FPS,
          bitrate: videoBitrate,
          onProgress: (progress, statusText) => {
            appStore.setState({ statusText });
          },
          exportFormat,
          videoCodec,
        });

        await api.saveVideoFile(fileHandle || targetPath, videoBlob, {
          mimeType: exportFormat === 'mp4' ? 'video/mp4' : 'video/webm',
          fileName: targetPath,
        });

        logger.log('[WebCodecsExport] Offline playlist video saved successfully:', targetPath);
        return true;
      } catch (error) {
        raiseError(t('errors.save-video-file-failed'), error);
        return false;
      } finally {
        appStore.setState({ isVideoRecording: false, statusText: '' });
      }
    }

    // ── Fallback Real-time MediaRecorder Path ──
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    const canvasStream = setup.canvas.captureStream(DEFAULT_VIDEO_FPS);
    const videoTracks = [...canvasStream.getVideoTracks()];

    if (includeAudio) {
      audioDestination = audioContext.createMediaStreamDestination();
      player.volume.connect(audioDestination);
      videoTracks.push(...audioDestination.stream.getAudioTracks());
    }

    recordingStream = new MediaStream(videoTracks);

    const recorder = new window.MediaRecorder(recordingStream, {
      mimeType: setup.mimeType,
      videoBitsPerSecond: videoBitrate,
    });

    activeVideoRecorder = recorder;
    appStore.setState({ isVideoRecording: true });

    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        allChunks.push(event.data);
      }
    };

    let recordingFailed = false;
    recorder.onerror = (event: Event & { error?: DOMException }) => {
      recordingFailed = true;
      raiseError(t('errors.record-video-failed'), event?.error || event);
    };

    // Start recorder once — we pause/resume between tracks
    recorder.start(RECORDING_TIMESLICE_MS);

    for (let i = 0; i < tracks.length; i++) {
      if (recordingFailed) break;

      const track = tracks[i];
      await loadAudioFile(track.file, false);

      const trackDuration = player.getDuration();
      if (!Number.isFinite(trackDuration) || trackDuration <= 0) continue;

      const clampedStart = Math.max(0, track.startTime ?? 0);
      const clampedEnd = Math.min(trackDuration, track.endTime ?? trackDuration);
      const durationMs = Math.max(250, Math.round((clampedEnd - clampedStart) * 1000));

      player.stop();
      player.setLoop(false);
      player.seek(clampedStart / trackDuration);
      player.play();

      // Wait for the track to finish playing
      await new Promise<void>(resolve => {
        const timer = window.setTimeout(() => {
          player.stop();
          resolve();
        }, durationMs + 200); // extra 200ms buffer

        player.once('stop', () => {
          window.clearTimeout(timer);
          resolve();
        });
      });

      // Brief pause between tracks
      if (i < tracks.length - 1) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    // Stop recorder and wait for final onstop flush
    await new Promise<void>(resolve => {
      recorder.onstop = async () => {
        if (!recordingFailed && allChunks.length > 0) {
          try {
            const blob = new Blob(allChunks, { type: setup.mimeType });
            await api.saveVideoFile(fileHandle || targetPath, blob, {
              mimeType: setup.mimeType,
              fileName: targetPath,
            });
            logger.log('Playlist video saved:', targetPath);
          } catch (error) {
            raiseError(t('errors.save-video-file-failed'), error);
          }
        }
        resolve();
      };
      recorder.stop();
    });

    return !recordingFailed;
  } catch (error) {
    raiseError(t('errors.start-video-recording-failed'), error);
    return false;
  } finally {
    if (audioDestination) {
      try { player.volume.disconnect(audioDestination); } catch (_e) { /* ignore */ }
    }
    for (const track of recordingStream?.getTracks() || []) {
      track.stop();
    }
    if (player.isPlaying()) player.stop();
    activeVideoRecorder = null;
    appStore.setState({ isVideoRecording: false, videoExportSegment: null });
  }
}

export async function startStagePictureInPicture() {
  if (!isStagePictureInPictureSupported()) {
    raiseError(t('errors.picture-in-picture-unsupported'));
    return false;
  }

  const canvas = renderBackend.getCanvas?.() as CaptureStreamCanvas | null;

  if (!canvas || typeof canvas.captureStream !== 'function') {
    raiseError(t('errors.stage-canvas-picture-in-picture-access-failed'));
    return false;
  }

  const video = ensureStagePictureInPictureVideo();

  if (!video) {
    raiseError(t('errors.picture-in-picture-init-failed'));
    return false;
  }

  try {
    renderer.requestRender();

    if (document.pictureInPictureElement && document.pictureInPictureElement !== video) {
      await document.exitPictureInPicture();
    }

    cleanupStagePictureInPictureStream();
    stagePictureInPictureStream = canvas.captureStream(DEFAULT_VIDEO_FPS);
    video.srcObject = stagePictureInPictureStream;
    await video.play();
    await video.requestPictureInPicture();
    appStore.setState({ isStagePictureInPictureActive: true });
    return true;
  } catch (error) {
    handleStagePictureInPictureLeave();
    raiseError(t('errors.start-picture-in-picture-failed'), error);
    return false;
  }
}

export async function stopStagePictureInPicture() {
  if (typeof document === 'undefined') {
    return false;
  }

  try {
    if (
      stagePictureInPictureVideo &&
      document.pictureInPictureElement === stagePictureInPictureVideo
    ) {
      await document.exitPictureInPicture();
    } else {
      handleStagePictureInPictureLeave();
    }

    return true;
  } catch (error) {
    raiseError(t('errors.close-picture-in-picture-failed'), error);
    return false;
  }
}

export function toggleStagePictureInPicture() {
  if (appStore.getState().isStagePictureInPictureActive) {
    return stopStagePictureInPicture();
  }

  return startStagePictureInPicture();
}

export function setActiveReactorId(reactorId?: string | null) {
  appStore.setState({ activeReactorId: reactorId || null });
}

export function setActiveElementId(elementId?: string | null) {
  appStore.setState({ activeElementId: elementId || null });
}

export function setCameraModeEnabled(enabled: boolean) {
  appStore.setState({ cameraModeEnabled: enabled });
  renderer.setContinuousRendering('camera-mode', enabled);
  renderer.requestRender();
}

export function setDisplayTransformModeEnabled(enabled: boolean) {
  appStore.setState({ displayTransformModeEnabled: enabled });
  renderer.setContinuousRendering('display-transform', enabled);
  renderer.requestRender();
}

export function toggleCameraMode() {
  setCameraModeEnabled(!appStore.getState().cameraModeEnabled);
}

export function toggleLeftPanelVisibility() {
  appStore.setState(state => ({
    isLeftPanelVisible: !state.isLeftPanelVisible,
  }));
}

export function toggleBottomPanelVisibility() {
  appStore.setState(state => ({
    isBottomPanelVisible: !state.isBottomPanelVisible,
  }));
}

export function toggleRightPanelVisibility() {
  appStore.setState(state => ({
    isRightPanelVisible: !state.isRightPanelVisible,
  }));
}

export async function handleMenuAction(action: string) {
  switch (action) {
    case 'new-project':
      await checkUnsavedChanges(action, newProject);
      break;

    case 'open-project':
      await checkUnsavedChanges(action, openProjectBrowser);
      break;

    case 'save-project':
      await saveProject(undefined);
      break;

    case 'load-audio':
      await openAudioFile(undefined);
      break;

    case 'use-microphone':
      await connectMicrophone(undefined);
      break;

    case 'use-midi':
      await connectMidiInput(undefined);
      break;

    case 'save-image':
      await saveImage();
      break;

    case 'save-video':
      await saveVideo();
      break;

    case 'edit-canvas':
      await showModal('CanvasSettings', {
        titleKey: 'menu.project-settings',
        showCloseButton: false,
      });
      break;

    case 'open-dev-tools':
      api.openDevTools();
      break;
  }
}

export async function loadPlugins() {
  logger.time('plugins');

  const plugins: Record<string, LibraryConstructor> = {};

  for (const [key, plugin] of Object.entries(
    api.getPlugins() as Record<string, PluginDescriptor>,
  )) {
    try {
      const module = (await import(/* webpackIgnore: true */ plugin.src)) as {
        default: PluginModuleLike;
      };

      module.default.config.icon = plugin.icon;

      plugins[key] = Plugin.create(module.default) as unknown as LibraryConstructor;
    } catch (e) {
      logger.error(e);
    }
  }

  library.set('plugins', plugins);

  logger.timeEnd('plugins', 'Loaded plugins', plugins);
}

export async function loadLibrary() {
  const plugins = (library.get('plugins') ?? {}) as Record<string, LibraryConstructor>;

  const coreDisplays: Record<string, LibraryConstructor> = {};
  for (const [key, display] of Object.entries(displays as Record<string, LibraryConstructor>)) {
    display.config.icon = `images/controls/${key}.png`;

    coreDisplays[key] = display;
  }

  const coreEffects: Record<string, LibraryConstructor> = {};
  for (const [key, effect] of Object.entries(effects as Record<string, LibraryConstructor>)) {
    effect.config.icon = `images/controls/${key}.png`;

    coreEffects[key] = effect;
  }

  for (const [key, plugin] of Object.entries(plugins)) {
    const { type } = plugin.config;

    if (type === 'display') {
      coreDisplays[key] = plugin;
    } else if (type === 'effect') {
      coreEffects[key] = plugin;
    }
  }

  library.set('displays', coreDisplays);
  library.set('effects', coreEffects);

  logger.log('Loaded library', library);
}

export async function initApp() {
  if (appInitialized) {
    return;
  }

  if (appInitPromise) {
    return appInitPromise;
  }

  appInitPromise = (async () => {
    await loadPlugins();
    await loadLibrary();
    await newProject();

    renderer.start();
    appInitialized = true;
  })().finally(() => {
    appInitPromise = null;
  });

  return appInitPromise;
}

export default appStore;
