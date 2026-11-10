import type { Product } from '../data/collection';
import { create, required } from '../lib/dom';
import { flyProductToBag } from '../lib/flight';
import { formatPrice, formatSize } from '../lib/format';
import { prefersReducedMotion } from '../lib/motion';

export type AddOutcome = { readonly ok: true } | { readonly ok: false; readonly limit: boolean };

interface ProductPanelOptions {
  readonly onAdd: (product: Product, size: number) => AddOutcome;
  readonly bagTarget: () => HTMLElement;
}

const ADDED_STATE_MS = 1800;

function priceText(product: Product): string {
  return formatPrice(product.price);
}

export class ProductPanel {
  readonly #options: ProductPanelOptions;
  readonly #view = required<HTMLElement>('#product-view');
  readonly #kicker = required<HTMLElement>('#product-kicker');
  readonly #title = required<HTMLElement>('#product-title');
  readonly #description = required<HTMLElement>('#product-description');
  readonly #color = required<HTMLElement>('#product-color');
  readonly #price = required<HTMLElement>('#product-price');
  readonly #details = required<HTMLElement>('#product-details');
  readonly #select = required<HTMLSelectElement>('#product-size');
  readonly #add = required<HTMLButtonElement>('#add-to-bag');
  readonly #addLabel = required<HTMLElement>('#add-label');
  readonly #addHint = required<HTMLElement>('#add-hint');
  readonly #addSymbol = required<HTMLElement>('.add-symbol');
  readonly #selectionMessage = required<HTMLElement>('#selection-message');
  readonly #more = required<HTMLDetailsElement>('.product-more');
  readonly #mobileVisual = required<HTMLElement>('#mobile-detail-visual');
  readonly #sizes = new Map<number, number>();
  #product: Product | null = null;
  #selectedSize: number | null = null;
  #addedTimer = 0;

  constructor(options: ProductPanelOptions) {
    this.#options = options;
    this.#select.addEventListener('change', () => this.#selectSize(Number(this.#select.value)));
    this.#add.addEventListener('click', () => this.#addToBag());
    this.#bindPointerLight();
  }

  setProduct(product: Product): void {
    this.#product = product;
    this.#view.dataset.product = String(product.id);
    this.#kicker.textContent = `LAST DEPT. / ${String(product.id).padStart(2, '0')}`;
    this.#title.textContent = product.name;
    this.#description.textContent = product.description;
    this.#color.textContent = product.color;
    this.#price.textContent = priceText(product);
    this.#details.textContent = product.details;
    this.#more.open = false;
    this.#mobileVisual.style.setProperty('--col', String((product.id - 1) % 2));
    this.#mobileVisual.style.setProperty('--row', String(Math.floor((product.id - 1) / 2)));

    const placeholder = create('option', undefined, 'Select a size');
    placeholder.value = '';
    placeholder.disabled = true;
    placeholder.selected = true;
    this.#select.replaceChildren(placeholder);
    for (const size of product.sizes) {
      const option = create('option', undefined, `EU ${formatSize(size)}`);
      option.value = String(size);
      this.#select.append(option);
    }

    const remembered = this.#sizes.get(product.id) ?? null;
    this.#selectedSize = remembered;
    if (remembered !== null) {
      this.#select.value = String(remembered);
    }
    this.#resetAddedState();
    this.#selectionMessage.textContent = '';
    this.#syncAddButton();
  }

  focusSize(): void {
    this.#select.focus({ preventScroll: true });
  }

  #selectSize(size: number): void {
    const product = this.#product;
    if (!product?.sizes.includes(size)) {
      this.#selectedSize = null;
      this.#syncAddButton();
      return;
    }

    this.#selectedSize = size;
    this.#sizes.set(product.id, size);
    this.#resetAddedState();
    this.#syncAddButton();
    this.#selectionMessage.textContent = `EU ${formatSize(size)} selected.`;
  }

  #syncAddButton(): void {
    const product = this.#product;
    const size = this.#selectedSize;
    const ready = Boolean(product && size !== null);
    this.#add.disabled = !ready;
    this.#add.classList.remove('is-added');
    this.#addLabel.textContent = 'Add to bag';
    this.#addHint.textContent =
      ready && size !== null
        ? `EU ${formatSize(size)} / Ready to add`
        : 'Select your size to continue';
  }

  #resetAddedState(): void {
    window.clearTimeout(this.#addedTimer);
    this.#add.classList.remove('is-added');
    this.#addLabel.textContent = 'Add to bag';
  }

  #addToBag(): void {
    const product = this.#product;
    const size = this.#selectedSize;
    if (!product || size === null) return;

    const result = this.#options.onAdd(product, size);
    window.clearTimeout(this.#addedTimer);

    if (!result.ok) {
      if (result.limit) {
        this.#addLabel.textContent = 'Bag limit reached';
        this.#addHint.textContent = 'Maximum quantity reached';
        this.#selectionMessage.textContent = 'Maximum quantity reached.';
        this.#addedTimer = window.setTimeout(() => this.#syncAddButton(), ADDED_STATE_MS);
      }
      return;
    }

    this.#add.classList.add('is-added');
    this.#addLabel.textContent = 'In your bag';
    this.#addHint.textContent = `${product.name} / EU ${formatSize(size)}`;
    this.#selectionMessage.textContent = `${product.name}, EU ${formatSize(size)} added to your bag.`;

    flyProductToBag(product, this.#addSymbol, this.#options.bagTarget(), prefersReducedMotion());
    this.#addedTimer = window.setTimeout(() => this.#syncAddButton(), ADDED_STATE_MS);
  }

  #bindPointerLight(): void {
    this.#add.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'touch' || prefersReducedMotion()) return;
      const bounds = this.#add.getBoundingClientRect();
      this.#add.style.setProperty('--pointer-x', `${event.clientX - bounds.left}px`);
      this.#add.style.setProperty(
        '--icon-x',
        `${(event.clientX - bounds.left - bounds.width / 2) * 0.035}px`,
      );
      this.#add.style.setProperty(
        '--icon-y',
        `${(event.clientY - bounds.top - bounds.height / 2) * 0.12}px`,
      );
    });

    this.#add.addEventListener('pointerleave', () => {
      this.#add.style.setProperty('--icon-x', '0px');
      this.#add.style.setProperty('--icon-y', '0px');
    });
  }
}
