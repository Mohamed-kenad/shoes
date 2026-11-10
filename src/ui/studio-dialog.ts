import { required } from '../lib/dom';

interface StudioDialogOptions {
  readonly onExplore: () => void;
}

export class StudioDialog {
  readonly #dialog = required<HTMLDialogElement>('#studio-dialog');
  readonly #closeButton = required<HTMLButtonElement>('#studio-close');
  readonly #explore = required<HTMLButtonElement>('#studio-explore');
  readonly #options: StudioDialogOptions;
  #trigger: HTMLElement | null = null;

  constructor(options: StudioDialogOptions) {
    this.#options = options;
    for (const button of document.querySelectorAll<HTMLElement>('[data-studio-open]')) {
      button.addEventListener('click', () => this.open(button));
    }
    this.#closeButton.addEventListener('click', () => this.close());
    this.#explore.addEventListener('click', () => {
      this.close();
      this.#options.onExplore();
    });
    this.#dialog.addEventListener('click', (event) => this.#onBackdropClick(event));
    this.#dialog.addEventListener('close', () => {
      this.#trigger?.focus({ preventScroll: true });
      this.#trigger = null;
    });
  }

  open(trigger?: HTMLElement): void {
    if (this.#dialog.open) return;
    this.#trigger =
      trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    this.#dialog.showModal();
  }

  close(): void {
    if (this.#dialog.open) this.#dialog.close();
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
}
