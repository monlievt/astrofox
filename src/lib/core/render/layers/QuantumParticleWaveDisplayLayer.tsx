// @ts-nocheck
import React from 'react';
import CanvasQuantumParticleWave from '@/lib/canvas/CanvasQuantumParticleWave';
import { CanvasTextureLayer } from './CanvasTextureLayer';

export function QuantumParticleWaveDisplayLayer({
  display,
  order,
  frameData,
  sceneOpacity,
  sceneBlendMode,
  sceneMask,
  sceneInverse,
  sceneMaskCombine,
}) {
  const canvasRef = React.useRef(null);

  const drawFrame = React.useCallback(({ canvas, properties, frameData }) => {
    // Quantum particle wave covers the full screen dimension to align horizontal waves correctly
    const w = Math.max(10, Math.round(Number(properties.width) || 854));
    const h = Math.max(10, Math.round(Number(properties.height) || 480));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    if (!canvasRef.current) {
      canvasRef.current = new CanvasQuantumParticleWave(properties, canvas);
    }

    canvasRef.current.update(properties);

    // 1. Process FFT frequency data
    const fft = frameData?.fft || new Uint8Array(128);
    const floatFft = new Float32Array(fft.length);
    for (let i = 0; i < fft.length; i++) {
      floatFft[i] = fft[i] / 255;
    }

    // 2. Process Time Domain (TD) wave data
    const td = frameData?.td || new Uint8Array(128);
    const floatTd = new Float32Array(td.length);
    for (let i = 0; i < td.length; i++) {
      floatTd[i] = (td[i] - 128) / 128;
    }

    const time = frameData?.time || 0;

    canvasRef.current.render({
      fft: floatFft,
      td: floatTd,
      time,
    });

    return {
      width: canvas.width,
      height: canvas.height,
      originX: canvas.width / 2,
      originY: canvas.height / 2,
    };
  }, []);

  return (
    <CanvasTextureLayer
      display={display}
      order={order}
      frameData={frameData}
      sceneOpacity={sceneOpacity}
      sceneBlendMode={sceneBlendMode}
      sceneMask={sceneMask}
      sceneInverse={sceneInverse}
      sceneMaskCombine={sceneMaskCombine}
      drawFrame={drawFrame}
    />
  );
}
