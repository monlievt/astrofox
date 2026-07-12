// @ts-nocheck

import { useFrame } from '@react-three/fiber';
import React from 'react';
import useApp from '@/app/actions/app';
import useScenes, { getSceneIdForElement } from '@/app/actions/scenes';
import { BLANK_IMAGE } from '@/app/constants';
import { SceneWithEffects } from './effects';
import {
  CubesDisplayLayer3D,
  GeometryDisplayLayer3D,
  MeshGridDisplayLayer3D,
  MorphingSphereDisplayLayer3D,
  PerspectiveScene3D,
  TunnelDisplayLayer3D,
  VissonanceSphereDisplayLayer3D,
  ParticleGalaxyDisplayLayer3D,
  ParticleFieldDisplayLayer3D,
  ParticleSpectrogramDisplayLayer3D,
} from './geometry';
import {
  BarSpectrumDisplayLayer,
  ImageDisplayLayer,
  LEDSpectrumDisplayLayer,
  MonstercatDisplayLayer,
  NCSDisplayLayer,
  ParticleBurstDisplayLayer,
  RadialSpectrumDisplayLayer,
  RippleRingsDisplayLayer,
  ShapeDisplayLayer,
  SoundWaveDisplayLayer,
  StarfieldDisplayLayer,
  TextDisplayLayer,
  TrapNationDisplayLayer,
  VideoDisplayLayer,
  WaveformRingDisplayLayer,
  WaveSpectrumDisplayLayer,
  MultiWaveDisplayLayer,
  MandalaDisplayLayer,
  ParticleSpectrumDisplayLayer,
  BinauralResonanceDisplayLayer,
  QuantumParticleWaveDisplayLayer,
  QuantumNeuralWebDisplayLayer,
  NeuroFlowFieldDisplayLayer,
  QuantumSiriSphereDisplayLayer,
  QuantumDNADisplayLayer,
  ChakraAuraDisplayLayer,
  WaveHorizonDisplayLayer,
} from './layers';

const NEUTRAL_SCENE_PROPS = {
  sceneOpacity: 1,
  sceneBlendMode: 'Normal',
  sceneMask: false,
  sceneInverse: false,
  sceneMaskCombine: 'replace',
};

const THREE_D_DISPLAY_NAMES = new Set([
  'GeometryDisplay',
  'TunnelDisplay',
  'CubesDisplay',
  'MeshGridDisplay',
  'MorphingSphereDisplay',
  'VissonanceSphereDisplay',
  'ParticleGalaxyDisplay',
  'ParticleFieldDisplay',
  'ParticleSpectrogramDisplay',
]);

function getScaledDisplay(display, scaleX, scaleY, scale) {
  if (!display || !display.properties) return display;
  const props = display.properties;
  const scaledProps = { ...props };

  // Scale positions
  if (typeof props.x === 'number') scaledProps.x = props.x * scaleX;
  if (typeof props.y === 'number') scaledProps.y = props.y * scaleY;

  const name = display.name;
  const isSymmetric =
    name === 'RadialSpectrumDisplay' ||
    name === 'TrapNationDisplay' ||
    name === 'NCSDisplay' ||
    name === 'WaveformRingDisplay' ||
    name === 'LissajousDisplay' ||
    name === 'RippleRingsDisplay' ||
    name === 'ParticleBurstDisplay' ||
    name === 'MorphingSphereDisplay' ||
    name === 'VissonanceSphereDisplay';

  // Scale dimensions
  if (typeof props.width === 'number') {
    scaledProps.width = props.width * (isSymmetric ? scale : scaleX);
  }
  if (typeof props.height === 'number') {
    scaledProps.height = props.height * (isSymmetric ? scale : scaleY);
  }

  // Scale display-specific parameters
  if (typeof props.radius === 'number') {
    scaledProps.radius = props.radius * scale;
  }
  if (typeof props.barWidth === 'number') {
    scaledProps.barWidth = props.barWidth * scale;
  }
  if (typeof props.barSpacing === 'number') {
    scaledProps.barSpacing = props.barSpacing * scale;
  }
  if (name === 'TextDisplay' && typeof props.size === 'number') {
    scaledProps.size = props.size * scale;
  }
  if (name === 'StarfieldDisplay' && typeof props.starSize === 'number') {
    scaledProps.starSize = props.starSize * scale;
  }
  if (name === 'LissajousDisplay' && typeof props.scale === 'number') {
    scaledProps.scale = props.scale * scale;
  }
  if (typeof props.baseRadius === 'number') {
    scaledProps.baseRadius = props.baseRadius * scale;
  }
  if (typeof props.ringSpacing === 'number') {
    scaledProps.ringSpacing = props.ringSpacing * scale;
  }
  if (typeof props.particleSize === 'number') {
    scaledProps.particleSize = props.particleSize * scale;
  }
  if (typeof props.barGap === 'number') {
    scaledProps.barGap = props.barGap * scale;
  }
  if (typeof props.ledGap === 'number') {
    scaledProps.ledGap = props.ledGap * scale;
  }
  if (typeof props.displacementScale === 'number') {
    scaledProps.displacementScale = props.displacementScale * scale;
  }

  const scaledDisplay = Object.create(display);
  Object.defineProperty(scaledDisplay, 'properties', {
    value: scaledProps,
    writable: true,
    configurable: true,
    enumerable: true,
  });

  return scaledDisplay;
}

function wrapDisplayNode(display, node) {
  if (!node) {
    return null;
  }

  return (
    <group key={display.id} visible={Boolean(display.enabled)}>
      {node}
    </group>
  );
}

function ComposerPresenter({ onPresent }) {
  useFrame(state => {
    onPresent?.(state.gl);
  }, 1);

  return null;
}

export default function StageRoot({ width, height, scenes, frameData, frameIndex, sceneLayersRef, onPresent }) {
  const activeElementId = useApp(state => state.activeElementId);
  const cameraModeEnabled = useApp(state => state.cameraModeEnabled);
  const sceneById = useScenes(state => state.sceneById);
  const elementParentSceneId = useScenes(state => state.elementParentSceneId);
  const cameraModeSceneId = React.useMemo(
    () =>
      cameraModeEnabled
        ? getSceneIdForElement(activeElementId, sceneById, elementParentSceneId)
        : null,
    [activeElementId, cameraModeEnabled, elementParentSceneId, sceneById],
  );

  const baseWidth = 854;
  const baseHeight = 480;
  const scaleX = width / baseWidth;
  const scaleY = height / baseHeight;
  const scale = Math.min(scaleX, scaleY);

  let order = 1;
  let sceneOrder = 0;
  const sceneProducers = [];

  for (const scene of scenes || []) {
    if (!scene?.enabled) {
      continue;
    }

    const sceneEffects = (scene.effects || []).filter(e => e?.enabled);
    const depthOfFieldEffect =
      sceneEffects.find(effect => effect?.name === 'DepthOfFieldEffect') || null;
    const postEffects = sceneEffects.filter(effect => effect?.name !== 'DepthOfFieldEffect');
    const scene2D = [];
    const scene2DBackground = [];
    const originalPush = scene2D.push;
    const scene3D = [];
    const has3DDisplays = (scene.displays || []).some(display =>
      THREE_D_DISPLAY_NAMES.has(display?.name),
    );
    let scene3DOrder = order;

    for (const rawDisplay of scene.displays || []) {
      if (!rawDisplay) {
        order += 1;
        continue;
      }

      const display = getScaledDisplay(rawDisplay, scaleX, scaleY, scale);

      // Dynamically override push method target based on renderInBackground property
      scene2D.push = display.properties?.renderInBackground
        ? scene2DBackground.push.bind(scene2DBackground)
        : originalPush;

      switch (display.name) {
        case 'ImageDisplay': {
          const src = display.properties?.src;
          const useArtwork = display.properties?.useTrackArtwork;
          const hasArtwork =
            useArtwork !== undefined && useArtwork !== false && useArtwork !== 'None';
          if ((!src || src === BLANK_IMAGE) && !hasArtwork) break;
          scene2D.push(
            wrapDisplayNode(
              display,
              <ImageDisplayLayer
                display={display}
                order={display.properties?.renderInBackground ? order - 10000 : order}
                frameData={frameData}
                {...NEUTRAL_SCENE_PROPS}
              />,
            ),
          );
          break;
        }
        case 'VideoDisplay':
          scene2D.push(
            wrapDisplayNode(
              display,
              <VideoDisplayLayer
                display={display}
                order={display.properties?.renderInBackground ? order - 10000 : order}
                {...NEUTRAL_SCENE_PROPS}
              />,
            ),
          );
          break;
        case 'TextDisplay':
          scene2D.push(
            wrapDisplayNode(
              display,
              <TextDisplayLayer
                display={display}
                order={order}
                frameData={frameData}
                {...NEUTRAL_SCENE_PROPS}
              />,
            ),
          );
          break;
        case 'ShapeDisplay':
          scene2D.push(
            wrapDisplayNode(
              display,
              <ShapeDisplayLayer
                display={display}
                order={order}
                frameData={frameData}
                {...NEUTRAL_SCENE_PROPS}
              />,
            ),
          );
          break;
        case 'BarSpectrumDisplay':
          scene2D.push(
            wrapDisplayNode(
              display,
              <BarSpectrumDisplayLayer
                display={display}
                order={order}
                frameData={frameData}
                {...NEUTRAL_SCENE_PROPS}
              />,
            ),
          );
          break;
        case 'RadialSpectrumDisplay':
          scene2D.push(
            wrapDisplayNode(
              display,
              <RadialSpectrumDisplayLayer
                display={display}
                order={order}
                frameData={frameData}
                {...NEUTRAL_SCENE_PROPS}
              />,
            ),
          );
          break;
        case 'WaveSpectrumDisplay':
          scene2D.push(
            wrapDisplayNode(
              display,
              <WaveSpectrumDisplayLayer
                display={display}
                order={order}
                frameData={frameData}
                {...NEUTRAL_SCENE_PROPS}
              />,
            ),
          );
          break;
        case 'WaveformRingDisplay':
          scene2D.push(
            wrapDisplayNode(
              display,
              <WaveformRingDisplayLayer
                display={display}
                order={order}
                frameData={frameData}
                {...NEUTRAL_SCENE_PROPS}
              />,
            ),
          );
          break;
        case 'SoundWaveDisplay':
          scene2D.push(
            wrapDisplayNode(
              display,
              <SoundWaveDisplayLayer
                display={display}
                order={order}
                frameData={frameData}
                {...NEUTRAL_SCENE_PROPS}
              />,
            ),
          );
          break;
        case 'GeometryDisplay':
          if (scene3D.length === 0) scene3DOrder = order;
          scene3D.push(
            wrapDisplayNode(
              display,
              <GeometryDisplayLayer3D
                display={display}
                order={order}
                frameData={frameData}
                {...NEUTRAL_SCENE_PROPS}
              />,
            ),
          );
          break;
        case 'TunnelDisplay':
          if (scene3D.length === 0) scene3DOrder = order;
          scene3D.push(
            wrapDisplayNode(
              display,
              <TunnelDisplayLayer3D
                display={display}
                order={order}
                height={height}
                sceneProperties={scene.properties || {}}
                frameData={frameData}
                {...NEUTRAL_SCENE_PROPS}
              />,
            ),
          );
          break;
        case 'CubesDisplay':
          if (scene3D.length === 0) scene3DOrder = order;
          scene3D.push(
            wrapDisplayNode(
              display,
              <CubesDisplayLayer3D
                display={display}
                order={order}
                width={width}
                height={height}
                frameData={frameData}
                {...NEUTRAL_SCENE_PROPS}
              />,
            ),
          );
          break;
        case 'MeshGridDisplay':
          if (scene3D.length === 0) scene3DOrder = order;
          scene3D.push(
            wrapDisplayNode(
              display,
              <MeshGridDisplayLayer3D
                display={display}
                order={order}
                frameData={frameData}
                {...NEUTRAL_SCENE_PROPS}
              />,
            ),
          );
          break;
        case 'StarfieldDisplay':
          scene2D.push(
            wrapDisplayNode(
              display,
              <StarfieldDisplayLayer
                display={display}
                order={order}
                frameData={frameData}
                {...NEUTRAL_SCENE_PROPS}
              />,
            ),
          );
          break;
        case 'TrapNationDisplay':
          scene2D.push(
            wrapDisplayNode(
              display,
              <TrapNationDisplayLayer
                display={display}
                order={order}
                frameData={frameData}
                {...NEUTRAL_SCENE_PROPS}
              />,
            ),
          );
          break;
        case 'NCSDisplay':
          scene2D.push(
            wrapDisplayNode(
              display,
              <NCSDisplayLayer
                display={display}
                order={order}
                frameData={frameData}
                {...NEUTRAL_SCENE_PROPS}
              />,
            ),
          );
          break;
        case 'MonstercatDisplay':
          scene2D.push(
            wrapDisplayNode(
              display,
              <MonstercatDisplayLayer
                display={display}
                order={order}
                frameData={frameData}
                {...NEUTRAL_SCENE_PROPS}
              />,
            ),
          );
          break;
        case 'RippleRingsDisplay':
          scene2D.push(
            wrapDisplayNode(
              display,
              <RippleRingsDisplayLayer
                display={display}
                order={order}
                frameData={frameData}
                {...NEUTRAL_SCENE_PROPS}
              />,
            ),
          );
          break;
        case 'ParticleBurstDisplay':
          scene2D.push(
            wrapDisplayNode(
              display,
              <ParticleBurstDisplayLayer
                display={display}
                order={order}
                frameData={frameData}
                {...NEUTRAL_SCENE_PROPS}
              />,
            ),
          );
          break;
        case 'LEDSpectrumDisplay':
          scene2D.push(
            wrapDisplayNode(
              display,
              <LEDSpectrumDisplayLayer
                display={display}
                order={order}
                frameData={frameData}
                {...NEUTRAL_SCENE_PROPS}
              />,
            ),
          );
          break;
        case 'MultiWaveDisplay':
          scene2D.push(
            wrapDisplayNode(
              display,
              <MultiWaveDisplayLayer
                display={display}
                order={order}
                frameData={frameData}
                {...NEUTRAL_SCENE_PROPS}
              />,
            ),
          );
          break;
        case 'MandalaDisplay':
          scene2D.push(
            wrapDisplayNode(
              display,
              <MandalaDisplayLayer
                display={display}
                order={order}
                frameData={frameData}
                {...NEUTRAL_SCENE_PROPS}
              />,
            ),
          );
          break;
        case 'QuantumParticleWaveDisplay':
          scene2D.push(
            wrapDisplayNode(
              display,
              <QuantumParticleWaveDisplayLayer
                display={display}
                order={order}
                frameData={frameData}
                {...NEUTRAL_SCENE_PROPS}
              />,
            ),
          );
          break;
        case 'BinauralResonanceDisplay':
          scene2D.push(
            wrapDisplayNode(
              display,
              <BinauralResonanceDisplayLayer
                display={display}
                order={order}
                frameData={frameData}
                {...NEUTRAL_SCENE_PROPS}
              />,
            ),
          );
          break;
        case 'QuantumNeuralWebDisplay':
          scene2D.push(
            wrapDisplayNode(
              display,
              <QuantumNeuralWebDisplayLayer
                display={display}
                order={order}
                frameData={frameData}
                {...NEUTRAL_SCENE_PROPS}
              />,
            ),
          );
          break;
        case 'NeuroFlowFieldDisplay':
          scene2D.push(
            wrapDisplayNode(
              display,
              <NeuroFlowFieldDisplayLayer
                display={display}
                order={order}
                frameData={frameData}
                {...NEUTRAL_SCENE_PROPS}
              />,
            ),
          );
          break;
        case 'QuantumSiriSphereDisplay':
          scene2D.push(
            wrapDisplayNode(
              display,
              <QuantumSiriSphereDisplayLayer
                display={display}
                order={order}
                frameData={frameData}
                {...NEUTRAL_SCENE_PROPS}
              />,
            ),
          );
          break;
        case 'QuantumDNADisplay':
          scene2D.push(
            wrapDisplayNode(
              display,
              <QuantumDNADisplayLayer
                display={display}
                order={order}
                frameData={frameData}
                {...NEUTRAL_SCENE_PROPS}
              />,
            ),
          );
          break;
        case 'ChakraAuraDisplay':
          scene2D.push(
            wrapDisplayNode(
              display,
              <ChakraAuraDisplayLayer
                display={display}
                order={order}
                frameData={frameData}
                {...NEUTRAL_SCENE_PROPS}
              />,
            ),
          );
          break;
        case 'WaveHorizonDisplay':
          scene2D.push(
            wrapDisplayNode(
              display,
              <WaveHorizonDisplayLayer
                display={display}
                order={order}
                frameData={frameData}
                {...NEUTRAL_SCENE_PROPS}
              />,
            ),
          );
          break;


        case 'MorphingSphereDisplay':
          if (scene3D.length === 0) scene3DOrder = order;
          scene3D.push(
            wrapDisplayNode(
              display,
              <MorphingSphereDisplayLayer3D
                display={display}
                order={order}
                frameData={frameData}
                {...NEUTRAL_SCENE_PROPS}
              />,
            ),
          );
          break;
        case 'VissonanceSphereDisplay':
          if (scene3D.length === 0) scene3DOrder = order;
          scene3D.push(
            wrapDisplayNode(
              display,
              <VissonanceSphereDisplayLayer3D
                display={display}
                order={order}
                frameData={frameData}
                {...NEUTRAL_SCENE_PROPS}
              />,
            ),
          );
          break;
        case 'ParticleGalaxyDisplay':
          if (scene3D.length === 0) scene3DOrder = order;
          scene3D.push(
            wrapDisplayNode(
              display,
              <ParticleGalaxyDisplayLayer3D
                display={display}
                order={order}
                frameData={frameData}
                {...NEUTRAL_SCENE_PROPS}
              />,
            ),
          );
          break;
        case 'ParticleFieldDisplay':
          if (scene3D.length === 0) scene3DOrder = order;
          scene3D.push(
            wrapDisplayNode(
              display,
              <ParticleFieldDisplayLayer3D
                display={display}
                order={order}
                frameData={frameData}
                {...NEUTRAL_SCENE_PROPS}
              />,
            ),
          );
          break;
        case 'ParticleSpectrogramDisplay':
          if (scene3D.length === 0) scene3DOrder = order;
          scene3D.push(
            wrapDisplayNode(
              display,
              <ParticleSpectrogramDisplayLayer3D
                display={display}
                order={order}
                frameData={frameData}
                {...NEUTRAL_SCENE_PROPS}
              />,
            ),
          );
          break;
        default:
          break;
      }

      order += 1;
    }

    const displayContent = (
      <React.Fragment key={scene.id}>
        {scene2DBackground}
        {(has3DDisplays || cameraModeSceneId === scene.id) && (
          <PerspectiveScene3D
            sceneId={scene.id}
            sceneProperties={scene.properties || {}}
            cameraModeActive={cameraModeSceneId === scene.id}
            width={width}
            height={height}
            renderOrder={scene3DOrder}
            depthOfFieldEffect={depthOfFieldEffect}
            frameIndex={frameIndex}
          >
            {scene3D}
          </PerspectiveScene3D>
        )}
        {scene2D}
      </React.Fragment>
    );

    const currentSceneOrder = sceneOrder;
    sceneOrder += 1;

    sceneProducers.push(
      <SceneWithEffects
        key={scene.id}
        width={width}
        height={height}
        effects={postEffects}
        frameData={frameData}
        outputToScreen={false}
        onTexture={texture => {
          if (!texture) {
            sceneLayersRef.current.delete(scene.id);
            return;
          }

          sceneLayersRef.current.set(scene.id, {
            order: currentSceneOrder,
            properties: scene.properties || {},
            texture,
          });
        }}
      >
        {displayContent}
      </SceneWithEffects>,
    );
  }

  return (
    <>
      {sceneProducers}
      <ComposerPresenter onPresent={onPresent} />
    </>
  );
}
