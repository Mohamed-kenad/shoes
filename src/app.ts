import { PRODUCTS_BY_ID, type Product } from './data/collection';
import { BagStore } from './lib/bag-store';
import { required } from './lib/dom';
import { animateMobileFlight } from './lib/flight';
import {
  cameraUrl,
  mountDetailImage,
  playCamera,
  preloadDetail,
  preloadThumb,
  primeCamera,
  resetCamera,
} from './lib/media';
import { createIdleScheduler, prefersReducedMotion } from './lib/motion';
import { BagDialog } from './ui/bag-dialog';
import { MobileCollection } from './ui/mobile-collection';
import { ProductPanel } from './ui/product-panel';
import { StudioDialog } from './ui/studio-dialog';
import { Wall } from './ui/wall';

type Mode = 'wall' | 'outbound' | 'detail' | 'inbound';

const PREPARE_DELAY_MS = 140;

function readStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export class App {
  readonly #scene = required<HTMLElement>('#scene');
  readonly #stage = required<HTMLElement>('#stage');
  readonly #productView = required<HTMLElement>('#product-view');
  readonly #detailFrame = required<HTMLElement>('#detail-frame');
  readonly #mobileVisual = required<HTMLElement>('#mobile-detail-visual');
  readonly #forward = required<HTMLVideoElement>('#forward-camera');
  readonly #reverse = required<HTMLVideoElement>('#reverse-camera');
  readonly #collectionLink = required<HTMLAnchorElement>('#collection-link');
  readonly #backLink = required<HTMLButtonElement>('#back-link');
  readonly #status = required<HTMLElement>('#status');
  readonly #bagToggle = required<HTMLButtonElement>('#bag-toggle');
  readonly #skipLink = required<HTMLAnchorElement>('.skip-link');
  readonly #brand = required<HTMLAnchorElement>('.brand');

  readonly #mobileQuery = window.matchMedia('(max-width: 760px)');
  readonly #store: BagStore;
  readonly #bagDialog: BagDialog;
  readonly #panel: ProductPanel;
  readonly #mobile: MobileCollection;
  readonly #idle = createIdleScheduler();

  #isMobile = this.#mobileQuery.matches;
  #mode: Mode = 'wall';
  #activeProduct: Product | null = null;
  #lastTrigger: HTMLElement | null = null;
  #preparedId: number | null = null;
  #prepareTimer = 0;
  #transitionToken = 0;
  #abort: AbortController | null = null;
  #pendingBack = false;
  #mobileBusy = false;

  constructor() {
    this.#store = new BagStore(PRODUCTS_BY_ID, readStorage());
    this.#bagDialog = new BagDialog({
      store: this.#store,
      products: PRODUCTS_BY_ID,
      toggle: this.#bagToggle,
    });
    this.#panel = new ProductPanel({
      onAdd: (product, size) => {
        const result = this.#store.add(product.id, size);
        return result.ok ? { ok: true } : { ok: false, limit: true };
      },
      bagTarget: () => this.#bagToggle,
    });
    this.#mobile = new MobileCollection({
      onSelect: (product) => {
        this.#status.textContent = `${product.name} selected.`;
      },
      onOpen: (product, trigger) => {
        void this.#openMobile(product, trigger);
      },
    });
    new Wall({
      hotspots: required<HTMLElement>('#hotspots'),
      labels: required<HTMLElement>('#holo-labels'),
      onPreview: (product) => this.#schedulePrepare(product),
      onEnter: (product, trigger) => {
        void this.#enterDesktop(product, trigger);
      },
    });
    new StudioDialog({
      onExplore: () => this.#goCollection(),
    });

    this.#bindEvents();
    this.#setMode('wall');
    this.#setStatus();
  }

  #bindEvents(): void {
    this.#bagToggle.addEventListener('click', () => this.#bagDialog.toggle());
    this.#backLink.addEventListener('click', () => {
      void this.leave();
    });
    this.#collectionLink.addEventListener('click', (event) => {
      event.preventDefault();
      this.#goCollection();
    });
    this.#brand.addEventListener('click', (event) => {
      event.preventDefault();
      this.#goCollection();
    });
    this.#skipLink.addEventListener('click', (event) => {
      if (!this.#isMobile) return;
      event.preventDefault();
      this.#focusMobileCollection();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (document.querySelector('dialog[open]')) return;
      if (this.#mode === 'detail' || this.#mode === 'outbound') {
        event.preventDefault();
        void this.leave();
      }
    });

    this.#mobileQuery.addEventListener('change', (event) => {
      this.#isMobile = event.matches;
      if (this.#mode !== 'wall') {
        this.#hardReset(false);
      } else if (this.#isMobile) {
        this.#mobile.showDock();
      } else {
        this.#mobile.hideDock();
      }
      this.#setStatus();
    });
  }

  async #enterDesktop(product: Product, trigger: HTMLElement): Promise<void> {
    if (this.#mode !== 'wall' || this.#isMobile) return;

    const token = ++this.#transitionToken;
    this.#activeProduct = product;
    this.#lastTrigger = trigger;
    this.#pendingBack = false;
    this.#panel.setProduct(product);
    this.#prepareNow(product);
    mountDetailImage(this.#detailFrame, product);
    this.#status.textContent = '';

    if (prefersReducedMotion()) {
      await preloadDetail(product.id).catch(() => undefined);
      if (token !== this.#transitionToken) return;
      this.#revealDetail(product);
      return;
    }

    const controller = new AbortController();
    this.#abort?.abort();
    this.#abort = controller;
    this.#setMode('outbound');
    this.#forward.hidden = false;
    this.#forward.classList.remove('is-active');

    try {
      await playCamera(this.#forward, cameraUrl(product.id, 'forward'), {
        signal: controller.signal,
        onFirstFrame: () => this.#forward.classList.add('is-active'),
      });
      if (token !== this.#transitionToken) return;
      this.#revealDetail(product);
      if (this.#pendingBack) {
        this.#pendingBack = false;
        void this.leave();
      }
    } catch {
      if (token !== this.#transitionToken) return;
      this.#revealDetail(product);
    } finally {
      this.#forward.hidden = true;
      this.#forward.classList.remove('is-active');
      if (this.#abort === controller) this.#abort = null;
    }
  }

  async #openMobile(product: Product, trigger: HTMLElement): Promise<void> {
    if (this.#mode !== 'wall' || !this.#isMobile || this.#mobileBusy) return;

    const token = ++this.#transitionToken;
    this.#mobileBusy = true;
    this.#activeProduct = product;
    this.#lastTrigger = trigger;
    this.#panel.setProduct(product);

    const source = this.#mobile.cardPhotoRect(product.id);
    this.#productView.hidden = false;
    this.#productView.inert = false;
    this.#productView.classList.remove('is-ready', 'is-flying');
    this.#productView.scrollTop = 0;
    this.#productView.classList.add('is-flying');
    this.#setMode('detail');
    this.#mobile.setDetailOpen(true);
    this.#status.textContent = '';

    // Read after the product view is visible so the flight lands on the real frame.
    const target = this.#mobileVisual.getBoundingClientRect();
    if (!prefersReducedMotion() && source) {
      await animateMobileFlight(product.id, source, target, 'open', false);
    }
    if (token !== this.#transitionToken) {
      this.#mobileBusy = false;
      return;
    }

    this.#productView.classList.remove('is-flying');
    this.#mobileBusy = false;
    this.#backLink.focus({ preventScroll: true });
  }

  async #closeMobile(): Promise<void> {
    const product = this.#activeProduct;
    if (!product || this.#mobileBusy) return;

    this.#mobileBusy = true;
    const token = ++this.#transitionToken;
    const target = this.#mobileVisual.getBoundingClientRect();

    this.#productView.hidden = true;
    this.#productView.inert = true;
    this.#productView.classList.remove('is-ready', 'is-flying');
    this.#setMode('wall');
    this.#mobile.setDetailOpen(false);
    this.#mobile.showDock();
    this.#idle.cancel();

    // The collection keeps the scroll position it had before the flight, so the
    // returning shoe lands where the visitor left it.
    const source = this.#mobile.cardPhotoRect(product.id) ?? target;

    if (!prefersReducedMotion()) {
      await animateMobileFlight(product.id, source, target, 'close', false);
    }

    this.#mobileBusy = false;
    this.#setStatus();
    if (token === this.#transitionToken) {
      this.#lastTrigger?.focus({ preventScroll: true });
    }
  }

  async leave(): Promise<void> {
    if (this.#mode === 'outbound') {
      this.#pendingBack = true;
      return;
    }
    if (this.#mode === 'inbound' || this.#mode === 'wall') return;
    if (this.#isMobile) {
      await this.#closeMobile();
      return;
    }
    if (prefersReducedMotion()) {
      this.#hardReset(true);
      return;
    }

    const product = this.#activeProduct;
    if (!product) {
      this.#hardReset(true);
      return;
    }

    const token = ++this.#transitionToken;
    this.#abort?.abort();
    this.#idle.cancel();
    this.#pendingBack = false;
    this.#detailFrame.hidden = true;
    this.#productView.hidden = true;
    this.#productView.inert = true;
    this.#productView.classList.remove('is-ready');
    this.#setMode('inbound');

    const controller = new AbortController();
    this.#abort = controller;
    this.#reverse.hidden = false;
    this.#reverse.classList.remove('is-active');

    try {
      await playCamera(this.#reverse, cameraUrl(product.id, 'reverse'), {
        signal: controller.signal,
        onFirstFrame: () => this.#reverse.classList.add('is-active'),
      });
    } catch {
      // A missing camera move should never trap the visitor in the product view.
    } finally {
      this.#reverse.hidden = true;
      this.#reverse.classList.remove('is-active');
      if (this.#abort === controller) this.#abort = null;
    }

    if (token !== this.#transitionToken) return;
    this.#hardReset(true);
  }

  #revealDetail(product: Product): void {
    if (this.#mode !== 'outbound' && this.#mode !== 'wall') return;
    this.#detailFrame.hidden = false;
    this.#productView.hidden = false;
    this.#productView.inert = false;
    this.#productView.scrollTop = 0;
    this.#productView.classList.remove('is-ready');
    void this.#productView.offsetWidth;
    this.#productView.classList.add('is-ready');
    this.#setMode('detail');
    this.#status.textContent = '';

    if (!prefersReducedMotion()) {
      this.#idle.request(() => {
        if (this.#mode === 'detail' && this.#activeProduct?.id === product.id && !this.#isMobile) {
          primeCamera(this.#reverse, cameraUrl(product.id, 'reverse'));
        }
      });
    }

    this.#backLink.focus({ preventScroll: true });
  }

  #hardReset(focus: boolean): void {
    ++this.#transitionToken;
    this.#abort?.abort();
    this.#abort = null;
    this.#idle.cancel();
    this.#pendingBack = false;
    this.#mobileBusy = false;
    resetCamera(this.#forward);
    resetCamera(this.#reverse);
    this.#detailFrame.hidden = true;
    this.#detailFrame.replaceChildren();
    this.#productView.hidden = true;
    this.#productView.inert = true;
    this.#productView.classList.remove('is-ready', 'is-flying');
    this.#setMode('wall');
    this.#mobile.setDetailOpen(false);
    if (this.#isMobile) this.#mobile.showDock();
    else this.#mobile.hideDock();
    this.#activeProduct = null;
    this.#setStatus();

    if (focus) this.#lastTrigger?.focus({ preventScroll: true });
  }

  #setMode(mode: Mode): void {
    this.#mode = mode;
    this.#scene.dataset.mode = mode;
    const inDetail = mode !== 'wall';

    this.#collectionLink.hidden = inDetail;
    this.#backLink.hidden = mode !== 'detail';
    if (mode === 'wall') this.#collectionLink.setAttribute('aria-current', 'page');
    else this.#collectionLink.removeAttribute('aria-current');

    this.#stage.inert = inDetail;
    this.#mobile.section.inert = inDetail;
    if (mode === 'detail' && this.#isMobile) this.#mobile.hideDock();
  }

  #setStatus(): void {
    this.#status.textContent = this.#isMobile
      ? 'Tap a silhouette. Find your perspective.'
      : 'Hover to illuminate. Select to explore.';
  }

  #schedulePrepare(product: Product | null): void {
    window.clearTimeout(this.#prepareTimer);
    if (!product || this.#isMobile) return;
    this.#prepareTimer = window.setTimeout(() => {
      if (this.#mode !== 'wall') return;
      this.#prepareNow(product);
    }, PREPARE_DELAY_MS);
  }

  #prepareNow(product: Product): void {
    if (this.#preparedId === product.id) return;
    this.#preparedId = product.id;
    primeCamera(this.#forward, cameraUrl(product.id, 'forward'));
    void preloadDetail(product.id).catch(() => undefined);
    void preloadThumb(product.id).catch(() => undefined);
  }

  #goCollection(): void {
    if (this.#mode === 'wall') {
      if (this.#isMobile) this.#focusMobileCollection();
      else this.#scene.focus({ preventScroll: true });
      return;
    }
    void this.leave();
  }

  #focusMobileCollection(): void {
    this.#mobile.section.focus({ preventScroll: true });
    this.#mobile.section.scrollTop = 0;
  }
}
