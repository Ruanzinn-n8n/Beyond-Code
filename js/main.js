// Beyond Code
// Main entry point

console.log("Beyond Code iniciado.");

/* ==========================================================================
   BEYOND CODE — ENTRY POINT
   Único trabalho deste arquivo: importar e iniciar a Intro.
   ========================================================================== */

import { IntroSequence } from './intro.js';

document.addEventListener('DOMContentLoaded', () => {
  const introRoot = document.querySelector('.intro');
  if (!introRoot) return;

  const intro = new IntroSequence(introRoot);
  intro.play();
});