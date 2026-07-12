// @ts-nocheck

import { create } from 'zustand';
import { analyzer, api, audioContext, logger, player } from '@/app/global';
import { t } from '@/i18n/config';
import type Audio from '@/lib/audio/Audio';
import { loadAudioData } from '@/lib/utils/audio';
import { trimChars } from '@/lib/utils/string';
import appStore from './app';
import { raiseError } from './error';

export interface InputOption {
  id: string;
  label: string;
}

export interface PlaylistTrack {
  id: string;
  name: string;
  file: File | string;
  duration: number;
  volume: number;
  enabled: boolean;
  audio: Audio | null;
  gainNode: GainNode | null;
  artworkUrl?: string | null;
}

export interface AudioState {
  liveModeEnabled: boolean;
  liveInputMode: 'microphone' | 'midi' | 'desktop';
  mode: 'file' | 'microphone' | 'midi' | 'desktop';
  file: string;
  source: File | null;
  sourceLabel: string;
  duration: number;
  loading: boolean;
  tags: Record<string, unknown> | null;
  error: string | null;
  microphoneDevices: InputOption[];
  selectedMicrophoneId: string;
  midiInputs: InputOption[];
  selectedMidiInputId: string;
  liveInputGain: number;
  microphoneSupported: boolean;
  desktopAudioSupported: boolean;
  midiSupported: boolean;
  playlist: PlaylistTrack[];
  playbackMode: 'sequential' | 'simultaneous';
  activeTrackId: string | null;
}

export const initialState: AudioState = {
  liveModeEnabled: false,
  liveInputMode: 'microphone',
  mode: 'file',
  file: '',
  source: null,
  sourceLabel: '',
  duration: 0,
  loading: false,
  tags: null,
  error: null,
  microphoneDevices: [],
  selectedMicrophoneId: '',
  midiInputs: [],
  selectedMidiInputId: '',
  liveInputGain: 100,
  microphoneSupported: false,
  desktopAudioSupported: false,
  midiSupported: false,
  playlist: [],
  playbackMode: 'sequential',
  activeTrackId: null,
};

const audioStore = create<AudioState>(() => ({
  ...initialState,
}));

if (typeof window !== 'undefined') {
  (window as any).audioStore = audioStore;
}

const AUDIO_FILE_EXTENSIONS = ['aac', 'flac', 'mp3', 'm4a', 'opus', 'ogg', 'wav'];
const DESKTOP_AUDIO_MISSING_ERROR = 'DESKTOP_AUDIO_MISSING';
const NO_MIDI_INPUTS_ERROR = 'NO_MIDI_INPUTS';

function getAudioFileFilters() {
  return [
    {
      name: t('file-types.audio-files'),
      extensions: AUDIO_FILE_EXTENSIONS,
    },
  ];
}

let midiAccess: MIDIAccess | null = null;
let activeMidiInput: MIDIInput | null = null;

function updateAudioState(
  partial: Partial<AudioState> & {
    mode?: 'file' | 'microphone' | 'midi' | 'desktop';
  },
) {
  audioStore.setState(partial);
}

function resetSourceState(mode: 'file' | 'microphone' | 'midi' | 'desktop') {
  updateAudioState({
    mode,
    file: '',
    source: null,
    sourceLabel: '',
    duration: 0,
    tags: null,
    loading: false,
    error: null,
  });
}

function getMicrophoneLabel(stream: MediaStream, fallback = t('live-mode.microphone')) {
  const [track] = stream.getAudioTracks();
  return track?.label || fallback;
}

function toDeviceOption(device: MediaDeviceInfo, index: number) {
  return {
    id: device.deviceId,
    label: device.label || t('audio.microphone-device', { count: index + 1 }),
  };
}

function getPreferredMicrophoneId(microphones: InputOption[], currentSelection: string) {
  if (microphones.some(device => device.id === currentSelection)) {
    return currentSelection;
  }

  const defaultDevice = microphones.find(device => device.id === 'default');

  return defaultDevice?.id || microphones[0]?.id || '';
}

function toMidiOption(input: MIDIInput) {
  return {
    id: input.id,
    label: input.name || input.manufacturer || t('audio.midi-input'),
  };
}

function detachMidiInput() {
  if (activeMidiInput) {
    activeMidiInput.onmidimessage = null;
    activeMidiInput = null;
  }
}

function clearLiveInputs() {
  detachMidiInput();
  player.clearSource();
}

function handleMidiMessage(event: MIDIMessageEvent) {
  player.handleMidiMessage({ data: event.data });
}

async function ensureMidiAccess() {
  if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
    throw new Error(t('errors.web-midi-unsupported'));
  }

  if (!midiAccess) {
    midiAccess = await navigator.requestMIDIAccess();
    midiAccess.onstatechange = () => {
      void syncMidiInputs();
    };
  }

  return midiAccess;
}

async function syncMidiInputs() {
  const supported =
    typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';

  if (!supported) {
    updateAudioState({
      midiSupported: false,
      midiInputs: [],
      selectedMidiInputId: '',
    });
    return [];
  }

  if (!midiAccess) {
    updateAudioState({
      midiSupported: true,
    });
    return audioStore.getState().midiInputs;
  }

  const inputs = Array.from(midiAccess.inputs.values()).map(toMidiOption);
  const selectedMidiInputId =
    activeMidiInput?.id || audioStore.getState().selectedMidiInputId || inputs[0]?.id || '';

  updateAudioState({
    midiSupported: true,
    midiInputs: inputs,
    selectedMidiInputId,
  });

  return inputs;
}

export async function inspectAudioFile(file: File) {
  const data = await api.readAudioFile(file);
  const audio = await loadAudioData(data);

  return {
    file,
    name: file.name,
    duration: audio.getDuration(),
    buffer: audio.buffer,
  };
}

export async function chooseAudioFile() {
  const { files, canceled } = await api.showOpenDialog({
    filters: getAudioFileFilters(),
  });

  if (canceled || !files?.length) {
    return null;
  }

  return files[0];
}

export async function refreshMicrophoneDevices() {
  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.enumerateDevices;

  if (!supported) {
    updateAudioState({
      microphoneSupported: false,
      microphoneDevices: [],
      selectedMicrophoneId: '',
    });
    return [];
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  const microphones = devices.filter(device => device.kind === 'audioinput').map(toDeviceOption);
  const currentSelection = audioStore.getState().selectedMicrophoneId;
  const selectedMicrophoneId = getPreferredMicrophoneId(microphones, currentSelection);

  updateAudioState({
    microphoneSupported: true,
    microphoneDevices: microphones,
    selectedMicrophoneId,
  });

  return microphones;
}

export async function refreshInputOptions() {
  await refreshMicrophoneDevices();
  await syncMidiInputs();

  const desktopAudioSupported =
    typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;

  updateAudioState({ desktopAudioSupported });
}

export function selectMicrophoneDevice(deviceId: string) {
  if (audioStore.getState().selectedMicrophoneId === deviceId) {
    return;
  }

  updateAudioState({ selectedMicrophoneId: deviceId });

  if (player.getMode() === 'microphone' && player.hasSource()) {
    void connectMicrophone(deviceId);
  }
}

export function selectMidiInput(inputId: string) {
  if (audioStore.getState().selectedMidiInputId === inputId) {
    return;
  }

  updateAudioState({ selectedMidiInputId: inputId });

  if (player.getMode() === 'midi' && player.hasSource()) {
    void connectMidiInput(inputId);
  }
}

export function setLiveInputGain(value: number) {
  const liveInputGain = Math.max(0, Math.min(300, value));

  updateAudioState({ liveInputGain });
  player.setInputGain(liveInputGain / 100);
}

function getArtworkUrl(picture: { format: string; data: number[] | Uint8Array }) {
  if (!picture || !picture.data) return null;
  const base64String =
    typeof window !== 'undefined'
      ? window.btoa(
          new Uint8Array(picture.data).reduce((data, byte) => data + String.fromCharCode(byte), ''),
        )
      : Buffer.from(picture.data).toString('base64');
  return `data:${picture.format};base64,${base64String}`;
}

export async function loadAudioFile(file: File | string, play?: boolean) {
  console.log('[loadAudioFile] Starting to load:', file, 'play:', play);

  const state = audioStore.getState();
  const currentPlaylist = state.playlist || [];
  const isFirstTrack = currentPlaylist.length === 0;
  const forceActivate = play ?? false;

  updateAudioState({ loading: true });

  if (isFirstTrack || forceActivate) {
    console.log('[loadAudioFile] Will activate this track. Clearing live inputs...');
    updateAudioState({ liveModeEnabled: false, mode: 'file' });
    clearLiveInputs();
  }

  // Yield one frame so loading UI can paint before heavy audio decode work begins.
  await new Promise(resolve => {
    if (typeof window !== 'undefined' && window.requestAnimationFrame) {
      window.requestAnimationFrame(() => resolve());
      return;
    }

    setTimeout(() => resolve(), 0);
  });

  const name =
    file instanceof File
      ? file.name
      : typeof file === 'string'
        ? file.split(/[\\/]/).pop() || ''
        : '';
  console.log('[loadAudioFile] Extracted name:', name);

  logger.time('audio-file-load');

  try {
    console.log('[loadAudioFile] Reading audio file...');
    const data = await api.readAudioFile(file);
    console.log('[loadAudioFile] File read complete. Size:', data.byteLength);

    console.log('[loadAudioFile] Decoding audio data...');
    const audio = await loadAudioData(data);
    console.log('[loadAudioFile] Audio decode complete. Duration:', audio.getDuration());
    const duration = audio.getDuration();

    // Create individual GainNode for mixing
    console.log('[loadAudioFile] Creating and connecting GainNode...');
    const gainNode = audioContext.createGain();
    gainNode.connect(player.volume);
    audio.addNode(gainNode);
    audio.addNode(analyzer.analyzer);

    console.log('[loadAudioFile] Loading tags...');
    const tags = await api.loadAudioTags(file);
    console.log('[loadAudioFile] Tags loaded:', tags);
    const artworkUrl = tags?.picture ? getArtworkUrl(tags.picture) : null;

    const id = Math.random().toString(36).substring(7);
    const newTrack: PlaylistTrack = {
      id,
      name,
      file,
      duration,
      volume: 1.0,
      enabled: true,
      audio,
      gainNode,
      artworkUrl,
    };

    const nextPlaylist = [...currentPlaylist, newTrack];
    console.log(
      '[loadAudioFile] Current playlist length:',
      currentPlaylist.length,
      'Next length:',
      nextPlaylist.length,
    );

    // Update playlist state first so player.load() sees the track in the playlist
    updateAudioState({
      playlist: nextPlaylist,
    });

    if (isFirstTrack || forceActivate) {
      console.log('[loadAudioFile] Activating and loading into player:', name);
      player.load(audio, name);
      updateAudioState({
        file: name,
        source: file instanceof File ? file : null,
        sourceLabel: name,
        duration,
        tags,
        activeTrackId: id,
      });
    } else if (state.playbackMode === 'simultaneous') {
      const maxDuration = Math.max(...nextPlaylist.map(t => t.duration));
      console.log('[loadAudioFile] Simultaneous mode, updating duration to:', maxDuration);
      updateAudioState({
        duration: maxDuration,
      });
    }

    updateAudioState({
      loading: false,
    });
    console.log('[loadAudioFile] State updated successfully!');

    if ((isFirstTrack || forceActivate) && (play ?? true)) {
      console.log('[loadAudioFile] Autoplay requested, starting playback');
      player.play();
    }

    logger.timeEnd('audio-file-load', 'Audio file loaded:', name);

    if (tags) {
      const { artist, title } = tags;
      appStore.setState({ statusText: trimChars(`${artist} - ${title}`) });
    } else {
      appStore.setState({ statusText: trimChars(name) });
    }
  } catch (error) {
    console.error('[loadAudioFile] Error occurred:', error);
    raiseError(t('errors.invalid-audio-file'), error);
    updateAudioState({ loading: false });
  }
}

export async function connectMicrophone(deviceId?: string) {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    raiseError(t('errors.microphone-unsupported'));
    return false;
  }

  const selectedDeviceId = deviceId || audioStore.getState().selectedMicrophoneId;

  updateAudioState({ loading: true });
  detachMidiInput();
  player.clearSource();

  try {
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: selectedDeviceId
        ? {
            deviceId: {
              exact: selectedDeviceId,
            },
          }
        : true,
    });
    await refreshMicrophoneDevices();

    const label = getMicrophoneLabel(stream);
    player.useMicrophone(stream, analyzer.analyzer, label);
    player.setInputGain(audioStore.getState().liveInputGain / 100);

    appStore.setState({
      statusText: trimChars(t('status.live', { label })),
    });

    updateAudioState({
      liveModeEnabled: true,
      liveInputMode: 'microphone',
      mode: 'microphone',
      file: '',
      source: null,
      sourceLabel: label,
      duration: 0,
      tags: null,
      loading: false,
      selectedMicrophoneId:
        stream.getAudioTracks()[0]?.getSettings().deviceId ||
        selectedDeviceId ||
        audioStore.getState().selectedMicrophoneId ||
        '',
    });

    return true;
  } catch (error) {
    raiseError(t('errors.microphone-access-failed'), error);
    resetSourceState('microphone');
    return false;
  }
}

export async function connectDesktopAudio() {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
    raiseError(t('errors.desktop-audio-unsupported'));
    return false;
  }

  updateAudioState({ loading: true });
  detachMidiInput();
  player.clearSource();

  try {
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
      systemAudio: 'include',
    });

    for (const track of stream.getVideoTracks()) {
      track.stop();
    }

    if (stream.getAudioTracks().length === 0) {
      throw new Error(DESKTOP_AUDIO_MISSING_ERROR);
    }

    stream.getAudioTracks()[0].addEventListener('ended', () => {
      setLiveModeEnabled(false);
    });

    const label = stream.getAudioTracks()[0]?.label || t('live-mode.desktop-audio');
    player.useDesktopAudio(stream, analyzer.analyzer, label);
    player.setInputGain(audioStore.getState().liveInputGain / 100);

    appStore.setState({
      statusText: trimChars(t('status.live', { label })),
    });

    updateAudioState({
      liveModeEnabled: true,
      liveInputMode: 'desktop',
      mode: 'desktop',
      file: '',
      source: null,
      sourceLabel: label,
      duration: 0,
      tags: null,
      loading: false,
    });

    return true;
  } catch (error) {
    if (error instanceof Error && error.name === 'NotAllowedError') {
      updateAudioState({ loading: false });
      return false;
    }

    if (error instanceof Error && error.message === DESKTOP_AUDIO_MISSING_ERROR) {
      raiseError(t('errors.desktop-audio-missing'), undefined, {
        logLevel: 'warn',
      });
      resetSourceState('desktop');
      return false;
    }

    raiseError(t('errors.desktop-audio-capture-failed'), error);
    resetSourceState('desktop');
    return false;
  }
}

export async function connectMidiInput(inputId?: string) {
  const selectedInputId = inputId || audioStore.getState().selectedMidiInputId;

  updateAudioState({ loading: true });
  player.clearSource();
  detachMidiInput();

  try {
    const access = await ensureMidiAccess();
    const inputs = Array.from(access.inputs.values());
    const targetInput = inputs.find(input => input.id === selectedInputId) || inputs[0] || null;

    await syncMidiInputs();

    if (!targetInput) {
      throw new Error(NO_MIDI_INPUTS_ERROR);
    }

    activeMidiInput = targetInput;
    activeMidiInput.onmidimessage = handleMidiMessage;

    const label = targetInput.name || targetInput.manufacturer || t('audio.midi-input');
    player.useMidi(label);

    appStore.setState({
      statusText: trimChars(t('status.live-midi', { label })),
    });

    updateAudioState({
      liveModeEnabled: true,
      liveInputMode: 'midi',
      mode: 'midi',
      file: '',
      source: null,
      sourceLabel: label,
      duration: 0,
      tags: null,
      loading: false,
      selectedMidiInputId: targetInput.id,
    });

    return true;
  } catch (error) {
    const expectedMissingInput = error instanceof Error && error.message === NO_MIDI_INPUTS_ERROR;

    raiseError(
      t('errors.midi-connect-failed'),
      expectedMissingInput ? new Error(t('errors.no-midi-inputs-found')) : error,
      {
        logLevel: expectedMissingInput ? 'warn' : 'error',
      },
    );
    resetSourceState('midi');
    return false;
  }
}

export function setLiveInputMode(mode: 'microphone' | 'midi' | 'desktop') {
  updateAudioState({
    liveInputMode: mode,
    mode,
    file: '',
    source: null,
    sourceLabel: '',
    duration: 0,
    tags: null,
    error: null,
  });
  player.clearSource();
}

export function setLiveModeEnabled(enabled: boolean) {
  if (!enabled) {
    clearLiveInputs();
    resetSourceState('file');
    updateAudioState({ liveModeEnabled: false, mode: 'file' });
    appStore.setState({ statusText: '' });
    return;
  }

  const { liveInputMode } = audioStore.getState();
  clearLiveInputs();
  resetSourceState(liveInputMode);
  updateAudioState({
    liveModeEnabled: true,
    mode: liveInputMode,
  });
  appStore.setState({
    statusText:
      liveInputMode === 'microphone'
        ? t('status.input-mode-choose-microphone')
        : liveInputMode === 'desktop'
          ? t('status.input-mode-desktop-audio')
          : t('status.input-mode-choose-midi'),
  });
}

export function removeTrackFromPlaylist(id: string) {
  const state = audioStore.getState();
  const nextPlaylist = state.playlist.filter(track => {
    if (track.id === id) {
      if (track.audio) {
        track.audio.stop();
        track.audio.disconnectNodes();
        track.audio.unload();
      }
      if (track.gainNode) {
        track.gainNode.disconnect();
      }
      return false;
    }
    return true;
  });

  let nextActiveTrackId = state.activeTrackId;
  if (state.activeTrackId === id) {
    nextActiveTrackId = nextPlaylist[0]?.id || null;
    player.stop();
    const nextActiveTrack = nextPlaylist.find(t => t.id === nextActiveTrackId);
    if (nextActiveTrack && nextActiveTrack.audio) {
      player.load(nextActiveTrack.audio, nextActiveTrack.name);
    } else {
      player.unload();
    }
  }

  const activeTrack = nextPlaylist.find(t => t.id === nextActiveTrackId);
  updateAudioState({
    playlist: nextPlaylist,
    activeTrackId: nextActiveTrackId,
    file: activeTrack ? activeTrack.name : '',
    source: activeTrack && activeTrack.file instanceof File ? activeTrack.file : null,
    sourceLabel: activeTrack ? activeTrack.name : '',
    duration:
      state.playbackMode === 'simultaneous'
        ? nextPlaylist.length > 0
          ? Math.max(...nextPlaylist.map(t => t.duration))
          : 0
        : activeTrack
          ? activeTrack.duration
          : 0,
  });
}

export function setTrackVolume(id: string, vol: number) {
  const state = audioStore.getState();
  const nextPlaylist = state.playlist.map(track => {
    if (track.id === id) {
      if (track.gainNode) {
        track.gainNode.gain.value = vol;
      }
      return { ...track, volume: vol };
    }
    return track;
  });
  updateAudioState({ playlist: nextPlaylist });
}

export function toggleTrackEnabled(id: string) {
  const state = audioStore.getState();
  const nextPlaylist = state.playlist.map(track => {
    if (track.id === id) {
      const nextEnabled = !track.enabled;
      if (!nextEnabled && track.audio && track.audio.playing) {
        track.audio.stop();
      }
      return { ...track, enabled: nextEnabled };
    }
    return track;
  });

  const activeTrack = nextPlaylist.find(t => t.id === state.activeTrackId);
  updateAudioState({
    playlist: nextPlaylist,
    duration:
      state.playbackMode === 'simultaneous'
        ? nextPlaylist.length > 0
          ? Math.max(...nextPlaylist.filter(t => t.enabled).map(t => t.duration))
          : 0
        : activeTrack
          ? activeTrack.duration
          : 0,
  });
}

export function setActiveTrack(id: string) {
  const state = audioStore.getState();
  if (state.activeTrackId === id) return;

  player.stop();
  const targetTrack = state.playlist.find(t => t.id === id);
  if (targetTrack && targetTrack.audio) {
    player.load(targetTrack.audio, targetTrack.name);
    updateAudioState({
      activeTrackId: id,
      file: targetTrack.name,
      source: targetTrack.file instanceof File ? targetTrack.file : null,
      sourceLabel: targetTrack.name,
      duration: targetTrack.duration,
    });
    player.play();
  }
}

export function setPlaybackMode(mode: 'sequential' | 'simultaneous') {
  player.stop();
  updateAudioState({ playbackMode: mode });

  const state = audioStore.getState();
  if (mode === 'sequential' && state.playlist.length > 0) {
    const targetId = state.activeTrackId || state.playlist[0].id;
    const targetTrack = state.playlist.find(t => t.id === targetId) || state.playlist[0];
    player.load(targetTrack.audio, targetTrack.name);
    updateAudioState({
      activeTrackId: targetTrack.id,
      file: targetTrack.name,
      source: targetTrack.file instanceof File ? targetTrack.file : null,
      sourceLabel: targetTrack.name,
      duration: targetTrack.duration,
    });
  } else if (mode === 'simultaneous' && state.playlist.length > 0) {
    const firstEnabled = state.playlist.find(t => t.enabled && t.audio);
    if (firstEnabled && firstEnabled.audio) {
      player.load(firstEnabled.audio, firstEnabled.name);
      const maxDuration = Math.max(...state.playlist.filter(t => t.enabled).map(t => t.duration));
      updateAudioState({
        file: firstEnabled.name,
        source: firstEnabled.file instanceof File ? firstEnabled.file : null,
        sourceLabel: 'Simultaneous Mix',
        duration: maxDuration,
      });
    }
  }
}

export async function openAudioFile(play?: boolean, multiple = false) {
  const { files, canceled } = await api.showOpenDialog({
    filters: getAudioFileFilters(),
    multiple,
  });

  if (!canceled && files && files.length) {
    const shouldPlay = play ?? true;

    if (multiple) {
      for (let i = 0; i < files.length; i++) {
        // Only autoplay the first file if playback is requested
        const isFirst = i === 0;
        await loadAudioFile(files[i], isFirst && shouldPlay);
      }
    } else {
      await loadAudioFile(files[0], shouldPlay);
    }
  }
}

export function moveTrack(id: string, direction: 'up' | 'down') {
  const state = audioStore.getState();
  const playlist = [...(state.playlist || [])];
  const index = playlist.findIndex(t => t.id === id);
  if (index === -1) return;

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= playlist.length) return;

  // Swap tracks
  const temp = playlist[index];
  playlist[index] = playlist[targetIndex];
  playlist[targetIndex] = temp;

  updateAudioState({ playlist });
}

export function setTrackArtwork(id: string, artworkUrl: string | null) {
  updateAudioState({
    playlist: audioStore.getState().playlist.map(t => (t.id === id ? { ...t, artworkUrl } : t)),
  });
}

export function playNextTrack() {
  const state = audioStore.getState();
  const { playlist, activeTrackId } = state;
  if (playlist.length <= 1) return;

  const currentIndex = playlist.findIndex(t => t.id === activeTrackId);
  let nextIndex = 0;
  if (currentIndex >= 0 && currentIndex < playlist.length - 1) {
    nextIndex = currentIndex + 1;
  }

  const nextTrack = playlist[nextIndex];
  // Force deactivate check to reload same track in case we want to re-trigger,
  // but since nextTrack is different, we can just call setActiveTrack.
  // Wait! If setActiveTrack checks if activeTrackId === id, and returns early,
  // we want next/prev to always work. Since nextTrack.id !== activeTrackId, it will work.
  // But wait, what if activeTrackId === nextTrack.id (only 1 track)?
  // We already checked playlist.length <= 1 and returned early.
  setActiveTrack(nextTrack.id);
}

export function playPreviousTrack() {
  const state = audioStore.getState();
  const { playlist, activeTrackId } = state;
  if (playlist.length <= 1) return;

  const currentIndex = playlist.findIndex(t => t.id === activeTrackId);
  let prevIndex = playlist.length - 1;
  if (currentIndex > 0) {
    prevIndex = currentIndex - 1;
  }

  const prevTrack = playlist[prevIndex];
  setActiveTrack(prevTrack.id);
}

export default audioStore;
