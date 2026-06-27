/**
 * ============================================================================
 * LAYER 1: ABSTRACT BASE UI COMPONENT
 * ============================================================================
 *
 * All UI elements (HUD, menus, etc.) inherit from this class.
 * Enforces a consistent lifecycle: update → render → dispose
 *
 * Benefits:
 * - Consistent initialization, update, and cleanup across all UI
 * - Easy to iterate over all UI elements in the main loop
 * - Prevents memory leaks by enforcing dispose()
 * - Makes it easy to add/remove UI elements dynamically
 *
 * Example:
 *   class PowerMeterUI extends BaseUIComponent {
 *     update(deltaTime) { ... }
 *     render() { ... }
 *     dispose() { ... }
 *   }
 *
 * Subclasses must implement:
 * - update(): Update state and logic for this frame
 * - render(): Draw to the DOM
 * - dispose(): Clean up resources (event listeners, DOM nodes, etc.)
 */

export abstract class BaseUIComponent {
  /**
   * Unique identifier for this UI component.
   * Useful for finding/removing components dynamically.
   */
  protected id: string;

  /**
   * Whether this component is currently visible.
   * Subclasses should respect this flag when rendering.
   */
  protected isVisible: boolean = true;

  constructor(id: string) {
    this.id = id;
  }

  /**
   * Called every frame.
   * Update internal state based on game state.
   * This is where you'd update animation values, timers, etc.
   *
   * @param deltaTime - Time elapsed since last frame (in seconds)
   */
  abstract update(deltaTime: number): void;

  /**
   * Called every frame after update().
   * Sync DOM elements with current state.
   * This is where you'd update text, progress bars, colors, etc.
   *
   * DO NOT update game logic in render() — that's update()'s job.
   */
  abstract render(): void;

  /**
   * Called when this component is destroyed.
   * Clean up: remove event listeners, delete DOM nodes, release resources.
   *
   * This is CRITICAL to prevent memory leaks.
   * If you added an event listener in the constructor, remove it here.
   */
  abstract dispose(): void;

  /**
   * Show this UI component.
   * Subclasses can override for custom show behavior.
   */
  show(): void {
    this.isVisible = true;
  }

  /**
   * Hide this UI component.
   * Subclasses can override for custom hide behavior.
   */
  hide(): void {
    this.isVisible = false;
  }

  /**
   * Get this component's unique ID.
   */
  getId(): string {
    return this.id;
  }
}
