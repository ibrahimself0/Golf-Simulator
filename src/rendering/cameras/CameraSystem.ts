/**
 * ============================================================================
 * LAYER 4: CAMERA SYSTEM
 * ============================================================================
 *
 * Manages the Three.js camera (the actual camera that renders).
 *
 * This is DIFFERENT from Layer 1's CameraController:
 * - CameraController (L1): Handles player input and calculates where camera should be
 * - CameraSystem (L4): Sets up the actual THREE.Camera and keeps it in sync
 *
 * Analogy:
 * - CameraController is like the camera operator (decides positioning)
 * - CameraSystem is like the film camera itself (applies the positioning)
 *
 * Key difference:
 * - CameraController: "Based on input, the camera should be at (x,y,z) looking at (tx,ty,tz)"
 * - CameraSystem: "Set the THREE.Camera to that position and rotation"
 */

import * as THREE from 'three';
import { BaseCamera } from '../../presentation/camera/abstracts/BaseCamera';

export class CameraSystem {
  /**
   * The actual Three.js perspective camera.
   * This is what the renderer uses.
   */
  private camera: THREE.PerspectiveCamera;

  /**
   * Reference to the Layer 1 camera controller.
   * We read position/target from this each frame.
   */
  private cameraController: BaseCamera;

  /**
   * Current aspect ratio.
   */
  private aspectRatio: number;

  /**
   * Field of view in degrees.
   */
  private fov: number = 60;

  /**
   * Near clipping plane.
   * Objects closer than this won't be rendered (optimization and Z-fighting prevention).
   */
  private near: number = 0.1;

  /**
   * Far clipping plane.
   * Objects farther than this won't be rendered.
   */
  private far: number = 1000;

  constructor(aspectRatio: number, cameraController: BaseCamera) {
    this.aspectRatio = aspectRatio;
    this.cameraController = cameraController;

    // Create Three.js perspective camera
    this.camera = new THREE.PerspectiveCamera(this.fov, aspectRatio, this.near, this.far);

    // Initialize position
    this.update(cameraController.getPosition(), cameraController.getTarget());
  }

  /**
   * Update camera position and rotation.
   * Should be called every frame to keep the Three.js camera in sync with the controller.
   *
   * @param position - Camera position (from controller)
   * @param target - Look-at target (from controller)
   */
  update(position: THREE.Vector3, target: THREE.Vector3): void {
    this.camera.position.copy(position);
    this.camera.lookAt(target);
  }

  /**
   * Update aspect ratio (called on window resize).
   *
   * @param aspectRatio - New width/height ratio
   */
  updateAspect(aspectRatio: number): void {
    this.aspectRatio = aspectRatio;
    this.camera.aspect = aspectRatio;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Get the Three.js camera.
   * Used by Renderer to render the scene.
   */
  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  /**
   * Set field of view.
   */
  setFOV(fov: number): void {
    this.fov = fov;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Get field of view.
   */
  getFOV(): number {
    return this.fov;
  }

  /**
   * Set clipping planes.
   */
  setClippingPlanes(near: number, far: number): void {
    this.near = near;
    this.far = far;
    this.camera.near = near;
    this.camera.far = far;
    this.camera.updateProjectionMatrix();
  }
}
