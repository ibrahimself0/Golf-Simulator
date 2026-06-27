/**
 * ============================================================================
 * LAYER 4: RENDERER
 * ============================================================================
 *
 * Sets up and manages the Three.js WebGL renderer.
 *
 * Responsibilities:
 * - Create WebGL renderer
 * - Configure render settings (resolution, anti-aliasing, tone mapping, etc.)
 * - Render each frame
 * - Handle window resizing
 *
 * Does NOT:
 * - Create scene (that's SceneManager)
 * - Create camera (that's CameraSystem)
 * - Calculate physics (that's physics layer)
 */

import * as THREE from 'three';
import { Sizes } from '../shared/utils/Sizes';

export class Renderer {
  /**
   * The Three.js WebGL renderer.
   */
  private instance: THREE.WebGLRenderer;

  /**
   * Reference to sizes utility.
   */
  private sizes: Sizes;

  constructor(canvas: HTMLCanvasElement, sizes: Sizes) {
    this.sizes = sizes;

    // Create renderer
    this.instance = new THREE.WebGLRenderer({
      canvas,
      antialias: true, // Smooth edges
      alpha: false, // Opaque background
      powerPreference: 'high-performance', // Prefer GPU over CPU
    });

    // Configure renderer settings
    this.instance.setSize(sizes.width, sizes.height);
    this.instance.setPixelRatio(Math.min(sizes.pixelRatio, 2)); // Cap at 2x for performance
    this.instance.outputColorSpace = THREE.SRGBColorSpace;

    // Tone mapping for better colors
    this.instance.toneMapping = THREE.ACESFilmicToneMapping;
    this.instance.toneMappingExposure = 1.25;

    // Enable shadows
    this.instance.shadowMap.enabled = true;
    this.instance.shadowMap.type = THREE.PCFShadowMap; // Soft shadows

    // Clear color (fallback if scene doesn't have background)
    this.instance.setClearColor(0x87ceeb);
  }

  /**
   * Render a scene with a camera.
   * Called every frame.
   *
   * @param scene - The THREE.Scene to render
   * @param camera - The THREE.Camera to render with
   */
  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.instance.render(scene, camera);
  }

  /**
   * Update renderer size.
   * Called when window is resized.
   *
   * @param sizes - Updated sizes
   */
  updateSize(sizes: Sizes): void {
    this.instance.setSize(sizes.width, sizes.height);
    this.instance.setPixelRatio(Math.min(sizes.pixelRatio, 2));
  }

  /**
   * Get the renderer instance.
   * Rarely needed, but available for advanced customization.
   */
  getInstance(): THREE.WebGLRenderer {
    return this.instance;
  }

  /**
   * Cleanup resources.
   */
  dispose(): void {
    this.instance.dispose();
  }
}
