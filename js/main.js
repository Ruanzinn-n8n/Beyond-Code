import { IntroSequence } from './intro.js';
import { HeroOrb } from './hero-orb.js';
import { Navbar, ScrollProgress } from './nav.js';
import { FaqAccordion } from './faq.js';

const HERO_REVEAL_DELAY = 150; // ms — aguardado após a Intro sumir de vez

const prefersReducedMotion = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Usado só para reduzir a contagem de partículas em Canvas (Orb e poeira
// global) em telas pequenas — GPUs de celular têm bem menos fôlego que
// desktop. Mesmo breakpoint de "phone" já usado em responsive.css.
const isSmallViewport = () =>
  window.matchMedia && window.matchMedia('(max-width: 640px)').matches;


/* ==========================================================================
   SCROLL REVEAL
   ========================================================================== */
class ScrollReveal {
  constructor(root, options = {}) {
    this.elements = Array.from(root.querySelectorAll('[data-reveal]')).filter(
      (el) => !el.closest('.story')
    );
    this.threshold = options.threshold ?? 0.2;
    this._observer = null;
    this._onIntersect = this._onIntersect.bind(this);
  }

  init() {
    if (!this.elements.length || prefersReducedMotion()) return this;

    this.elements.forEach((el) => el.style.setProperty('--reveal-progress', '0'));

    this._observer = new IntersectionObserver(this._onIntersect, {
      threshold: this.threshold,
      rootMargin: '0px 0px -10% 0px',
    });
    this.elements.forEach((el) => this._observer.observe(el));

    return this;
  }

  _onIntersect(entries) {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.style.setProperty('--reveal-progress', '1');
      this._observer.unobserve(entry.target); // revela uma vez só, nunca esconde de novo
    });
  }

  destroy() {
    if (this._observer) this._observer.disconnect();
  }
}


/* ==========================================================================
   NUMBER COUNTER
   ========================================================================== */
class NumberCounter {
  constructor(root) {
    this.elements = Array.from(root.querySelectorAll('[data-count-to]'));
    this._observer = null;
    this._onIntersect = this._onIntersect.bind(this);
  }

  init() {
    if (!this.elements.length) return this;

    if (prefersReducedMotion()) {
      this.elements.forEach((el) => this._render(el, this._targetOf(el)));
      return this;
    }

    this._observer = new IntersectionObserver(this._onIntersect, { threshold: 0.4 });
    this.elements.forEach((el) => this._observer.observe(el));
    return this;
  }

  _onIntersect(entries) {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      this._animate(entry.target);
      this._observer.unobserve(entry.target);
    });
  }

  _targetOf(el) {
    return parseFloat(el.dataset.countTo);
  }

  _animate(el) {
    const to = this._targetOf(el);
    const duration = 1400;
    const start = performance.now();

    const step = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cúbico
      this._render(el, to * eased);

      if (progress < 1) requestAnimationFrame(step);
      else this._render(el, to);
    };

    requestAnimationFrame(step);
  }

  _render(el, value) {
    const decimals = parseInt(el.dataset.countDecimals || '0', 10);
    const prefix = el.dataset.countPrefix || '';
    const suffix = el.dataset.countSuffix || '';
    el.textContent = prefix + this._format(value, decimals) + suffix;
  }

  _format(value, decimals) {
    const [intPart, decPart] = value.toFixed(decimals).split('.');
    const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return decPart ? `${withThousands}.${decPart}` : withThousands;
  }

  destroy() {
    if (this._observer) this._observer.disconnect();
  }
}


/* ==========================================================================
   POINTER GLOW
   ========================================================================== */
class PointerGlow {
  constructor(root, options = {}) {
    this.elements = Array.from(root.querySelectorAll('[data-glow], .timeline__item'));
    this.maxTilt = options.maxTilt ?? 3;
    this._onPointerMove = this._onPointerMove.bind(this);
  }

  init() {
    if (!this.elements.length || prefersReducedMotion()) return this;
    this.elements.forEach((el) => el.addEventListener('pointermove', this._onPointerMove));
    return this;
  }

  _onPointerMove(event) {
    const el = event.currentTarget;
    const rect = el.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;

    el.style.setProperty('--pointer-x', `${(px * 100).toFixed(1)}%`);
    el.style.setProperty('--pointer-y', `${(py * 100).toFixed(1)}%`);
    el.style.setProperty('--tilt-x', `${((0.5 - py) * this.maxTilt * 2).toFixed(2)}deg`);
    el.style.setProperty('--tilt-y', `${((px - 0.5) * this.maxTilt * 2).toFixed(2)}deg`);
  }

  destroy() {
    this.elements.forEach((el) => el.removeEventListener('pointermove', this._onPointerMove));
  }
}


/* ==========================================================================
   POINTER TRACKER — posição do mouse compartilhada
   Um único listener em window. GlobalParallax se inscreve como
   assinante (chamado de dentro do mesmo evento, sem listener próprio);
   GlobalParticles só lê o valor mais recente de dentro do seu próprio
   loop de rAF. Antes eram dois listeners de pointermove em window
   fazendo essencialmente o mesmo trabalho a cada movimento do mouse.
   ========================================================================== */
const pointerTracker = { x: null, y: null };
const pointerSubscribers = [];

window.addEventListener(
  'pointermove',
  (event) => {
    pointerTracker.x = event.clientX;
    pointerTracker.y = event.clientY;
    pointerSubscribers.forEach((fn) => fn(event));
  },
  { passive: true }
);

window.addEventListener(
  'pointerleave',
  () => {
    pointerTracker.x = null;
    pointerTracker.y = null;
  },
  { passive: true }
);


/* ==========================================================================
   GLOBAL PARALLAX
   ========================================================================== */
class GlobalParallax {
  constructor(options = {}) {
    this.maxOffset = options.maxOffset ?? 15; // px — "nunca mais que 10-15px"
    this.particlesOffset = options.particlesOffset ?? 6;
    this.particlesLayer = document.querySelector('.core__particles');
    this.root = document.documentElement.style;
    this._ticking = false;
    this._onPointerMove = this._onPointerMove.bind(this);
  }

  init() {
    if (prefersReducedMotion()) return this;
    pointerSubscribers.push(this._onPointerMove);
    return this;
  }

  _onPointerMove(event) {
    if (this._ticking) return;
    this._ticking = true;

    requestAnimationFrame(() => {
      const nx = (event.clientX / window.innerWidth) * 2 - 1;
      const ny = (event.clientY / window.innerHeight) * 2 - 1;

      this.root.setProperty('--parallax-x', `${(nx * this.maxOffset).toFixed(1)}px`);
      this.root.setProperty('--parallax-y', `${(ny * this.maxOffset).toFixed(1)}px`);

      if (this.particlesLayer) {
        this.particlesLayer.style.setProperty('--particles-x', `${(nx * this.particlesOffset).toFixed(1)}px`);
        this.particlesLayer.style.setProperty('--particles-y', `${(ny * this.particlesOffset).toFixed(1)}px`);
      }

      this._ticking = false;
    });
  }

  destroy() {
    const index = pointerSubscribers.indexOf(this._onPointerMove);
    if (index !== -1) pointerSubscribers.splice(index, 1);
  }
}


/* ==========================================================================
   GLOBAL PARTICLES
   ========================================================================== */
class GlobalParticles {
  constructor(container, options = {}) {
    this.container = container;
    this.count = options.count ?? 120;
    this.repelRadius = options.repelRadius ?? 130;
    this.maxRepel = options.maxRepel ?? 10; // px — "poucos pixels"

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'core__particles-canvas';
    this.ctx = this.canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.width = 0;
    this.height = 0;
    this.particles = [];

    this._running = false;
    this._rafId = null;

    this._onResize = this._onResize.bind(this);
    this._onVisibilityChange = this._onVisibilityChange.bind(this);
    this._loop = this._loop.bind(this);
  }

  init() {
    if (!this.container || prefersReducedMotion()) return this; // fica só a textura CSS estática

    this.container.appendChild(this.canvas);
    this._resize();
    this._createParticles();

    window.addEventListener('resize', this._onResize, { passive: true });
    document.addEventListener('visibilitychange', this._onVisibilityChange);

    this.start();
    return this;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._rafId = requestAnimationFrame(this._loop);
  }

  stop() {
    this._running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
  }

  destroy() {
    this.stop();
    window.removeEventListener('resize', this._onResize);
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
    this.canvas.remove();
  }

  /* ------------------------------------------------------------------
     SETUP
     ------------------------------------------------------------------ */

  _resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  _createParticles() {
    this.particles = Array.from({ length: this.count }, () => ({
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      size: 0.6 + Math.random() * 1.8,
      baseOpacity: 0.12 + Math.random() * 0.45,
      // Metade sobe, metade desce, algumas quase paradas — cada uma com
      // sua própria velocidade, nunca um movimento em bloco/repetitivo.
      driftSpeed: (Math.random() - 0.5) * 0.05,
      // Deriva horizontal orgânica — sem isso, a partícula só sobe/desce
      // em linha reta, o que lê como "efeito" em vez de poeira flutuando.
      swayAmplitude: 3 + Math.random() * 6,
      swaySpeed: 0.00025 + Math.random() * 0.0004,
      swayPhase: Math.random() * Math.PI * 2,
      twinklePhase: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.0005 + Math.random() * 0.001,
      offsetX: 0,
      offsetY: 0,
    }));
  }

  /* ------------------------------------------------------------------
     EVENTOS
     ------------------------------------------------------------------ */

  _onResize() {
    this._resize();
  }

  _onVisibilityChange() {
    if (document.hidden) this.stop();
    else this.start();
  }

  /* ------------------------------------------------------------------
     LOOP
     ------------------------------------------------------------------ */

  _loop(now) {
    if (!this._running) return;

    this.ctx.clearRect(0, 0, this.width, this.height);

    for (const p of this.particles) {
      this._drift(p);
      this._repel(p);
      this._draw(p, now);
    }

    this._rafId = requestAnimationFrame(this._loop);
  }

  _drift(p) {
    p.y += p.driftSpeed;
    if (p.y < -10) p.y = this.height + 10;
    if (p.y > this.height + 10) p.y = -10;
  }

  _repel(p) {
    let targetX = 0;
    let targetY = 0;

    if (pointerTracker.x !== null) {
      const dx = p.x - pointerTracker.x;
      const dy = p.y - pointerTracker.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < this.repelRadius) {
        const force = (1 - dist / this.repelRadius) * this.maxRepel;
        const safeDist = dist || 1;
        targetX = (dx / safeDist) * force;
        targetY = (dy / safeDist) * force;
      }
    }

    p.offsetX += (targetX - p.offsetX) * 0.06;
    p.offsetY += (targetY - p.offsetY) * 0.06;
  }

  _draw(p, now) {
    const sway = Math.sin(now * p.swaySpeed + p.swayPhase) * p.swayAmplitude;
    const twinkle = 0.7 + Math.sin(now * p.twinkleSpeed + p.twinklePhase) * 0.3;
    const alpha = p.baseOpacity * twinkle;

    this.ctx.beginPath();
    this.ctx.arc(p.x + p.offsetX + sway, p.y + p.offsetY, p.size, 0, Math.PI * 2);
    this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
    this.ctx.fill();
  }
}


/* ==========================================================================
   RAMP PROPERTY
   ========================================================================== */
function rampProperty(el, prop, duration = 700) {
  const start = performance.now();

  const step = (now) => {
    const progress = Math.min(1, (now - start) / duration);
    el.style.setProperty(prop, progress.toFixed(3));
    if (progress < 1) requestAnimationFrame(step);
  };

  requestAnimationFrame(step);
}


/* ==========================================================================
   STORY REVEAL
   ========================================================================== */
class StoryReveal {
  constructor(root) {
    this.timeline = root.querySelector('.story__timeline');
    this.items = this.timeline ? Array.from(this.timeline.querySelectorAll('.timeline__item')) : [];
    this.header = root.querySelectorAll('.story [data-reveal]');
    this._observer = null;
    this._onIntersect = this._onIntersect.bind(this);
  }

  init() {
    if (!this.timeline || prefersReducedMotion()) return this;

    // Esconde ativamente antes de observar
    this.timeline.classList.add('pre-reveal');
    this.items.forEach((item) => item.style.setProperty('--reveal-progress', '0'));
    this.header.forEach((el) => el.style.setProperty('--reveal-progress', '0'));

    this._observer = new IntersectionObserver(this._onIntersect, { threshold: 0.25 });
    this._observer.observe(this.timeline);
    return this;
  }

  _onIntersect(entries) {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      this._reveal();
      this._observer.disconnect();
    });
  }

  _reveal() {
    this.header.forEach((el, i) => {
      window.setTimeout(() => el.style.setProperty('--reveal-progress', '1'), i * 90);
    });

    this.timeline.classList.remove('pre-reveal');

    this.items.forEach((item, i) => {
      window.setTimeout(() => item.style.setProperty('--reveal-progress', '1'), 200 + i * 140);
    });
  }

  destroy() {
    if (this._observer) this._observer.disconnect();
  }
}


/* ==========================================================================
   MAP REVEAL
   ========================================================================== */
class MapReveal {
  constructor(root, nodes) {
    this.root = root;
    this.nodes = nodes;
    this._observer = null;
    this._onIntersect = this._onIntersect.bind(this);
  }

  init() {
    if (!this.root || !this.nodes.length) return this;

    if (prefersReducedMotion()) {
      this.nodes.forEach((node) => node.style.setProperty('--reveal-progress', '1'));
      return this;
    }

    this._observer = new IntersectionObserver(this._onIntersect, { threshold: 0.3 });
    this._observer.observe(this.root);
    return this;
  }

  _onIntersect(entries) {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      this.nodes.forEach((node, i) => {
        window.setTimeout(() => rampProperty(node, '--reveal-progress', 700), i * 90);
      });
      this._observer.disconnect();
    });
  }

  destroy() {
    if (this._observer) this._observer.disconnect();
  }
}


/* ==========================================================================
   CTA REVEAL 
   ========================================================================== */
class CtaReveal {
  constructor(visual) {
    this.visual = visual;
    this._observer = null;
    this._onIntersect = this._onIntersect.bind(this);
  }

  init() {
    if (!this.visual) return this;

    if (prefersReducedMotion()) {
      this.visual.style.setProperty('--reveal-progress', '1');
      return this;
    }

    this._observer = new IntersectionObserver(this._onIntersect, { threshold: 0.3 });
    this._observer.observe(this.visual);
    return this;
  }

  _onIntersect(entries) {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      rampProperty(this.visual, '--reveal-progress', 1000);
      this._observer.disconnect();
    });
  }

  destroy() {
    if (this._observer) this._observer.disconnect();
  }
}


/* ==========================================================================
   AMBIENT PAUSE — nenhuma animação contínua roda fora de tela
   Um único IntersectionObserver cobre todas as seções com respiração
   ambiente (@keyframes infinite): Transformation, Results e CTA. A
   pausa em si é 100% CSS (animation-play-state, ver .is-offscreen em
   animations.css) — este código só liga/desliga a classe.
   ========================================================================== */
class AmbientPause {
  constructor(sections) {
    this.sections = sections.filter(Boolean);
    this._observer = null;
    this._onIntersect = this._onIntersect.bind(this);
  }

  init() {
    if (!this.sections.length) return this;
    this._observer = new IntersectionObserver(this._onIntersect, { threshold: 0 });
    this.sections.forEach((section) => this._observer.observe(section));
    return this;
  }

  _onIntersect(entries) {
    entries.forEach((entry) => {
      entry.target.classList.toggle('is-offscreen', !entry.isIntersecting);
    });
  }

  destroy() {
    if (this._observer) this._observer.disconnect();
  }
}


/* ==========================================================================
   MAP NETWORK
   ========================================================================== */
class MapNetwork {
  /**
   * @param {SVGElement} svg — o <svg class="results__map-points">
   */
  constructor(svg, options = {}) {
    this.svg = svg;
    this.group = svg.querySelector('.results__map-lines');
    this.nodes = Array.from(svg.querySelectorAll('.results__map-nodes circle'));
    this.maxNeighbors = options.maxNeighbors ?? 3;
    this.maxDistance = options.maxDistance ?? 50; // unidades do viewBox
  }

  init() {
    if (!this.group || this.nodes.length < 2) return this;

    this.points = this._readPoints();
    const edges = this._buildEdges(this.points);
    this._render(edges, this.points);

    return this;
  }

  _readPoints() {
    return this.nodes.map((circle) => ({
      x: parseFloat(circle.getAttribute('cx')),
      y: parseFloat(circle.getAttribute('cy')),
    }));
  }

  _buildEdges(points) {
    const seen = new Set();
    const edges = [];

    points.forEach((point, i) => {
      const nearest = points
        .map((other, j) => ({ j, dist: this._distance(point, other) }))
        .filter(({ j, dist }) => j !== i && dist <= this.maxDistance)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, this.maxNeighbors);

      nearest.forEach(({ j }) => {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (seen.has(key)) return;
        seen.add(key);
        edges.push(i < j ? [i, j] : [j, i]);
      });
    });

    return edges;
  }

  _distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  _render(edges, points) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const fragment = document.createDocumentFragment();
    this.lines = []; // linhas de pulso, expostas pra MapReveal poder escalonar

    edges.forEach(([i, j], index) => {
      fragment.appendChild(this._createLine(svgNS, points[i], points[j]));

      const pulse = this._createLine(svgNS, points[i], points[j]);
      pulse.classList.add('results__map-pulse-line');
      pulse.style.setProperty('--i', index);
      fragment.appendChild(pulse);
      this.lines.push(pulse);
    });

    this.group.appendChild(fragment);
  }

  _createLine(svgNS, a, b) {
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', a.x);
    line.setAttribute('y1', a.y);
    line.setAttribute('x2', b.x);
    line.setAttribute('y2', b.y);
    return line;
  }
}


/* ==========================================================================
   MAP POINTER
   ========================================================================== */
class MapPointer {
  /**
   * @param {SVGElement} svg — o <svg class="results__map-points">
   * @param {HTMLElement} container — .results__map-visual (escuta o mouse)
   * @param {SVGCircleElement[]} nodes — mesmos círculos do MapNetwork
   * @param {{x:number,y:number}[]} points — mesmas coordenadas, mesma ordem
   */
  constructor(svg, container, nodes, points, options = {}) {
    this.svg = svg;
    this.container = container;
    this.nodes = nodes;
    this.points = points;

    this.influenceRadius = options.influenceRadius ?? 70; // unidades do viewBox
    this.maxTilt = options.maxTilt ?? 6; // graus — mais discreto que a Orb
    this.lerpFactor = options.lerpFactor ?? 0.1;
    this.settleThreshold = 0.004;

    this._targetPointer = null; // {x, y} em espaço do viewBox, ou null se longe
    this._currentTilt = { x: 0, y: 0 };
    this._targetTilt = { x: 0, y: 0 };
    this._currentProximity = new Array(nodes.length).fill(0);
    this._running = false;
    this._rafId = null;

    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerLeave = this._onPointerLeave.bind(this);
    this._tick = this._tick.bind(this);
  }

  init() {
    if (!this.container || !this.nodes.length || prefersReducedMotion()) return this;
    this.container.addEventListener('pointermove', this._onPointerMove);
    this.container.addEventListener('pointerleave', this._onPointerLeave);
    return this;
  }

  destroy() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this.container.removeEventListener('pointermove', this._onPointerMove);
    this.container.removeEventListener('pointerleave', this._onPointerLeave);
  }

  /* ------------------------------------------------------------------
     EVENTOS
     ------------------------------------------------------------------ */

  _onPointerMove(event) {
    const rect = this.container.getBoundingClientRect();
    const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1; // -1..1
    const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    this._targetTilt = { x: -ny * this.maxTilt, y: nx * this.maxTilt };
    this._targetPointer = this._toViewBoxPoint(event);
    this._ensureRunning();
  }

  _onPointerLeave() {
    this._targetTilt = { x: 0, y: 0 };
    this._targetPointer = null;
    this._ensureRunning();
  }

  _toViewBoxPoint(event) {
    const point = this.svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(this.svg.getScreenCTM().inverse());
  }

  /* ------------------------------------------------------------------
     LOOP
     ------------------------------------------------------------------ */

  _ensureRunning() {
    if (this._running) return;
    this._running = true;
    this._rafId = requestAnimationFrame(this._tick);
  }

  _tick() {
    let settled = this._updateTilt();
    settled = this._updateProximity() && settled;

    if (settled && !this._targetPointer) {
      this._running = false;
      return;
    }

    this._rafId = requestAnimationFrame(this._tick);
  }

  _updateTilt() {
    this._currentTilt.x += (this._targetTilt.x - this._currentTilt.x) * this.lerpFactor;
    this._currentTilt.y += (this._targetTilt.y - this._currentTilt.y) * this.lerpFactor;

    this.svg.style.setProperty('--map-tilt-x', `${this._currentTilt.x.toFixed(2)}deg`);
    this.svg.style.setProperty('--map-tilt-y', `${this._currentTilt.y.toFixed(2)}deg`);

    return (
      Math.abs(this._targetTilt.x - this._currentTilt.x) < this.settleThreshold &&
      Math.abs(this._targetTilt.y - this._currentTilt.y) < this.settleThreshold
    );
  }

  _updateProximity() {
    let settled = true;

    this.points.forEach((point, i) => {
      const target = this._targetPointer ? this._proximityFor(point) : 0;
      const current = this._currentProximity[i];
      const next = current + (target - current) * this.lerpFactor;

      this._currentProximity[i] = next;
      this.nodes[i].style.setProperty('--proximity', next.toFixed(3));

      if (Math.abs(target - next) > this.settleThreshold) settled = false;
    });

    return settled;
  }

  _proximityFor(point) {
    const dx = point.x - this._targetPointer.x;
    const dy = point.y - this._targetPointer.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const t = Math.max(0, Math.min(1, 1 - dist / this.influenceRadius));
    return t * t * (3 - 2 * t);
  }
}


document.addEventListener('DOMContentLoaded', () => {
  // Navbar e FAQ são independentes da Intro/Hero — já ficam utilizáveis
  // desde o primeiro frame.
  const header = document.querySelector('.header');
  const navbar = header ? new Navbar(header).init() : null;

  const progressTrack = document.querySelector('.nav__progress');
  const progressDot = document.querySelector('.nav__progress-dot');
  if (progressTrack && progressDot) new ScrollProgress(progressTrack, progressDot).init();

  const faqList = document.querySelector('.faq__list');
  if (faqList) new FaqAccordion(faqList).init();

  // Transformation → Footer: também independentes da Intro/Hero.
  new ScrollReveal(document).init();
  new NumberCounter(document).init();
  new PointerGlow(document).init();
  new GlobalParallax().init();
  new StoryReveal(document).init();

  const particlesLayer = document.querySelector('.core__particles');
  if (particlesLayer) {
    new GlobalParticles(particlesLayer, {
      count: isSmallViewport() ? 70 : 120,
    }).init();
  }

  const mapSvg = document.querySelector('.results__map-points');
  if (mapSvg) {
    const network = new MapNetwork(mapSvg).init();
    const mapVisual = document.querySelector('.results__map-visual');
    if (mapVisual) new MapPointer(mapSvg, mapVisual, network.nodes, network.points).init();

    const mapContainer = document.querySelector('.results__map');
    if (mapContainer) new MapReveal(mapContainer, network.nodes).init();
  }

  const ctaVisual = document.querySelector('.cta__visual');
  if (ctaVisual) new CtaReveal(ctaVisual).init();

  new AmbientPause([
    document.querySelector('.transformation'),
    document.querySelector('.results'),
    document.querySelector('.cta'),
  ]).init();

  const introRoot = document.querySelector('.intro');
  const hero = document.querySelector('.hero');
  const orbCanvas = document.querySelector('.hero__orb');

  if (!introRoot) return;

  // O HeroOrb é instanciado desde já (geometria/eventos prontos), mas só
  // começa a animar quando a Hero recebe .hero--ready — nunca antes.
  const orb = orbCanvas
    ? new HeroOrb(orbCanvas, {
        particleCount: isSmallViewport() ? 160 : 240,
      }).init()
    : null;

  const revealHero = () => {
    if (!hero) return;
    window.setTimeout(() => {
      hero.classList.add('hero--ready');
      if (orb) orb.start();
      if (navbar) navbar.reveal();
    }, HERO_REVEAL_DELAY);
  };

  const intro = new IntroSequence(introRoot, { onComplete: revealHero });
  intro.play();
});