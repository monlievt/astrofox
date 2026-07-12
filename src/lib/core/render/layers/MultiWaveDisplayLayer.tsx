// @ts-nocheck
import React from 'react';
import CanvasMultiWave from '@/lib/canvas/CanvasMultiWave';
import { CanvasTextureLayer } from './CanvasTextureLayer';

export function MultiWaveDisplayLayer({
  display,
  order,
  frameData,
  sceneOpacity,
  sceneBlendMode,
  sceneMask,
  sceneInverse,
  sceneMaskCombine,
}) {
  const canvasMultiWaveRef = React.useRef(null);

  const drawFrame = React.useCallback(({ canvas, properties, frameData }) => {
    const w = Math.max(10, Math.round(Number(properties.width) || 854));
    const h = Math.max(10, Math.round(Number(properties.height) || 240));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    if (!canvasMultiWaveRef.current) {
      canvasMultiWaveRef.current = new CanvasMultiWave(properties, canvas);
    }

    canvasMultiWaveRef.current.update(properties);

    const fft = frameData?.fft || new Uint8Array(64);
    const floatFft = new Float32Array(fft.length);
    for (let i = 0; i < fft.length; i++) {
      floatFft[i] = fft[i] / 255;
    }

    canvasMultiWaveRef.current.render(floatFft);

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
