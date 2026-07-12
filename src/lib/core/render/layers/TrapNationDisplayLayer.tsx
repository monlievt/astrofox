// @ts-nocheck
import React from 'react';
import CanvasTrapNation from '@/lib/canvas/CanvasTrapNation';
import { CanvasTextureLayer } from './CanvasTextureLayer';

export function TrapNationDisplayLayer({
  display,
  order,
  frameData,
  sceneOpacity,
  sceneBlendMode,
  sceneMask,
  sceneInverse,
  sceneMaskCombine,
}) {
  const trapNationRef = React.useRef(null);

  const drawFrame = React.useCallback(({ canvas, properties, frameData }) => {
    if (!trapNationRef.current) {
      trapNationRef.current = new CanvasTrapNation(properties, canvas);
    }

    trapNationRef.current.update(properties);

    const fft = frameData?.fft || new Uint8Array(64);
    const floatFft = new Float32Array(fft.length);
    for (let i = 0; i < fft.length; i++) {
      floatFft[i] = fft[i] / 255;
    }

    trapNationRef.current.render(floatFft);

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
