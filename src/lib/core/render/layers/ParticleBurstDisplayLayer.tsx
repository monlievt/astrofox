// @ts-nocheck
import React from 'react';
import CanvasParticleBurst from '@/lib/canvas/CanvasParticleBurst';
import { CanvasTextureLayer } from './CanvasTextureLayer';

export function ParticleBurstDisplayLayer({
  display,
  order,
  frameData,
  sceneOpacity,
  sceneBlendMode,
  sceneMask,
  sceneInverse,
  sceneMaskCombine,
}) {
  const burstRef = React.useRef(null);

  const drawFrame = React.useCallback(({ canvas, properties, frameData }) => {
    const w = Math.max(10, Math.round(Number(properties.width) || 854));
    const h = Math.max(10, Math.round(Number(properties.height) || 480));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    if (!burstRef.current) {
      burstRef.current = new CanvasParticleBurst(properties, canvas);
    }

    burstRef.current.update(properties);

    // Extract raw Uint8Array from frameData and convert to normalized Float32Array [0, 1]
    const fft = frameData?.fft || new Uint8Array(128);
    const floatFft = new Float32Array(fft.length);
    for (let i = 0; i < fft.length; i++) {
      floatFft[i] = fft[i] / 255;
    }

    burstRef.current.render(floatFft);

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
