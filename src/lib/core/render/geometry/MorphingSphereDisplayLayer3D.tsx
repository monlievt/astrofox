// @ts-nocheck
import React from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, DoubleSide, AddEquation, CustomBlending, OneFactor, ZeroFactor } from 'three';
import { getThreeBlending, requiresPremultipliedAlpha } from '../layers/TexturePlane';

const SIMPLEX_NOISE = `
vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x) {
     return mod289(((x*34.0)+1.0)*x);
}

vec4 taylorInvSqrt(vec4 r)
{
  return 1.79284291400159 - 0.85373472095314 * r;
}

float snoise(vec3 v)
{ 
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

  i = mod289(i); 
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
`;

const MORPH_VERTEX_SHADER = `
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uTreble;
  uniform float uBassSensitivity;
  uniform float uMidSensitivity;
  uniform float uTrebleSensitivity;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vDisplacement;

  ${SIMPLEX_NOISE}

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;

    // Displacement noise
    float noiseVal = snoise(position * 0.015 + vec3(uTime * 0.4));
    
    // Bass drives overall displacement, mid/treble drives the spikes
    float displace = (uBass * uBassSensitivity * 35.0) + 
                     (uMid * uMidSensitivity * 15.0 * noiseVal) + 
                     (uTreble * uTrebleSensitivity * 10.0 * (1.0 - abs(noiseVal)));

    vec3 newPosition = position + normal * displace;
    vDisplacement = displace;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`;

const MORPH_FRAGMENT_SHADER = `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  uniform float uOpacity;
  uniform float uGlowIntensity;
  uniform vec3 uGlowColor;
  uniform float uTime;
  uniform float uBass;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vDisplacement;

  void main() {
    // Normal in camera space
    vec3 N = normalize(vNormal);
    
    // View direction
    vec3 V = normalize(vec3(0.0, 0.0, 1.0));
    
    // Fresnel term (rim effect)
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    
    // Color mapping based on position and time for a fluid gradient
    float colorShift = sin(vPosition.x * 0.008 + vPosition.y * 0.008 + uTime * 0.5) * 0.5 + 0.5;
    
    // Mix the base colors
    vec3 baseColor = mix(uColorA, uColorB, colorShift);
    baseColor = mix(baseColor, uColorC, fresnel * 0.8);
    
    // Vibrant glow effect
    vec3 glow = uGlowColor * fresnel * (uGlowIntensity / 5.0);
    
    // Add beat reactive pulse
    vec3 finalColor = baseColor * (1.0 + uBass * 0.45) + glow;
    
    gl_FragColor = vec4(finalColor, uOpacity);
  }
`;

export function MorphingSphereDisplayLayer3D({
  display,
  order,
  frameData,
  sceneOpacity,
  sceneBlendMode,
  sceneMask,
  sceneInverse,
}) {
  const { properties = {} } = display;
  const {
    radius = 120,
    colorA = '#7a00ff',
    colorB = '#ff007a',
    colorC = '#00f0ff',
    glowColor = '#7a00ff',
    glowIntensity = 15,
    bassSensitivity = 1.5,
    midSensitivity = 1.0,
    trebleSensitivity = 0.8,
    rotationSpeed = 0.3,
    detail = 64,
    x = 0,
    y = 0,
    z = 0,
    opacity = 1.0,
    wireframe = false,
  } = properties;

  const meshRef = React.useRef();
  const materialRef = React.useRef();
  const frameDataRef = React.useRef(frameData);
  frameDataRef.current = frameData;

  // Uniforms
  const uniforms = React.useMemo(() => {
    return {
      uTime: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uTreble: { value: 0 },
      uBassSensitivity: { value: Number(bassSensitivity) },
      uMidSensitivity: { value: Number(midSensitivity) },
      uTrebleSensitivity: { value: Number(trebleSensitivity) },
      uColorA: { value: new Color(colorA) },
      uColorB: { value: new Color(colorB) },
      uColorC: { value: new Color(colorC) },
      uGlowColor: { value: new Color(glowColor) },
      uGlowIntensity: { value: Number(glowIntensity) },
      uOpacity: { value: Number(opacity ?? 1.0) * Number(sceneOpacity ?? 1.0) },
    };
  }, []);

  // Update uniforms that can change
  React.useEffect(() => {
    const material = materialRef.current;
    if (material) {
      material.uniforms.uColorA.value.set(colorA);
      material.uniforms.uColorB.value.set(colorB);
      material.uniforms.uColorC.value.set(colorC);
      material.uniforms.uGlowColor.value.set(glowColor);
      material.uniforms.uGlowIntensity.value = Number(glowIntensity);
      material.uniforms.uBassSensitivity.value = Number(bassSensitivity);
      material.uniforms.uMidSensitivity.value = Number(midSensitivity);
      material.uniforms.uTrebleSensitivity.value = Number(trebleSensitivity);
      material.uniforms.uOpacity.value = Number(opacity ?? 1.0) * Number(sceneOpacity ?? 1.0);
    }
  }, [colorA, colorB, colorC, glowColor, glowIntensity, bassSensitivity, midSensitivity, trebleSensitivity, opacity, sceneOpacity]);

  // React to frame updates
  useFrame((state, delta) => {
    const material = materialRef.current;
    if (!material) return;

    material.uniforms.uTime.value += delta;

    const currentFrameData = frameDataRef.current;
    if (currentFrameData && currentFrameData.fft) {
      const fft = currentFrameData.fft;
      const fLen = fft.length;
      
      const bassEnd = Math.max(1, Math.floor(fLen * 0.08));
      const midEnd = Math.max(bassEnd + 1, Math.floor(fLen * 0.4));
      
      let bass = 0;
      for (let i = 0; i < bassEnd; i++) bass += fft[i] || 0;
      bass = (bass / bassEnd) / 255;

      let mid = 0;
      for (let i = bassEnd; i < midEnd; i++) mid += fft[i] || 0;
      mid = (mid / (midEnd - bassEnd)) / 255;

      let treble = 0;
      for (let i = midEnd; i < fLen; i++) treble += fft[i] || 0;
      treble = (treble / (fLen - midEnd)) / 255;

      material.uniforms.uBass.value = bass;
      material.uniforms.uMid.value = mid;
      material.uniforms.uTreble.value = treble;
    }

    if (meshRef.current) {
      const rot = Number(rotationSpeed) * 0.4 * delta;
      meshRef.current.rotation.y += rot;
      meshRef.current.rotation.x += rot * 0.5;
    }
  });

  const meshPosition = [x, -y, z];
  const blending = sceneMask ? CustomBlending : getThreeBlending(sceneBlendMode);

  return (
    <group position={meshPosition} renderOrder={order}>
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[radius, Math.min(64, Math.floor(detail / 2))]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={MORPH_VERTEX_SHADER}
          fragmentShader={MORPH_FRAGMENT_SHADER}
          uniforms={uniforms}
          wireframe={wireframe}
          transparent={true}
          depthTest={true}
          depthWrite={true}
          blending={blending}
          blendEquation={sceneMask ? AddEquation : undefined}
          blendSrc={sceneMask ? ZeroFactor : undefined}
          blendDst={sceneMask ? OneFactor : undefined}
          blendEquationAlpha={sceneMask ? AddEquation : undefined}
          blendSrcAlpha={sceneMask ? OneFactor : undefined}
          blendDstAlpha={sceneMask ? ZeroFactor : undefined}
        />
      </mesh>
    </group>
  );
}
