import * as THREE from 'three'
import { GreenTerrain } from '../../domain/physics/GreenTerrain'

/** Minimal dynamic square border that follows the generated terrain size. */
export class CourseBoundaryRenderer {
  private readonly terrain: GreenTerrain
  private readonly geometry = new THREE.BufferGeometry()
  private readonly material = new THREE.LineBasicMaterial({ color: 0xf4f4f4 })
  private readonly line = new THREE.LineSegments(this.geometry, this.material)

  constructor(terrain: GreenTerrain) {
    this.terrain = terrain
    this.line.name = 'course-boundary'
    this.updateFromTerrain()
  }

  getObject3D(): THREE.LineSegments {
    return this.line
  }

  updateFromTerrain(): void {
    const halfSize = this.getVisibleHalfSize()
    const lift = 0.12
    const corners = [
      new THREE.Vector3(-halfSize, this.terrain.getHeightAt(-halfSize, -halfSize) + lift, -halfSize),
      new THREE.Vector3(halfSize, this.terrain.getHeightAt(halfSize, -halfSize) + lift, -halfSize),
      new THREE.Vector3(halfSize, this.terrain.getHeightAt(halfSize, halfSize) + lift, halfSize),
      new THREE.Vector3(-halfSize, this.terrain.getHeightAt(-halfSize, halfSize) + lift, halfSize),
    ]

    const vertices = new Float32Array([
      corners[0].x,
      corners[0].y,
      corners[0].z,
      corners[1].x,
      corners[1].y,
      corners[1].z,
      corners[1].x,
      corners[1].y,
      corners[1].z,
      corners[2].x,
      corners[2].y,
      corners[2].z,
      corners[2].x,
      corners[2].y,
      corners[2].z,
      corners[3].x,
      corners[3].y,
      corners[3].z,
      corners[3].x,
      corners[3].y,
      corners[3].z,
      corners[0].x,
      corners[0].y,
      corners[0].z,
    ])

    this.geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
    this.geometry.computeBoundingSphere()
  }

  getPhysicsHalfSize(): number {
    return this.getVisibleHalfSize()
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }

  private getVisibleHalfSize(): number {
    return Math.max(0, this.terrain.getSize() / 2 - this.terrain.getCellSize())
  }
}
