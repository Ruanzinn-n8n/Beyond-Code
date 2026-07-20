/* ==========================================================================
   BEYOND CODE — WARP
   Túnel espacial por perspectiva (estilo starfield/hyperspace).
   Cada linha existe num espaço 3D simplificado (x, y, z); a câmera avança
   em direção a z=0. Projetar (x/z, y/z) é o que faz tudo crescer e
   acelerar ao se aproximar — como estrelas vistas de dentro de uma nave,
   não uma explosão saindo do centro da tela.
   ========================================================================== */

const CONFIG = Object.freeze({
  PARTICLE_COUNT: 260,

  // Profundidade: Z_FAR é "no horizonte", Z_NEAR é "colado na câmera".
  // Ao cruzar Z_NEAR, a linha "passou pelo usuário" e renasce em Z_FAR —
  // nunca no centro da tela.
  Z_FAR: 1,
  Z_NEAR: 0.015,

  // Posição angular ao redor do eixo da câmera (espalhamento lateral).
  MIN_SPREAD: 0.05,
  MAX_SPREAD: 1,

  // Velocidade individual por linha ao longo do eixo Z — varia entre
  // partículas para que o campo nunca pareça um bloco rígido/sincronizado.
  SPEED_MIN: 0.0035,
  SPEED_MAX: 0.011,

  // Rastro mínimo garantido: nenhuma linha nasce como um ponto — ela já
  // existe como um traço curto e alonga naturalmente ao se aproximar.
  MIN_STREAK_DELTA_Z: 0.01,
  STREAK_FACTOR: 1,

  FOCAL_LENGTH: 320,
  LINE_WIDTH_BASE: 1.2,
  LINE_WIDTH_GROWTH: 2.2,
  COLOR_RGB: '245, 246, 247',

  INTENSITY_SMOOTHING: 0.06,
});

/**
 * Uma única "linha" do túnel. Vive em coordenadas (x, y, z): x e y são
 * fixos (a direção do raio não muda), só z diminui — é a câmera avançando.
 */
class Particle {
  constructor() {
    this.respawn(true);
  }

  /**
   * @param {boolean} spreadAcrossDepth — true apenas na criação inicial,
   * para o túnel já nascer com profundidade em vez de todas as linhas
   * surgirem juntas em Z_FAR e demorarem a preencher a cena.
   */
  respawn(spreadAcrossDepth) {
    const angle = Math.random() * Math.PI * 2;
    const spread =
      CONFIG.MIN_SPREAD + Math.random() * (CONFIG.MAX_SPREAD - CONFIG.MIN_SPREAD);

    this.x = Math.cos(angle) * spread;
    this.y = Math.sin(angle) * spread;

    this.z = spreadAcrossDepth
      ? CONFIG.Z_NEAR + Math.random() * (CONFIG.Z_FAR - CONFIG.Z_NEAR)
      : CONFIG.Z_FAR;

    this.speed =
      CONFIG.SPEED_MIN + Math.random() * (CONFIG.SPEED_MAX - CONFIG.SPEED_MIN);
  }

  /** Avança a linha em direção à câmera. speedMultiplier vem da intensidade global. */
  update(speedMultiplier) {
    this.z -= this.speed * speedMultiplier;
  }

  hasPassedCamera() {
    return this.z <= CONFIG.Z_NEAR;
  }

  /** Projeta um ponto (x, y) num dado z para coordenadas de tela. */
  _project(z, center) {
    const depth = Math.max(z, CONFIG.Z_NEAR);
    return {
      x: center.x + (this.x / depth) * CONFIG.FOCAL_LENGTH,
      y: center.y + (this.y / depth) * CONFIG.FOCAL_LENGTH,
    };
  }

  /** Cabeça (posição atual) e cauda (um pouco mais longe) do traço. */
  getStreak(center, speedMultiplier) {
    const head = this._project(this.z, center);

    const deltaZ =
      Math.max(this.speed * speedMultiplier, CONFIG.MIN_STREAK_DELTA_Z) *
      CONFIG.STREAK_FACTOR;

    const tail = this._project(Math.min(this.z + deltaZ, CONFIG.Z_FAR), center);

    return { head, tail };
  }

  /** 0 = acabou de nascer no fundo · 1 = colada na câmera. */
  getProximity() {
    return 1 - (this.z - CONFIG.Z_NEAR) / (CONFIG.Z_FAR - CONFIG.Z_NEAR);
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

    this._handleResize = this._handleResize.bind(this);
    this._loop = this._loop.bind(this);
  }

  /** Prepara o canvas e o pool de partículas. Chamar uma vez, antes de start(). */
  init() {
    this._handleResize();
    window.addEventListener('resize', this._handleResize);

    this.particles = Array.from({ length: CONFIG.PARTICLE_COUNT }, () => {
      const particle = new Particle();
      particle.respawn(true); // espalha pela profundidade já na criação
      return particle;
    });
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
      if (particle.hasPassedCamera()) {
        // Renasce no fundo do túnel — nunca no centro da tela.
        particle.respawn(false);
      }
    });
  }

  _draw() {
    this._clear();
    const { ctx, center, intensity } = this;

    this.particles.forEach((particle) => {
      const proximity = particle.getProximity();
      const alpha = intensity * (0.35 + proximity * 0.65);
      if (alpha <= 0.01) return;

      const { head, tail } = particle.getStreak(center, intensity);

      ctx.lineWidth = CONFIG.LINE_WIDTH_BASE + proximity * CONFIG.LINE_WIDTH_GROWTH;
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(${CONFIG.COLOR_RGB}, ${alpha})`;

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