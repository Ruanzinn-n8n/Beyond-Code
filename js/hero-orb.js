/* ==========================================================================
   BEYOND CODE — HERO ORB
   Núcleo tecnológico vivo, renderizado em Canvas 2D dentro de .hero__scene.

   Arquitetura isolada, no mesmo espírito de WarpEffect (js/warp.js):
   uma classe única, métodos pequenos com responsabilidade única, nenhum
   estado global, nenhuma dependência externa.

   Não desenha nada em CSS — apenas pixels em Canvas. O CSS só posiciona
   o elemento <canvas> dentro de .hero__scene (ver css/layout.css).
   ========================================================================== */

const TAU = Math.PI * 2;

/* Ângulo de ouro — usado para distribuir os pontos na esfera de forma
   uniforme (Fibonacci sphere). É o que evita "faixas" ou aglomerados
   de partículas nos polos, que denunciariam uma esfera artificial. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export class HeroOrb {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Object} [options]
   */
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });

    this.options = Object.assign(
      {
        particleCount: 120,
        rotationSpeedDeg: 4, // graus por segundo — dentro de 3–5
        maxNeighbors: 3, // conexões por partícula (garante rede esparsa)
        neighborThreshold: 0.62, // distância de corda (unidade da esfera)
        breathAmplitude: 0.028, // variação de "respiração" do raio
        breathPeriodMs: 6200,
        floatAmplitudePx: 7, // oscilação vertical, em px de tela
        floatPeriodMs: 5200,
        mouseInfluenceRadiusFactor: 3.2, // múltiplo do raio do canvas
        mouseTiltMaxRad: 0.16, // ~9°
        mouseLerp: 0.055, // suavização do "aproximar/afastar"
        glowBaseAlpha: 0.16,
        glowHoverBoost: 0.10, // +10% pedido no brief
        colorCore: '255, 255, 255',
        colorParticleWarm: '255, 255, 255',
        colorParticleCool: '210, 224, 236', // cinza muito claro / azul sutil
        colorGlow: '198, 214, 232',
      },
      options
    );

    /* -- estado de tempo / animação --------------------------------- */
    this._rafId = null;
    this._running = false;
    this._lastTime = 0;
    this._elapsed = 0;

    /* -- estado de rotação -------------------------------------------- */
    this._rotationY = 0;
    this._tiltX = 0;
    this._tiltXTarget = 0;
    this._tiltYOffset = 0;
    this._tiltYOffsetTarget = 0;

    /* -- estado de interação do mouse --------------------------------- */
    this._hoverIntensity = 0; // 0..1, suavizado
    this._hoverTarget = 0;
    this._pointerInViewport = false;
    this._pointerScreenX = 0;
    this._pointerScreenY = 0;
    this._bounds = null; // cache de getBoundingClientRect

    /* -- geometria / buffers reutilizáveis (evita GC por frame) ------- */
    this._particles = null; // { bx, by, bz, sizeFactor, brightFactor }[]
    this._edges = null; // [i, j][]
    this._projX = null;
    this._projY = null;
    this._projScale = null;
    this._projZ = null;
    this._order = null; // índices ordenados back-to-front

    this._dpr = 1;
    this._cssWidth = 0;
    this._cssHeight = 0;
    this._radius = 0;
    this._perspectiveDistance = 0;

    this._reducedMotion =
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* handlers vinculados uma única vez, para poder remover no destroy */
    this._onResize = this._onResize.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerLeave = this._onPointerLeave.bind(this);
    this._onVisibilityChange = this._onVisibilityChange.bind(this);
    this._loop = this._loop.bind(this);
  }

  /* ------------------------------------------------------------------
     CICLO DE VIDA PÚBLICO
     ------------------------------------------------------------------ */

  init() {
    this._generateParticles();
    this._generateEdges();
    this._bindEvents();
    this.resize();
    return this;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._lastTime = performance.now();
    this._rafId = requestAnimationFrame(this._loop);
  }

  stop() {
    this._running = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  destroy() {
    this.stop();
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('mousemove', this._onPointerMove);
    window.removeEventListener('mouseleave', this._onPointerLeave);
    document.removeEventListener('visibilitychange', this._onVisibilityChange);

    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }

    const { ctx, canvas } = this;
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    this._particles = null;
    this._edges = null;
    this._projX = this._projY = this._projScale = this._projZ = null;
    this._order = null;
  }

  /* ------------------------------------------------------------------
     GEOMETRIA (executa uma única vez em init)
     ------------------------------------------------------------------ */

  _generateParticles() {
    const n = this.options.particleCount;
    const particles = new Array(n);

    for (let i = 0; i < n; i++) {
      // Fibonacci sphere: distribuição uniforme, sem aglomerar nos polos.
      const y = 1 - (i / (n - 1)) * 2;
      const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = GOLDEN_ANGLE * i;

      const bx = Math.cos(theta) * radiusAtY;
      const bz = Math.sin(theta) * radiusAtY;

      particles[i] = {
        bx,
        by: y,
        bz,
        // leve jitter de tamanho/brilho — quebra a monotonia sem
        // sacrificar a leitura de "esfera" definida.
        sizeFactor: 0.62 + Math.random() * 0.85,
        brightFactor: 0.55 + Math.random() * 0.6,
        // fase própria para micro-cintilação de brilho (sutil, nunca pisca)
        twinklePhase: Math.random() * TAU,
      };
    }

    this._particles = particles;
    this._projX = new Float32Array(n);
    this._projY = new Float32Array(n);
    this._projScale = new Float32Array(n);
    this._projZ = new Float32Array(n);
    this._order = new Uint16Array(n);
    for (let i = 0; i < n; i++) this._order[i] = i;
  }

  _generateEdges() {
    const particles = this._particles;
    const n = particles.length;
    const { maxNeighbors, neighborThreshold } = this.options;
    const edgeSet = new Set();
    const edges = [];

    for (let i = 0; i < n; i++) {
      const pi = particles[i];
      const candidates = [];

      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const pj = particles[j];
        const dx = pi.bx - pj.bx;
        const dy = pi.by - pj.by;
        const dz = pi.bz - pj.bz;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < neighborThreshold) {
          candidates.push([j, dist]);
        }
      }

      candidates.sort((a, b) => a[1] - b[1]);

      for (let k = 0; k < Math.min(maxNeighbors, candidates.length); k++) {
        const j = candidates[k][0];
        const key = i < j ? `${i}_${j}` : `${j}_${i}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push(i < j ? [i, j] : [j, i]);
        }
      }
    }

    this._edges = edges;
  }

  /* ------------------------------------------------------------------
     RESIZE / RETINA
     ------------------------------------------------------------------ */

  resize() {
    const canvas = this.canvas;
    const parent = canvas.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);

    this._cssWidth = width;
    this._cssHeight = height;
    this._dpr = dpr;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Raio proporcional ao menor lado do container — mantém a esfera
    // sempre visível e proporcional em qualquer breakpoint.
    this._radius = Math.min(width, height) * 0.5 * 0.74;
    this._perspectiveDistance = this._radius * 3.1;

    this._refreshBounds();
  }

  _onResize() {
    this.resize();
  }

  _refreshBounds() {
    this._bounds = this.canvas.getBoundingClientRect();
  }

  /* ------------------------------------------------------------------
     EVENTOS
     ------------------------------------------------------------------ */

  _bindEvents() {
    window.addEventListener('resize', this._onResize, { passive: true });
    window.addEventListener('mousemove', this._onPointerMove, { passive: true });
    window.addEventListener('mouseleave', this._onPointerLeave, { passive: true });
    document.addEventListener('visibilitychange', this._onVisibilityChange);

    if ('ResizeObserver' in window && this.canvas.parentElement) {
      this._resizeObserver = new ResizeObserver(() => this.resize());
      this._resizeObserver.observe(this.canvas.parentElement);
    }
  }

  _onPointerMove(event) {
    this._pointerInViewport = true;
    this._pointerScreenX = event.clientX;
    this._pointerScreenY = event.clientY;
  }

  _onPointerLeave() {
    this._pointerInViewport = false;
  }

  _onVisibilityChange() {
    if (document.hidden) {
      this.stop();
    } else {
      this.start();
    }
  }

  /* ------------------------------------------------------------------
     LOOP PRINCIPAL
     ------------------------------------------------------------------ */

  _loop(now) {
    if (!this._running) return;

    const dt = Math.min(64, now - this._lastTime); // clamp evita saltos em tab volta ao foco
    this._lastTime = now;
    this._elapsed += dt;

    this._update(dt);
    this._render();

    this._rafId = requestAnimationFrame(this._loop);
  }

  /* ------------------------------------------------------------------
     ATUALIZAÇÃO DE ESTADO
     ------------------------------------------------------------------ */

  _update(dt) {
    const speedFactor = this._reducedMotion ? 0.12 : 1;

    // 1) Rotação contínua, muito lenta.
    const radPerMs = (this.options.rotationSpeedDeg * (Math.PI / 180)) / 1000;
    this._rotationY += radPerMs * dt * speedFactor;
    if (this._rotationY > TAU) this._rotationY -= TAU;

    // 2) Proximidade do mouse → intensidade de hover (0..1), suavizada.
    if (!this._reducedMotion) {
      this._updateHoverTarget();
    }
    this._hoverIntensity +=
      (this._hoverTarget - this._hoverIntensity) * this.options.mouseLerp;

    // 3) Inclinação sutil da esfera em direção ao mouse.
    this._tiltX += (this._tiltXTarget - this._tiltX) * this.options.mouseLerp;
    this._tiltYOffset +=
      (this._tiltYOffsetTarget - this._tiltYOffset) * this.options.mouseLerp;
  }

  _updateHoverTarget() {
    if (!this._bounds || !this._pointerInViewport) {
      this._hoverTarget = 0;
      this._tiltXTarget = 0;
      this._tiltYOffsetTarget = 0;
      return;
    }

    const centerX = this._bounds.left + this._bounds.width / 2;
    const centerY = this._bounds.top + this._bounds.height / 2;

    const dx = this._pointerScreenX - centerX;
    const dy = this._pointerScreenY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const influenceRadius =
      this._radius * this.options.mouseInfluenceRadiusFactor;

    const normalized = 1 - Math.min(1, dist / influenceRadius);
    // smoothstep — aproximação/afastamento sem transição abrupta
    this._hoverTarget = normalized * normalized * (3 - 2 * normalized);

    const maxTilt = this.options.mouseTiltMaxRad;
    this._tiltXTarget = Math.max(-1, Math.min(1, dy / influenceRadius)) * maxTilt * this._hoverTarget;
    this._tiltYOffsetTarget =
      Math.max(-1, Math.min(1, dx / influenceRadius)) * maxTilt * this._hoverTarget;
  }

  /* ------------------------------------------------------------------
     RENDERIZAÇÃO
     ------------------------------------------------------------------ */

  _render() {
    const { ctx } = this;
    const w = this._cssWidth;
    const h = this._cssHeight;

    ctx.clearRect(0, 0, w, h);

    const centerX = w / 2;
    const floatOffset =
      Math.sin((this._elapsed / this.options.floatPeriodMs) * TAU) *
      this.options.floatAmplitudePx *
      (this._reducedMotion ? 0.25 : 1);
    const centerY = h / 2 + floatOffset;

    const breathScale =
      1 +
      Math.sin((this._elapsed / this.options.breathPeriodMs) * TAU) *
        this.options.breathAmplitude *
        (this._reducedMotion ? 0.3 : 1);

    this._drawCoreGlow(centerX, centerY, breathScale);
    this._project(centerX, centerY, breathScale);
    this._sortBackToFront();
    this._drawConnections();
    this._drawParticles();
  }

  _drawCoreGlow(centerX, centerY, breathScale) {
    const { ctx } = this;
    const boost = 1 + this._hoverIntensity * this.options.glowHoverBoost;
    const glowRadius = this._radius * 0.92 * breathScale * boost;
    const alpha = this.options.glowBaseAlpha * (0.85 + this._hoverIntensity * 0.35);

    const gradient = ctx.createRadialGradient(
      centerX,
      centerY,
      0,
      centerX,
      centerY,
      glowRadius
    );
    gradient.addColorStop(0, `rgba(${this.options.colorCore}, ${alpha})`);
    gradient.addColorStop(0.45, `rgba(${this.options.colorGlow}, ${alpha * 0.35})`);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, glowRadius, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  _project(centerX, centerY, breathScale) {
    const particles = this._particles;
    const n = particles.length;
    const cosY = Math.cos(this._rotationY);
    const sinY = Math.sin(this._rotationY);
    const cosX = Math.cos(this._tiltX);
    const sinX = Math.sin(this._tiltX);
    const cosZ = Math.cos(this._tiltYOffset);
    const sinZ = Math.sin(this._tiltYOffset);

    const radius = this._radius * breathScale;
    const D = this._perspectiveDistance;

    for (let i = 0; i < n; i++) {
      const p = particles[i];

      // Rotação principal em Y (giro lento e contínuo).
      let x = p.bx * cosY + p.bz * sinY;
      let z = -p.bx * sinY + p.bz * cosY;
      let y = p.by;

      // Inclinação sutil em X (resposta ao mouse — eixo vertical).
      const y2 = y * cosX - z * sinX;
      const z2 = y * sinX + z * cosX;
      y = y2;
      z = z2;

      // Inclinação sutil em Z (resposta ao mouse — eixo horizontal).
      const x2 = x * cosZ - y * sinZ;
      const y3 = x * sinZ + y * cosZ;
      x = x2;
      y = y3;

      x *= radius;
      y *= radius;
      z *= radius;

      const scale = D / (D + z);
      this._projX[i] = centerX + x * scale;
      this._projY[i] = centerY + y * scale;
      this._projScale[i] = scale;
      this._projZ[i] = z;
    }
  }

  _sortBackToFront() {
    const order = this._order;
    const z = this._projZ;
    // Insertion sort: para 120 elementos quase já ordenados entre frames
    // (rotação é contínua e suave), isso é mais barato que Array.sort
    // genérico e não aloca memória nova.
    for (let i = 1; i < order.length; i++) {
      const key = order[i];
      const keyZ = z[key];
      let j = i - 1;
      while (j >= 0 && z[order[j]] > keyZ) {
        order[j + 1] = order[j];
        j--;
      }
      order[j + 1] = key;
    }
  }

  _drawConnections() {
    const { ctx } = this;
    const edges = this._edges;
    const projScale = this._projScale;
    const projX = this._projX;
    const projY = this._projY;
    const hover = this._hoverIntensity;

    ctx.lineWidth = 1;

    for (let e = 0; e < edges.length; e++) {
      const [i, j] = edges[e];

      // Opacidade das conexões depende da profundidade dos dois pontos —
      // é isso que faz a "rede" mudar naturalmente conforme a rotação,
      // sem recalcular pares e sem piscar.
      const depthFactor = (projScale[i] + projScale[j]) / 2; // ~0.7–1.3
      const baseAlpha = Math.max(0, (depthFactor - 0.68) * 0.42);
      if (baseAlpha <= 0.002) continue;

      const alpha = baseAlpha * (0.9 + hover * 0.3);
      ctx.strokeStyle = `rgba(${this.options.colorParticleCool}, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(projX[i], projY[i]);
      ctx.lineTo(projX[j], projY[j]);
      ctx.stroke();
    }
  }

  _drawParticles() {
    const { ctx } = this;
    const particles = this._particles;
    const order = this._order;
    const projX = this._projX;
    const projY = this._projY;
    const projScale = this._projScale;
    const hover = this._hoverIntensity;
    const baseSize = Math.max(1.1, this._radius * 0.028);

    for (let k = 0; k < order.length; k++) {
      const i = order[k];
      const p = particles[i];
      const scale = projScale[i];

      // Profundidade → tamanho e brilho. Partículas na frente (scale > 1)
      // ficam maiores e mais nítidas; no fundo, menores e mais discretas.
      const size = baseSize * p.sizeFactor * scale;
      if (size <= 0.15) continue;

      const twinkle =
        0.85 + Math.sin(this._elapsed * 0.0011 + p.twinklePhase) * 0.15;

      const depthAlpha = Math.max(0.08, Math.min(1, (scale - 0.55) * 1.35));
      const alpha =
        depthAlpha * p.brightFactor * twinkle * (0.88 + hover * 0.28);

      const x = projX[i];
      const y = projY[i];
      const color =
        k % 3 === 0 ? this.options.colorParticleWarm : this.options.colorParticleCool;

      // Halo suave em vez de shadowBlur (mais barato, sem repaint global).
      const haloRadius = size * 2.6;
      const halo = ctx.createRadialGradient(x, y, 0, x, y, haloRadius);
      halo.addColorStop(0, `rgba(${color}, ${alpha * 0.5})`);
      halo.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, haloRadius, 0, TAU);
      ctx.fill();

      ctx.fillStyle = `rgba(${color}, ${Math.min(1, alpha)})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, TAU);
      ctx.fill();
    }
  }
}