import audioStore from '@/app/actions/audio';
import type Audio from '@/lib/audio/Audio';
import MidiController, { type MidiAnalysisData } from '@/lib/audio/MidiController';
import EventEmitter from '@/lib/core/EventEmitter';

const UPDATE_INTERVAL = 200;
export type InputMode = 'file' | 'microphone' | 'midi' | 'desktop';

export interface PlayerCapabilities {
  canSeek: boolean;
  hasWaveform: boolean;
  usesVolume: boolean;
  isLive: boolean;
}

export default class Player extends EventEmitter {
  audioContext: AudioContext;
  volume: GainNode;
  inputGain: GainNode;
  audio: Audio | null;
  loop: boolean;
  timer: ReturnType<typeof setInterval> | null;
  mode: InputMode | null;
  sourceLabel: string;
  stream: MediaStream | null;
  streamSource: MediaStreamAudioSourceNode | null;
  streamAnalyzer: AudioNode | null;
  liveActive: boolean;
  midi: MidiController;

  constructor(context: AudioContext) {
    super();

    this.audioContext = context;
    this.audio = null;
    this.timer = null;
    this.mode = null;
    this.sourceLabel = '';
    this.stream = null;
    this.streamSource = null;
    this.streamAnalyzer = null;
    this.liveActive = false;
    this.midi = new MidiController();

    this.volume = this.audioContext.createGain();
    this.volume.connect(this.audioContext.destination);
    this.inputGain = this.audioContext.createGain();

    this.loop = false;
  }

  load(audio: Audio, sourceLabel = '') {
    this.clearSource();

    this.audio = audio;
    this.mode = 'file';
    this.sourceLabel = sourceLabel;

    const { playlist } = audioStore.getState();
    const isTrackInPlaylist = playlist && playlist.some(t => t.audio === audio);
    if (!isTrackInPlaylist) {
      this.audio.addNode(this.volume);
    }

    this.emit('source-change');
    this.emit('audio-load');
  }

  useMicrophone(stream: MediaStream, analyzerNode: AudioNode, sourceLabel = 'Microphone') {
    this.clearSource();

    this.mode = 'microphone';
    this.sourceLabel = sourceLabel;
    this.stream = stream;
    this.streamAnalyzer = analyzerNode;
    this.streamSource = this.audioContext.createMediaStreamSource(stream);
    this.reconnectLiveNodes();
    this.liveActive = true;

    this.emit('source-change');
    this.emit('play');
    this.emit('playback-change');
  }

  useDesktopAudio(stream: MediaStream, analyzerNode: AudioNode, sourceLabel = '') {
    this.clearSource();

    this.mode = 'desktop';
    this.sourceLabel = sourceLabel;
    this.stream = stream;
    this.streamAnalyzer = analyzerNode;
    this.streamSource = this.audioContext.createMediaStreamSource(stream);
    this.reconnectLiveNodes();
    this.liveActive = true;

    this.emit('source-change');
    this.emit('play');
    this.emit('playback-change');
  }

  useMidi(sourceLabel = '') {
    this.clearSource();

    this.mode = 'midi';
    this.sourceLabel = sourceLabel;
    this.liveActive = true;

    this.emit('source-change');
    this.emit('play');
    this.emit('playback-change');
  }

  unload() {
    this.clearSource();
  }

  clearSource() {
    this.disconnectTimer();
    this.releaseAudio();
    this.releaseStream();
    this.releaseMidi();

    const hadSource = this.mode !== null;

    this.mode = null;
    this.sourceLabel = '';

    if (hadSource) {
      this.emit('source-change');
      this.emit('audio-unload');
    }
  }

  releaseAudio() {
    const { audio } = this;

    if (audio) {
      this.stop();
      audio.unload();
      this.audio = null;
    }
  }

  releaseStream() {
    if (this.streamSource) {
      try {
        this.streamSource.disconnect();
      } catch (_error) {
        // Ignore disconnect errors from a stale MediaStream source.
      }
    }

    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
    }

    this.stream = null;
    this.streamSource = null;
    this.streamAnalyzer = null;
    this.inputGain.disconnect();
    this.liveActive = false;
  }

  releaseMidi() {
    this.midi.reset();
    this.liveActive = false;
  }

  disconnectTimer() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  reconnectLiveNodes() {
    if (!this.streamSource || !this.streamAnalyzer) {
      return;
    }

    this.streamSource.connect(this.inputGain);
    this.inputGain.connect(this.streamAnalyzer);
  }

  disconnectLiveNodes() {
    if (!this.streamSource) {
      return;
    }

    try {
      this.streamSource.disconnect();
      this.inputGain.disconnect();
    } catch (_error) {
      // Ignore disconnect errors from already detached nodes.
    }
  }
  play() {
    console.log('[Player.play] play() called. mode:', this.mode);
    const { mode } = this;

    if (this.audioContext.state === 'suspended') {
      console.log('[Player.play] AudioContext is suspended, resuming...');
      this.audioContext.resume();
    }

    if (mode === 'file') {
      const { playlist, playbackMode, activeTrackId } = audioStore.getState();
      console.log(
        '[Player.play] File mode active. Playlist length:',
        playlist?.length,
        'playbackMode:',
        playbackMode,
        'activeTrackId:',
        activeTrackId,
      );

      if (playbackMode === 'simultaneous') {
        const enabledTracks = playlist.filter(t => t.enabled && t.audio);
        console.log('[Player.play] Simultaneous mode. enabledTracks count:', enabledTracks.length);
        if (enabledTracks.length === 0) {
          console.log('[Player.play] No enabled tracks to play.');
          return;
        }

        const isAnyPlaying = enabledTracks.some(t => t.audio?.playing);
        if (isAnyPlaying) {
          console.log('[Player.play] At least one track is already playing, pausing...');
          this.pause();
          return;
        }

        console.log('[Player.play] Starting playback of all enabled tracks...');
        for (const track of enabledTracks) {
          console.log('[Player.play] Playing:', track.name);
          track.audio?.play();
        }
      } else {
        const activeTrack = playlist.find(t => t.id === activeTrackId) || playlist[0];
        console.log('[Player.play] Sequential mode. activeTrack:', activeTrack?.name);
        if (!activeTrack || !activeTrack.audio) {
          console.log(
            '[Player.play] No active track or track audio found. Fallback to this.audio:',
            this.audio?.playing,
          );
          if (this.audio) {
            if (this.audio.playing) {
              this.pause();
              return;
            }
            this.audio.play();
          }
          return;
        }

        if (activeTrack.audio.playing) {
          console.log('[Player.play] Active track is already playing, pausing...');
          this.pause();
          return;
        }

        console.log('[Player.play] Starting playback of active track:', activeTrack.name);
        activeTrack.audio.play();
      }

      this.timer = setInterval(() => {
        const { playlist, playbackMode, activeTrackId } = audioStore.getState();

        if (playbackMode === 'simultaneous') {
          const enabledTracks = playlist.filter(t => t.enabled && t.audio);
          const allFinished = enabledTracks.every(t => t.audio!.getPosition() >= 1.0);
          if (allFinished && enabledTracks.length > 0) {
            if (this.loop) {
              this.seek(0);
            } else {
              this.stop();
            }
          }
        } else {
          const activeTrack = playlist.find(t => t.id === activeTrackId) || playlist[0];
          if (activeTrack && activeTrack.audio && activeTrack.audio.getPosition() >= 1.0) {
            const activeIndex = playlist.indexOf(activeTrack);
            if (activeIndex >= 0 && activeIndex < playlist.length - 1) {
              const nextTrack = playlist[activeIndex + 1];
              this.stop();
              audioStore.setState({ activeTrackId: nextTrack.id });
              audioStore.setState({
                file: nextTrack.name,
                source: nextTrack.file instanceof File ? nextTrack.file : null,
                sourceLabel: nextTrack.name,
                duration: nextTrack.duration,
              });
              this.play();
            } else {
              if (this.loop) {
                this.stop();
                if (playlist.length > 0) {
                  const firstTrack = playlist[0];
                  audioStore.setState({ activeTrackId: firstTrack.id });
                  audioStore.setState({
                    file: firstTrack.name,
                    source: firstTrack.file instanceof File ? firstTrack.file : null,
                    sourceLabel: firstTrack.name,
                    duration: firstTrack.duration,
                  });
                  this.play();
                } else if (this.audio) {
                  this.play();
                }
              } else {
                this.stop();
              }
            }
          } else if (!activeTrack && this.audio && this.audio.getPosition() >= 1.0) {
            if (this.loop) {
              this.seek(0);
              this.play();
            } else {
              this.stop();
            }
          }
        }

        this.emit('tick');
      }, UPDATE_INTERVAL);

      this.emit('play');
      this.emit('playback-change');
      return;
    }

    if ((mode === 'microphone' || mode === 'desktop') && this.streamSource) {
      if (this.liveActive) {
        this.pause();
        return;
      }

      this.reconnectLiveNodes();
      this.liveActive = true;
      this.emit('play');
      this.emit('playback-change');
      return;
    }

    if (mode === 'midi') {
      if (this.liveActive) {
        this.pause();
        return;
      }

      this.liveActive = true;
      this.emit('play');
      this.emit('playback-change');
    }
  }

  pause() {
    const { mode } = this;

    if (mode === 'file') {
      const { playlist, playbackMode } = audioStore.getState();

      if (playbackMode === 'simultaneous') {
        playlist.forEach(track => {
          if (track.enabled && track.audio) {
            track.audio.pause();
          }
        });
      } else {
        const { activeTrackId } = audioStore.getState();
        const activeTrack = playlist.find(t => t.id === activeTrackId) || playlist[0];
        if (activeTrack && activeTrack.audio) {
          activeTrack.audio.pause();
        } else if (this.audio) {
          this.audio.pause();
        }
      }

      this.disconnectTimer();

      this.emit('pause');
      this.emit('playback-change');
      return;
    }

    if ((mode === 'microphone' || mode === 'desktop') && this.liveActive) {
      this.disconnectLiveNodes();
      this.liveActive = false;
      this.emit('pause');
      this.emit('playback-change');
      return;
    }

    if (mode === 'midi' && this.liveActive) {
      this.liveActive = false;
      this.emit('pause');
      this.emit('playback-change');
    }
  }

  stop() {
    const { mode } = this;

    if (mode === 'file') {
      const { playlist, playbackMode } = audioStore.getState();

      if (playbackMode === 'simultaneous') {
        playlist.forEach(track => {
          if (track.enabled && track.audio) {
            track.audio.stop();
          }
        });
      } else {
        const { activeTrackId } = audioStore.getState();
        const activeTrack = playlist.find(t => t.id === activeTrackId) || playlist[0];
        if (activeTrack && activeTrack.audio) {
          activeTrack.audio.stop();
        } else if (this.audio) {
          this.audio.stop();
        }
      }

      this.disconnectTimer();
      this.emit('stop');
      this.emit('playback-change');
      return;
    }

    if ((mode === 'microphone' || mode === 'desktop' || mode === 'midi') && this.liveActive) {
      if (mode === 'microphone' || mode === 'desktop') {
        this.disconnectLiveNodes();
      }

      this.liveActive = false;
      this.emit('stop');
      this.emit('playback-change');
    }
  }

  seek(val: number) {
    const { playlist, playbackMode, activeTrackId } = audioStore.getState();
    if (this.mode === 'file') {
      if (playbackMode === 'simultaneous') {
        const maxDuration = this.getDuration();
        const targetTime = val * maxDuration;
        playlist.forEach(track => {
          if (track.enabled && track.audio) {
            const trackDuration = track.audio.getDuration();
            const trackPos = trackDuration > 0 ? Math.min(1.0, targetTime / trackDuration) : 0;
            track.audio.seek(trackPos);
          }
        });
      } else {
        const activeTrack = playlist.find(t => t.id === activeTrackId) || playlist[0];
        if (activeTrack && activeTrack.audio) {
          activeTrack.audio.seek(val);
        } else if (this.audio) {
          this.audio.seek(val);
        }
      }
      this.emit('seek');
    }
  }

  getAudio() {
    const { playlist, playbackMode, activeTrackId } = audioStore.getState();
    if (playbackMode === 'simultaneous') {
      const firstEnabled = playlist.find(t => t.enabled && t.audio);
      return firstEnabled ? firstEnabled.audio : this.audio;
    }
    const activeTrack = playlist.find(t => t.id === activeTrackId) || playlist[0];
    return activeTrack && activeTrack.audio ? activeTrack.audio : this.audio;
  }

  hasAudio() {
    return this.mode === 'file'
      ? !!this.getAudio()
      : this.mode === 'microphone' || this.mode === 'desktop';
  }

  hasSource() {
    return this.mode !== null;
  }

  setVolume(val: number) {
    if (this.volume) {
      this.volume.gain.value = val;
    }
  }

  getVolume() {
    return this.volume.gain.value;
  }

  setInputGain(val: number) {
    this.inputGain.gain.value = val;
  }

  getInputGain() {
    return this.inputGain.gain.value;
  }

  getCurrentTime() {
    const { playlist, playbackMode, activeTrackId } = audioStore.getState();
    if (this.mode === 'file') {
      if (playbackMode === 'simultaneous') {
        const firstEnabled = playlist.find(t => t.enabled && t.audio);
        return firstEnabled && firstEnabled.audio
          ? firstEnabled.audio.getCurrentTime()
          : this.audio
            ? this.audio.getCurrentTime()
            : 0;
      }
      const activeTrack = playlist.find(t => t.id === activeTrackId) || playlist[0];
      return activeTrack && activeTrack.audio
        ? activeTrack.audio.getCurrentTime()
        : this.audio
          ? this.audio.getCurrentTime()
          : 0;
    }
    return 0;
  }

  getDuration() {
    const { playlist, playbackMode, activeTrackId } = audioStore.getState();
    if (this.mode === 'file') {
      if (playbackMode === 'simultaneous') {
        const enabledTracks = playlist.filter(t => t.enabled && t.audio);
        return enabledTracks.length > 0
          ? Math.max(...enabledTracks.map(t => t.audio!.getDuration()))
          : this.audio
            ? this.audio.getDuration()
            : 0;
      }
      const activeTrack = playlist.find(t => t.id === activeTrackId) || playlist[0];
      return activeTrack && activeTrack.audio
        ? activeTrack.audio.getDuration()
        : this.audio
          ? this.audio.getDuration()
          : 0;
    }
    return 0;
  }

  getPosition() {
    const duration = this.getDuration();
    if (duration === 0) return 0;
    return this.getCurrentTime() / duration;
  }

  setLoop(val: boolean) {
    this.loop = val;
  }

  isPlaying() {
    if (this.mode === 'file') {
      const { playlist, playbackMode, activeTrackId } = audioStore.getState();
      if (playbackMode === 'simultaneous') {
        return playlist.some(t => t.enabled && t.audio?.playing) || !!this.audio?.playing;
      }
      const activeTrack = playlist.find(t => t.id === activeTrackId) || playlist[0];
      return activeTrack && activeTrack.audio ? activeTrack.audio.playing : !!this.audio?.playing;
    }
    return this.liveActive;
  }

  isLooping() {
    return !!this.loop;
  }

  canSeek() {
    if (this.mode === 'file') {
      const { playlist, playbackMode, activeTrackId } = audioStore.getState();
      if (playbackMode === 'simultaneous') {
        return playlist.some(t => t.enabled && t.audio) || !!this.audio;
      }
      const activeTrack = playlist.find(t => t.id === activeTrackId) || playlist[0];
      return !!activeTrack?.audio || !!this.audio;
    }
    return false;
  }

  isLive() {
    return this.mode === 'microphone' || this.mode === 'desktop' || this.mode === 'midi';
  }

  getMode() {
    return this.mode;
  }

  getSourceLabel() {
    return this.sourceLabel;
  }

  getCapabilities(): PlayerCapabilities {
    return {
      canSeek: this.canSeek(),
      hasWaveform: this.canSeek(),
      usesVolume: this.mode !== 'midi' && this.mode !== null,
      isLive: this.isLive(),
    };
  }

  updateAnalysis(analyzer: {
    process: (input?: AudioBuffer) => void;
    analyzer: { fftSize: number };
  }) {
    if (!this.isPlaying()) {
      return;
    }

    if (this.mode === 'midi') {
      this.midi.updateAnalysis(analyzer.analyzer.fftSize, this.audioContext.currentTime);
      return;
    }

    analyzer.process(undefined);
  }

  getAnalysisData(analyzer: {
    fft: Uint8Array;
    td: Float32Array;
    gain: number;
    analyzer: { fftSize: number };
  }):
    | MidiAnalysisData
    | {
        fft: Uint8Array;
        td: Float32Array;
        gain: number;
        activity: number;
      } {
    if (this.mode === 'midi') {
      return this.midi.getAnalysisData();
    }

    return {
      fft: analyzer.fft,
      td: analyzer.td,
      gain: analyzer.gain,
      activity: 0,
    };
  }

  handleMidiMessage(event: { data?: Uint8Array | number[] | null }) {
    this.midi.handleMessage(event);
  }
}
