// @ts-nocheck

import {
  Check,
  ChevronDown,
  ChevronUp,
  Music,
  Play,
  Plus,
  Radio,
  Shuffle,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import useAudioStore, {
  loadAudioFile,
  moveTrack,
  openAudioFile,
  removeTrackFromPlaylist,
  setActiveTrack,
  setPlaybackMode,
  setTrackArtwork,
  setTrackVolume,
  toggleTrackEnabled,
} from '@/app/actions/audio';
import { Button } from '@/components/ui/button';

function formatTime(seconds: number) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export default function PlaylistMixerPanel() {
  const { t } = useTranslation(undefined, { keyPrefix: 'panels' });
  const { playlist, playbackMode, activeTrackId } = useAudioStore(
    useShallow(state => ({
      playlist: state.playlist || [],
      playbackMode: state.playbackMode || 'sequential',
      activeTrackId: state.activeTrackId,
    })),
  );

  const [editingTrackId, setEditingTrackId] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function handleAddTrack() {
    await openAudioFile(false, true);
  }

  function handleThumbnailClick(trackId: string) {
    setEditingTrackId(trackId);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && editingTrackId) {
      const reader = new FileReader();
      reader.onload = event => {
        const result = event.target?.result;
        if (typeof result === 'string') {
          setTrackArtwork(editingTrackId, result);
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = ''; // Reset input
    setEditingTrackId(null);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-neutral-900 text-neutral-200">
      {/* Mode Header */}
      <div className="flex flex-col p-4 gap-3 border-b border-neutral-800 bg-neutral-950 shrink-0">
        <div className="flex justify-between items-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Playback Mode
          </span>
          <div className="flex rounded-md bg-neutral-900 p-0.5 border border-neutral-800">
            <button
              type="button"
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-sm transition-all outline-none ${
                playbackMode === 'sequential'
                  ? 'bg-primary text-neutral-100 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
              onClick={() => setPlaybackMode('sequential')}
            >
              <Shuffle size={12} />
              Sequential
            </button>
            <button
              type="button"
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-sm transition-all outline-none ${
                playbackMode === 'simultaneous'
                  ? 'bg-primary text-neutral-100 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
              onClick={() => setPlaybackMode('simultaneous')}
            >
              <Radio size={12} />
              Simultaneous
            </button>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full flex items-center justify-center gap-2 border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100"
          onClick={handleAddTrack}
        >
          <Plus size={14} />
          Add Audio Track
        </Button>
      </div>

      {/* Playlist / Tracks List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {playlist.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-neutral-500 gap-2 border-2 border-dashed border-neutral-800 rounded-lg p-6">
            <Music size={24} className="stroke-1" />
            <span className="text-xs text-center">
              No audio tracks added. Drag and drop audio or click "Add Audio Track" above.
            </span>
          </div>
        ) : (
          playlist.map((track, trackIndex) => {
            const isActive = playbackMode === 'sequential' && activeTrackId === track.id;
            const isEnabled = playbackMode === 'sequential' || track.enabled;

            return (
              <div
                key={track.id}
                className={`flex flex-col gap-2 p-3 border rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'border-primary bg-primary/5 shadow-md shadow-primary/5'
                    : isEnabled
                      ? 'border-neutral-800 bg-neutral-950/60'
                      : 'border-neutral-800 bg-neutral-950/20 opacity-60'
                }`}
              >
                {/* Top Row: Info & Controls */}
                <div className="flex items-start gap-2.5">
                  {playbackMode === 'sequential' ? (
                    <button
                      type="button"
                      className={`flex items-center justify-center shrink-0 w-6 h-6 rounded-full border transition-all ${
                        isActive
                          ? 'bg-primary border-primary text-neutral-100'
                          : 'border-neutral-700 hover:border-neutral-500 text-neutral-400 hover:text-neutral-200'
                      }`}
                      onClick={() => setActiveTrack(track.id)}
                      title="Set active & play"
                    >
                      {isActive ? (
                        <Check size={12} />
                      ) : (
                        <Play size={10} className="translate-x-px" />
                      )}
                    </button>
                  ) : (
                    <input
                      type="checkbox"
                      checked={track.enabled}
                      onChange={() => toggleTrackEnabled(track.id)}
                      className="mt-1 w-4 h-4 rounded border-neutral-700 text-primary focus:ring-primary accent-primary cursor-pointer shrink-0"
                      title="Enable/disable mixing"
                    />
                  )}

                  {/* Thumbnail / Artwork */}
                  <div
                    className="relative group shrink-0 w-8 h-8 rounded bg-neutral-900 border border-neutral-800 flex items-center justify-center overflow-hidden cursor-pointer"
                    onClick={() => handleThumbnailClick(track.id)}
                    title="Click to change track artwork"
                  >
                    {track.artworkUrl ? (
                      <img
                        src={track.artworkUrl}
                        alt="Artwork"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Music
                        size={14}
                        className="text-neutral-500 group-hover:text-neutral-300 transition-colors"
                      />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col">
                    <span
                      className={`text-sm font-medium truncate select-none leading-snug cursor-default ${
                        isActive ? 'text-neutral-100' : 'text-neutral-300'
                      }`}
                      title={track.name}
                    >
                      {track.name}
                    </span>
                    <span className="text-2xs text-neutral-500 mt-0.5">
                      {formatTime(track.duration)}
                    </span>
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      className="text-neutral-500 hover:text-neutral-300 p-1 hover:bg-neutral-800/40 rounded transition-all outline-none disabled:opacity-20 disabled:pointer-events-none"
                      onClick={() => moveTrack(track.id, 'up')}
                      disabled={trackIndex === 0}
                      title="Move up"
                    >
                      <ChevronUp size={13} />
                    </button>
                    <button
                      type="button"
                      className="text-neutral-500 hover:text-neutral-300 p-1 hover:bg-neutral-800/40 rounded transition-all outline-none disabled:opacity-20 disabled:pointer-events-none"
                      onClick={() => moveTrack(track.id, 'down')}
                      disabled={trackIndex === playlist.length - 1}
                      title="Move down"
                    >
                      <ChevronDown size={13} />
                    </button>
                    <button
                      type="button"
                      className="text-neutral-500 hover:text-red-400 p-1 hover:bg-neutral-800/40 rounded transition-all outline-none"
                      onClick={() => removeTrackFromPlaylist(track.id)}
                      title="Remove track"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Bottom Row: Volume Slider (Only for Simultaneous Mixing) */}
                {playbackMode === 'simultaneous' && track.enabled && (
                  <div className="flex items-center gap-2 mt-1 px-1">
                    <button
                      type="button"
                      className="text-neutral-400 hover:text-neutral-200 outline-none shrink-0"
                      onClick={() => setTrackVolume(track.id, track.volume > 0 ? 0 : 1.0)}
                      title={track.volume > 0 ? 'Mute' : 'Unmute'}
                    >
                      {track.volume > 0 ? <Volume2 size={12} /> : <VolumeX size={12} />}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={track.volume}
                      onChange={e => setTrackVolume(track.id, parseFloat(e.target.value))}
                      className="flex-1 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
                    />
                    <span className="text-2xs text-neutral-500 font-mono w-7 text-right">
                      {~~(track.volume * 100)}%
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
    </div>
  );
}
