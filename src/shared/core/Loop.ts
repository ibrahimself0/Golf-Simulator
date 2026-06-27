/**
 * ============================================================================
 * SHARED: GAME LOOP
 * ============================================================================
 *
 * Wraps requestAnimationFrame to provide a consistent game loop.
 *
 * Features:
 * - Calculates delta time (time since last frame)
 * - Calls registered callbacks with delta time
 * - Can be started/stopped
 * - Tracks frame count and FPS (for debugging)
 */

export class Loop {
  /**
   * Registered frame update callbacks.
   * Each callback is called with (deltaTime) every frame.
   */
  private callbacks: Array<(deltaTime: number) => void> = [];

  /**
   * Current animation frame request ID.
   * Used to cancel the loop with cancelAnimationFrame.
   */
  private rafId: number | null = null;

  /**
   * Timestamp of the last frame.
   * Used to calculate delta time.
   */
  private lastFrameTime: number = 0;

  /**
   * Total frames elapsed since start.
   * Useful for debugging and timing.
   */
  private frameCount: number = 0;

  /**
   * Current frames per second (approximate).
   * Updated every second.
   */
  private fps: number = 0;

  /**
   * Timestamp of the last FPS calculation.
   */
  private lastFpsTime: number = 0;

  /**
   * Register a callback to be called every frame.
   *
   * @param callback - Function called with (deltaTime) every frame
   */
  onTick(callback: (deltaTime: number) => void): void {
    this.callbacks.push(callback);
  }

  /**
   * Start the game loop.
   * Does nothing if already running.
   */
  start(): void {
    if (this.rafId !== null) return; // Already running

    this.lastFrameTime = performance.now();
    this.lastFpsTime = performance.now();
    this._tick();
  }

  /**
   * Stop the game loop.
   */
  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Internal tick function (called by requestAnimationFrame).
   */
  private _tick = (): void => {
    const now = performance.now();
    const deltaTime = (now - this.lastFrameTime) / 1000; // Convert to seconds
    this.lastFrameTime = now;

    // Call all registered callbacks
    for (const callback of this.callbacks) {
      callback(deltaTime);
    }

    // Update FPS counter (approximate, once per second)
    this.frameCount++;
    if (now - this.lastFpsTime > 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsTime = now;
      // Optionally log FPS to console
      // console.log(`FPS: ${this.fps}`);
    }

    // Schedule next frame
    this.rafId = requestAnimationFrame(this._tick);
  };

  /**
   * Get current FPS (approximate).
   * Updated once per second.
   */
  getFPS(): number {
    return this.fps;
  }

  /**
   * Cleanup.
   */
  dispose(): void {
    this.stop();
    this.callbacks = [];
  }
}
