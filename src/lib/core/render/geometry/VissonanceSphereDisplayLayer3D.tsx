// @ts-nocheck
import React from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, DoubleSide, AddEquation, CustomBlending, OneFactor, ZeroFactor } from 'three';
import { getThreeBlending } from '../layers/TexturePlane';

const NEON_VERTEX_SHADER = `
  uniform float uTime;
  uniform float uAudioBass;
  uniform float uAudioEnergy;
  uniform float uSensitivity;
  uniform float uDisplacementScale;

  varying float vDepth;
  varying float vDisplace;

  // Modulo-less 3D simplex noise
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
    // Dynamic noise frequency based on treble/energy, creating high-frequency ripples on beats!
    float noiseFreq = 0.015 + uAudioEnergy * 0.015;
    float noiseVal = snoise(position * noiseFreq + vec3(uTime));
    
    // Waveform-like vertex offset
    float displace = clamp(uAudioBass * uSensitivity * uDisplacementScale, 0.0, 150.0) * noiseVal;
    vec3 newPos = position + normal * displace;

    vDisplace = displace;
    
    vec4 mvPosition = modelViewMatrix * vec4(newPos, 1.0);
    vDepth = -mvPosition.z; // camera depth for depth-fade lines
    
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const NEON_FRAGMENT_SHADER = `
  uniform vec3 uLineColor;
  uniform vec3 uGlowColor;
  uniform float uGlowIntensity;
  uniform float uOpacity;

  varying float vDepth;
  varying float vDisplace;

  void main() {
    // Depth fade: lines further back get progressively transparent, creating neat 3D depth look
    float depthFade = clamp(1.2 - (vDepth / 800.0), 0.05, 1.0);
    
    // Mix line color and glow based on local displacement spikes
    float pulse = clamp(vDisplace / 30.0, 0.0, 1.0);
    vec3 color = mix(uLineColor, uGlowColor, pulse);
    
    // Add extra brightness for glow
    vec3 finalColor = color * (1.0 + pulse * uGlowIntensity * 0.5);

    gl_FragColor = vec4(finalColor, uOpacity * depthFade);
  }
`;

export function VissonanceSphereDisplayLayer3D({
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
    radius = 130,
    lineColor = '#00ffff',
    glowColor = '#00ffff',
    glowIntensity = 18,
    sensitivity = 1.2,
    detail = 24,
    rotationSpeedX = 0.2,
    rotationSpeedY = 0.5,
    displacementScale = 60,
    x = 0,
    y = 0,
    z = 0,
    opacity = 1.0,
  } = properties;

  const meshRef = React.useRef();
  const materialRef = React.useRef();
  const frameDataRef = React.useRef(frameData);
  frameDataRef.current = frameData;

  // Preallocated Uniforms
  const uniforms = React.useMemo(() => {
    return {
      uTime: { value: 0 },
      uAudioBass: { value: 0 },
      uAudioEnergy: { value: 0 },
      uSensitivity: { value: Number(sensitivity) },
      uDisplacementScale: { value: Number(displacementScale) },
      uLineColor: { value: new Color(lineColor) },
      uGlowColor: { value: new Color(glowColor) },
      uGlowIntensity: { value: Number(glowIntensity) },
      uOpacity: { value: Number(opacity ?? 1.0) * Number(sceneOpacity ?? 1.0) },
    };
  }, []);

  // Update uniforms that can change
  React.useEffect(() => {
    const material = materialRef.current;
    if (material) {
      material.uniforms.uLineColor.value.set(lineColor);
      material.uniforms.uGlowColor.value.set(glowColor);
      material.uniforms.uGlowIntensity.value = Number(glowIntensity);
      material.uniforms.uSensitivity.value = Number(sensitivity);
      material.uniforms.uDisplacementScale.value = Number(displacementScale);
      material.uniforms.uOpacity.value = Number(opacity ?? 1.0) * Number(sceneOpacity ?? 1.0);
    }
  }, [lineColor, glowColor, glowIntensity, sensitivity, displacementScale, opacity, sceneOpacity]);

  // Handle updates on each frame
  useFrame((state, delta) => {
    const material = materialRef.current;
    if (!material) return;

    const currentFrameData = frameDataRef.current;
    let bass = 0;
    let energy = 0;

    if (currentFrameData && currentFrameData.fft) {
      const fft = currentFrameData.fft;
      const fLen = fft.length;
      
      const bassEnd = Math.max(1, Math.floor(fLen * 0.08));
      for (let i = 0; i < bassEnd; i++) bass += fft[i] || 0;
      bass = (bass / bassEnd) / 255;

      for (let i = 0; i < fLen; i++) energy += fft[i] || 0;
      energy = (energy / fLen) / 255;

      material.uniforms.uAudioBass.value = bass;
      material.uniforms.uAudioEnergy.value = energy;
    }

    // Modulate time speed using bass energy so waves morph faster on beat
    const timeSpeed = 0.35 + bass * 2.2 * Number(sensitivity);
    material.uniforms.uTime.value += delta * timeSpeed;

    if (meshRef.current) {
      const rotFactor = 0.15 + energy * 0.85;
      meshRef.current.rotation.y += Number(rotationSpeedY) * 0.08 * delta * rotFactor;
      meshRef.current.rotation.x += Number(rotationSpeedX) * 0.08 * delta * rotFactor;
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
          vertexShader={NEON_VERTEX_SHADER}
          fragmentShader={NEON_FRAGMENT_SHADER}
          uniforms={uniforms}
          wireframe={true}
          transparent={true}
          side={DoubleSide}
          depthTest={true}
          depthWrite={false}
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
