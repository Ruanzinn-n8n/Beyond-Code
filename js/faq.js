/* ==========================================================================
   BEYOND CODE — FAQ ACCORDION
   O HTML e o CSS do FAQ já existiam (indicador +/-, resposta com
   grid-template-rows animável em css/animations.css) — só faltava o
   clique de verdade abrindo/fechando. É isso que esta classe faz.

   Mesma filosofia de HeroOrb/Navbar: uma classe isolada, métodos
   pequenos, init()/destroy(). Um item aberto por vez (acordeão).
   ========================================================================== */

// Deve cobrir a transição de grid-template-rows usada em animations.css,
// pra só marcar `hidden` de novo depois que o fechamento já terminou.
const CLOSE_HIDE_DELAY_MS = 420;

export class FaqAccordion {
  /**
   * @param {HTMLElement} root — o container que tem os .faq-item (ex: .faq__list)
   */
  constructor(root) {
    this.items = Array.from(root.querySelectorAll('.faq-item'));
    this._hideTimeouts = new Map(); // answer -> timeoutId, um por item

    this._onTriggerClick = this._onTriggerClick.bind(this);
  }

  /* ------------------------------------------------------------------
     CICLO DE VIDA PÚBLICO
     ------------------------------------------------------------------ */

  init() {
    this.items.forEach((item) => {
      const trigger = item.querySelector('.faq-item__trigger');
      if (trigger) trigger.addEventListener('click', this._onTriggerClick);
    });
    return this;
  }

  destroy() {
    this.items.forEach((item) => {
      const trigger = item.querySelector('.faq-item__trigger');
      if (trigger) trigger.removeEventListener('click', this._onTriggerClick);
    });

    this._hideTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    this._hideTimeouts.clear();
  }

  /* ------------------------------------------------------------------
     ABRIR / FECHAR
     ------------------------------------------------------------------ */

  _onTriggerClick(event) {
    const item = event.currentTarget.closest('.faq-item');
    if (!item) return;

    const trigger = item.querySelector('.faq-item__trigger');
    const wasOpen = trigger.getAttribute('aria-expanded') === 'true';

    // Acordeão: só uma resposta aberta por vez — abrir uma fecha as outras.
    this.items.forEach((other) => {
      if (other !== item) this._close(other);
    });

    if (wasOpen) {
      this._close(item);
    } else {
      this._open(item);
    }
  }

  _open(item) {
    const trigger = item.querySelector('.faq-item__trigger');
    const answer = item.querySelector('.faq-item__answer');
    if (!trigger || !answer) return;

    const pendingHide = this._hideTimeouts.get(answer);
    if (pendingHide) {
      clearTimeout(pendingHide);
      this._hideTimeouts.delete(answer);
    }

    answer.hidden = false;

    // Força um reflow entre remover `hidden` e ligar a classe que
    // dispara a transição — mesmo truque do dropdown da navbar, sem
    // isso o navegador não anima a abertura.
    void answer.offsetHeight;

    item.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
  }

  _close(item) {
    const trigger = item.querySelector('.faq-item__trigger');
    const answer = item.querySelector('.faq-item__answer');
    if (!trigger || !answer) return;
    if (trigger.getAttribute('aria-expanded') !== 'true') return;

    item.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');

    // Só marca `hidden` de novo depois que o fade/collapse termina —
    // tira a resposta da árvore de acessibilidade e do fluxo de tab
    // assim que fechada, sem cortar a animação no meio.
    const timeoutId = window.setTimeout(() => {
      answer.hidden = true;
      this._hideTimeouts.delete(answer);
    }, CLOSE_HIDE_DELAY_MS);

    this._hideTimeouts.set(answer, timeoutId);
  }
}