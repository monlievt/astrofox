// @ts-nocheck
import React from 'react';
import CanvasQuantumNeuralWeb from '@/lib/canvas/CanvasQuantumNeuralWeb';
import { CanvasTextureLayer } from './CanvasTextureLayer';

export function QuantumNeuralWebDisplayLayer({
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
    const w = Math.max(10, Math.round(Number(properties.width) || 854));
    const h = Math.max(10, Math.round(Number(properties.height) || 854));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    if (!canvasRef.current) {
      canvasRef.current = new CanvasQuantumNeuralWeb(properties, canvas);
    }

    canvasRef.current.update(properties);

    const fft = frameData?.fft || new Uint8Array(64);
    const floatFft = new Float32Array(fft.length);
    for (let i = 0; i < fft.length; i++) {
      floatFft[i] = fft[i] / 255;
    }

    canvasRef.current.render(floatFft);

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
