/* ==========================================================================
   BEYOND CODE — NAVBAR
   Sticky nav com dropdown customizado ("Story ▾"). Mesma filosofia de
   HeroOrb/IntroSequence: uma classe isolada, métodos pequenos com uma
   única responsabilidade, um jeito de entrar (init) e de sair (destroy).

   Toda a animação (entrada, dropdown, estado dentro/fora da Hero) vive
   em CSS (css/animations.css) — este arquivo só troca classes,
   atributos ARIA e o texto do rótulo ativo.

   Dois IntersectionObserver cuidam do estado, sem scroll listener e
   sem polling:
   — _heroObserver:    a Hero está visível? → navbar quase invisível.
                        Ela deixou de estar? → navbar ganha vidro fosco.
   — _sectionObserver: qual das seções do dropdown está no centro da
                        tela agora? → esse vira o rótulo do trigger.
   ========================================================================== */

// Deve cobrir a maior duração de transição usada em animations.css para o
// dropdown, para só marcar `hidden` depois que o fade já terminou.
const CLOSE_TRANSITION_MS = 320;

// Mesmo valor de --nav-reveal-duration em animations.css — não dá pra ler
// uma CSS var direto do JS sem uma chamada extra ao DOM, então mantemos
// os dois em sincronia manualmente (comentado nos dois lugares).
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

    // Força um reflow entre remover `hidden` e aplicar a classe que
    // dispara a transição — sem isso o navegador não anima a entrada.
    void this.menu.offsetHeight;

    this.menu.classList.add('is-open');
    this.trigger.setAttribute('aria-expanded', 'true');
  }

  close() {
    if (!this._isOpen) return;

    this._isOpen = false;
    this.menu.classList.remove('is-open');
    this.trigger.setAttribute('aria-expanded', 'false');

    // Só esconde de verdade (display: none via `hidden`) depois que o
    // fade termina — mantém o dropdown fora da árvore de acessibilidade
    // e do fluxo de tab assim que fechado, sem cortar a animação.
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

    // threshold: 0 → dispara assim que o último pixel da Hero sai (ou
    // o primeiro entra) da viewport. Enquanto qualquer parte dela
    // ainda estiver visível, a navbar continua no estado "flutuando".
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

    // Cada item do menu já sabe seu próprio rótulo e destino — a lista
    // de seções observadas nasce direto do DOM, nunca duplicada aqui.
    this._sectionsByElement = new Map();

    this.items.forEach((item) => {
      const section = document.querySelector(item.getAttribute('href'));
      if (section) this._sectionsByElement.set(section, item.textContent.trim());
    });

    if (!this._sectionsByElement.size) return;

    // Uma faixa fina no meio vertical da tela: a seção considerada
    // "ativa" é a que estiver cruzando essa faixa — o mesmo truque
    // usado por qualquer scroll-spy moderno, sem nenhum listener de
    // scroll e sem recalcular nada a cada frame.
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

  // Troca o texto do rótulo com um pequeno fade — nunca um corte seco,
  // mesmo com o usuário rolando rápido entre seções.
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
    // Impede que este mesmo clique seja lido por _onDocumentClick como
    // "clique fora" e feche o menu no mesmo instante em que abre.
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

  // Tab já percorre os itens naturalmente (são links) — isso só soma
  // navegação por seta, comum em menus deste tipo (role="menu").
  _onMenuKeydown(event) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();

    const currentIndex = this.items.indexOf(document.activeElement);
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = (currentIndex + direction + this.items.length) % this.items.length;
    this.items[nextIndex].focus();
  }

  // Clicar num item navega para a seção (âncora nativa) e só fecha o
  // dropdown — o scroll suave em si vive em CSS (scroll-behavior), e o
  // rótulo se atualiza sozinho quando a seção chegar ao centro da tela
  // (mesmo _sectionObserver usado durante o scroll manual).
  _onItemClick() {
    this.close();
  }
}