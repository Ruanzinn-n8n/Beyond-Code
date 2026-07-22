/* ==========================================================================
   BEYOND CODE — ENTRY POINT
   Inicia a Intro e, quando ela termina de verdade, aguarda um pequeno
   intervalo e revela a Hero adicionando a classe hero--ready.
   Toda a animação da revelação vive em CSS (css/hero-reveal.css) —
   este arquivo só troca a classe.
   ========================================================================== */

import { IntroSequence } from './intro.js';
import { HeroOrb } from './hero-orb.js';

const HERO_REVEAL_DELAY = 150; // ms — aguardado após a Intro sumir de vez

if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

window.scrollTo(0,0);

document.addEventListener('DOMContentLoaded', () => {
  const introRoot = document.querySelector('.intro');
  const hero = document.querySelector('.hero');
  const orbCanvas = document.querySelector('.hero__orb');

  if (!introRoot) return;

  // O HeroOrb é instanciado desde já (geometria/eventos prontos), mas só
  // começa a animar quando a Hero recebe .hero--ready — nunca antes.
  const orb = orbCanvas ? new HeroOrb(orbCanvas).init() : null;

  const revealHero = () => {
    window.scrollTo(0,0);
    if (!hero) return;
    window.setTimeout(() => {
      hero.classList.add('hero--ready');
      if (orb) orb.start();
    }, HERO_REVEAL_DELAY);
  };

  const intro = new IntroSequence(introRoot, { onComplete: revealHero });
  intro.play();
});