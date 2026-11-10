const wholePriceFormatter = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const fractionalPriceFormatter = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const sizeFormatter = new Intl.NumberFormat('en-IE', {
  maximumFractionDigits: 1,
});

export function formatPrice(price: number): string {
  return Number.isInteger(price)
    ? wholePriceFormatter.format(price)
    : fractionalPriceFormatter.format(price);
}

export function formatSize(size: number): string {
  return sizeFormatter.format(size);
}

export function formatBagCount(count: number): string {
  return `(${String(count).padStart(2, '0')})`;
}

export function priceToCents(price: number): number {
  return Math.round(price * 100);
}
