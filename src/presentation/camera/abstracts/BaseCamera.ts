/**
 * ============================================================================
 * LAYER 1: ABSTRACT BASE CAMERA
 * ============================================================================
 *
 * All camera controllers (first-person, follow-cam, top-down, etc.)
 * inherit from this class.
 *
 * This is a LAYER 1 camera (handles player input and positioning).
 * Different from the rendering layer camera (which is the actual THREE.Camera).
 *
 * Benefits:
 * - Can switch between different camera types at runtime
 * - Each camera type encapsulates its own input handling and logic
 * - Rendering layer just asks: "where should the camera be?" without caring how
 *
 * Example:
 *   class FirstPersonCamera extends BaseCamera { ... }
 *   class FollowCamera extends BaseCamera { ... }
 *
 * Subclasses must implement:
 * - update(): Update camera position/rotation based on input and game state
 * - getPosition(): Where the camera is in world space
 * - getTarget(): Where the camera is looking (for orthographic: look-ahead point)
 * - getUpVector(): Camera "up" direction (usually (0, 1, 0))
 */

import * as THREE from 'three';

export abstract class BaseCamera {
  /**
   * Current camera position in world space.
   */
  protected position: THREE.Vector3;

  /**
   * Point the camera is looking at (or towards).
   */
  protected target: THREE.Vector3;

  /**
   * World up direction (usually (0, 1, 0)).
   */
  protected up: THREE.Vector3;

  /**
   * Field of view in degrees (for perspective cameras).
   */
  protected fov: number = 60;

  constructor(
    position: THREE.Vector3 = new THREE.Vector3(0, 2, 5),
    target: THREE.Vector3 = new THREE.Vector3(0, 0, 0),
  ) {
    this.position = position.clone();
    this.target = target.clone();
    this.up = new THREE.Vector3(0, 1, 0);
  }

  /**
   * Called every frame.
   * Update camera position and rotation based on:
   * - Player input (mouse, keyboard)
   * - Game state (ball position for follow-cam)
   * - Time (smooth animations, orbiting, etc.)
   *
   * @param deltaTime - Time since last frame (seconds)
   * @param gameState - Current game state (optional, subclass uses as needed)
   */
  abstract update(deltaTime: number, gameState?: any): void;

  /**
   * Get camera position in world space.
   * Used by rendering layer to set THREE.Camera.position.
   *
   * @returns Copy of current position
   */
  abstract getPosition(): THREE.Vector3;

  /**
   * Get camera target/look-at point.
   * For first-person: returns a point in front of the player.
   * For follow: returns the ball position.
   * For orbital: returns the center of orbit.
   *
   * @returns Copy of target position
   */
  abstract getTarget(): THREE.Vector3;

  /**
   * Get camera up vector.
   * Usually (0, 1, 0) but can change for tilted cameras or spinning effects.
   *
   * @returns Copy of up vector
   */
  getUpVector(): THREE.Vector3 {
    return this.up.clone();
  }

  /**
   * Get field of view (for perspective cameras).
   *
   * @returns FOV in degrees
   */
  getFOV(): number {
    return this.fov;
  }

  /**
   * Handle input event (keyboard, mouse, etc.).
   * Subclasses override this to respond to specific inputs.
   *
   * @param event - Input event (key pressed, mouse moved, etc.)
   */
  onInput(_event: KeyboardEvent | MouseEvent | any): void {
    // Default: do nothing. Subclasses override.
  }

  /**
   * Reset camera to default position and rotation.
   * Called when restarting or switching camera modes.
   */
  abstract reset(): void;
}
