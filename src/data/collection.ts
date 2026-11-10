export interface Product {
  readonly id: number;
  readonly name: string;
  readonly color: string;
  readonly description: string;
  readonly details: string;
  /** Price in whole euros. The collection intentionally uses display prices without cents. */
  readonly price: number;
  readonly currency: 'EUR';
  readonly sizes: readonly number[];
}

export interface HotspotZone {
  readonly n: number;
  /** [left, top, width, height] as fractions of the wall artwork. */
  readonly led: readonly [number, number, number, number];
  readonly hit: readonly [number, number, number, number];
}

const SIZES = [
  36, 36.5, 37.5, 38, 38.5, 39, 40, 40.5, 41, 42, 42.5, 43, 44, 44.5, 45, 45.5, 46, 47, 47.5,
] as const;

const CATALOG = [
  {
    name: 'FOUNDRY 01',
    color: 'Peach orange',
    description: 'Sculpted lines. A translucent amber sole.',
    details: 'Horizontal overlays, tonal laces and three transparent supports.',
    price: 175,
  },
  {
    name: 'YARD 02',
    color: 'Forest / Bone',
    description: 'A high collar with a distinctive buckle closure.',
    details: 'Light contrast panels, a padded collar and a straight sole profile.',
    price: 160,
  },
  {
    name: 'HANGAR 03',
    color: 'Cobalt / White',
    description: 'Padded panels with a clear blue sole.',
    details: 'Cobalt laces, light woven panels and a white toe.',
    price: 185,
  },
  {
    name: 'TIER 04',
    color: 'Lilac / Cream',
    description: 'Soft volumes. A layered silhouette.',
    details: 'A mid-cut collar, overlapping panels and twin pull tabs.',
    price: 165,
  },
  {
    name: 'ESCARP 05',
    color: 'Graphite / Olive',
    description: 'A rugged profile, finished with orange laces.',
    details: 'A protected toe and a deeply sculpted outsole.',
    price: 155,
  },
  {
    name: 'INDEX 06',
    color: 'Sand / Burgundy',
    description: 'A low profile with diagonal panelling.',
    details: 'A soft-touch finish and a speckled sole.',
    price: 125,
  },
  {
    name: 'FRAME 07',
    color: 'Graphite / Cobalt',
    description: 'An enveloping collar. A sharp flash of blue.',
    details: 'A high-cut profile and a flat gum-coloured sole.',
    price: 170,
  },
  {
    name: 'FORM 08',
    color: 'Pearl / Silver',
    description: 'Continuous knit over a clear amber sole.',
    details: 'A silver heel and one uninterrupted translucent sole chamber.',
    price: 165,
  },
  {
    name: 'PLINTH 09',
    color: 'White / Terracotta',
    description: 'Clean lines, grounded in terracotta.',
    details: 'A low-cut shape, white laces and a stitched toe.',
    price: 120,
  },
  {
    name: 'GRADE 10',
    color: 'Coral / Blue / Lime',
    description: 'A woven upper on a sculpted foundation.',
    details: 'A stretch collar and vertical grooves along the sole.',
    price: 150,
  },
] as const;

export const PRODUCTS: readonly Product[] = Object.freeze(
  CATALOG.map((item, index) =>
    Object.freeze({
      id: index + 1,
      ...item,
      currency: 'EUR' as const,
      sizes: SIZES,
    }),
  ),
);

export const PRODUCTS_BY_ID: ReadonlyMap<number, Product> = new Map(
  PRODUCTS.map((product) => [product.id, product]),
);

/**
 * Hotspots and shelf lights are authored against the 5504 × 3072 master
 * artwork (43:24). The delivered wall is a resize of the same frame, so the
 * fractions remain exact at every width.
 */
export const HOTSPOTS: readonly HotspotZone[] = Object.freeze([
  {
    n: 1,
    led: [0.01875, 0.3498950315, 0.219921875, 0.1693491952],
    hit: [0.04375, 0.2597620714, 0.17, 0.1657102869],
  },
  {
    n: 2,
    led: [0.2109375, 0.3498950315, 0.211328125, 0.1693491952],
    hit: [0.23625, 0.2597620714, 0.16125, 0.1657102869],
  },
  {
    n: 3,
    led: [0.4046875, 0.3498950315, 0.20390625, 0.1693491952],
    hit: [0.43, 0.2597620714, 0.15375, 0.1657102869],
  },
  {
    n: 4,
    led: [0.590625, 0.3498950315, 0.209375, 0.1693491952],
    hit: [0.615625, 0.2597620714, 0.159375, 0.1657102869],
  },
  {
    n: 5,
    led: [0.775, 0.3498950315, 0.21875, 0.1693491952],
    hit: [0.8, 0.2597620714, 0.16875, 0.1657102869],
  },
  {
    n: 6,
    led: [0.01875, 0.6829951015, 0.219921875, 0.177746676],
    hit: [0.04375, 0.6046186144, 0.17, 0.1623512946],
  },
  {
    n: 7,
    led: [0.2109375, 0.6829951015, 0.211328125, 0.177746676],
    hit: [0.23625, 0.6046186144, 0.16125, 0.1623512946],
  },
  {
    n: 8,
    led: [0.4046875, 0.6829951015, 0.20390625, 0.177746676],
    hit: [0.43, 0.6046186144, 0.15375, 0.1623512946],
  },
  {
    n: 9,
    led: [0.590625, 0.6829951015, 0.209375, 0.177746676],
    hit: [0.615625, 0.6046186144, 0.159375, 0.1623512946],
  },
  {
    n: 10,
    led: [0.775, 0.6829951015, 0.21875, 0.177746676],
    hit: [0.8, 0.6046186144, 0.16875, 0.1623512946],
  },
]);

const LABEL_X = [0.129, 0.317, 0.5069, 0.6949, 0.8837] as const;

export function labelPosition(productId: number): { left: string; top: string } {
  const index = productId - 1;
  return {
    left: `${((LABEL_X[index % 5] ?? 0.5) * 100).toFixed(3)}%`,
    top: index < 5 ? '46.7%' : '80.8%',
  };
}
