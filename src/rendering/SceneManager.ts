/**
 * ============================================================================
 * LAYER 4: SCENE MANAGER
 * ============================================================================
 *
 * Manages the Three.js scene graph.
 * This is essentially a wrapper around THREE.Scene with some conveniences.
 *
 * Responsibilities:
 * - Create and manage the Three.js scene
 * - Add/remove objects from the scene
 * - Setup lights and environment
 * - Manage fog, background, etc.
 *
 * Does NOT:
 * - Render (that's the Renderer's job)
 * - Calculate anything (that's physics layer)
 * - Handle input (that's UI layer)
 */

import * as THREE from 'three';

export class SceneManager {
  /**
   * The Three.js scene object.
   */
  private scene: THREE.Scene

  /**
   * Ambient light (global illumination).
   * Makes sure no part of the scene is completely black.
   */
  private ambientLight!: THREE.AmbientLight

  /**
   * Directional light (like sunlight).
   * Creates shadows and dramatic lighting.
   */
  private directionalLight!: THREE.DirectionalLight

  /**
   * Fog (optional, for atmosphere).
   * Makes distant objects fade out.
   */
  private fog: THREE.Fog | null = null
  private setupSkybox(): void {
    const loader = new THREE.CubeTextureLoader()

    const texture = loader.load([
      '/sky4/px.png',
      '/sky4/nx.png',
      '/sky4/py.png',
      '/sky4/ny.png',
      '/sky4/pz.png',
      '/sky4/nz.png',
    ])

    this.scene.background = texture
  }
  constructor() {
    // Create scene
    this.scene = new THREE.Scene()
    this.setupSkybox()

    this.scene.fog = new THREE.Fog(0x87c0ff, 30, 310)
    // Setup lighting
    this.setupLighting()

    // Optional: Add fog for atmosphere
    // this.setupFog();
  }

  /**
   * Setup lights in the scene.
   */
  private setupLighting(): void {
    // 🌤 very soft ambient (prevents black areas without flattening)
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.35)
    this.scene.add(this.ambientLight)

    // 🌞 sun light (keep it simple)
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.7)
    this.directionalLight.position.set(30, 80, 20)

    this.directionalLight.castShadow = true

    // 📉 medium shadows (not too heavy)
    this.directionalLight.shadow.mapSize.set(1024, 1024)

    const d = 150
    this.directionalLight.shadow.camera.left = -d
    this.directionalLight.shadow.camera.right = d
    this.directionalLight.shadow.camera.top = d
    this.directionalLight.shadow.camera.bottom = -d

    this.directionalLight.shadow.camera.near = 1
    this.directionalLight.shadow.camera.far = 200

    this.scene.add(this.directionalLight)
  }

  /**
   * Setup fog (optional).
   * Uncomment in setupLighting() to enable.
   */
  setupFog(): void {
    // Fog: objects fade to this color at distance
    this.fog = new THREE.Fog(0x87ceeb, 50, 100) // color, near, far
    this.scene.fog = this.fog
  }

  /**
   * Add an object to the scene.
   */
  add(object: THREE.Object3D): void {
    this.scene.add(object)
  }

  /**
   * Remove an object from the scene.
   */
  remove(object: THREE.Object3D): void {
    this.scene.remove(object)
  }

  /**
   * Get the scene object.
   * Used by Renderer to render the scene.
   */
  getScene(): THREE.Scene {
    return this.scene
  }

  /**
   * Set background color.
   */
  setBackgroundColor(color: THREE.ColorRepresentation): void {
    this.scene.background = new THREE.Color(color)
  }

  /**
   * Get directional light (for tweaking shadows, position, etc.).
   */
  getDirectionalLight(): THREE.DirectionalLight {
    return this.directionalLight
  }

  /**
   * Get ambient light.
   */
  getAmbientLight(): THREE.AmbientLight {
    return this.ambientLight
  }

  /**
   * Clear all objects from the scene.
   */
  clear(): void {
    // Remove all children
    while (this.scene.children.length > 0) {
      this.scene.remove(this.scene.children[0])
    }

    // Re-add lights
    this.scene.add(this.ambientLight)
    this.scene.add(this.directionalLight)
  }
}
