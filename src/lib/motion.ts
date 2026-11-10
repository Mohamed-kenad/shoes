const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export function prefersReducedMotion(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export interface IdleScheduler {
  request(callback: () => void): void;
  cancel(): void;
}

export function createIdleScheduler(): IdleScheduler {
  let handle: number | undefined;
  const idleWindow = window as unknown as {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };
  return {
    request(callback) {
      this.cancel();
      if (typeof idleWindow.requestIdleCallback === 'function') {
        handle = idleWindow.requestIdleCallback(callback, { timeout: 1500 });
      } else {
        handle = window.setTimeout(callback, 250);
      }
    },
    cancel() {
      if (handle === undefined) return;
      if (typeof idleWindow.cancelIdleCallback === 'function')
        idleWindow.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
      handle = undefined;
    },
  };
}

export async function animate(
  element: Element,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
): Promise<void> {
  const animation = element.animate(keyframes, options);
  try {
    await animation.finished;
  } catch {
    // A cancelled animation is a normal outcome during a fast double interaction.
  } finally {
    animation.cancel();
  }
}
