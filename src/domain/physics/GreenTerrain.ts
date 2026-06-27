/**
 * Height-field terrain used by the physics simulation.
 *
 * The same continuous height and normal queries are used for collision,
 * bounce and downhill rolling, so the ball reacts consistently to the uneven
 * ground. No rendering objects are created here.
 */

import * as THREE from 'three'
import { Perlin } from '../../shared/utils/Perlin'

export interface GreenTerrainConfig {
  size: number
  resolution: number
  maximumHeight: number
  seed: number
}

const DEFAULT_TERRAIN: Readonly<GreenTerrainConfig> = {
  size: 300,
  resolution: 1080,
  maximumHeight: 5,
  seed: 0,
}

export class GreenTerrain {
  private readonly size: number
  private readonly resolution: number
  private readonly maximumHeight: number
  private readonly heightMap: Float32Array
  private seed: number
  private perlin: Perlin

  constructor(config: Partial<GreenTerrainConfig> = {}) {
    const values = { ...DEFAULT_TERRAIN, ...config }
    if (values.size <= 0 || values.resolution < 2 || values.maximumHeight < 0) {
      throw new Error('Terrain size and resolution must be positive; height cannot be negative')
    }

    this.size = values.size
    this.resolution = Math.floor(values.resolution)
    this.maximumHeight = values.maximumHeight
    this.seed = values.seed
    this.heightMap = new Float32Array(this.resolution * this.resolution)
    this.perlin = new Perlin(this.seed)
    this.generateTerrain()
  }

  /** Generates broad hills with two finer octaves rather than sharp bumps. */
  private generateTerrain(): void {
    const cellSize = this.getCellSize()

    for (let zIndex = 0; zIndex < this.resolution; zIndex++) {
      for (let xIndex = 0; xIndex < this.resolution; xIndex++) {
        const worldX = (xIndex - this.resolution / 2) * cellSize
        const worldZ = (zIndex - this.resolution / 2) * cellSize
        let height = 0
        let amplitude = 1
        let frequency = 1
        let totalAmplitude = 0

        for (let octave = 0; octave < 3; octave++) {
          height +=
            this.perlin.noise(worldX * frequency * 0.02, worldZ * frequency * 0.02) *
            amplitude
          totalAmplitude += amplitude
          amplitude *= 0.5
          frequency *= 2
        }

        this.heightMap[xIndex + zIndex * this.resolution] =
          (height / totalAmplitude) * this.maximumHeight
      }
    }
  }

  /** Smoothly interpolates the four nearest height samples. */
  getHeightAt(x: number, z: number): number {
    const cellSize = this.getCellSize()
    const gridX = (x + this.size / 2) / cellSize
    const gridZ = (z + this.size / 2) / cellSize

    if (
      gridX < 0 ||
      gridX > this.resolution - 1 ||
      gridZ < 0 ||
      gridZ > this.resolution - 1
    ) {
      // Beyond the generated green the course continues as level ground.
      return 0
    }

    const x0 = Math.min(Math.floor(gridX), this.resolution - 2)
    const z0 = Math.min(Math.floor(gridZ), this.resolution - 2)
    const xFraction = gridX - x0
    const zFraction = gridZ - z0
    const h00 = this.heightMap[x0 + z0 * this.resolution]
    const h10 = this.heightMap[x0 + 1 + z0 * this.resolution]
    const h01 = this.heightMap[x0 + (z0 + 1) * this.resolution]
    const h11 = this.heightMap[x0 + 1 + (z0 + 1) * this.resolution]
    const nearHeight = THREE.MathUtils.lerp(h00, h10, xFraction)
    const farHeight = THREE.MathUtils.lerp(h01, h11, xFraction)

    return THREE.MathUtils.lerp(nearHeight, farHeight, zFraction)
  }

  /** Returns an upward unit normal calculated from the local height gradient. */
  getSurfaceNormalAt(x: number, z: number): THREE.Vector3 {
    if (!this.isOnGeneratedTerrain(x, z)) {
      return new THREE.Vector3(0, 1, 0)
    }

    const sampleDistance = this.getCellSize() * 0.5
    const minimum = -this.size / 2
    const maximum = minimum + (this.resolution - 1) * this.getCellSize()
    const leftX = Math.max(minimum, x - sampleDistance)
    const rightX = Math.min(maximum, x + sampleDistance)
    const backZ = Math.max(minimum, z - sampleDistance)
    const frontZ = Math.min(maximum, z + sampleDistance)
    const heightChangeX = this.getHeightAt(rightX, z) - this.getHeightAt(leftX, z)
    const heightChangeZ = this.getHeightAt(x, frontZ) - this.getHeightAt(x, backZ)
    const distanceX = Math.max(rightX - leftX, Number.EPSILON)
    const distanceZ = Math.max(frontZ - backZ, Number.EPSILON)

    return new THREE.Vector3(
      -heightChangeX / distanceX,
      1,
      -heightChangeZ / distanceZ
    ).normalize()
  }

  /** Compatibility helper: acceleration caused by gravity along the surface. */
  getSlopeGravity(position: THREE.Vector3): THREE.Vector3 {
    const normal = this.getSurfaceNormalAt(position.x, position.z)
    const gravity = new THREE.Vector3(0, -9.81, 0)
    return gravity.addScaledVector(normal, -gravity.dot(normal))
  }

  getHeightMap(): Float32Array {
    return this.heightMap
  }

  getResolution(): number {
    return this.resolution
  }

  getSize(): number {
    return this.size
  }

  /** Rebuilds the course. Passing a seed makes the result reproducible. */
  regenerate(seed: number = this.seed + 1): void {
    this.seed = seed
    this.perlin = new Perlin(seed)
    this.generateTerrain()
  }

  public getCellSize(): number {
    // This matches the existing terrain renderer's vertex spacing.
    return this.size / this.resolution
  }

  private isOnGeneratedTerrain(x: number, z: number): boolean {
    const minimum = -this.size / 2
    const maximum = minimum + (this.resolution - 1) * this.getCellSize()
    return x >= minimum && x <= maximum && z >= minimum && z <= maximum
  }
}
