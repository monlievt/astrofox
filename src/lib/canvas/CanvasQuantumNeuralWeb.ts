export default class CanvasQuantumNeuralWeb {
  properties: Record<string, any>;
  canvas: HTMLCanvasElement;
  particles: { x: number; y: number; vx: number; vy: number; phase: number }[] = [];
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
        vx: (Math.random() - 0.5) * 1.2,
        vy: (Math.random() - 0.5) * 1.2,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  render(fft: Float32Array) {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    const {
      particleCount = 100,
      connectDistance = 100,
      amplitude = 40,
      speed = 1.0,
      particleSize = 2.5,
      lineWidth = 1.0,
      lineOpacity = 0.25,
      color = '#00f3ff',
      glowColor = '#00f3ff',
      glowIntensity = 15,
      sensitivity = 1.2,
      pulseSpeed = 1.5,
      x: offsetX = 0,
      y: offsetY = 0,
    } = this.properties;

    const width = this.canvas.width;
    const height = this.canvas.height;

    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2 + Number(offsetX);
    const centerY = height / 2 - Number(offsetY);

    const count = Math.max(10, Math.min(250, Math.round(Number(particleCount) || 100)));
    const maxDist = Math.max(10, Math.min(300, Number(connectDistance)));
    const amp = Number(amplitude);
    const pSize = Number(particleSize);
    const lineW = Number(lineWidth);
    const lineOpa = Number(lineOpacity);
    const sens = Number(sensitivity);
    const moveSpeed = Number(speed);
    const pulseS = Number(pulseSpeed);

    // Initialize or adjust particles array
    if (this.particles.length !== count || this.prevWidth !== width || this.prevHeight !== height) {
      this.initParticles(count, width, height);
      this.prevWidth = width;
      this.prevHeight = height;
    }

    // Update phase/time animation
    this.phase += pulseS * 0.02;

    // 1. Move and update particles
    const activeCount = Math.floor(fft.length * 0.65);
    const updatedParticles = this.particles.map((p, idx) => {
      // Move particle
      let px = p.x + p.vx * moveSpeed;
      let py = p.y + p.vy * moveSpeed;

      // Wrap boundaries
      if (px < 0) px = width;
      if (px > width) px = 0;
      if (py < 0) py = height;
      if (py > height) py = 0;

      // Audio reactivity: assign each particle to a specific FFT bin
      const binIdx = Math.floor((idx / count) * activeCount);
      const audioVal = (fft[binIdx] || 0) * sens;

      return {
        x: px,
        y: py,
        vx: p.vx,
        vy: p.vy,
        phase: p.phase + 0.05,
        audioVal,
      };
    });
    this.particles = updatedParticles;

    ctx.save();

    // Position offset offset mapping relative to center
    const xShift = Number(offsetX);
    const yShift = -Number(offsetY);

    // Enable neon glow if intensity > 0
    const useGlow = Number(glowIntensity) > 0;
    if (useGlow) {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = Number(glowIntensity);
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // ─── 2. DRAW CONNECTING WEB LINES AND ELECTRICAL IMPULSES ───
    for (let i = 0; i < count; i++) {
      const p1 = updatedParticles[i];
      for (let j = i + 1; j < count; j++) {
        const p2 = updatedParticles[j];

        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < maxDist) {
          // Fade opacity as particles get further apart
          const distFade = 1.0 - dist / maxDist;
          const currentOpacity = lineOpa * distFade;

          // Draw the web connection line
          ctx.strokeStyle = `rgba(0, 243, 255, ${currentOpacity})`;
          ctx.lineWidth = lineW * distFade;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();

          // Draw synapses electrical impulses as a comet trail (splash/spread effect)
          // Pulse travels down the line from p1 to p2
          const pulseProgress = (this.phase + i * 0.13 + j * 0.07) % 1.0;
          const impulseVal = (p1.audioVal + p2.audioVal) / 2;

          if (impulseVal > 0.05) {
            // Draw 3 sub-sparks trailing behind each other to simulate a comet tail / splash
            for (let t = 0; t < 3; t++) {
              const trailOffset = t * 0.035; // distance offset
              const trailProgress = Math.max(0, pulseProgress - trailOffset);
              const trailX = p1.x + (p2.x - p1.x) * trailProgress;
              const trailY = p1.y + (p2.y - p1.y) * trailProgress;

              const sparkSize =
                lineW * 2.0 * distFade * (1.0 + impulseVal * 1.5) * (1.0 - t * 0.28);
              ctx.fillStyle = `rgba(255, 255, 255, ${distFade * (0.35 + impulseVal * 0.65) * (1.0 - t * 0.35)})`;
              ctx.beginPath();
              ctx.arc(trailX, trailY, sparkSize, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }
    }

    // ─── 3. DRAW GLOWING PARTICLE NODES ───
    for (let i = 0; i < count; i++) {
      const p = updatedParticles[i];

      // Node size is modulated by its audio value
      const sizeFactor = pSize * (1.0 + p.audioVal * amp * 0.05);

      if (useGlow) {
        ctx.shadowColor = color;
        ctx.shadowBlur = Number(glowIntensity) * (0.6 + p.audioVal * 0.4);
      }

      // Draw outer glowing halo and expanding brainwave ripples for active particles
      if (p.audioVal > 0.1) {
        ctx.fillStyle = color + '15'; // 8% opacity halo
        ctx.beginPath();
        ctx.arc(p.x, p.y, sizeFactor * 2.2, 0, Math.PI * 2);
        ctx.fill();

        // Expanding brainwave ripple ring
        if (p.audioVal > 0.15) {
          ctx.save();
          ctx.shadowBlur = 0; // Disable heavy glow for clean ring
          const progress = (this.phase * 1.2 + i * 0.53) % 1.0;
          const rippleRad = sizeFactor * (1.2 + progress * 3.8);
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.35 * (1.0 - progress);
          ctx.lineWidth = lineW * 0.6;
          ctx.beginPath();
          ctx.arc(p.x, p.y, rippleRad, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Draw solid white/core node
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, sizeFactor, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
