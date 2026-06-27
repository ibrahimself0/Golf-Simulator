/**
 * ============================================================================
 * LAYER 3: ABSTRACT BASE PHYSICS OBJECT
 * ============================================================================
 *
 * All objects that participate in physics simulation inherit from this class.
 * Currently used by: Ball, Green terrain (future: obstacles, clubs, etc.)
 *
 * Benefits:
 * - Physics engine can treat all objects uniformly
 * - Easy to add new physics objects without changing engine code
 * - Enforces that all physics objects can be stepped through time
 * - Separates physics calculation from rendering
 *
 * Example:
 *   class BallPhysics extends BasePhysicsObject {
 *     update(deltaTime) { ... }
 *     getPosition() { ... }
 *   }
 *
 * Subclasses must implement:
 * - update(): Step this object's physics by deltaTime seconds
 * - getPosition(): Return current 3D position
 * - getVelocity(): Return current 3D velocity (for next layer)
 * - isActive(): Is this object still simulating? (ball moving, etc.)
 */

import * as THREE from 'three';

export abstract class BasePhysicsObject {
  /**
   * Unique identifier for this physics object.
   * Useful for tracking which object is which in collision detection.
   */
  protected id: string;

  /**
   * Current world position of this object.
   * MUST be updated during update().
   */
  protected position: THREE.Vector3 = new THREE.Vector3();

  /**
   * Current velocity of this object (units per second).
   * Used for physics calculations and rendering.
   */
  protected velocity: THREE.Vector3 = new THREE.Vector3();

  /**
   * Is this object currently active (needs updating)?
   * For example: ball is active while rolling, inactive when at rest.
   */
  protected _isActive: boolean = true;

  constructor(id: string, initialPosition: THREE.Vector3) {
    this.id = id;
    this.position = initialPosition.clone();
  }

  /**
   * Step the physics forward by deltaTime seconds.
   * This is where forces (gravity, friction, drag) are applied.
   *
   * @param deltaTime - Time elapsed since last update (in seconds)
   */
  abstract update(deltaTime: number): void;

  /**
   * Get the current world position of this object.
   * Used by rendering layer to update mesh position.
   *
   * @returns Copy of current position (safe to modify)
   */
  abstract getPosition(): THREE.Vector3;

  /**
   * Get the current velocity of this object.
   * Used for physics calculations and collision detection.
   *
   * @returns Copy of current velocity (safe to modify)
   */
  abstract getVelocity(): THREE.Vector3;

  /**
   * Get the current rotation/spin of this object.
   * For ball: applies backspin, topspin effects.
   * Can be used for visual rotation in rendering layer.
   *
   * @returns Euler angles in radians
   */
  getRotation(): THREE.Euler {
    return new THREE.Euler();
  }

  /**
   * Is this object still actively simulating?
   * True = object needs update() called each frame
   * False = object can be skipped (optimization)
   *
   * Examples:
   * - Ball moving? active = true
   * - Ball stopped on green? active = false
   * - Grass blowing in wind? could be false (static)
   *
   * @returns true if object needs updating
   */
  abstract isActive(): boolean;

  /**
   * Get this object's unique ID.
   */
  getId(): string {
    return this.id;
  }

  /**
   * Set position directly.
   * Used for initialization or teleportation.
   * Does NOT trigger collision detection — do that in update().
   *
   * @param position - New position
   */
  setPosition(position: THREE.Vector3): void {
    this.position.copy(position);
  }

  /**
   * Set velocity directly.
   * Used for initialization or corrections.
   *
   * @param velocity - New velocity
   */
  setVelocity(velocity: THREE.Vector3): void {
    this.velocity.copy(velocity);
  }

  /**
   * Reset this object to a default state.
   * Called when restarting a hole, for example.
   */
  reset(): void {
    this.velocity.set(0, 0, 0);
    this._isActive = true;
  }
}
