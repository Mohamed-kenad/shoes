import type { Product } from '../data/collection';
import { thumbUrl } from './media';
import { animate } from './motion';

const MOBILE_FLIGHT_EASING = 'cubic-bezier(.32,.05,.2,1)';
const MOBILE_FLIGHT_MS = 520;

export function flyProductToBag(
  product: Product,
  origin: HTMLElement,
  target: HTMLElement,
  reducedMotion: boolean,
): void {
  if (reducedMotion) {
    target.animate([{ opacity: 0.55 }, { opacity: 1 }], { duration: 140 });
    return;
  }

  const start = origin.getBoundingClientRect();
  const end = target.getBoundingClientRect();
  const flight = document.createElement('img');
  flight.src = thumbUrl(product.id);
  flight.alt = '';
  flight.className = 'bag-flight';
  flight.width = 90;
  flight.height = 62;

  Object.assign(flight.style, {
    left: `${start.left + start.width / 2 - 45}px`,
    top: `${start.top + start.height / 2 - 31}px`,
  });
  document.body.append(flight);

  const dx = end.left + end.width / 2 - (start.left + start.width / 2);
  const dy = end.top + end.height / 2 - (start.top + start.height / 2);

  const animation = flight.animate(
    [
      { transform: 'translate(0, 0) scale(.6)', opacity: 0, offset: 0 },
      {
        transform: `translate(${dx * 0.14}px, ${Math.min(-56, dy * 0.18)}px) scale(1)`,
        opacity: 1,
        offset: 0.22,
      },
      {
        transform: `translate(${dx * 0.72}px, ${dy * 0.78 - 32}px) scale(.52)`,
        opacity: 1,
        offset: 0.76,
      },
      { transform: `translate(${dx}px, ${dy}px) scale(.1)`, opacity: 0, offset: 1 },
    ],
    { duration: 680, easing: 'cubic-bezier(.2,.65,.25,1)', fill: 'forwards' },
  );

  animation.finished
    .catch(() => undefined)
    .finally(() => {
      flight.remove();
      target.animate(
        [
          { transform: 'scale(1)' },
          { transform: 'scale(1.12)', color: 'var(--accent)' },
          { transform: 'scale(1)' },
        ],
        { duration: 300, easing: 'ease-out' },
      );
    });
}

function createMobileFlight(productId: number): HTMLDivElement {
  const flight = document.createElement('div');
  flight.className = 'mobile-flight';
  flight.setAttribute('aria-hidden', 'true');
  const index = productId - 1;
  flight.style.setProperty('--col', String(index % 2));
  flight.style.setProperty('--row', String(Math.floor(index / 2)));
  return flight;
}

function setFlightRect(element: HTMLElement, rect: DOMRect): void {
  Object.assign(element.style, {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
}

export async function animateMobileFlight(
  productId: number,
  source: DOMRect,
  target: DOMRect,
  direction: 'open' | 'close',
  reducedMotion: boolean,
): Promise<void> {
  if (reducedMotion || target.width === 0 || source.width === 0) return;

  const flight = createMobileFlight(productId);
  setFlightRect(flight, target);
  document.body.append(flight);

  const scale = source.width / target.width;
  const dx = source.left - target.left;
  const dy = source.top - target.top;
  const from = `translate(${dx}px, ${dy}px) scale(${scale})`;
  const to = 'translate(0, 0) scale(1)';

  await animate(
    flight,
    direction === 'open'
      ? [{ transform: from }, { transform: to }]
      : [{ transform: to }, { transform: from }],
    {
      duration: MOBILE_FLIGHT_MS,
      easing: MOBILE_FLIGHT_EASING,
      fill: 'both',
    },
  );

  flight.remove();
}
