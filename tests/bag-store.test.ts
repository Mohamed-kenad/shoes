import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PRODUCTS, PRODUCTS_BY_ID } from '../src/data/collection';
import {
  BAG_STORAGE_KEY,
  BagStore,
  readStoredBag,
  type StorageLike,
  sanitizeBag,
} from '../src/lib/bag-store';

const FIRST = PRODUCTS[0];
const SECOND = PRODUCTS[1];

if (!FIRST || !SECOND) throw new Error('The test catalogue must contain two products');

const FIRST_SIZE = FIRST.sizes[0] ?? 36;
const FIRST_ALT_SIZE = FIRST.sizes[1] ?? 36.5;
const SECOND_SIZE = SECOND.sizes[0] ?? 36;

function memoryStorage(initial?: string): StorageLike & { readonly values: Map<string, string> } {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(BAG_STORAGE_KEY, initial);
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe('sanitizeBag', () => {
  it('returns an empty list for non-array input', () => {
    expect(sanitizeBag(null, PRODUCTS_BY_ID)).toEqual([]);
    expect(sanitizeBag({ id: 1 }, PRODUCTS_BY_ID)).toEqual([]);
  });

  it('drops unknown products, invalid sizes and malformed quantities', () => {
    const lines = sanitizeBag(
      [
        { id: 999, size: 40, quantity: 1 },
        { id: FIRST.id, size: 99, quantity: 1 },
        { id: FIRST.id, size: FIRST_SIZE, quantity: 0 },
        { id: FIRST.id, size: FIRST_SIZE, quantity: 100 },
        { id: FIRST.id, size: FIRST_SIZE, quantity: 1.5 },
        { id: FIRST.id, size: FIRST_SIZE, quantity: '1' },
        'not-a-line',
      ],
      PRODUCTS_BY_ID,
    );

    expect(lines).toEqual([]);
  });

  it('keeps valid lines and merges duplicates up to the quantity ceiling', () => {
    const size = FIRST_SIZE;
    const lines = sanitizeBag(
      [
        { id: FIRST.id, size, quantity: 50 },
        { id: FIRST.id, size, quantity: 60 },
      ],
      PRODUCTS_BY_ID,
    );

    expect(lines).toEqual([{ id: FIRST.id, size, quantity: 99 }]);
    expect(Object.isFrozen(lines)).toBe(true);
    expect(Object.isFrozen(lines[0])).toBe(true);
  });

  it('preserves distinct sizes of the same product', () => {
    const firstSize = FIRST_SIZE;
    const secondSize = FIRST_ALT_SIZE;
    const lines = sanitizeBag(
      [
        { id: FIRST.id, size: firstSize, quantity: 1 },
        { id: FIRST.id, size: secondSize, quantity: 2 },
      ],
      PRODUCTS_BY_ID,
    );

    expect(lines).toHaveLength(2);
  });
});

describe('readStoredBag', () => {
  it('returns an empty list without storage', () => {
    expect(readStoredBag(undefined, PRODUCTS_BY_ID)).toEqual([]);
  });

  it('reads stored, sanitized lines', () => {
    const storage = memoryStorage(
      JSON.stringify([{ id: SECOND.id, size: SECOND_SIZE, quantity: 2 }]),
    );

    expect(readStoredBag(storage, PRODUCTS_BY_ID)).toEqual([
      { id: SECOND.id, size: SECOND_SIZE, quantity: 2 },
    ]);
  });

  it('survives corrupt JSON', () => {
    expect(readStoredBag(memoryStorage('{not json'), PRODUCTS_BY_ID)).toEqual([]);
  });
});

describe('BagStore', () => {
  let storage: ReturnType<typeof memoryStorage>;
  let store: BagStore;

  beforeEach(() => {
    storage = memoryStorage();
    store = new BagStore(PRODUCTS_BY_ID, storage);
  });

  it('adds a valid product and size', () => {
    const size = FIRST_SIZE;
    const result = store.add(FIRST.id, size);

    expect(result).toEqual({ ok: true, quantity: 1 });
    expect(store.snapshot).toEqual({
      lines: [{ id: FIRST.id, size, quantity: 1 }],
      count: 1,
      subtotalCents: FIRST.price * 100,
    });
  });

  it('rejects invalid product ids and sizes', () => {
    expect(store.add(999, 40)).toEqual({ ok: false });
    expect(store.add(FIRST.id, 99)).toEqual({ ok: false });
    expect(store.add(FIRST.id, FIRST_SIZE, 0)).toEqual({ ok: false });
  });

  it('increments an existing line instead of duplicating it', () => {
    const size = FIRST_SIZE;
    store.add(FIRST.id, size);
    store.add(FIRST.id, size, 3);

    expect(store.snapshot.lines).toEqual([{ id: FIRST.id, size, quantity: 4 }]);
    expect(store.snapshot.count).toBe(4);
  });

  it('refuses to grow a line beyond 99 units', () => {
    const size = FIRST_SIZE;
    store.add(FIRST.id, size, 99);

    expect(store.add(FIRST.id, size)).toEqual({ ok: false });
    expect(store.snapshot.lines[0]?.quantity).toBe(99);
  });

  it('changes quantities and removes a line at zero', () => {
    const size = FIRST_SIZE;
    store.add(FIRST.id, size);

    store.setQuantity(FIRST.id, size, 5);
    expect(store.snapshot.lines[0]?.quantity).toBe(5);

    store.setQuantity(FIRST.id, size, 0);
    expect(store.snapshot.lines).toEqual([]);
  });

  it('removes only the matching product and size', () => {
    const firstSize = FIRST_SIZE;
    const secondSize = FIRST_ALT_SIZE;
    store.add(FIRST.id, firstSize);
    store.add(FIRST.id, secondSize);

    store.remove(FIRST.id, firstSize);
    expect(store.snapshot.lines).toEqual([{ id: FIRST.id, size: secondSize, quantity: 1 }]);
  });

  it('persists a stable snapshot to storage', () => {
    const size = FIRST_SIZE;
    store.add(FIRST.id, size);

    expect(storage.values.get(BAG_STORAGE_KEY)).toBe(
      JSON.stringify([{ id: FIRST.id, size, quantity: 1 }]),
    );
    expect(new BagStore(PRODUCTS_BY_ID, storage).snapshot.lines).toEqual([
      { id: FIRST.id, size, quantity: 1 },
    ]);
  });

  it('notifies subscribers and unsubscribes cleanly', () => {
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const size = FIRST_SIZE;

    store.add(FIRST.id, size);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.remove(FIRST.id, size);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps working when storage throws', () => {
    const failing: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const failingStore = new BagStore(PRODUCTS_BY_ID, failing);

    expect(() => failingStore.add(FIRST.id, FIRST_SIZE)).not.toThrow();
    expect(failingStore.snapshot.count).toBe(1);
  });
});
