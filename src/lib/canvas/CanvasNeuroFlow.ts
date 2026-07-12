export default class CanvasNeuroFlow {
  properties: Record<string, any>;
  canvas: HTMLCanvasElement;
  particles: { x: number; y: number; vx: number; vy: number; baseSize: number }[] = [];
  phase: number = 0;
  prevWidth: number = 0;
  prevHeight: number = 0;

  constructor(properties: Record<string, any>, canvas: HTMLCanvasElement) {
    this.properties = properties;
    this.canvas = canvas;
  }

  update(properties: Record<string, any>) {
    this.properties = properties;
  }

  initParticles(count: number, width: number, height: number) {
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        baseSize: 1.0 + Math.random() * 2.0,
      });
    }
  }

  render(fft: Float32Array) {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    const {
      particleCount = 150,
      speed = 1.0,
      trailLength = 0.92,
      amplitude = 60,
      vortexIntensity = 1.5,
      connectDistance = 50,
      color = '#00f3ff',
      glowColor = '#00f3ff',
      glowIntensity = 12,
      sensitivity = 1.2,
      x: offsetX = 0,
      y: offsetY = 0,
    } = this.properties;

    const width = this.canvas.width;
    const height = this.canvas.height;

    // Draw fading background trail
    const fadeOpa = Math.max(0.01, Math.min(0.3, 1.0 - Number(trailLength)));
    ctx.fillStyle = `rgba(0, 0, 0, ${fadeOpa})`;
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2 + Number(offsetX);
    const centerY = height / 2 - Number(offsetY);

    const count = Math.max(20, Math.min(400, Math.round(Number(particleCount) || 150)));
    const moveSpeed = Number(speed);
    const amp = Number(amplitude);
    const vortexI = Number(vortexIntensity);
    const connectDist = Number(connectDistance);
    const sens = Number(sensitivity);

    if (this.particles.length !== count || this.prevWidth !== width || this.prevHeight !== height) {
      this.initParticles(count, width, height);
      this.prevWidth = width;
      this.prevHeight = height;
    }

    // Time phase
    this.phase += 0.006 * moveSpeed;

    // Calculate average audio volume for vortex pull
    let audioSum = 0;
    const activeCount = Math.floor(fft.length * 0.6);
    for (let b = 0; b < activeCount; b++) {
      audioSum += fft[b] || 0;
    }
    const avgVolume = (audioSum / Math.max(1, activeCount)) * sens;

    // Update particles physics inside the flow field
    const updatedParticles = this.particles.map((p, idx) => {
      // 1. Flow Field Vector Force (Perlin-noise simulation using sine/cosine waves)
      const scale = 0.004;
      const flowAngle =
        Math.sin(p.x * scale + this.phase) * Math.cos(p.y * scale - this.phase) * Math.PI * 2;
      let fx = Math.cos(flowAngle) * 0.15;
      let fy = Math.sin(flowAngle) * 0.15;

      // 2. Swirling Vortex Center Force (triggers on audio peaks)
      if (vortexI > 0 && avgVolume > 0.05) {
        const dx = centerX - p.x;
        const dy = centerY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 10) {
          const nx = dx / dist;
          const ny = dy / dist;

          // Tangent vectors for rotation
          const tx = -ny;
          const ty = nx;

          // Pull factor (attraction to center)
          const pullForce = 0.08 * vortexI * avgVolume;
          // Rotation factor (spiral swirl speed)
          const swirlForce = 0.35 * vortexI * avgVolume;

          fx += nx * pullForce + tx * swirlForce;
          fy += ny * pullForce + ty * swirlForce;
        }
      }

      // Add forces to velocities with damping
      let vx = (p.vx + fx) * 0.95;
      let vy = (p.vy + fy) * 0.95;

      // Apply coordinates
      let x = p.x + vx * moveSpeed;
      let y = p.y + vy * moveSpeed;

      // If out of bounds, re-randomize coordinates to keep flow uniform
      if (x < 0 || x > width || y < 0 || y > height) {
        x = Math.random() * width;
        y = Math.random() * height;
        vx = (Math.random() - 0.5) * 0.5;
        vy = (Math.random() - 0.5) * 0.5;
      }

      // Specific audio reactivity for this particle
      const binIdx = Math.floor((idx / count) * activeCount);
      const audioVal = (fft[binIdx] || 0) * sens;

      return {
        x,
        y,
        vx,
        vy,
        baseSize: p.baseSize,
        audioVal,
      };
    });
    this.particles = updatedParticles;

    ctx.save();

    // Enable neon glow if intensity > 0
    const useGlow = Number(glowIntensity) > 0;
    if (useGlow) {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = Number(glowIntensity);
    }

    // ─── 3. DRAW TRANSIENT INTER-PARTICLE LINES (Fluid web connections) ───
    if (connectDist > 0) {
      ctx.lineWidth = 0.65;
      ctx.shadowBlur = 0; // Keep lines clean

      for (let i = 0; i < count; i++) {
        const p1 = updatedParticles[i];
        for (let j = i + 1; j < count; j++) {
          const p2 = updatedParticles[j];

          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < connectDist) {
            // Lines are brighter when particles are close and audio is active
            const fade = 1.0 - dist / connectDist;
            const lineVal = (p1.audioVal + p2.audioVal) / 2;
            ctx.strokeStyle =
              color +
              Math.floor(fade * (0.08 + lineVal * 0.4) * 255)
                .toString(16)
                .padStart(2, '0');

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }
    }

    // ─── 4. DRAW GLOWING FLOW NODES ───
    for (let i = 0; i < count; i++) {
      const p = updatedParticles[i];
      const pSize = p.baseSize * (1.0 + p.audioVal * amp * 0.05);

      if (useGlow) {
        ctx.shadowColor = color;
        ctx.shadowBlur = Number(glowIntensity) * (0.6 + p.audioVal * 0.5);
      }

      // Draw soft outer flare for active flow nodes
      if (p.audioVal > 0.08) {
        ctx.fillStyle = color + '12'; // Low opacity halo
        ctx.beginPath();
        ctx.arc(p.x, p.y, pSize * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Core white particle
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, pSize, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
