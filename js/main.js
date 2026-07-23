/* ==========================================================================
   BEYOND CODE — ENTRY POINT
   Inicia a Intro e, quando ela termina de verdade, aguarda um pequeno
   intervalo e revela a Hero adicionando a classe hero--ready.
   Toda a animação da revelação vive em CSS (css/hero-reveal.css) —
   este arquivo só troca a classe.
   ========================================================================== */

import { IntroSequence } from './intro.js';
import { HeroOrb } from './hero-orb.js';
import { Navbar } from './nav.js';
import { FaqAccordion } from './faq.js';

const HERO_REVEAL_DELAY = 150; // ms — aguardado após a Intro sumir de vez

document.addEventListener('DOMContentLoaded', () => {
  // Navbar e FAQ são independentes da Intro/Hero — já ficam utilizáveis
  // desde o primeiro frame.
  const header = document.querySelector('.header');
  const navbar = header ? new Navbar(header).init() : null;

  const faqList = document.querySelector('.faq__list');
  if (faqList) new FaqAccordion(faqList).init();

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