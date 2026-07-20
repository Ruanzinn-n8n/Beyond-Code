/* ==========================================================================
   BEYOND CODE — INTRO SEQUENCE
   Timeline 100% baseada em timers (setTimeout), sem depender de eventos
   de CSS (transitionend), que podem não disparar em certos navegadores.
   Inclui um watchdog: não importa o que aconteça no meio do caminho,
   a Intro é forçada a terminar dentro de um tempo máximo conhecido.
   ========================================================================== */

import { WarpEffect } from './warp.js';

const SELECTORS = Object.freeze({
  canvas: '.intro__canvas',
});

const PHASE = Object.freeze({
  BLACK: 'black',
  SPARK: 'spark',
  SHOOT: 'shoot',
  WARP: 'warp',
  REVEAL: 'reveal',
  APPROACH: 'approach',
  CLOSING: 'closing',
});

const TIMING = Object.freeze({
  BLACK_HOLD: 700,
  LIGHT_HOLD: 180,
  LIGHT_SHOOT: 260,
  WARP_ACCEL_HOLD: 1400,
  WARP_DECEL_HOLD: 700,
  MESSAGE_FADE_HOLD: 1100,
  APPROACH_START_DELAY: 1000,
  APPROACH_DURATION: 3200, // precisa bater com a transition de [data-phase="approach"] .intro__text em intro.css
  FINAL_HOLD: 100,
  FADE_OUT_DURATION: 500, // precisa bater com a transition de .intro em intro.css
  REDUCED_MOTION_HOLD: 400,
  WATCHDOG_MARGIN: 2000, // folga de segurança somada ao tempo total esperado
});

const WARP_INTENSITY = Object.freeze({
  FULL: 1,
  DECELERATED: 0.15,
  STOPPED: 0,
});

/** Soma de todas as fases — usada só para calcular o prazo do watchdog. */
const TOTAL_TIMELINE_DURATION =
  TIMING.BLACK_HOLD +
  TIMING.LIGHT_HOLD +
  TIMING.LIGHT_SHOOT +
  TIMING.WARP_ACCEL_HOLD +
  TIMING.WARP_DECEL_HOLD +
  TIMING.MESSAGE_FADE_HOLD +
  TIMING.APPROACH_START_DELAY +
  TIMING.APPROACH_DURATION +
  TIMING.FINAL_HOLD +
  TIMING.FADE_OUT_DURATION;

export class IntroSequence {
  constructor(root, { onComplete } = {}) {
    this.root = root;
    this.canvas = root.querySelector(SELECTORS.canvas);
    this.warp = new WarpEffect(this.canvas);
    this.reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    this.timers = [];
    this.ended = false; // garante que o fim só rode uma única vez
    this.onComplete = onComplete; // chamado só depois que a Intro já sumiu
  }

  /** Ponto de entrada público: inicia a sequência completa. */
  play() {
    // Watchdog: garante que a Intro termine SEMPRE, mesmo que algo no
    // meio da timeline falhe silenciosamente.
    this._after(TOTAL_TIMELINE_DURATION + TIMING.WATCHDOG_MARGIN, () =>
      this._end()
    );

    try {
      this.warp.init();
    } catch (error) {
      this._end();
      return;
    }

    if (this.reducedMotion) {
      this._playReducedMotion();
      return;
    }

    this._setPhase(PHASE.BLACK);
    this._after(TIMING.BLACK_HOLD, () => this._runSpark());
  }

  // -- Cena 2 --------------------------------------------------------------
  _runSpark() {
    this._setPhase(PHASE.SPARK);
    this._after(TIMING.LIGHT_HOLD, () => this._runShoot());
  }

  _runShoot() {
    this._setPhase(PHASE.SHOOT);
    this._safeWarpCall(() => {
      this.warp.start();
      this.warp.setIntensity(WARP_INTENSITY.FULL);
    });
    this._after(TIMING.LIGHT_SHOOT, () => this._runWarp());
  }

  // -- Cena 3 --------------------------------------------------------------
  _runWarp() {
    this._setPhase(PHASE.WARP);
    this._after(TIMING.WARP_ACCEL_HOLD, () => this._decelerateWarp());
  }

  _decelerateWarp() {
    this._safeWarpCall(() => this.warp.setIntensity(WARP_INTENSITY.DECELERATED));
    this._after(TIMING.WARP_DECEL_HOLD, () => this._revealMessage());
  }

  // -- Cena 4 ----------------------------------------------------------------
  _revealMessage() {
    this._setPhase(PHASE.REVEAL);
    this._safeWarpCall(() => this.warp.setIntensity(WARP_INTENSITY.STOPPED));
    this._after(TIMING.MESSAGE_FADE_HOLD, () => {
      this._safeWarpCall(() => this.warp.stop());
      this._scheduleApproach();
    });
  }

  // -- Cena 5 --------------------------------------------------------------
  _scheduleApproach() {
    this._after(TIMING.APPROACH_START_DELAY, () => {
      this._setPhase(PHASE.APPROACH);
      // Espera por TEMPO, não por transitionend — um evento de CSS pode
      // não disparar e travaria a Intro para sempre. Tempo é garantido.
      this._after(TIMING.APPROACH_DURATION, () => this._closeIn());
    });
  }

  // -- Cena 6 --------------------------------------------------------------
  _closeIn() {
    this._setPhase(PHASE.CLOSING);
    this._after(TIMING.FINAL_HOLD, () => this._end());
  }

  // -- Acessibilidade --------------------------------------------------------
  _playReducedMotion() {
    this._setPhase(PHASE.REVEAL);
    this._after(TIMING.REDUCED_MOTION_HOLD, () => this._end());
  }

  /**
   * Fim único e definitivo da Intro.
   * Idempotente: pode ser chamado mais de uma vez (timeline normal +
   * watchdog) sem qualquer efeito colateral.
   */
  _end() {
    if (this.ended) return;
    this.ended = true;

    this._clearTimers();
    this._safeWarpCall(() => this.warp.destroy());

    this.root.classList.add('intro--fade-out');

    window.setTimeout(() => {
      this.root.classList.add('intro--hidden');
      // Reforço via inline style: garante que a Hero seja liberada mesmo
      // que, por qualquer motivo, o CSS de .intro--hidden não seja aplicado.
      this.root.style.setProperty('display', 'none', 'important');

      if (typeof this.onComplete === 'function') {
        this.onComplete();
      }
    }, TIMING.FADE_OUT_DURATION);
  }

  // -- Utilitários -----------------------------------------------------------
  _safeWarpCall(fn) {
    try {
      fn();
    } catch (error) {
      // Uma falha no Canvas nunca pode impedir a Intro de terminar.
    }
  }

  _setPhase(phase) {
    this.root.dataset.phase = phase;
  }

  _after(delay, callback) {
    const id = window.setTimeout(callback, delay);
    this.timers.push(id);
    return id;
  }

  _clearTimers() {
    this.timers.forEach((id) => window.clearTimeout(id));
    this.timers = [];
  }
}