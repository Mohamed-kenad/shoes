import type { Product } from '../data/collection';

export const MOBILE_WALL_URL = '/media/mobile/mobile-wall.webp';
export const MOBILE_LIGHTS_URL = '/media/mobile/mobile-lights.webp';
export const WALL_TEXTURE_URL = '/media/wall/wall-texture.webp';

export type CameraDirection = 'forward' | 'reverse';

const DETAIL_WIDTH_STANDARD = 1376;
const DETAIL_WIDTH_RETINA = 2752;
const detailCache = new Map<string, Promise<HTMLImageElement>>();
const thumbCache = new Map<number, Promise<HTMLImageElement>>();

const pad = (id: number): string => String(id).padStart(2, '0');

export function detailUrl(id: number, width: number): string {
  return `/media/details/detail-${pad(id)}-${width}.webp`;
}

export function thumbUrl(id: number): string {
  return `/media/thumbs/thumb-${pad(id)}.webp`;
}

export function ledUrl(id: number): string {
  return `/media/leds/led-${id}.webp`;
}

export function cameraUrl(id: number, direction: CameraDirection): string {
  return `/media/videos/camera-${pad(id)}-${direction}.mp4`;
}

function preferredDetailWidth(): number {
  return window.innerWidth * window.devicePixelRatio > 1800
    ? DETAIL_WIDTH_RETINA
    : DETAIL_WIDTH_STANDARD;
}

function decodeImage(image: HTMLImageElement): Promise<HTMLImageElement> {
  if (typeof image.decode !== 'function') {
    return new Promise((resolve, reject) => {
      image.addEventListener('load', () => resolve(image), { once: true });
      image.addEventListener('error', () => reject(new Error('Image failed to load')), {
        once: true,
      });
    });
  }
  return image.decode().then(() => image);
}

/** Warms the browser cache for a detail frame without mounting it in the document. */
export function preloadDetail(productId: number): Promise<HTMLImageElement> {
  const url = detailUrl(productId, preferredDetailWidth());
  const cached = detailCache.get(url);
  if (cached) return cached;

  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  const pending = decodeImage(image);
  detailCache.set(url, pending);
  pending.catch(() => detailCache.delete(url));
  return pending;
}

export function preloadThumb(productId: number): Promise<HTMLImageElement> {
  const cached = thumbCache.get(productId);
  if (cached) return cached;

  const image = new Image();
  image.decoding = 'async';
  image.src = thumbUrl(productId);
  const pending = decodeImage(image);
  thumbCache.set(productId, pending);
  pending.catch(() => thumbCache.delete(productId));
  return pending;
}

export function mountDetailImage(container: HTMLElement, product: Product): HTMLImageElement {
  const image = new Image();
  image.src = detailUrl(product.id, preferredDetailWidth());
  image.alt = `Close-up of ${product.name.toLowerCase()}`;
  image.width = DETAIL_WIDTH_STANDARD;
  image.height = 768;
  image.decoding = 'async';
  image.fetchPriority = 'high';
  image.draggable = false;
  container.replaceChildren(image);
  return image;
}

function setCameraSource(video: HTMLVideoElement, src: string): void {
  if (video.getAttribute('src') === src) return;
  video.src = src;
  video.dataset.source = src;
  video.preload = 'auto';
  video.load();
}

export function primeCamera(video: HTMLVideoElement, src: string): void {
  if (video.getAttribute('src') === src) {
    if (video.readyState === HTMLMediaElement.HAVE_NOTHING) video.load();
    return;
  }
  setCameraSource(video, src);
}

interface WaitOptions {
  readonly timeoutMs: number;
  readonly signal?: AbortSignal | undefined;
}

function waitForEvent(
  target: EventTarget,
  events: readonly string[],
  { timeoutMs, signal }: WaitOptions,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Camera transition cancelled', 'AbortError'));
      return;
    }

    let settled = false;
    const cleanup = (): void => {
      for (const event of events) target.removeEventListener(event, settle);
      target.removeEventListener('error', fail);
      window.clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    };
    const settle = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const fail = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Video failed to load'));
    };
    const abort = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new DOMException('Camera transition cancelled', 'AbortError'));
    };

    const timer = window.setTimeout(fail, timeoutMs);
    for (const event of events) target.addEventListener(event, settle, { once: true });
    target.addEventListener('error', fail, { once: true });
    signal?.addEventListener('abort', abort, { once: true });
  });
}

function waitForFirstFrame(video: HTMLVideoElement): Promise<void> {
  const withFrameCallback = video as HTMLVideoElement & {
    requestVideoFrameCallback?: (callback: () => void) => number;
  };

  if (typeof withFrameCallback.requestVideoFrameCallback === 'function') {
    return new Promise((resolve) => {
      withFrameCallback.requestVideoFrameCallback?.(() => resolve());
    });
  }

  return new Promise((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
  });
}

/**
 * Plays one authored camera move from its first frame to its last. The caller
 * controls the overlay visibility; this function only owns media readiness.
 */
export async function playCamera(
  video: HTMLVideoElement,
  src: string,
  options: { readonly signal?: AbortSignal; readonly onFirstFrame?: () => void } = {},
): Promise<void> {
  const { signal, onFirstFrame } = options;
  primeCamera(video, src);

  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    await waitForEvent(video, ['loadeddata', 'canplay'], { timeoutMs: 5000, signal });
  }

  video.pause();
  video.currentTime = 0;

  const ended = waitForEvent(video, ['ended'], { timeoutMs: 6000, signal });
  await video.play();
  await waitForFirstFrame(video);
  onFirstFrame?.();
  await ended;
}

export function resetCamera(video: HTMLVideoElement): void {
  video.pause();
  video.classList.remove('is-active');
  video.hidden = true;
  try {
    video.currentTime = 0;
  } catch {
    // A source that has not loaded yet may reject a seek; that is harmless.
  }
}
