/* ==========================================================================
   BEYOND CODE — ENTRY POINT
   Inicia a Intro e, quando ela termina de verdade, aguarda um pequeno
   intervalo e revela a Hero adicionando a classe hero--ready.
   Toda a animação da revelação vive em CSS (css/hero-reveal.css) —
   este arquivo só troca a classe.
   ========================================================================== */

import { IntroSequence } from './intro.js';

const HERO_REVEAL_DELAY = 150; // ms — aguardado após a Intro sumir de vez

document.addEventListener('DOMContentLoaded', () => {
  const introRoot = document.querySelector('.intro');
  const hero = document.querySelector('.hero');

  if (!introRoot) return;

  const revealHero = () => {
    if (!hero) return;
    window.setTimeout(() => {
      hero.classList.add('hero--ready');
    }, HERO_REVEAL_DELAY);
  };

  const intro = new IntroSequence(introRoot, { onComplete: revealHero });
  intro.play();
});