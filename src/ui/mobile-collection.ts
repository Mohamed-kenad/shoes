import { PRODUCTS, PRODUCTS_BY_ID, type Product } from '../data/collection';
import { create, required } from '../lib/dom';
import { formatPrice } from '../lib/format';
import { MOBILE_LIGHTS_URL } from '../lib/media';

interface MobileCollectionOptions {
  readonly onSelect: (product: Product) => void;
  readonly onOpen: (product: Product, trigger: HTMLElement) => void;
}

export class MobileCollection {
  readonly #section = required<HTMLElement>('#mobile-collection');
  readonly #shelves = required<HTMLElement>('#mobile-shelves');
  readonly #dock = required<HTMLElement>('#mobile-dock');
  readonly #dockName = required<HTMLElement>('#dock-name');
  readonly #dockMeta = required<HTMLElement>('#dock-meta');
  readonly #dockOpen = required<HTMLButtonElement>('#dock-open');
  readonly #cards = new Map<number, HTMLButtonElement>();
  readonly #options: MobileCollectionOptions;
  #selectedId: number | null = null;

  constructor(options: MobileCollectionOptions) {
    this.#options = options;
    this.#build();
    this.#dockOpen.addEventListener('click', () => {
      const product = this.#selectedId === null ? null : PRODUCTS_BY_ID.get(this.#selectedId);
      const card = this.#selectedId === null ? null : this.#cards.get(this.#selectedId);
      if (product && card) this.#options.onOpen(product, card);
    });
  }

  get selectedId(): number | null {
    return this.#selectedId;
  }

  get section(): HTMLElement {
    return this.#section;
  }

  getCard(productId: number): HTMLButtonElement | null {
    return this.#cards.get(productId) ?? null;
  }

  cardPhotoRect(productId: number): DOMRect | null {
    const card = this.#cards.get(productId);
    const photo = card?.querySelector<HTMLElement>('.mobile-shoe-photo');
    return photo ? photo.getBoundingClientRect() : null;
  }

  setDetailOpen(open: boolean): void {
    document.body.classList.toggle('mobile-detail', open);
    this.#dock.hidden = open || this.#selectedId === null;
    if (!open && this.#selectedId !== null) {
      document.body.classList.add('has-mobile-selection');
    }
  }

  showDock(): void {
    if (this.#selectedId === null) {
      this.#dock.hidden = true;
      return;
    }
    const product = PRODUCTS_BY_ID.get(this.#selectedId);
    if (!product) return;
    this.#dockName.textContent = product.name;
    this.#dockMeta.textContent = `${product.color} / ${formatPrice(product.price)}`;
    this.#dock.hidden = false;
    document.body.classList.add('has-mobile-selection');
  }

  hideDock(): void {
    this.#dock.hidden = true;
    document.body.classList.remove('has-mobile-selection');
  }

  #build(): void {
    for (const product of PRODUCTS) {
      const card = create('button', 'mobile-shoe');
      card.type = 'button';
      card.dataset.product = String(product.id);
      card.setAttribute('aria-pressed', 'false');
      card.setAttribute('aria-label', `Select ${product.name}, ${formatPrice(product.price)}`);

      const photo = create('span', 'mobile-shoe-photo');
      photo.setAttribute('aria-hidden', 'true');
      photo.style.setProperty('--col', String((product.id - 1) % 2));
      photo.style.setProperty('--row', String(Math.floor((product.id - 1) / 2)));

      const light = document.createElement('img');
      light.className = 'mobile-shoe-light';
      light.src = MOBILE_LIGHTS_URL;
      light.alt = '';
      light.width = 1440;
      light.height = 3086;
      light.decoding = 'async';
      light.draggable = false;
      photo.append(light);

      const meta = create('span', 'mobile-shoe-meta');
      meta.append(
        create('span', 'mobile-shoe-name', product.name),
        create('span', 'mobile-shoe-price', formatPrice(product.price)),
      );

      card.append(photo, meta);
      card.addEventListener('click', () => this.#onCardClick(product, card));
      this.#shelves.append(card);
      this.#cards.set(product.id, card);
    }
  }

  #onCardClick(product: Product, card: HTMLButtonElement): void {
    if (this.#selectedId === product.id) {
      this.#options.onOpen(product, card);
      return;
    }
    this.#select(product);
  }

  #select(product: Product): void {
    this.#selectedId = product.id;
    for (const [id, card] of this.#cards) {
      card.setAttribute('aria-pressed', String(id === product.id));
    }
    this.showDock();
    this.#options.onSelect(product);
  }
}
