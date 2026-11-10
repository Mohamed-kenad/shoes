import type { Product } from '../data/collection';
import type { BagStore } from '../lib/bag-store';
import { create, required } from '../lib/dom';
import { formatBagCount, formatPrice, formatSize } from '../lib/format';
import { thumbUrl } from '../lib/media';

type LineAction = 'decrease' | 'increase' | 'remove';

interface BagDialogOptions {
  readonly store: BagStore;
  readonly products: ReadonlyMap<number, Product>;
  readonly toggle: HTMLButtonElement;
}

function lineMeta(product: Product, size: number): string {
  return `EU ${formatSize(size)} / ${product.color}`;
}

function priceText(price: number): string {
  return formatPrice(price);
}

export class BagDialog {
  readonly #options: BagDialogOptions;
  readonly #dialog = required<HTMLDialogElement>('#bag-dialog');
  readonly #closeButton = required<HTMLButtonElement>('#bag-close');
  readonly #count = required<HTMLElement>('#bag-count');
  readonly #lines = required<HTMLUListElement>('#bag-lines');
  readonly #empty = required<HTMLElement>('#bag-empty');
  readonly #subtotal = required<HTMLElement>('#bag-subtotal');

  constructor(options: BagDialogOptions) {
    this.#options = options;
    this.#closeButton.addEventListener('click', () => this.close());
    this.#lines.addEventListener('click', (event) => this.#onLineClick(event));
    this.#dialog.addEventListener('click', (event) => this.#onBackdropClick(event));
    this.#dialog.addEventListener('close', () => this.#syncClosedState());
    this.#options.store.subscribe(() => {
      this.#renderCount();
      if (this.#dialog.open) this.render();
    });
    this.#renderCount();
  }

  open(): void {
    if (this.#dialog.open) return;
    this.render();
    document.body.classList.add('bag-open');
    this.#options.toggle.setAttribute('aria-expanded', 'true');
    this.#dialog.showModal();
  }

  close(): void {
    if (!this.#dialog.open) return;
    this.#dialog.close();
  }

  toggle(): void {
    if (this.#dialog.open) this.close();
    else this.open();
  }

  render(): void {
    const { lines, count, subtotalCents } = this.#options.store.snapshot;
    this.#lines.replaceChildren();
    this.#empty.hidden = lines.length > 0;
    this.#subtotal.hidden = lines.length === 0;
    this.#subtotal.replaceChildren(
      create('span', undefined, 'Subtotal'),
      create('span', undefined, priceText(subtotalCents / 100)),
    );

    for (const line of lines) {
      const product = this.#options.products.get(line.id);
      if (!product) continue;
      const row = create('li', 'bag-line');
      row.dataset.product = String(line.id);
      row.dataset.size = String(line.size);

      const photo = create('div', 'bag-line-photo');
      const image = document.createElement('img');
      image.src = thumbUrl(product.id);
      image.alt = '';
      image.width = 360;
      image.height = 247;
      image.loading = 'lazy';
      image.decoding = 'async';
      photo.append(image);

      const copy = create('div', 'bag-line-copy');
      copy.append(
        create('p', 'bag-line-name', product.name),
        create('p', 'bag-line-meta', lineMeta(product, line.size)),
        create('p', 'bag-line-price', priceText(product.price)),
      );

      const controls = create('div', 'bag-line-controls');
      const decrease = this.#control(
        'decrease',
        line.id,
        line.size,
        '−',
        `Decrease quantity of ${product.name}, size ${line.size}`,
      );
      const quantity = create('span', 'bag-line-quantity', String(line.quantity));
      const increase = this.#control(
        'increase',
        line.id,
        line.size,
        '+',
        `Increase quantity of ${product.name}, size ${line.size}`,
      );
      const remove = this.#control(
        'remove',
        line.id,
        line.size,
        'Remove',
        `Remove ${product.name}, size ${line.size}`,
      );
      increase.disabled = line.quantity >= 99;
      controls.append(decrease, quantity, increase, remove);
      copy.append(controls);
      row.append(photo, copy);
      this.#lines.append(row);
    }

    this.#renderCount(count);
  }

  #control(
    action: LineAction,
    productId: number,
    size: number,
    text: string,
    label: string,
  ): HTMLButtonElement {
    const button = create('button', action === 'remove' ? 'bag-remove' : 'bag-step', text);
    button.type = 'button';
    button.dataset.action = action;
    button.dataset.product = String(productId);
    button.dataset.size = String(size);
    button.setAttribute('aria-label', label);
    return button;
  }

  #onLineClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest<HTMLButtonElement>('button[data-action]');
    if (!button) return;
    const productId = Number(button.dataset.product);
    const size = Number(button.dataset.size);
    const action = button.dataset.action as LineAction | undefined;
    if (!Number.isInteger(productId) || !Number.isInteger(size) || !action) return;

    const line = this.#options.store.snapshot.lines.find(
      (entry) => entry.id === productId && entry.size === size,
    );
    if (!line) return;

    switch (action) {
      case 'decrease':
        this.#options.store.setQuantity(productId, size, line.quantity - 1);
        break;
      case 'increase':
        this.#options.store.setQuantity(productId, size, line.quantity + 1);
        break;
      case 'remove':
        this.#options.store.remove(productId, size);
        break;
    }

    this.render();
    this.#restoreLineFocus(action, productId, size);
  }

  #restoreLineFocus(action: LineAction, productId: number, size: number): void {
    const selector = `button[data-action="${action}"][data-product="${productId}"][data-size="${size}"]`;
    const replacement = this.#lines.querySelector<HTMLButtonElement>(selector);
    if (replacement) {
      replacement.focus({ preventScroll: true });
      return;
    }
    this.#closeButton.focus({ preventScroll: true });
  }

  #onBackdropClick(event: MouseEvent): void {
    if (event.target !== this.#dialog) return;
    const bounds = this.#dialog.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    ) {
      this.close();
    }
  }

  #renderCount(count = this.#options.store.snapshot.count): void {
    this.#count.textContent = formatBagCount(count);
    this.#options.toggle.setAttribute(
      'aria-label',
      `Bag (${String(count).padStart(2, '0')}), open bag`,
    );
  }

  #syncClosedState(): void {
    document.body.classList.remove('bag-open');
    this.#options.toggle.setAttribute('aria-expanded', 'false');
    this.#options.toggle.focus({ preventScroll: true });
  }
}
