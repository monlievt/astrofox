// @ts-nocheck
import React from 'react';
import { LinearFilter, SRGBColorSpace, TextureLoader } from 'three';
import useAudioStore from '@/app/actions/audio';
import { BLANK_IMAGE } from '@/app/constants';
import { fitMediaWithinBounds } from '@/lib/utils/media';
import { TexturePlane } from './TexturePlane';

export function ImageDisplayLayer({
  display,
  order,
  sceneOpacity,
  sceneBlendMode,
  sceneMask,
  sceneInverse,
  sceneMaskCombine,
  frameData,
}) {
  const { properties = {} } = display;
  const {
    src,
    useTrackArtwork = 'None',
    x = 0,
    y = 0,
    rotation = 0,
    zoom = 1,
    audioPulse = 0,
    waveAmp = 0,
    waveFreq = 2.5,
    waveSpeed = 1.0,
    waveReact = 1.0,
    opacity = 1,
    width = 0,
    height = 0,
    parallaxMode = 'None',
    parallaxSpeed = 1.0,
    parallaxAmount = 20,
  } = properties;

  const [textureSize, setTextureSize] = React.useState({ width: 1, height: 1 });

  const trackArtwork = useAudioStore(state => {
    if (!useTrackArtwork || useTrackArtwork === 'None') {
      return null;
    }
    if (useTrackArtwork === true || useTrackArtwork === 'Active Track') {
      const activeTrack =
        state.playlist.find(t => t.id === state.activeTrackId) || state.playlist[0];
      return activeTrack?.artworkUrl || null;
    }
    const targetTrack = state.playlist.find(t => t.id === useTrackArtwork);
    return targetTrack?.artworkUrl || null;
  });

  const finalSrc = trackArtwork || src;

  const { width: sceneWidth, height: sceneHeight } = display.scene.getSize();
  const fitted = React.useMemo(() => {
    if (width || height) {
      return { width, height };
    }
    return fitMediaWithinBounds(textureSize.width, textureSize.height, sceneWidth, sceneHeight);
  }, [width, height, textureSize, sceneWidth, sceneHeight]);

  const planeWidth = fitted.width;
  const planeHeight = fitted.height;

  const texture = React.useMemo(() => {
    if (!finalSrc || finalSrc === BLANK_IMAGE) {
      return null;
    }
    const nextTexture = new TextureLoader().load(finalSrc, tex => {
      const img = tex.image;
      if (img) {
        setTextureSize({
          width: img.naturalWidth || img.width || 1,
          height: img.naturalHeight || img.height || 1,
        });
        tex.needsUpdate = true;
      }
    });
    nextTexture.minFilter = LinearFilter;
    nextTexture.magFilter = LinearFilter;
    nextTexture.colorSpace = SRGBColorSpace;
    nextTexture.generateMipmaps = false;

    return nextTexture;
  }, [finalSrc]);

  React.useEffect(() => {
    return () => {
      if (texture?.dispose) {
        texture.dispose();
      }
    };
  }, [texture]);

  // Do not render anything if there is no valid image source or artwork URL
  if (!finalSrc || finalSrc === BLANK_IMAGE) {
    return null;
  }

  // Calculate audio bass response for the built-in simple jedug-jedug effect
  let bass = 0;
  if (frameData?.fft) {
    const fft = frameData.fft;
    const activeCount = Math.floor(fft.length * 0.6);
    const bCount = Math.floor(activeCount * 0.25);
    for (let i = 0; i < bCount; i++) bass += fft[i] || 0;
    bass = (bass / Math.max(1, bCount)) / 255;
  }
  const finalZoom = Number(zoom ?? 1) * (1.0 + bass * Number(audioPulse ?? 0) * 0.35);

  return (
    <TexturePlane
      texture={texture}
      width={planeWidth}
      height={planeHeight}
      x={x}
      y={y}
      originX={planeWidth / 2}
      originY={planeHeight / 2}
      rotation={rotation}
      zoom={finalZoom}
      opacity={opacity}
      sceneOpacity={sceneOpacity}
      sceneBlendMode={sceneBlendMode}
      sceneMask={sceneMask}
      sceneInverse={sceneInverse}
      sceneMaskCombine={sceneMaskCombine}
      renderOrder={order}
      parallaxMode={parallaxMode}
      parallaxSpeed={parallaxSpeed}
      parallaxAmount={parallaxAmount}
      frameData={frameData}
      waveAmp={waveAmp}
      waveFreq={waveFreq}
      waveSpeed={waveSpeed}
      waveReact={waveReact}
    />
  );
}
