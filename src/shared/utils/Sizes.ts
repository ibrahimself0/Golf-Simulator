/**
 * ============================================================================
 * SHARED: SIZES UTILITY
 * ============================================================================
 *
 * Tracks window/canvas dimensions and provides notifications when they change.
 *
 * Why a separate class?
 * - Centralizes size tracking (DRY principle)
 * - Allows other systems to subscribe to resize events
 * - Handles device pixel ratio for high-DPI displays
 *
 * Usage:
 *   const sizes = new Sizes();
 *   console.log(sizes.width, sizes.height);
 *   sizes.onResize(() => console.log('Window resized!'));
 */

export class Sizes {
  /**
   * Current window width in pixels.
   */
  width: number;

  /**
   * Current window height in pixels.
   */
  height: number;

  /**
   * Device pixel ratio.
   * On high-DPI displays (Retina, etc.), this is > 1.
   * We cap it at 2 for performance.
   */
  pixelRatio: number;

  /**
   * Aspect ratio (width / height).
   * Useful for cameras and viewport calculations.
   */
  aspect: number;

  /**
   * Registered resize callbacks.
   */
  private resizeCallbacks: Array<() => void> = [];

  constructor() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.pixelRatio = Math.min(window.devicePixelRatio, 2);
    this.aspect = this.width / this.height;

    // Listen for window resize
    window.addEventListener('resize', () => this._onResize());
  }

  /**
   * Register a callback to be called when window resizes.
   *
   * @param callback - Called with no arguments when resize happens
   */
  onResize(callback: () => void): void {
    this.resizeCallbacks.push(callback);
  }

  /**
   * Internal resize handler.
   */
  private _onResize(): void {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.pixelRatio = Math.min(window.devicePixelRatio, 2);
    this.aspect = this.width / this.height;

    // Call all registered callbacks
    for (const callback of this.resizeCallbacks) {
      callback();
    }
  }

  /**
   * Cleanup.
   */
  dispose(): void {
    this.resizeCallbacks = [];
  }
}
