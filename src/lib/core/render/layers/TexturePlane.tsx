// @ts-nocheck
import React from 'react';
import {
  AddEquation,
  AdditiveBlending,
  CustomBlending,
  MultiplyBlending,
  NormalBlending,
  OneFactor,
  SubtractiveBlending,
  ZeroFactor,
} from 'three';
import { LUMA, MASK_FRAGMENT_SHADER, MASK_VERTEX_SHADER, toRadians } from '../constants';

export function getThreeBlending(blendMode = 'Normal') {
  switch (blendMode) {
    case 'Add':
      return AdditiveBlending;
    case 'Multiply':
      return MultiplyBlending;
    case 'Subtract':
      return SubtractiveBlending;
    default:
      return NormalBlending;
  }
}

export function requiresPremultipliedAlpha(blendMode = 'Normal') {
  return blendMode === 'Multiply' || blendMode === 'Subtract';
}

import { useFrame, useThree } from '@react-three/fiber';

const WAVE_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const WAVE_FRAGMENT_SHADER = `
  uniform sampler2D map;
  uniform float uTime;
  uniform float uWaveAmp;
  uniform float uWaveFreq;
  uniform float uWaveSpeed;
  uniform float uBass;
  uniform float uWaveReact;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;
    float speedFactor = uTime * uWaveSpeed * 4.0;
    float wave = sin(uv.y * uWaveFreq * 6.28318 + speedFactor);
    float dynamicAmp = uWaveAmp * (1.0 + uBass * uWaveReact * 2.5) * 0.002;
    
    uv.x += wave * dynamicAmp;
    
    // Discard pixels that leak out of the horizontal frame boundaries
    if (uv.x < 0.0 || uv.x > 1.0) {
      discard;
    }
    
    vec4 texColor = texture2D(map, uv);
    gl_FragColor = vec4(texColor.rgb, texColor.a * uOpacity);
  }
`;

export function TexturePlane({
  texture,
  width,
  height,
  x,
  y,
  originX,
  originY,
  rotation,
  zoom,
  opacity,
  sceneOpacity,
  sceneBlendMode,
  sceneMask,
  sceneInverse,
  sceneMaskCombine,
  renderOrder,
  parallaxMode = 'None',
  parallaxSpeed = 1.0,
  parallaxAmount = 20,
  frameData,
  waveAmp = 0,
  waveFreq = 2.5,
  waveSpeed = 1.0,
  waveReact = 1.0,
}) {
  const meshRef = React.useRef();
  const basePosition = [x + (width / 2 - originX), -y + (height / 2 - originY), 0];
  const planeWidth = Math.max(1, width);
  const planeHeight = Math.max(1, height);
  const planeScale = [planeWidth * zoom, planeHeight * zoom, 1];
  const finalOpacity = Math.max(0, Math.min(1, Number(opacity ?? 1) * Number(sceneOpacity ?? 1)));

  // Setup WebGL uniforms for shader material wave rendering
  const uniforms = React.useMemo(() => {
    return {
      map: { value: texture },
      uTime: { value: 0 },
      uWaveAmp: { value: Number(waveAmp ?? 0) },
      uWaveFreq: { value: Number(waveFreq ?? 2.5) },
      uWaveSpeed: { value: Number(waveSpeed ?? 1.0) },
      uWaveReact: { value: Number(waveReact ?? 1.0) },
      uBass: { value: 0 },
      uOpacity: { value: finalOpacity },
    };
  }, [texture]);

  // Sync React properties with WebGL shader uniforms
  React.useEffect(() => {
    const mat = meshRef.current?.material;
    if (mat && mat.uniforms) {
      if (mat.uniforms.uWaveAmp) mat.uniforms.uWaveAmp.value = Number(waveAmp ?? 0);
      if (mat.uniforms.uWaveFreq) mat.uniforms.uWaveFreq.value = Number(waveFreq ?? 2.5);
      if (mat.uniforms.uWaveSpeed) mat.uniforms.uWaveSpeed.value = Number(waveSpeed ?? 1.0);
      if (mat.uniforms.uWaveReact) mat.uniforms.uWaveReact.value = Number(waveReact ?? 1.0);
      if (mat.uniforms.uOpacity) mat.uniforms.uOpacity.value = finalOpacity;
    }
  }, [waveAmp, waveFreq, waveSpeed, waveReact, finalOpacity]);

  useFrame(state => {
    if (!meshRef.current) return;

    let ox = 0;
    let oy = 0;

    if (parallaxMode === 'Slow Drift') {
      const time = state.clock.elapsedTime * parallaxSpeed * 0.5;
      ox = Math.cos(time) * parallaxAmount;
      oy = Math.sin(time) * parallaxAmount;
    } else if (parallaxMode === 'Mouse Move') {
      ox = state.pointer.x * parallaxAmount;
      oy = state.pointer.y * parallaxAmount;
    } else if (parallaxMode === 'Audio Reaction') {
      const gain = frameData?.gain || 0;
      const time = state.clock.elapsedTime * 10 * parallaxSpeed;
      ox = Math.sin(time) * gain * parallaxAmount * 0.5;
      oy = Math.cos(time) * gain * parallaxAmount * 0.5;
    }

    meshRef.current.position.x = basePosition[0] + ox;
    meshRef.current.position.y = basePosition[1] + oy;

    // Update wave uniforms: uTime and uBass
    const mat = meshRef.current?.material;
    if (mat && mat.uniforms) {
      if (mat.uniforms.uTime) mat.uniforms.uTime.value = state.clock.elapsedTime;
      if (mat.uniforms.uBass) {
        let bass = 0;
        if (frameData?.fft) {
          const fft = frameData.fft;
          const activeCount = Math.floor(fft.length * 0.6);
          const bCount = Math.floor(activeCount * 0.25);
          for (let i = 0; i < bCount; i++) bass += fft[i] || 0;
          bass = (bass / Math.max(1, bCount)) / 255;
        }
        mat.uniforms.uBass.value = bass;
      }
    }
  });

  if (sceneMask) {
    const blendDstAlpha = sceneMaskCombine === 'add' ? OneFactor : ZeroFactor;

    return (
      <mesh
        ref={meshRef}
        position={basePosition}
        rotation={[0, 0, -toRadians(rotation)]}
        scale={planeScale}
        renderOrder={renderOrder}
      >
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          uniforms={{
            map: { value: texture },
            opacity: { value: finalOpacity },
            inverse: { value: sceneInverse ? 1 : 0 },
            luma: { value: LUMA },
          }}
          vertexShader={MASK_VERTEX_SHADER}
          fragmentShader={MASK_FRAGMENT_SHADER}
          transparent={true}
          depthTest={false}
          depthWrite={false}
          blending={CustomBlending}
          blendEquation={AddEquation}
          blendSrc={ZeroFactor}
          blendDst={OneFactor}
          blendEquationAlpha={AddEquation}
          blendSrcAlpha={OneFactor}
          blendDstAlpha={blendDstAlpha}
        />
      </mesh>
    );
  }

  // GPU Wave distortion shader material when waveAmp is set
  if (waveAmp > 0) {
    return (
      <mesh
        ref={meshRef}
        position={basePosition}
        rotation={[0, 0, -toRadians(rotation)]}
        scale={planeScale}
        renderOrder={renderOrder}
      >
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={WAVE_VERTEX_SHADER}
          fragmentShader={WAVE_FRAGMENT_SHADER}
          transparent={true}
          depthTest={false}
          depthWrite={false}
          blending={getThreeBlending(sceneBlendMode)}
        />
      </mesh>
    );
  }

  return (
    <mesh
      ref={meshRef}
      position={basePosition}
      rotation={[0, 0, -toRadians(rotation)]}
      scale={planeScale}
      renderOrder={renderOrder}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={texture}
        transparent={true}
        premultipliedAlpha={requiresPremultipliedAlpha(sceneBlendMode)}
        opacity={finalOpacity}
        toneMapped={false}
        depthTest={false}
        depthWrite={false}
        blending={getThreeBlending(sceneBlendMode)}
      />
    </mesh>
  );
}
