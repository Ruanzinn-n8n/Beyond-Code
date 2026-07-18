/* ==========================================================================
   BEYOND CODE — WARP
   Toda a matemática e o desenho do efeito de túnel espacial (Canvas API).
   Não conhece "cenas" ou timeline — apenas desenha de acordo com uma
   intensidade (0 a 1) definida externamente via setIntensity().
   ========================================================================== */

const CONFIG = Object.freeze({
  PARTICLE_COUNT: 220,
  BASE_SPEED: 1.5,
  MAX_SPEED: 32,
  ACCEL_RATE: 0.9,
  SPAWN_RADIUS: 6,
  TAIL_LENGTH_FACTOR: 5,
  LINE_WIDTH: 1.6,
  COLOR_RGB: '245, 246, 247',
  INTENSITY_SMOOTHING: 0.08,
  FADE_IN_FRAMES: 16,
});

/**
 * Uma única linha do túnel: nasce no centro e viaja até sair da tela.
 * Propriedades próprias: x, y (derivadas), direction, speed, length,
 * opacity, life.
 */
class Particle {
  constructor(centerX, centerY) {
    this.reset(centerX, centerY);
  }

  reset(centerX, centerY) {
    this.centerX = centerX;
    this.centerY = centerY;
    this.direction = Math.random() * Math.PI * 2;
    this.radius = Math.random() * CONFIG.SPAWN_RADIUS;
    this.speed = CONFIG.BASE_SPEED + Math.random() * 2;
    this.length = 0;
    this.opacity = 0;
    this.life = 0;
  }

  update(intensity) {
    this.speed = Math.min(
      this.speed + CONFIG.ACCEL_RATE * intensity,
      CONFIG.MAX_SPEED
    );
    this.radius += this.speed * intensity;
    this.length = Math.min(this.speed * CONFIG.TAIL_LENGTH_FACTOR, this.radius);
    this.life += 1;
    this.opacity = Math.min(1, this.life / CONFIG.FADE_IN_FRAMES) * intensity;

    this.x = this.centerX + Math.cos(this.direction) * this.radius;
    this.y = this.centerY + Math.sin(this.direction) * this.radius;
  }

  isDead(maxRadius) {
    return this.radius > maxRadius;
  }

  getHead() {
    return { x: this.x, y: this.y };
  }

  getTail() {
    const tailRadius = Math.max(this.radius - this.length, 0);
    return {
      x: this.centerX + Math.cos(this.direction) * tailRadius,
      y: this.centerY + Math.sin(this.direction) * tailRadius,
    };
  }
}

export class WarpEffect {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.intensity = 0;
    this.targetIntensity = 0;
    this.running = false;
    this.frameId = null;
    this.center = { x: 0, y: 0 };
    this.maxRadius = 0;

    this._handleResize = this._handleResize.bind(this);
    this._loop = this._loop.bind(this);
  }

  /** Prepara o canvas e o pool de partículas. Chamar uma vez, antes de start(). */
  init() {
    this._handleResize();
    window.addEventListener('resize', this._handleResize);

    this.particles = Array.from(
      { length: CONFIG.PARTICLE_COUNT },
      () => new Particle(this.center.x, this.center.y)
    );
  }

  /** Define para onde a intensidade deve convergir (0 = parado, 1 = máxima). */
  setIntensity(value) {
    this.targetIntensity = Math.max(0, Math.min(1, value));
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.frameId = requestAnimationFrame(this._loop);
  }

  stop() {
    this.running = false;
    if (this.frameId) cancelAnimationFrame(this.frameId);
    this._clear();
  }

  destroy() {
    this.stop();
    window.removeEventListener('resize', this._handleResize);
    this.particles = [];
  }

  _handleResize() {
    const { innerWidth: width, innerHeight: height } = window;
    this.canvas.width = width;
    this.canvas.height = height;
    this.center = { x: width / 2, y: height / 2 };
    this.maxRadius = Math.hypot(width, height) / 2 + 40;
  }

  _loop() {
    if (!this.running) return;

    this.intensity +=
      (this.targetIntensity - this.intensity) * CONFIG.INTENSITY_SMOOTHING;

    this._updateParticles();
    this._draw();

    this.frameId = requestAnimationFrame(this._loop);
  }

  _updateParticles() {
    this.particles.forEach((particle) => {
      particle.update(this.intensity);
      if (particle.isDead(this.maxRadius)) {
        particle.reset(this.center.x, this.center.y);
      }
    });
  }

  _draw() {
    this._clear();
    const { ctx } = this;
    ctx.lineWidth = CONFIG.LINE_WIDTH;
    ctx.lineCap = 'round';

    this.particles.forEach((particle) => {
      if (particle.opacity <= 0) return;

      const head = particle.getHead();
      const tail = particle.getTail();

      ctx.strokeStyle = `rgba(${CONFIG.COLOR_RGB}, ${particle.opacity})`;
      ctx.beginPath();
      ctx.moveTo(tail.x, tail.y);
      ctx.lineTo(head.x, head.y);
      ctx.stroke();
    });
  }

  _clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}