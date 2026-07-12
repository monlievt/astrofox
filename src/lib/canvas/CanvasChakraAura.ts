function parseHex(hex: string) {
  const clean = hex.replace('#', '');
  const num =
    parseInt(
      clean.length === 3
        ? clean
            .split('')
            .map(c => c + c)
            .join('')
        : clean,
      16,
    ) || 0;
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function interpolateColor(color1: string, color2: string, factor: number) {
  const c1 = parseHex(color1);
  const c2 = parseHex(color2);
  const r = Math.round(c1.r + factor * (c2.r - c1.r));
  const g = Math.round(c1.g + factor * (c2.g - c1.g));
  const b = Math.round(c1.b + factor * (c2.b - c1.b));
  return `rgb(${r}, ${g}, ${b})`;
}

interface AuraParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  maxAge: number;
  size: number;
  speedScale: number;
}

interface AuraShockwave {
  radius: number;
  speed: number;
  alpha: number;
  color: string;
}

export default class CanvasChakraAura {
  properties: Record<string, any>;
  canvas: HTMLCanvasElement;
  particles: AuraParticle[] = [];
  shockwaves: AuraShockwave[] = [];
  time: number = 0;
  smoothBass: number = 0.2;
  smoothHighs: number = 0.1;
  bassBeatCooldown: number = 0;
  highsBeatCooldown: number = 0;

  constructor(properties: Record<string, any>, canvas: HTMLCanvasElement) {
    this.properties = properties;
    this.canvas = canvas;
  }

  update(properties: Record<string, any>) {
    this.properties = properties;
  }

  render(fft: Float32Array) {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    const {
      sphereRadius = 50, // Center Core Radius
      dotDensity = 100, // Maximum particles count
      innerColor = '#8f00ff', // Inner Chakra Color (Violet)
      outerColor = '#ffd700', // Outer Aura Color (Gold)
      glowIntensity = 15,
      glowColor = '#8f00ff',
      sensitivity = 1.5,
      wiggleSpeed = 1.0, // Used as speed of particle drift
      x: offsetX = 0,
      y: offsetY = 0,
    } = this.properties;

    const width = this.canvas.width;
    const height = this.canvas.height;
    const centerX = width / 2 + Number(offsetX);
    const centerY = height / 2 - Number(offsetY);

    ctx.clearRect(0, 0, width, height);

    this.time += 0.01 * Number(wiggleSpeed);
    const sens = Number(sensitivity);
    const coreR = Number(sphereRadius);
    const maxParticles = Math.max(30, Math.min(400, Number(dotDensity)));
    const driftSpeed = Number(wiggleSpeed);

    // Calculate audio frequency bands
    const activeCount = Math.floor(fft.length * 0.6);
    let bass = 0;
    let mids = 0;
    let highs = 0;

    const bCount = Math.floor(activeCount * 0.2);
    const mCount = Math.floor(activeCount * 0.4);

    for (let i = 0; i < bCount; i++) bass += fft[i] || 0;
    for (let i = bCount; i < bCount + mCount; i++) mids += fft[i] || 0;
    for (let i = bCount + mCount; i < activeCount; i++) highs += fft[i] || 0;

    bass = (bass / Math.max(1, bCount)) * sens;
    mids = (mids / Math.max(1, mCount)) * sens;
    highs = (highs / Math.max(1, activeCount - bCount - mCount)) * sens;

    const avgVol = (bass + mids + highs) / 3;

    // Decrement beat cooldowns
    if (this.bassBeatCooldown > 0) this.bassBeatCooldown--;
    if (this.highsBeatCooldown > 0) this.highsBeatCooldown--;

    // ─── 1. DUAL BEAT DETECTION & SHOCKWAVE EMISSION ───
    this.smoothBass = this.smoothBass * 0.96 + bass * 0.04;
    this.smoothHighs = this.smoothHighs * 0.96 + highs * 0.04;

    // Trigger Bass Shockwave (Crown Chakra / Violet)
    const isBassPeak = bass > Math.max(0.12, this.smoothBass * 1.32) && this.bassBeatCooldown === 0;
    if (isBassPeak) {
      this.shockwaves.push({
        radius: coreR,
        speed: 5.5 + bass * 4.5,
        alpha: 0.65 + bass * 0.35,
        color: innerColor,
      });
      this.bassBeatCooldown = 18; // cooldown to prevent trigger storm
    }

    // Trigger Highs/Gamma Shockwave (Solar Plexus / Gold)
    const isHighsPeak =
      highs > Math.max(0.1, this.smoothHighs * 1.35) && this.highsBeatCooldown === 0;
    if (isHighsPeak) {
      this.shockwaves.push({
        radius: coreR,
        speed: 7.5 + highs * 5.0, // Expands faster
        alpha: 0.5 + highs * 0.4,
        color: outerColor, // Gold/White shockwave
      });
      this.highsBeatCooldown = 22;
    }

    // ─── 2. PARTICLE EMISSION ───
    // Emit rate scales directly with music volume (amplified scale)
    const emitRate = 1 + Math.floor(avgVol * 26);
    if (this.particles.length < maxParticles) {
      for (let i = 0; i < emitRate; i++) {
        const theta = Math.random() * Math.PI * 2;
        // Emit from core boundary
        const px = centerX + Math.cos(theta) * coreR;
        const py = centerY + Math.sin(theta) * coreR;

        // Initial velocity outwards
        const force = 1.0 + Math.random() * 1.5 + bass * 2.0;
        const vx = Math.cos(theta) * force;
        const vy = Math.sin(theta) * force;

        this.particles.push({
          x: px,
          y: py,
          vx,
          vy,
          age: 0,
          maxAge: 70 + Math.random() * 90,
          size: 1.0 + Math.random() * 2.2,
          speedScale: 0.6 + Math.random() * 0.8,
        });
      }
    }

    // ─── 3. UPDATE SHOCKWAVES & PHYSICAL PARTICLE PUSH ───
    this.shockwaves = this.shockwaves
      .map(sw => {
        const radius = sw.radius + sw.speed;
        const alpha = sw.alpha * 0.94; // fade out

        return {
          radius,
          speed: sw.speed,
          alpha,
          color: sw.color,
        };
      })
      .filter(sw => sw.alpha > 0.015);

    // ─── 4. UPDATE PHYSICS AND DRAW PARTICLES (Aura Field) ───
    this.particles = this.particles
      .map(p => {
        // Apply vector noise flow field force to create curved organic paths
        const scale = 0.007;
        const angle =
          Math.sin(p.x * scale + this.time) * Math.cos(p.y * scale - this.time) * Math.PI * 0.65;

        let fx = Math.cos(angle) * 0.12 * driftSpeed;
        let fy = Math.sin(angle) * 0.12 * driftSpeed;

        // Calculate radial vector from center
        const dx = p.x - centerX;
        const dy = p.y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const nx = dist > 0 ? dx / dist : 0;
        const ny = dist > 0 ? dy / dist : 0;

        // Apply physical push if a shockwave passes over the particle
        for (const sw of this.shockwaves) {
          if (Math.abs(dist - sw.radius) < 18) {
            // Push outwards along normal vector with shockwave force
            fx += nx * (2.8 * sw.alpha);
            fy += ny * (2.8 * sw.alpha);
          }
        }

        // Add gentle radial expansion force
        fx += nx * (0.04 * (1.0 + mids * 0.5));
        fy += ny * (0.04 * (1.0 + mids * 0.5));

        // Integrate forces with damping
        const vx = (p.vx + fx) * 0.97;
        const vy = (p.vy + fy) * 0.97;

        return {
          x: p.x + vx * p.speedScale,
          y: p.y + vy * p.speedScale,
          vx,
          vy,
          age: p.age + 1,
          maxAge: p.maxAge,
          size: p.size,
          speedScale: p.speedScale,
        };
      })
      .filter(p => p.age < p.maxAge);

    // Draw Particles
    ctx.save();
    const useGlow = Number(glowIntensity) > 0;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const lifeRatio = p.age / p.maxAge;

      // Interpolate color based on lifetime: inner chakra (violet) to outer aura (gold)
      const color = interpolateColor(innerColor, outerColor, lifeRatio);
      ctx.fillStyle = color;

      // Twinkling stars effect on high-frequencies
      const twinkle = Math.random() > 0.88 ? highs * 2.8 : 0.0;
      const opacity = (1.0 - lifeRatio) * (0.42 + twinkle);
      ctx.globalAlpha = Math.max(0.04, Math.min(1.0, opacity));

      if (useGlow) {
        ctx.shadowColor = color;
        ctx.shadowBlur = Number(glowIntensity) * (0.4 + twinkle * 0.6);
      } else {
        ctx.shadowBlur = 0;
      }

      // Size increases slightly on beats
      const currentSize = p.size * (1.0 + avgVol * 0.6) + twinkle * 0.8;

      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.6, currentSize), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // ─── 5. DRAW SHOCKWAVES (Concentric expanding light rings) ───
    if (this.shockwaves.length > 0) {
      ctx.save();
      for (const sw of this.shockwaves) {
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = 1.5 + sw.alpha * 5.0;
        ctx.globalAlpha = sw.alpha * 0.45;

        if (useGlow) {
          ctx.shadowColor = sw.color;
          ctx.shadowBlur = Number(glowIntensity) * sw.alpha * 1.2;
        }

        ctx.beginPath();
        ctx.arc(centerX, centerY, sw.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // ─── 6. DRAW BREATHING CORE ENERGY FIELD (Chakra Core) ───
    ctx.save();
    // Core radius expands and contracts directly with the average volume
    const activeCoreR = coreR * (1.0 + avgVol * 1.55);

    const coreGrad = ctx.createRadialGradient(
      centerX - activeCoreR * 0.1,
      centerY - activeCoreR * 0.1,
      activeCoreR * 0.15,
      centerX,
      centerY,
      activeCoreR,
    );
    coreGrad.addColorStop(0, '#ffffff'); // bright center spark
    coreGrad.addColorStop(0.35, innerColor + 'cc'); // soft inner color
    coreGrad.addColorStop(0.85, innerColor + '33'); // fading halo edge
    coreGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(centerX, centerY, activeCoreR, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
