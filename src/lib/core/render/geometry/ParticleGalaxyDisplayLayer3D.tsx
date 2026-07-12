// @ts-nocheck
import React from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, DoubleSide, AddEquation, CustomBlending, OneFactor, ZeroFactor, BufferAttribute, BufferGeometry } from 'three';
import { getThreeBlending } from '../layers/TexturePlane';

const GALAXY_CORE_VERTEX_SHADER = `
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uBassSensitivity;
  uniform float uMidSensitivity;
  uniform float uSize;

  varying float vIsCore;
  varying float vRingIndex;
  varying float vDepth;

  // Simplex 3D Noise code
  vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

  float snoise(vec3 v){
    const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy) );
    vec3 x0 =   v - i + dot(i, C.xxx) ;

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod(i, 289.0 );
    vec4 p = permute( permute( permute(
               i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
             + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
             + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

    float n_ = 0.142857142857;
    vec3  ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z *ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_ );

    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                  dot(p2,x2), dot(p3,x3) ) );
  }

  void main() {
    vIsCore = 1.0;
    vRingIndex = 0.0;

    // Distort core points based on music and simplex noise
    float noiseVal = snoise(position * 0.015 + vec3(uTime * 0.5));
    float displace = (uBass * uBassSensitivity * 30.0) + 
                     (uMid * uMidSensitivity * 15.0 * noiseVal);

    vec3 animatedPos = position + normal * displace;

    vec4 mvPosition = modelViewMatrix * vec4(animatedPos, 1.0);
    vDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;

    // Size attenuates with distance and scales with uniform uSize
    gl_PointSize = uSize * (650.0 / -mvPosition.z);
  }
`;

const GALAXY_RINGS_VERTEX_SHADER = `
  uniform float uTime;
  uniform float uAudioBass;
  uniform float uAudioEnergy;
  uniform float uSensitivity;
  uniform float uRingCount;
  uniform float uSize;

  attribute float aRingIndex;
  attribute float aAngle;
  attribute float aSpeed;

  varying float vIsCore;
  varying float vRingIndex;
  varying float vDepth;

  void main() {
    vIsCore = 0.0;
    vRingIndex = aRingIndex;

    // Current angle modulated by orbital speed and dynamic time
    float currentAngle = aAngle + uTime * aSpeed * 0.15;
    float baseRadius = position.x;

    // Wave ripples along the rings, reacting to audio energy
    float wave = sin(currentAngle * 6.0 + uTime * 2.5) * 6.0 * (1.0 + uAudioEnergy * uSensitivity);

    // Expand rings out on bass hit
    float expansion = 1.0 + uAudioBass * uSensitivity * 0.15 * (1.0 - aRingIndex / uRingCount);
    float activeRadius = baseRadius * expansion + wave;

    // Concentric coordinates with vertical waving
    vec3 animatedPos = vec3(
      cos(currentAngle) * activeRadius,
      sin(currentAngle * 4.0 + uTime * 1.5) * 8.0 * (1.0 + uAudioBass * uSensitivity),
      sin(currentAngle) * activeRadius
    );

    vec4 mvPosition = modelViewMatrix * vec4(animatedPos, 1.0);
    vDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;

    // Sizing based on depth and custom particle size
    gl_PointSize = uSize * (500.0 / -mvPosition.z) * (1.0 - aRingIndex / (uRingCount * 1.8));
  }
`;

const GALAXY_FRAGMENT_SHADER = `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  uniform float uGlowIntensity;
  
  varying float vIsCore;
  varying float vRingIndex;
  varying float vDepth;

  void main() {
    // Generate soft, anti-aliased circles
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;

    // Soft glow falloff
    float alpha = smoothstep(0.5, 0.05, dist);

    // Color gradient: Core gets bright ColorA/pure white, rings blend to ColorB
    vec3 finalColor;
    if (vIsCore > 0.5) {
      finalColor = mix(uColorA, vec3(1.0, 1.0, 1.0), 0.25) * (1.0 + uGlowIntensity * 0.05);
    } else {
      // Color shifts as rings move outwards
      finalColor = mix(uColorA, uColorB, vRingIndex / 10.0) * (1.0 + uGlowIntensity * 0.04);
    }

    // Depth fade out to look beautiful in 3D perspective space
    float depthFade = clamp(1.2 - (vDepth / 850.0), 0.1, 1.0);

    gl_FragColor = vec4(finalColor, uOpacity * alpha * depthFade);
  }
`;

export function ParticleGalaxyDisplayLayer3D({
  display,
  order,
  frameData,
  sceneOpacity,
  sceneBlendMode,
  sceneMask,
}) {
  const { properties = {} } = display;
  const {
    orbRadius = 100,
    orbDetail = 24,
    ringCount = 8,
    particleSize = 3.5,
    colorA = '#8000ff',
    colorB = '#00ffff',
    glowIntensity = 15,
    sensitivity = 1.2,
    rotationSpeed = 0.3,
    tiltX = 0,
    tiltY = 0,
    tiltZ = 0,
    x = 0,
    y = 0,
    z = 0,
    opacity = 1.0,
  } = properties;

  const coreRef = React.useRef();
  const ringsRef = React.useRef();
  const coreMaterialRef = React.useRef();
  const ringsMaterialRef = React.useRef();
  const frameDataRef = React.useRef(frameData);
  frameDataRef.current = frameData;

  // Initial Uniforms
  const coreUniforms = React.useMemo(() => {
    return {
      uTime: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uBassSensitivity: { value: Number(sensitivity) },
      uMidSensitivity: { value: Number(sensitivity) * 0.8 },
      uSize: { value: Number(particleSize) },
      uColorA: { value: new Color(colorA) },
      uGlowIntensity: { value: Number(glowIntensity) },
      uOpacity: { value: Number(opacity ?? 1.0) * Number(sceneOpacity ?? 1.0) },
    };
  }, []);

  const ringsUniforms = React.useMemo(() => {
    return {
      uTime: { value: 0 },
      uAudioBass: { value: 0 },
      uAudioEnergy: { value: 0 },
      uSensitivity: { value: Number(sensitivity) },
      uRingCount: { value: Number(ringCount) },
      uSize: { value: Number(particleSize) * 0.8 },
      uColorA: { value: new Color(colorA) },
      uColorB: { value: new Color(colorB) },
      uGlowIntensity: { value: Number(glowIntensity) },
      uOpacity: { value: Number(opacity ?? 1.0) * Number(sceneOpacity ?? 1.0) },
    };
  }, []);

  // Update uniforms when properties change
  React.useEffect(() => {
    if (coreMaterialRef.current) {
      coreMaterialRef.current.uniforms.uColorA.value.set(colorA);
      coreMaterialRef.current.uniforms.uSize.value = Number(particleSize);
      coreMaterialRef.current.uniforms.uGlowIntensity.value = Number(glowIntensity);
      coreMaterialRef.current.uniforms.uBassSensitivity.value = Number(sensitivity);
      coreMaterialRef.current.uniforms.uMidSensitivity.value = Number(sensitivity) * 0.8;
      coreMaterialRef.current.uniforms.uOpacity.value = Number(opacity ?? 1.0) * Number(sceneOpacity ?? 1.0);
    }
    if (ringsMaterialRef.current) {
      ringsMaterialRef.current.uniforms.uColorA.value.set(colorA);
      ringsMaterialRef.current.uniforms.uColorB.value.set(colorB);
      ringsMaterialRef.current.uniforms.uSize.value = Number(particleSize) * 0.75;
      ringsMaterialRef.current.uniforms.uGlowIntensity.value = Number(glowIntensity);
      ringsMaterialRef.current.uniforms.uSensitivity.value = Number(sensitivity);
      ringsMaterialRef.current.uniforms.uRingCount.value = Number(ringCount);
      ringsMaterialRef.current.uniforms.uOpacity.value = Number(opacity ?? 1.0) * Number(sceneOpacity ?? 1.0);
    }
  }, [colorA, colorB, particleSize, glowIntensity, sensitivity, ringCount, opacity, sceneOpacity]);

  // Generate buffer geometry for rings once
  const ringsGeometry = React.useMemo(() => {
    const geom = new BufferGeometry();
    const positions = [];
    const ringIndices = [];
    const angles = [];
    const speeds = [];

    const numRings = Math.max(1, Math.round(Number(ringCount) || 1));
    const radius = Number(orbRadius) || 100;

    for (let r = 0; r < numRings; r++) {
      // Expanded spacing to fill the screen
      const ringRadius = radius * (1.2 + r * 0.48);
      // Increased particle count for a much denser and richer look
      const particlesInRing = Math.round(150 + r * 65);
      
      for (let i = 0; i < particlesInRing; i++) {
        const angle = (i / particlesInRing) * Math.PI * 2;
        
        // Store radius in position.x (so we can access in shader)
        positions.push(ringRadius, 0, 0);
        ringIndices.push(r);
        angles.push(angle);
        
        // Orbital speeds decrease outwards (Keplerian-like feel)
        const ringSpeed = (1.0 / Math.sqrt(r + 1)) * (Math.random() * 0.4 + 0.8);
        speeds.push(ringSpeed);
      }
    }

    geom.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    geom.setAttribute('aRingIndex', new BufferAttribute(new Float32Array(ringIndices), 1));
    geom.setAttribute('aAngle', new BufferAttribute(new Float32Array(angles), 1));
    geom.setAttribute('aSpeed', new BufferAttribute(new Float32Array(speeds), 1));

    return geom;
  }, [orbRadius, ringCount]);

  // Frame tick updates
  useFrame((state, delta) => {
    const coreMat = coreMaterialRef.current;
    const ringsMat = ringsMaterialRef.current;
    if (!coreMat || !ringsMat) return;

    const currentFrameData = frameDataRef.current;
    let bass = 0;
    let mid = 0;
    let energy = 0;

    if (currentFrameData && currentFrameData.fft) {
      const fft = currentFrameData.fft;
      const fLen = fft.length;

      const bassEnd = Math.max(1, Math.floor(fLen * 0.08));
      const midEnd = Math.max(bassEnd + 1, Math.floor(fLen * 0.4));

      for (let i = 0; i < bassEnd; i++) bass += fft[i] || 0;
      bass = (bass / bassEnd) / 255;

      for (let i = bassEnd; i < midEnd; i++) mid += fft[i] || 0;
      mid = (mid / (midEnd - bassEnd)) / 255;

      for (let i = 0; i < fLen; i++) energy += fft[i] || 0;
      energy = (energy / fLen) / 255;

      coreMat.uniforms.uBass.value = bass;
      coreMat.uniforms.uMid.value = mid;
      
      ringsMat.uniforms.uAudioBass.value = bass;
      ringsMat.uniforms.uAudioEnergy.value = energy;
    }

    // Modulate speeds of time progression
    const timeSpeed = 0.4 + bass * 2.2 * Number(sensitivity);
    coreMat.uniforms.uTime.value += delta * timeSpeed;
    ringsMat.uniforms.uTime.value += delta * timeSpeed * 0.85;

    // Slow organic orbit rotations
    if (coreRef.current) {
      coreRef.current.rotation.y += Number(rotationSpeed) * 0.15 * delta;
      coreRef.current.rotation.x += Number(rotationSpeed) * 0.08 * delta;
    }

    if (ringsRef.current) {
      ringsRef.current.rotation.y += Number(rotationSpeed) * 0.08 * delta;
      ringsRef.current.rotation.x += Number(rotationSpeed) * 0.03 * delta;
    }
  });

  const meshPosition = [x, -y, z];
  const meshRotation = [
    Number(tiltX || 0) * Math.PI / 180,
    Number(tiltY || 0) * Math.PI / 180,
    Number(tiltZ || 0) * Math.PI / 180,
  ];
  const blending = sceneMask ? CustomBlending : getThreeBlending(sceneBlendMode);

  return (
    <group position={meshPosition} rotation={meshRotation} renderOrder={order}>
      {/* 1. Core Pulsating Particle Orb */}
      <points ref={coreRef}>
        <icosahedronGeometry args={[orbRadius, Math.min(3, Math.floor(Number(orbDetail) / 8))]} />
        <shaderMaterial
          ref={coreMaterialRef}
          vertexShader={GALAXY_CORE_VERTEX_SHADER}
          fragmentShader={GALAXY_FRAGMENT_SHADER}
          uniforms={coreUniforms}
          transparent={true}
          depthTest={true}
          depthWrite={false}
          blending={blending}
          blendEquation={sceneMask ? AddEquation : undefined}
          blendSrc={sceneMask ? ZeroFactor : undefined}
          blendDst={sceneMask ? OneFactor : undefined}
        />
      </points>

      {/* 2. Concentric Ring Galaxy */}
      <points ref={ringsRef} geometry={ringsGeometry}>
        <shaderMaterial
          ref={ringsMaterialRef}
          vertexShader={GALAXY_RINGS_VERTEX_SHADER}
          fragmentShader={GALAXY_FRAGMENT_SHADER}
          uniforms={ringsUniforms}
          transparent={true}
          depthTest={true}
          depthWrite={false}
          blending={blending}
          blendEquation={sceneMask ? AddEquation : undefined}
          blendSrc={sceneMask ? ZeroFactor : undefined}
          blendDst={sceneMask ? OneFactor : undefined}
        />
      </points>
    </group>
  );
}
