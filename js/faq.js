const CLOSE_HIDE_DELAY_MS = 420;

export class FaqAccordion {
  /**
   * @param {HTMLElement} root
   */
  constructor(root) {
    this.items = Array.from(root.querySelectorAll('.faq-item'));
    this._hideTimeouts = new Map();

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

    // ------ só uma resposta aberta por vez -------.
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

    const timeoutId = window.setTimeout(() => {
      answer.hidden = true;
      this._hideTimeouts.delete(answer);
    }, CLOSE_HIDE_DELAY_MS);

    this._hideTimeouts.set(answer, timeoutId);
  }
}