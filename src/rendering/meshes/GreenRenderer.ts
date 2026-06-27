/**
 * ============================================================================
 * LAYER 4: GREEN RENDERER
 * ============================================================================
 *
 * Creates and manages the visual representation of the golf green.
 *
 * This class reads the HEIGHT MAP from GreenTerrain (Layer 3)
 * and creates a Three.js mesh from it.
 *
 * Key insight:
 * - GreenTerrain knows "what the ground is like" (physics)
 * - GreenRenderer knows "how to display it" (graphics)
 * - They're decoupled: could render same terrain with different meshes
 *
 * Optimization notes:
 * - Uses BufferGeometry (GPU-optimized)
 * - Flat shading for grass appearance
 * - Single material for all terrain
 * - Could be further optimized with LOD (level of detail) for large terrains
 */

import * as THREE from 'three';
import { GreenTerrain } from '../../domain/physics/GreenTerrain';

export class GreenRenderer {
  /**
   * The Three.js mesh representing the green.
   */
  private mesh: THREE.Mesh;

  /**
   * Reference to terrain physics (for syncing if terrain changes).
   */
  private terrain: GreenTerrain;

  /**
   * Geometry that gets updated each frame if terrain changes.
   */
  private geometry: THREE.BufferGeometry;

  /**
   * Material for the green.
   * Could be changed for different effects (wet, dry, sand, etc.).
   */
  private material: THREE.MeshPhongMaterial;

  constructor(terrain: GreenTerrain) {
    this.terrain = terrain;

    // Create geometry from terrain height map
    this.geometry = this.createGeometryFromTerrain();

    // Create material — grass-like appearance
    this.material = new THREE.MeshPhongMaterial({
      color: 0x2d5016, // Dark green
      side: THREE.DoubleSide,
      flatShading: false, // Smooth shading looks better for grass
      wireframe: false, // Change to true for debugging
    });

    // Create mesh
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
  }

  /**
   * Create Three.js geometry from terrain height map.
   *
   * This is the core of rendering:
   * 1. Read height map from physics
   * 2. Create vertices for each grid point
   * 3. Create faces connecting the vertices
   * 4. Set normals for proper lighting
   */
  private createGeometryFromTerrain(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();

    const heightMap = this.terrain.getHeightMap();
    const resolution = this.terrain.getResolution();
    const size = this.terrain.getSize();
    const cellSize = size / resolution;

    // --- STEP 1: Create vertices ---
    // One vertex for each grid point in the height map
    const vertices: number[] = [];
    const uvs: number[] = [];

    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        // World position
        const x = (i - resolution / 2) * cellSize;
        const z = (j - resolution / 2) * cellSize;
        const y = heightMap[i + j * resolution];

        vertices.push(x, y, z);

        // UV coordinates for texturing (future enhancement)
        const u = i / (resolution - 1);
        const v = j / (resolution - 1);
        uvs.push(u, v);
      }
    }

    // --- STEP 2: Create indices (faces) ---
    // Connect vertices into triangles
    const indices: number[] = [];

    for (let i = 0; i < resolution - 1; i++) {
      for (let j = 0; j < resolution - 1; j++) {
        // Two triangles per grid cell
        const a = i + j * resolution;
        const b = i + 1 + j * resolution;
        const c = i + (j + 1) * resolution;
        const d = i + 1 + (j + 1) * resolution;

        // First triangle
        indices.push(a, b, c);
        // Second triangle
        indices.push(b, d, c);
      }
    }

    // --- STEP 3: Set geometry data ---
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));

    // Compute normals for proper lighting
    geometry.computeVertexNormals();

    return geometry;
  }

  /**
   * Get the Three.js mesh.
   * Called by SceneManager to add it to the scene.
   */
  getMesh(): THREE.Mesh {
    return this.mesh;
  }

  /**
   * Update the green if terrain changes (e.g., player regenerates course).
   * Rebuilds the geometry from scratch.
   */
  updateFromTerrain(): void {
    // Dispose old geometry
    this.geometry.dispose();

    // Create new geometry
    this.geometry = this.createGeometryFromTerrain();
    this.mesh.geometry = this.geometry;
  }

  /**
   * Change the material (e.g., for different terrain types).
   */
  setMaterial(material: THREE.Material): void {
    this.material.dispose();
    this.material = material as THREE.MeshPhongMaterial;
    this.mesh.material = this.material;
  }

  /**
   * Clean up resources.
   */
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}
