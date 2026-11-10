import {
  HOTSPOTS,
  labelPosition,
  PRODUCTS,
  PRODUCTS_BY_ID,
  type Product,
} from '../data/collection';
import { create } from '../lib/dom';
import { ledUrl } from '../lib/media';

interface WallOptions {
  readonly hotspots: HTMLElement;
  readonly labels: HTMLElement;
  readonly onEnter: (product: Product, trigger: HTMLButtonElement) => void;
  readonly onPreview: (product: Product | null) => void;
}

export class Wall {
  readonly #buttons = new Map<number, HTMLButtonElement>();
  readonly #lights = new Map<number, HTMLImageElement>();
  readonly #labels = new Map<number, HTMLElement>();
  readonly #options: WallOptions;
  #active: number | null = null;

  constructor(options: WallOptions) {
    this.#options = options;
    this.#build();
    this.#bindNavigation();
  }

  get buttons(): ReadonlyMap<number, HTMLButtonElement> {
    return this.#buttons;
  }

  #build(): void {
    for (const zone of HOTSPOTS) {
      const product = PRODUCTS[zone.n - 1];
      if (!product) continue;

      const light = document.createElement('img');
      light.className = 'shelf-light';
      light.alt = '';
      light.width = 563;
      light.height = 242;
      light.decoding = 'async';
      light.dataset.src = ledUrl(product.id);
      light.style.left = `${zone.led[0] * 100}%`;
      light.style.top = `${zone.led[1] * 100}%`;
      light.style.width = `${zone.led[2] * 100}%`;
      light.style.height = `${zone.led[3] * 100}%`;
      this.#options.hotspots.append(light);
      this.#lights.set(product.id, light);

      const button = create('button', 'hotspot');
      button.type = 'button';
      button.dataset.shoe = String(product.id);
      button.setAttribute('aria-label', `Explore ${product.name}`);
      button.style.left = `${zone.hit[0] * 100}%`;
      button.style.top = `${zone.hit[1] * 100}%`;
      button.style.width = `${zone.hit[2] * 100}%`;
      button.style.height = `${zone.hit[3] * 100}%`;
      button.addEventListener('pointerenter', () => this.#preview(product.id));
      button.addEventListener('pointerleave', () => {
        if (this.#active === product.id) this.#clear();
      });
      button.addEventListener('focus', () => this.#preview(product.id));
      button.addEventListener('blur', () => {
        if (this.#active === product.id) this.#clear();
      });
      button.addEventListener('click', () => this.#options.onEnter(product, button));
      this.#options.hotspots.append(button);
      this.#buttons.set(product.id, button);

      const label = create('div', 'holo-name');
      label.dataset.product = String(product.id);
      label.append(
        create('span', 'holo-product', product.name),
        create('span', 'holo-edition', `${String(product.id).padStart(2, '0')} / STUDIO`),
      );
      // The visible label is decorative; the button's accessible name is authoritative.
      label.setAttribute('aria-hidden', 'true');
      const position = labelPosition(product.id);
      label.style.left = position.left;
      label.style.top = position.top;
      this.#options.labels.append(label);
      this.#labels.set(product.id, label);
    }

    this.#options.hotspots.addEventListener('pointerleave', () => this.#clear());
  }

  #preview(productId: number): void {
    if (this.#active === productId) return;
    this.#active = productId;
    for (const [id, button] of this.#buttons) {
      button.classList.toggle('is-lit', id === productId);
    }
    for (const [id, label] of this.#labels) {
      label.classList.toggle('on', id === productId);
    }
    const light = this.#lights.get(productId);
    if (light) {
      if (!light.getAttribute('src')) light.src = light.dataset.src ?? '';
      light.classList.add('on');
    }
    this.#options.onPreview(PRODUCTS_BY_ID.get(productId) ?? null);
  }

  #clear(): void {
    this.#active = null;
    for (const button of this.#buttons.values()) button.classList.remove('is-lit');
    for (const label of this.#labels.values()) label.classList.remove('on');
    for (const light of this.#lights.values()) light.classList.remove('on');
    this.#options.onPreview(null);
  }

  #bindNavigation(): void {
    this.#options.hotspots.addEventListener('keydown', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement) || !target.classList.contains('hotspot')) return;
      const current = Number(target.dataset.shoe);
      if (!Number.isInteger(current)) return;

      const row = Math.floor((current - 1) / 5);
      const column = (current - 1) % 5;
      let next = current;

      switch (event.key) {
        case 'ArrowLeft':
          next = row * 5 + ((column + 4) % 5) + 1;
          break;
        case 'ArrowRight':
          next = row * 5 + ((column + 1) % 5) + 1;
          break;
        case 'ArrowUp':
          next = ((row + 1) % 2) * 5 + column + 1;
          break;
        case 'ArrowDown':
          next = ((row + 1) % 2) * 5 + column + 1;
          break;
        default:
          return;
      }

      event.preventDefault();
      this.#buttons.get(next)?.focus();
    });
  }
}
