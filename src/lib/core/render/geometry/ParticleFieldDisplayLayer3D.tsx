// @ts-nocheck
import React from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, BufferAttribute, BufferGeometry } from 'three';

const FIELD_VERTEX_SHADER = `
  uniform float uTime;
  uniform float uAudioBass;
  uniform float uAudioEnergy;
  uniform float uSensitivity;
  uniform float uAmplitude;
  uniform float uSpeed;
  uniform float uSize;

  varying float vDepth;
  varying vec2 vGridCoord;

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
    vGridCoord = position.xy;

    vec3 noiseInput = vec3(position.x * 0.005, position.z * 0.005, uTime * uSpeed * 0.4);
    float noiseVal = snoise(noiseInput);
    
    // Wave ripple combined with audio bass
    float waveHeight = noiseVal * uAmplitude * (1.0 + uAudioBass * uSensitivity * 0.7);

    // Apply secondary high-frequency ripple based on treble/energy
    waveHeight += sin(position.x * 0.02 + uTime * 3.0) * 12.0 * (1.0 + uAudioEnergy * uSensitivity * 0.5);

    vec3 animatedPos = vec3(position.x, position.y + waveHeight, position.z);

    // Rotate slightly on Y axis based on time
    float angle = uTime * 0.03;
    float cosA = cos(angle);
    float sinA = sin(angle);
    vec3 rotatedPos = vec3(
      animatedPos.x * cosA - animatedPos.z * sinA,
      animatedPos.y,
      animatedPos.x * sinA + animatedPos.z * cosA
    );

    vec4 mvPosition = modelViewMatrix * vec4(rotatedPos, 1.0);
    vDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;

    // Point size depends on distance and custom scale factor
    gl_PointSize = uSize * (600.0 / -mvPosition.z);
  }
`;

const FIELD_FRAGMENT_SHADER = `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  uniform float uGlowIntensity;

  varying float vDepth;
  varying vec2 vGridCoord;

  void main() {
    // Round particles with glow
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;

    float alpha = smoothstep(0.5, 0.08, dist);

    // Color gradient across the terrain based on grid coordinates
    float mixFactor = clamp((vGridCoord.x + 300.0) / 600.0, 0.0, 1.0);
    vec3 finalColor = mix(uColorA, uColorB, mixFactor) * (1.0 + uGlowIntensity * 0.04);

    // Depth fading
    float depthFade = clamp(1.4 - (vDepth / 1200.0), 0.1, 1.0);

    gl_FragColor = vec4(finalColor, uOpacity * alpha * depthFade);
  }
`;

export function ParticleFieldDisplayLayer3D({
  display,
  order,
  frameData,
  sceneOpacity,
  sceneBlendMode,
  sceneMask,
}) {
  const { properties = {} } = display;
  const {
    gridSize = 32,
    spacing = 24,
    amplitude = 60,
    particleSize = 4.5,
    colorA = '#00ffcc',
    colorB = '#ff00ff',
    glowIntensity = 18,
    speed = 1.0,
    sensitivity = 1.2,
    x = 0,
    y = -100,
    z = -200,
    opacity = 1.0,
  } = properties;

  const pointsRef = React.useRef();
  const materialRef = React.useRef();
  const frameDataRef = React.useRef(frameData);
  frameDataRef.current = frameData;

  const uniforms = React.useMemo(() => {
    return {
      uTime: { value: 0 },
      uAudioBass: { value: 0 },
      uAudioEnergy: { value: 0 },
      uSensitivity: { value: Number(sensitivity) },
      uAmplitude: { value: Number(amplitude) },
      uSpeed: { value: Number(speed) },
      uSize: { value: Number(particleSize) },
      uColorA: { value: new Color(colorA) },
      uColorB: { value: new Color(colorB) },
      uGlowIntensity: { value: Number(glowIntensity) },
      uOpacity: { value: Number(opacity ?? 1.0) * Number(sceneOpacity ?? 1.0) },
    };
  }, []);

  React.useEffect(() => {
    const mat = materialRef.current;
    if (mat) {
      mat.uniforms.uColorA.value.set(colorA);
      mat.uniforms.uColorB.value.set(colorB);
      mat.uniforms.uSize.value = Number(particleSize);
      mat.uniforms.uGlowIntensity.value = Number(glowIntensity);
      mat.uniforms.uSensitivity.value = Number(sensitivity);
      mat.uniforms.uAmplitude.value = Number(amplitude);
      mat.uniforms.uSpeed.value = Number(speed);
      mat.uniforms.uOpacity.value = Number(opacity ?? 1.0) * Number(sceneOpacity ?? 1.0);
    }
  }, [colorA, colorB, particleSize, glowIntensity, sensitivity, amplitude, speed, opacity, sceneOpacity]);

  const geometry = React.useMemo(() => {
    const geom = new BufferGeometry();
    const positions = [];
    const size = Math.max(8, Math.round(Number(gridSize) || 32));
    const step = Number(spacing) || 24;

    const startX = -((size - 1) * step) / 2;
    const startZ = -((size - 1) * step) / 2;

    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        const px = startX + i * step;
        const pz = startZ + j * step;
        positions.push(px, 0, pz);
      }
    }

    geom.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    return geom;
  }, [gridSize, spacing]);

  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime();
    const fd = frameDataRef.current;
    
    // Parse real-time audio bands
    let bass = 0.1;
    let energy = 0.1;

    if (fd && fd.fft) {
      const fft = fd.fft;
      let bassSum = 0;
      let energySum = 0;

      for (let i = 0; i < 8; i++) {
        bassSum += fft[i] || 0;
      }
      for (let i = 0; i < fft.length; i++) {
        energySum += fft[i] || 0;
      }

      bass = bassSum / 8 / 255;
      energy = energySum / fft.length / 255;
    }

    const mat = materialRef.current;
    if (mat) {
      mat.uniforms.uTime.value = elapsed;
      mat.uniforms.uAudioBass.value = bass;
      mat.uniforms.uAudioEnergy.value = energy;
    }
  });

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      position={[Number(x), Number(y), Number(z)]}
      rotation={[0.6, 0, 0]} // Tilt down slightly to see perspective terrain grid
    >
      <shaderMaterial
        ref={materialRef}
        vertexShader={FIELD_VERTEX_SHADER}
        fragmentShader={FIELD_FRAGMENT_SHADER}
        uniforms={uniforms}
        transparent={true}
        depthWrite={false}
        blending={2} // Additive blending for gorgeous glowing overlays
      />
    </points>
  );
}
