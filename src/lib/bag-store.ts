import type { Product } from '../data/collection';
import { priceToCents } from './format';

export interface BagLine {
  readonly id: number;
  readonly size: number;
  readonly quantity: number;
}

export interface BagSnapshot {
  readonly lines: readonly BagLine[];
  readonly count: number;
  readonly subtotalCents: number;
}

export type AddResult = { readonly ok: true; readonly quantity: number } | { readonly ok: false };

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

type BagListener = () => void;

const MAX_QUANTITY = 99;
export const BAG_STORAGE_KEY = 'last-dept.bag.v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Reads only values that still match the current catalogue. Stale sizes,
 * unknown products and malformed quantities are dropped rather than trusted.
 */
export function sanitizeBag(
  raw: unknown,
  products: ReadonlyMap<number, Product>,
): readonly BagLine[] {
  if (!Array.isArray(raw)) return [];

  const lines: BagLine[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const { id, size, quantity } = item;
    if (!isFiniteInteger(id) || !isFiniteNumber(size) || !isFiniteInteger(quantity)) continue;
    const product = products.get(id);
    if (!product?.sizes.includes(size)) continue;
    if (quantity < 1 || quantity > MAX_QUANTITY) continue;

    const existing = lines.find((line) => line.id === id && line.size === size);
    if (existing) {
      const merged = Math.min(MAX_QUANTITY, existing.quantity + quantity);
      const index = lines.indexOf(existing);
      lines[index] = { id, size, quantity: merged };
    } else {
      lines.push({ id, size, quantity });
    }
  }
  return Object.freeze(lines.map((line) => Object.freeze(line)));
}

export function readStoredBag(
  storage: StorageLike | undefined,
  products: ReadonlyMap<number, Product>,
): readonly BagLine[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(BAG_STORAGE_KEY);
    return raw ? sanitizeBag(JSON.parse(raw) as unknown, products) : [];
  } catch {
    return [];
  }
}

export class BagStore {
  readonly #products: ReadonlyMap<number, Product>;
  readonly #storage: StorageLike | undefined;
  readonly #listeners = new Set<BagListener>();
  #lines: readonly BagLine[];

  constructor(products: ReadonlyMap<number, Product>, storage?: StorageLike) {
    this.#products = products;
    this.#storage = storage;
    this.#lines = readStoredBag(storage, products);
  }

  subscribe(listener: BagListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  get snapshot(): BagSnapshot {
    let count = 0;
    let subtotalCents = 0;
    for (const line of this.#lines) {
      const product = this.#products.get(line.id);
      if (!product) continue;
      count += line.quantity;
      subtotalCents += priceToCents(product.price) * line.quantity;
    }
    return { lines: this.#lines, count, subtotalCents };
  }

  add(productId: number, size: number, quantity = 1): AddResult {
    const product = this.#products.get(productId);
    if (!product?.sizes.includes(size) || quantity < 1) return { ok: false };

    const current = this.#lines.find((line) => line.id === productId && line.size === size);
    if (current && current.quantity >= MAX_QUANTITY) return { ok: false };
    const nextQuantity = Math.min(MAX_QUANTITY, (current?.quantity ?? 0) + quantity);

    this.#lines = current
      ? this.#lines.map((line) =>
          line === current ? Object.freeze({ ...line, quantity: nextQuantity }) : line,
        )
      : Object.freeze([
          ...this.#lines,
          Object.freeze({ id: productId, size, quantity: nextQuantity }),
        ]);

    this.#commit();
    return { ok: true, quantity: nextQuantity };
  }

  setQuantity(productId: number, size: number, quantity: number): void {
    const line = this.#lines.find((entry) => entry.id === productId && entry.size === size);
    if (!line) return;

    if (quantity <= 0) {
      this.remove(productId, size);
      return;
    }

    const next = Math.min(MAX_QUANTITY, Math.max(1, Math.trunc(quantity)));
    this.#lines = this.#lines.map((entry) =>
      entry === line ? Object.freeze({ ...entry, quantity: next }) : entry,
    );
    this.#commit();
  }

  remove(productId: number, size: number): void {
    const next = this.#lines.filter((line) => !(line.id === productId && line.size === size));
    if (next.length === this.#lines.length) return;
    this.#lines = Object.freeze(next);
    this.#commit();
  }

  #commit(): void {
    this.#persist();
    for (const listener of this.#listeners) listener();
  }

  #persist(): void {
    if (!this.#storage) return;
    try {
      this.#storage.setItem(BAG_STORAGE_KEY, JSON.stringify(this.#lines));
    } catch {
      // Private browsing and storage quotas must never break the storefront.
    }
  }
}
