import { Muxer as WebmMuxer, ArrayBufferTarget as WebmArrayBufferTarget } from 'webm-muxer';
import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4ArrayBufferTarget } from 'mp4-muxer';
import { logger } from '@/app/global';
import useAudioStore from '@/app/actions/audio';

interface ExportProgressCallback {
  (progress: number, statusText: string): void;
}

export interface ExporterTrack {
  file: File;
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  buffer: AudioBuffer | null;
}

export async function exportVideoOffline({
  canvas,
  renderer,
  tracks,
  fps = 60,
  bitrate = 8_000_000,
  onProgress,
  exportFormat = 'webm',
  videoCodec = 'vp9',
}: {
  canvas: HTMLCanvasElement;
  renderer: any;
  tracks: ExporterTrack[];
  fps?: number;
  bitrate?: number;
  onProgress?: ExportProgressCallback;
  exportFormat?: 'webm' | 'mp4';
  videoCodec?: 'vp9' | 'h264' | 'hevc';
}): Promise<Blob> {
  const width = canvas.width;
  const height = canvas.height;

  const originalActiveTrackId = useAudioStore.getState().activeTrackId;

  // Calculate total duration and frames
  const totalDuration = tracks.reduce((sum, t) => sum + (t.endTime - t.startTime), 0);
  const totalFrames = Math.max(1, Math.round(totalDuration * fps));

  logger.log(`[WebCodecsExport] Starting offline render. Format: ${exportFormat}, Codec: ${videoCodec}, Tracks: ${tracks.length}, Total Duration: ${totalDuration}s, Total Frames: ${totalFrames}`);

  const sampleRate = tracks[0]?.buffer?.sampleRate || 48000;
  const channels = tracks[0]?.buffer?.numberOfChannels || 2;

  // 1. Initialize Muxer based on selected format
  let muxer: any;
  if (exportFormat === 'mp4') {
    muxer = new Mp4Muxer({
      target: new Mp4ArrayBufferTarget(),
      video: {
        codec: videoCodec === 'hevc' ? 'hevc' : 'avc',
        width,
        height,
      },
      audio: {
        codec: 'aac',
        numberOfChannels: channels,
        sampleRate: sampleRate,
      },
      fastStart: 'fragmented',
    });
  } else {
    muxer = new WebmMuxer({
      target: new WebmArrayBufferTarget(),
      video: {
        codec: 'V_VP9',
        width,
        height,
      },
      audio: {
        codec: 'A_OPUS',
        numberOfChannels: channels,
        sampleRate: sampleRate,
      },
    });
  }

  // 2. Initialize VideoEncoder
  let globalFrameIndex = 0;
  const videoEncoder = new VideoEncoder({
    output: (chunk, metadata) => {
      muxer.addVideoChunk(chunk, metadata);
    },
    error: (err) => {
      logger.error('[WebCodecsExport] VideoEncoder error:', err);
    },
  });

  // Resolve proper codec string based on options
  let codecString = 'vp09.00.10.08'; // Default VP9
  if (exportFormat === 'mp4') {
    codecString = videoCodec === 'hevc' ? 'hev1.1.6.L93.B0' : 'avc1.640028';
  }

  const config: VideoEncoderConfig = {
    codec: codecString,
    width,
    height,
    bitrate,
    framerate: fps,
    latencyMode: 'quality',
    hardwareAcceleration: 'prefer-hardware',
  };

  let isSupported = false;
  try {
    const check = await VideoEncoder.isConfigSupported(config);
    isSupported = !!check.supported;
  } catch (e) {
    isSupported = false;
  }

  if (!isSupported) {
    logger.warn(`[WebCodecsExport] Hardware accelerated ${videoCodec} is not supported on this device/browser, falling back to default.`);
    config.hardwareAcceleration = 'no-preference';
  }

  await videoEncoder.configure(config);

  // 3. Initialize AudioEncoder
  const audioEncoder = new AudioEncoder({
    output: (chunk, metadata) => {
      muxer.addAudioChunk(chunk, metadata);
    },
    error: (err) => {
      logger.error('[WebCodecsExport] AudioEncoder error:', err);
    },
  });

  await audioEncoder.configure({
    codec: exportFormat === 'mp4' ? 'mp4a.40.2' : 'opus',
    numberOfChannels: channels,
    sampleRate: sampleRate,
    bitrate: 192000,
  });

  // 4. Sequentially process and encode each track
  let globalAudioTimeUs = 0;

  for (let tIdx = 0; tIdx < tracks.length; tIdx++) {
    const track = tracks[tIdx];
    logger.log(`[WebCodecsExport] Processing track ${tIdx + 1}/${tracks.length}: ${track.name}`);

    // Find matching track in the store's playlist to activate it and switch the active artwork
    const storeState = useAudioStore.getState();
    const matchingTrack = storeState.playlist.find(
      (t: any) => t.id === (track as any).id || t.name === track.name
    );

    if (matchingTrack) {
      useAudioStore.setState({ activeTrackId: matchingTrack.id });
      // Yield to let Astrofox UI and ThreeJS context re-route to the newly loaded audio track and artwork
      await new Promise((r) => setTimeout(r, 300));
    }

    const buffer = track.buffer || track.file;
    if (!track.buffer) {
      logger.warn(`[WebCodecsExport] Track ${track.name} is missing decoded AudioBuffer!`);
      continue;
    }

    const tStartSample = Math.floor(track.startTime * sampleRate);
    const tEndSample = Math.min(track.buffer.length, Math.floor(track.endTime * sampleRate));
    const tTrackSamples = tEndSample - tStartSample;

    // --- Encode Audio for this Track Segment ---
    const chunkSize = 2048;
    const channelData = Array.from({ length: channels }, (_, c) => track.buffer.getChannelData(c));

    for (let offset = tStartSample; offset < tEndSample; offset += chunkSize) {
      const chunkEnd = Math.min(tEndSample, offset + chunkSize);
      const chunkLength = chunkEnd - offset;

      const planarBuffer = new Float32Array(chunkLength * channels);
      for (let c = 0; c < channels; c++) {
        planarBuffer.set(channelData[c].subarray(offset, chunkEnd), c * chunkLength);
      }

      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate,
        numberOfFrames: chunkLength,
        numberOfChannels: channels,
        timestamp: Math.round(globalAudioTimeUs + ((offset - tStartSample) / sampleRate) * 1e6),
        data: planarBuffer,
      });

      audioEncoder.encode(audioData);
      audioData.close();
    }
    
    globalAudioTimeUs += (tTrackSamples / sampleRate) * 1e6;

    // --- Encode Video Frames for this Track Segment ---
    const trackDuration = track.endTime - track.startTime;
    const trackFrames = Math.round(trackDuration * fps);

    for (let f = 0; f < trackFrames; f++) {
      const time = track.startTime + f / fps;

      // Render the frame offline
      await renderer.renderFrame(f, fps);

      // Extract canvas image and feed to VideoEncoder
      const timestampUs = Math.round((globalFrameIndex * 1e6) / fps);
      const videoFrame = new VideoFrame(canvas, { timestamp: timestampUs });
      const isKeyframe = globalFrameIndex % 150 === 0;

      videoEncoder.encode(videoFrame, { keyFrame: isKeyframe });
      videoFrame.close();

      globalFrameIndex++;

      if (onProgress) {
        const progress = Math.round((globalFrameIndex / totalFrames) * 100);
        onProgress(
          progress,
          `Mengekspor: ${progress}% (Lagu ${tIdx + 1}/${tracks.length} - Frame ${f}/${trackFrames})`
        );
      }

      if (globalFrameIndex % 30 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  }

  // 5. Finalize file exports
  await audioEncoder.flush();
  await videoEncoder.flush();
  muxer.finalize();

  if (originalActiveTrackId) {
    useAudioStore.setState({ activeTrackId: originalActiveTrackId });
  }

  const buffer = muxer.target.buffer;
  return new Blob([buffer], { type: exportFormat === 'mp4' ? 'video/mp4' : 'video/webm' });
}
