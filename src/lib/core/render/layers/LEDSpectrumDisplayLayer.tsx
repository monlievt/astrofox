// @ts-nocheck
import React from 'react';
import CanvasLEDSpectrum from '@/lib/canvas/CanvasLEDSpectrum';
import { CanvasTextureLayer } from './CanvasTextureLayer';

export function LEDSpectrumDisplayLayer({
  display,
  order,
  frameData,
  sceneOpacity,
  sceneBlendMode,
  sceneMask,
  sceneInverse,
  sceneMaskCombine,
}) {
  const ledRef = React.useRef(null);

  const drawFrame = React.useCallback(({ canvas, properties, frameData }) => {
    if (!ledRef.current) {
      ledRef.current = new CanvasLEDSpectrum(properties, canvas);
    }

    ledRef.current.update(properties);

    const fft = frameData?.fft || new Uint8Array(128);
    const floatFft = new Float32Array(fft.length);
    for (let i = 0; i < fft.length; i++) {
      floatFft[i] = fft[i] / 255;
    }

    ledRef.current.render(floatFft);

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
