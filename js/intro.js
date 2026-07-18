/* ==========================================================================
   BEYOND CODE — INTRO SEQUENCE
   Toda a timeline da abertura: fases, timers, início e fim.
   Nenhuma matemática de canvas aqui — isso é responsabilidade de warp.js.
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
});

const WARP_INTENSITY = Object.freeze({
  FULL: 1,
  DECELERATED: 0.15,
  STOPPED: 0,
});

export class IntroSequence {
  constructor(root) {
    this.root = root;
    this.canvas = root.querySelector(SELECTORS.canvas);
    this.warp = new WarpEffect(this.canvas);
    this.reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    this.timers = [];
  }

  /** Ponto de entrada público: inicia a sequência completa. */
  play() {
    this.warp.init();

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
    this.warp.start();
    this.warp.setIntensity(WARP_INTENSITY.FULL);
    this._after(TIMING.LIGHT_SHOOT, () => this._runWarp());
  }

  // -- Cena 3 --------------------------------------------------------------
  _runWarp() {
    this._setPhase(PHASE.WARP);
    this._after(TIMING.WARP_ACCEL_HOLD, () => this._decelerateWarp());
  }

  _decelerateWarp() {
    this.warp.setIntensity(WARP_INTENSITY.DECELERATED);
    this._after(TIMING.WARP_DECEL_HOLD, () => this._revealMessage());
  }

  // -- Cena 4 ----------------------------------------------------------------
  _revealMessage() {
    this._setPhase(PHASE.REVEAL);
    this.warp.setIntensity(WARP_INTENSITY.STOPPED);
    this._after(TIMING.MESSAGE_FADE_HOLD, () => {
      this.warp.stop();
      this._scheduleApproach();
    });
  }

  // -- Cena 5 --------------------------------------------------------------
  _scheduleApproach() {
    this._after(TIMING.APPROACH_START_DELAY, () => {
      this._setPhase(PHASE.APPROACH);
      // Espera pelo tempo da transição (não pelo evento transitionend):
      // um evento de CSS pode não disparar (aba em segundo plano, transição
      // interrompida, etc.) e travaria a Intro para sempre. Tempo é garantido.
      this._after(TIMING.APPROACH_DURATION, () => this._closeIn());
    });
  }

  // -- Cena 6 --------------------------------------------------------------
  _closeIn() {
    this._setPhase(PHASE.CLOSING);
    this._after(TIMING.FINAL_HOLD, () => this._end());
  }

  _end() {
    this.warp.destroy();
    this.root.classList.add('intro--fade-out'); // opacidade vai a 0 suavemente
    this._after(TIMING.FADE_OUT_DURATION, () => {
      this.root.classList.add('intro--hidden'); // some do layout de vez
      this._clearTimers();
    });
  }

  // -- Acessibilidade --------------------------------------------------------
  _playReducedMotion() {
    this._setPhase(PHASE.REVEAL);
    this._after(TIMING.REDUCED_MOTION_HOLD, () => this._end());
  }

  // -- Utilitários -----------------------------------------------------------
  _setPhase(phase) {
    this.root.dataset.phase = phase;
  }

  _after(delay, callback) {
    const id = window.setTimeout(callback, delay);
    this.timers.push(id);
  }

  _clearTimers() {
    this.timers.forEach((id) => window.clearTimeout(id));
    this.timers = [];
  }
}