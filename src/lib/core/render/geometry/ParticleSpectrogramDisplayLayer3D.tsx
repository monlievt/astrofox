// @ts-nocheck
import React from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, BufferAttribute, BufferGeometry } from 'three';

const SPECTROGRAM_VERTEX_SHADER = `
  uniform float uTime;
  uniform float uAmplitude;
  uniform float uSize;

  varying float vDepth;
  varying vec2 vGridCoord;
  varying float vHeightVal;

  void main() {
    vGridCoord = position.xz;
    vHeightVal = position.y;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;

    // Scale particle sizes nicely with depth
    gl_PointSize = uSize * (850.0 / -mvPosition.z);
  }
`;

const SPECTROGRAM_FRAGMENT_SHADER = `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  uniform float uGlowIntensity;
  uniform float uAmplitude;

  varying float vDepth;
  varying vec2 vGridCoord;
  varying float vHeightVal;

  void main() {
    // Glowing round circular points
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;

    float alpha = smoothstep(0.5, 0.08, dist);

    // Height-based dynamic gradient (peaks are bright ColorA, valleys are ColorB)
    float heightMix = clamp(vHeightVal / (uAmplitude * 0.8), 0.0, 1.0);
    vec3 finalColor = mix(uColorB, uColorA, heightMix) * (1.0 + uGlowIntensity * 0.04);

    // Fade out far away depth particles
    float depthFade = clamp(1.4 - (vDepth / 1400.0), 0.1, 1.0);

    gl_FragColor = vec4(finalColor, uOpacity * alpha * depthFade);
  }
`;

export function ParticleSpectrogramDisplayLayer3D({
  display,
  order,
  frameData,
  sceneOpacity,
  sceneBlendMode,
  sceneMask,
}) {
  const { properties = {} } = display;
  const {
    columns = 60,
    rows = 32,
    spacingX = 12,
    spacingZ = 16,
    amplitude = 140,
    particleSize = 5.0,
    colorA = '#a855f7',
    colorB = '#00f0ff',
    glowIntensity = 25,
    scrollSpeed = 1.0,
    sensitivity = 1.4,
    x = 0,
    y = -140,
    z = -380,
    opacity = 1.0,
  } = properties;

  const pointsRef = React.useRef();
  const materialRef = React.useRef();
  const frameDataRef = React.useRef(frameData);
  frameDataRef.current = frameData;

  // History buffer to store scrolling heights
  const historyRef = React.useRef([]);
  const lastScrollTimeRef = React.useRef(0);

  const uniforms = React.useMemo(() => {
    return {
      uTime: { value: 0 },
      uAmplitude: { value: Number(amplitude) },
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
      mat.uniforms.uAmplitude.value = Number(amplitude);
      mat.uniforms.uOpacity.value = Number(opacity ?? 1.0) * Number(sceneOpacity ?? 1.0);
    }
  }, [colorA, colorB, particleSize, glowIntensity, amplitude, opacity, sceneOpacity]);

  // Construct static coordinates grid
  const geometry = React.useMemo(() => {
    const geom = new BufferGeometry();
    const positions = [];
    const numCols = Math.max(8, Math.round(Number(columns) || 60));
    const numRows = Math.max(8, Math.round(Number(rows) || 32));
    const stepX = Number(spacingX) || 12;
    const stepZ = Number(spacingZ) || 16;

    const startX = -((numCols - 1) * stepX) / 2;
    const startZ = -((numRows - 1) * stepZ) / 2;

    // Reset history buffer
    historyRef.current = Array.from({ length: numCols }, () => new Float32Array(numRows).fill(0.0));

    for (let c = 0; c < numCols; c++) {
      const px = startX + c * stepX;
      for (let r = 0; r < numRows; r++) {
        const pz = startZ + r * stepZ;
        // Position layout: X, Y (starts at 0), Z
        positions.push(px, 0.0, pz);
      }
    }

    geom.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    return geom;
  }, [columns, rows, spacingX, spacingZ]);

  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime();
    const fd = frameDataRef.current;
    const numCols = Math.max(8, Math.round(Number(columns) || 60));
    const numRows = Math.max(8, Math.round(Number(rows) || 32));
    const stepX = Number(spacingX) || 12;
    const stepZ = Number(spacingZ) || 16;

    const mat = materialRef.current;
    if (mat) {
      mat.uniforms.uTime.value = elapsed;
    }

    // Rate-limit column scrolling based on scrollSpeed to prevent visual rushing
    const scrollInterval = 0.05 / Math.max(0.1, Number(scrollSpeed) || 1.0);
    if (elapsed - lastScrollTimeRef.current >= scrollInterval) {
      lastScrollTimeRef.current = elapsed;

      // Extract new FFT row values
      const newColumn = new Float32Array(numRows);
      if (fd && fd.fft) {
        const fft = fd.fft;
        const fLen = fft.length;
        for (let r = 0; r < numRows; r++) {
          // Focus spectrum bins on low-mid where dynamics are high
          const bin = Math.min(fLen - 1, Math.floor((r / numRows) * (fLen * 0.70)));
          newColumn[r] = (fft[bin] || 0) / 255.0;
        }
      }

      // Scroll column heights from right to left (column 0 = left edge, columns-1 = right edge)
      const history = historyRef.current;
      for (let c = 0; c < numCols - 1; c++) {
        history[c].set(history[c + 1]);
      }
      history[numCols - 1].set(newColumn);

      // Re-populate and update geometry vertex Y values
      if (pointsRef.current) {
        const geom = pointsRef.current.geometry;
        const posAttr = geom.getAttribute('position');
        const array = posAttr.array;
        
        const amp = Number(amplitude);

        for (let c = 0; c < numCols; c++) {
          const colData = history[c];
          for (let r = 0; r < numRows; r++) {
            const index = c * numRows + r;
            const fftVal = colData[r] || 0.0;

            // Base gentle organic waving noise
            const px = array[index * 3];
            const pz = array[index * 3 + 2];
            
            // Simplex-like mathematical noise for valleys
            const noiseVal = Math.sin(px * 0.005 + elapsed * 1.2) * Math.cos(pz * 0.005 + elapsed * 0.8) * 12.0;

            // Peak amplitude driven directly by audio and mapped vertically
            const targetHeight = (fftVal * amp) + noiseVal;
            
            // Write to Y coordinate
            array[index * 3 + 1] = targetHeight;
          }
        }
        posAttr.needsUpdate = true;
      }
    }
  });

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      position={[Number(x), Number(y), Number(z)]}
      rotation={[0.35, 0, 0]} // Tilted horizontal grid perspective
    >
      <shaderMaterial
        ref={materialRef}
        vertexShader={SPECTROGRAM_VERTEX_SHADER}
        fragmentShader={SPECTROGRAM_FRAGMENT_SHADER}
        uniforms={uniforms}
        transparent={true}
        depthWrite={false}
        blending={2} // Additive blending for gorgeous neon overlays
      />
    </points>
  );
}
