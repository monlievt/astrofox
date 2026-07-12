// @ts-nocheck
import React from 'react';
import CanvasStarfield from '@/lib/canvas/CanvasStarfield';
import { CanvasTextureLayer } from './CanvasTextureLayer';

export function StarfieldDisplayLayer({
  display,
  order,
  frameData,
  sceneOpacity,
  sceneBlendMode,
  sceneMask,
  sceneInverse,
  sceneMaskCombine,
}) {
  const starfieldRef = React.useRef(null);

  const drawFrame = React.useCallback(({ canvas, properties, frameData }) => {
    if (!starfieldRef.current) {
      starfieldRef.current = new CanvasStarfield(properties, canvas);
    }

    starfieldRef.current.update(properties);

    const gain = frameData?.gain || 0;
    starfieldRef.current.render(gain);

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
