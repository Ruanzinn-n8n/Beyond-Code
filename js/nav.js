const CLOSE_TRANSITION_MS = 320;

const LABEL_SWAP_MS = 160; // == --nav-menu-trigger-label transition

export class Navbar {
  /**
   * @param {HTMLElement} header — .header
   */
  constructor(header) {
    this.header = header;
    this.nav = header.querySelector('.nav');
    this.trigger = header.querySelector('.nav__menu-trigger');
    this.triggerLabel = header.querySelector('.nav__menu-trigger-label');
    this.menu = header.querySelector('.nav__menu-list');
    this.menuWrapper = header.querySelector('.nav__menu');
    this.items = this.menu
      ? Array.from(this.menu.querySelectorAll('.nav__menu-item'))
      : [];

    this.hero = document.querySelector('.hero');

    this._isOpen = false;
    this._closeTimeoutId = null;
    this._labelSwapTimeoutId = null;
    this._activeLabel = this.triggerLabel ? this.triggerLabel.textContent.trim() : '';

    this._heroObserver = null;
    this._sectionObserver = null;

    /* handlers vinculados uma única vez, para poder remover no destroy */
    this._onTriggerClick = this._onTriggerClick.bind(this);
    this._onDocumentClick = this._onDocumentClick.bind(this);
    this._onDocumentKeydown = this._onDocumentKeydown.bind(this);
    this._onMenuKeydown = this._onMenuKeydown.bind(this);
    this._onItemClick = this._onItemClick.bind(this);
    this._onHeroIntersect = this._onHeroIntersect.bind(this);
    this._onSectionIntersect = this._onSectionIntersect.bind(this);
  }

  /* ------------------------------------------------------------------
     CICLO DE VIDA PÚBLICO
     ------------------------------------------------------------------ */

  init() {
    if (!this.nav || !this.trigger || !this.menu) return this;
    this._bindEvents();
    this._observeHero();
    this._observeSections();
    return this;
  }

  // Chamado pelo main.js no mesmo instante em que a Hero recebe
  // hero--ready — a navbar participa da mesma apresentação, nunca antes.
  reveal() {
    this.header.classList.add('header--ready');
  }

  destroy() {
    this.trigger.removeEventListener('click', this._onTriggerClick);
    document.removeEventListener('click', this._onDocumentClick);
    document.removeEventListener('keydown', this._onDocumentKeydown);
    this.menu.removeEventListener('keydown', this._onMenuKeydown);
    this.items.forEach((item) => item.removeEventListener('click', this._onItemClick));

    if (this._heroObserver) this._heroObserver.disconnect();
    if (this._sectionObserver) this._sectionObserver.disconnect();

    if (this._closeTimeoutId) clearTimeout(this._closeTimeoutId);
    if (this._labelSwapTimeoutId) clearTimeout(this._labelSwapTimeoutId);
  }

  /* ------------------------------------------------------------------
     ABRIR / FECHAR DROPDOWN
     ------------------------------------------------------------------ */

  toggle() {
    if (this._isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    if (this._isOpen) return;

    if (this._closeTimeoutId) {
      clearTimeout(this._closeTimeoutId);
      this._closeTimeoutId = null;
    }

    this._isOpen = true;
    this.menu.hidden = false;

    void this.menu.offsetHeight;

    this.menu.classList.add('is-open');
    this.trigger.setAttribute('aria-expanded', 'true');
  }

  close() {
    if (!this._isOpen) return;

    this._isOpen = false;
    this.menu.classList.remove('is-open');
    this.trigger.setAttribute('aria-expanded', 'false');

    this._closeTimeoutId = window.setTimeout(() => {
      this.menu.hidden = true;
      this._closeTimeoutId = null;
    }, CLOSE_TRANSITION_MS);
  }

  /* ------------------------------------------------------------------
     ESTADO DENTRO/FORA DA HERO
     ------------------------------------------------------------------ */

  _observeHero() {
    if (!this.hero) return;

    this._heroObserver = new IntersectionObserver(this._onHeroIntersect, {
      threshold: 0,
    });
    this._heroObserver.observe(this.hero);
  }

  _onHeroIntersect([entry]) {
    this.header.classList.toggle('header--scrolled', !entry.isIntersecting);
  }

  /* ------------------------------------------------------------------
     SEÇÃO ATIVA (rótulo do dropdown)
     ------------------------------------------------------------------ */

  _observeSections() {
    if (!this.items.length) return;

    this._sectionsByElement = new Map();

    this.items.forEach((item) => {
      const section = document.querySelector(item.getAttribute('href'));
      if (section) this._sectionsByElement.set(section, item.textContent.trim());
    });

    if (!this._sectionsByElement.size) return;

    this._sectionObserver = new IntersectionObserver(this._onSectionIntersect, {
      rootMargin: '-45% 0px -45% 0px',
      threshold: 0,
    });

    this._sectionsByElement.forEach((_label, section) => {
      this._sectionObserver.observe(section);
    });
  }

  _onSectionIntersect(entries) {
    const visible = entries.find((entry) => entry.isIntersecting);
    if (!visible) return;

    const label = this._sectionsByElement.get(visible.target);
    this._setActiveLabel(label);
  }

  // Troca o texto do rótulo com um pequeno fade.
  _setActiveLabel(label) {
    if (!label || label === this._activeLabel || !this.triggerLabel) return;
    this._activeLabel = label;

    if (this._labelSwapTimeoutId) clearTimeout(this._labelSwapTimeoutId);

    this.triggerLabel.classList.add('is-swapping');
    this._labelSwapTimeoutId = window.setTimeout(() => {
      this.triggerLabel.textContent = label;
      this.triggerLabel.classList.remove('is-swapping');
      this._labelSwapTimeoutId = null;
    }, LABEL_SWAP_MS);
  }

  /* ------------------------------------------------------------------
     EVENTOS DO DROPDOWN
     ------------------------------------------------------------------ */

  _bindEvents() {
    this.trigger.addEventListener('click', this._onTriggerClick);
    document.addEventListener('click', this._onDocumentClick);
    document.addEventListener('keydown', this._onDocumentKeydown);
    this.menu.addEventListener('keydown', this._onMenuKeydown);
    this.items.forEach((item) => item.addEventListener('click', this._onItemClick));
  }

  _onTriggerClick(event) {
    event.stopPropagation();
    this.toggle();
  }

  _onDocumentClick(event) {
    if (!this._isOpen) return;
    if (this.menuWrapper.contains(event.target)) return;
    this.close();
  }

  _onDocumentKeydown(event) {
    if (event.key === 'Escape' && this._isOpen) {
      this.close();
      this.trigger.focus();
    }
  }

  _onMenuKeydown(event) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();

    const currentIndex = this.items.indexOf(document.activeElement);
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = (currentIndex + direction + this.items.length) % this.items.length;
    this.items[nextIndex].focus();
  }

  _onItemClick() {
    this.close();
  }
}


/* ==========================================================================
   SCROLL PROGRESS 
   ========================================================================== */
export class ScrollProgress {
  /**
   * @param {HTMLElement} track — .nav__progress
   * @param {HTMLElement} dot — .nav__progress-dot
   */
  constructor(track, dot) {
    this.track = track;
    this.dot = dot;
    this.trackWidth = 0;
    this.dotWidth = 0;
    this._ticking = false;

    this._onScroll = this._onScroll.bind(this);
    this._onResize = this._onResize.bind(this);
  }

  init() {
    if (!this.track || !this.dot) return this;

    this._measure();
    window.addEventListener('scroll', this._onScroll, { passive: true });
    window.addEventListener('resize', this._onResize, { passive: true });
    this._update(); // posição inicial

    return this;
  }

  destroy() {
    window.removeEventListener('scroll', this._onScroll);
    window.removeEventListener('resize', this._onResize);
  }

  /* ------------------------------------------------------------------
     MEDIÇÃO 
     ------------------------------------------------------------------ */

  _measure() {
    this.trackWidth = this.track.getBoundingClientRect().width;
    this.dotWidth = this.dot.getBoundingClientRect().width;
  }

  _onResize() {
    this._measure();
    this._update();
  }

  /* ------------------------------------------------------------------
     SCROLL
     ------------------------------------------------------------------ */

  _onScroll() {
    if (this._ticking) return;
    this._ticking = true;

    requestAnimationFrame(() => {
      this._update();
      this._ticking = false;
    });
  }

  _update() {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const progress = maxScroll > 0 ? Math.min(1, Math.max(0, window.scrollY / maxScroll)) : 0;
    const travel = Math.max(0, this.trackWidth - this.dotWidth);

    this.dot.style.transform = `translateX(${(progress * travel).toFixed(2)}px)`;
  }
}