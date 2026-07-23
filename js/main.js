/* ==========================================================================
   BEYOND CODE — ENTRY POINT
   Inicia a Intro e, quando ela termina de verdade, aguarda um pequeno
   intervalo e revela a Hero adicionando a classe hero--ready.
   Toda a animação da revelação vive em CSS (css/hero-reveal.css) —
   este arquivo só troca a classe.

   Este arquivo também orquestra o restante do site (Transformation →
   Footer): scroll reveal, contadores de números, glow de mouse nos
   cards e a poeira de partículas do fundo global. Cada peça é uma
   classe pequena e isolada, no mesmo espírito de HeroOrb/Navbar — só
   que, por instrução do projeto, todas vivem aqui mesmo (nenhum
   arquivo novo foi criado).
   ========================================================================== */

import { IntroSequence } from './intro.js';
import { HeroOrb } from './hero-orb.js';
import { Navbar } from './nav.js';
import { FaqAccordion } from './faq.js';

const HERO_REVEAL_DELAY = 150; // ms — aguardado após a Intro sumir de vez

const prefersReducedMotion = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;


/* ==========================================================================
   SCROLL REVEAL — Transformation → Footer
   Cada [data-reveal] entra em cena com opacity + translateY + blur leve
   (tudo definido em css/animations.css); este código só liga a classe
   --reveal-progress no momento certo, uma única vez por elemento.

   Progressive enhancement: o CSS por padrão deixa tudo visível
   (--reveal-progress: 1). Só quando este JS roda de fato é que os
   elementos são escondidos antes de observar — se o JS falhar, o site
   nunca fica com conteúdo permanentemente invisível.

   Nunca inclui a Story (filtrada explicitamente) — ela já tem seus
   próprios ganchos, prontos para uma etapa futura, e não deve mudar.
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
   NUMBER COUNTER — estatísticas da Results contam a partir de 0
   Lê [data-count-to] (mais prefix/suffix/decimals opcionais) e anima
   via requestAnimationFrame com easing próprio — sem depender de
   nenhuma biblioteca. Dispara uma vez, quando o número entra em cena.
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

  // Mesma convenção já usada no texto estático original (ponto como
  // separador de milhar E de decimal — ex.: "12.000+", "4.9/5").
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
   POINTER GLOW — brilho que segue o mouse em qualquer [data-glow]
   Uma única classe cobre todos os cards novos (Transformation, Results,
   Community): escreve --pointer-x/--pointer-y, o CSS cuida do resto
   (ver [data-glow]::after em components.css).
   ========================================================================== */
class PointerGlow {
  constructor(root) {
    this.elements = Array.from(root.querySelectorAll('[data-glow]'));
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
    el.style.setProperty('--pointer-x', `${((event.clientX - rect.left) / rect.width) * 100}%`);
    el.style.setProperty('--pointer-y', `${((event.clientY - rect.top) / rect.height) * 100}%`);
  }

  destroy() {
    this.elements.forEach((el) => el.removeEventListener('pointermove', this._onPointerMove));
  }
}


/* ==========================================================================
   PARTICLE PARALLAX — a poeira do fundo global reage ao mouse
   Poucos pixels, nunca mais — .core__particles já existe (ver
   effects.css); este código só escreve --particles-x/--particles-y,
   throttlado por requestAnimationFrame (nunca um listener pesado).
   ========================================================================== */
class ParticleParallax {
  constructor(el, options = {}) {
    this.el = el;
    this.maxOffset = options.maxOffset ?? 6; // px — "só alguns pixels"
    this._ticking = false;
    this._onPointerMove = this._onPointerMove.bind(this);
  }

  init() {
    if (!this.el || prefersReducedMotion()) return this;
    window.addEventListener('pointermove', this._onPointerMove, { passive: true });
    return this;
  }

  _onPointerMove(event) {
    if (this._ticking) return;
    this._ticking = true;

    requestAnimationFrame(() => {
      const nx = (event.clientX / window.innerWidth) * 2 - 1; // -1..1
      const ny = (event.clientY / window.innerHeight) * 2 - 1;
      this.el.style.setProperty('--particles-x', `${(nx * this.maxOffset).toFixed(1)}px`);
      this.el.style.setProperty('--particles-y', `${(ny * this.maxOffset).toFixed(1)}px`);
      this._ticking = false;
    });
  }

  destroy() {
    window.removeEventListener('pointermove', this._onPointerMove);
  }
}


/* ==========================================================================
   MAP NETWORK — Results: conecta os pontos do "painel tecnológico"
   Mesma lógica de vizinhança da Hero Orb (cada ponto liga aos N mais
   próximos), só que aqui os pontos são fixos — o grafo é calculado uma
   única vez, na carga, sem loop de animação. Com poucas dezenas de
   pontos, uma varredura O(n²) é instantânea; não precisa de nada mais
   sofisticado.
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

  // Para cada ponto, liga aos N vizinhos mais próximos dentro do raio
  // máximo. Um Set de chaves "i-j" (sempre i < j) evita linhas duplicadas
  // quando dois pontos já se escolheram mutuamente como vizinhos.
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

    edges.forEach(([i, j]) => {
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', points[i].x);
      line.setAttribute('y1', points[i].y);
      line.setAttribute('x2', points[j].x);
      line.setAttribute('y2', points[j].y);
      fragment.appendChild(line);
    });

    this.group.appendChild(fragment);
  }
}


/* ==========================================================================
   MAP POINTER — reação ao mouse, no mesmo espírito da Hero Orb, só que
   bem mais suave: um tilt sutil no conjunto (perspective + rotateX/Y) e
   o glow de cada ponto crescendo conforme o cursor se aproxima
   (--proximity, lido pela animação node-pulse em css/animations.css).

   Um único loop de rAF, iniciado só quando o mouse entra na área do
   mapa e encerrado assim que tudo volta a repousar — nunca roda à toa
   com a página parada. Tudo interpolado (lerp) a cada frame, o que já
   entrega a suavidade pedida sem precisar de easing em CSS.
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
    this.maxTilt = options.maxTilt ?? 4; // graus — bem mais discreto que a Orb
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

  // Converte a posição do mouse (coordenadas de tela) para o espaço do
  // viewBox do SVG — é o que permite comparar direto com cx/cy dos nós.
  _toViewBoxPoint(event) {
    const point = this.svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(this.svg.getScreenCTM().inverse());
  }

  /* ------------------------------------------------------------------
     LOOP (só roda enquanto algo ainda está se movendo)
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

  // Smoothstep — brilho cresce suave conforme o cursor se aproxima,
  // sem nunca ligar/desligar abruptamente ao cruzar o raio de influência.
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

  const faqList = document.querySelector('.faq__list');
  if (faqList) new FaqAccordion(faqList).init();

  // Transformation → Footer: também independentes da Intro/Hero.
  new ScrollReveal(document).init();
  new NumberCounter(document).init();
  new PointerGlow(document).init();

  const particlesLayer = document.querySelector('.core__particles');
  if (particlesLayer) new ParticleParallax(particlesLayer).init();

  const mapSvg = document.querySelector('.results__map-points');
  if (mapSvg) {
    const network = new MapNetwork(mapSvg).init();
    const mapVisual = document.querySelector('.results__map-visual');
    if (mapVisual) new MapPointer(mapSvg, mapVisual, network.nodes, network.points).init();
  }

  const introRoot = document.querySelector('.intro');
  const hero = document.querySelector('.hero');
  const orbCanvas = document.querySelector('.hero__orb');

  if (!introRoot) return;

  // O HeroOrb é instanciado desde já (geometria/eventos prontos), mas só
  // começa a animar quando a Hero recebe .hero--ready — nunca antes.
  const orb = orbCanvas ? new HeroOrb(orbCanvas).init() : null;

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